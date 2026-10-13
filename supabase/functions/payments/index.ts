// deno-lint-ignore-file no-explicit-any
// J-STORE payments — MTN MoMo (Collections "RequestToPay") + Orange Money (Web Payment).
//
//   POST /initiate        (signed-in buyer)  start a payment for an order group
//   POST /status          (signed-in buyer)  check/finalize a payment (polling)
//   PUT|POST /mtn-callback   (MTN, public)   hint that a payment changed
//   POST /orange-notify      (Orange, public) hint that a payment changed
//
// SECURITY MODEL: callbacks are NOT trusted. They only tell us "go check".
// Every success is re-verified server-side by calling MTN/Orange with OUR
// credentials, and the amount is compared with what we charged. The order is
// only confirmed through confirm_order_group_payment() after that.
//
// PAYMENTS_MODE: "mock" (default, no provider calls — for testing the whole
// flow), "sandbox" (provider test environments), "live" (real money).

import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string, d = "") => Deno.env.get(k) ?? d;

const MODE = env("PAYMENTS_MODE", "mock");
const SUPABASE_URL = env("SUPABASE_URL");
const SITE_URL = env("SITE_URL", "http://localhost:5173").replace(/\/$/, "");
const FN_URL = `${SUPABASE_URL}/functions/v1/payments`;

// Supabase is moving from the legacy service_role key to "secret keys". Use the legacy
// one when present (still injected today), otherwise fall back to the new secret key.
function serviceKey(): string {
  const legacy = env("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    return JSON.parse(env("SUPABASE_SECRET_KEYS", "{}"))["default"] ?? "";
  } catch {
    return "";
  }
}

const admin = createClient(SUPABASE_URL, serviceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, PUT, OPTIONS",
};
// Handled business errors are returned as HTTP 200 + {error} so the browser
// client can show the message (supabase-js hides bodies of non-2xx replies).
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// ── provider config ─────────────────────────────────────────────────────────
const MTN = {
  base: env(
    "MTN_BASE_URL",
    MODE === "live" ? "https://proxy.momoapi.mtn.com" : "https://sandbox.momodeveloper.mtn.com",
  ),
  target: env("MTN_TARGET_ENV", MODE === "live" ? "mtncameroon" : "sandbox"),
  currency: env("MTN_CURRENCY", MODE === "live" ? "XAF" : "EUR"),
  subKey: env("MTN_SUBSCRIPTION_KEY"),
  user: env("MTN_API_USER"),
  key: env("MTN_API_KEY"),
};
const OM = {
  path: env("ORANGE_PATH", MODE === "live" ? "cm" : "dev"),
  currency: env("ORANGE_CURRENCY", MODE === "live" ? "XAF" : "OUV"),
  auth: env("ORANGE_AUTH_HEADER"),
  merchant: env("ORANGE_MERCHANT_KEY"),
};
const OM_BASE = `https://api.orange.com/orange-money-webpay/${OM.path}/v1`;

type Tok = { value: string; exp: number } | null;
let mtnTok: Tok = null;
let omTok: Tok = null;

// ── readable failure messages ───────────────────────────────────────────────
// Providers return codes like PAYER_NOT_FOUND; buyers should see plain language.
const REASONS: Record<string, string> = {
  PAYER_NOT_FOUND: "This number is not a registered MTN MoMo account.",
  NOT_ENOUGH_FUNDS: "Insufficient balance on the MoMo account.",
  PAYER_LIMIT_REACHED: "The MoMo account has reached its transaction limit.",
  APPROVAL_REJECTED: "The payment was declined on the phone.",
  PAYMENT_NOT_APPROVED: "The payment was not approved.",
  EXPIRED: "The payment request expired before it was approved.",
  TRANSACTION_CANCELED: "The payment was cancelled.",
  NOT_ALLOWED: "This account is not allowed to make this payment.",
  SERVICE_UNAVAILABLE: "The provider is temporarily unavailable. Please try again.",
  INTERNAL_PROCESSING_ERROR: "The provider had a problem. Please try again.",
  CANCELLED: "The payment was cancelled.",
  CANCELED: "The payment was cancelled.",
  FAILED: "The payment was not completed.",
};
function friendlyReason(raw: unknown): string | null {
  if (!raw) return null;
  console.error("provider failure reason:", raw); // raw code stays in the function logs
  return REASONS[String(raw).toUpperCase()] ?? "The payment was not completed.";
}

// Provider refused the request itself (e.g. malformed or unknown number) — not our fault, not an outage.
class ProviderRejected extends Error {}

// ── MTN ─────────────────────────────────────────────────────────────────────
async function mtnToken(): Promise<string> {
  if (mtnTok && mtnTok.exp > Date.now() + 30_000) return mtnTok.value;
  const r = await fetch(`${MTN.base}/collection/token/`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${MTN.user}:${MTN.key}`),
      "Ocp-Apim-Subscription-Key": MTN.subKey,
    },
  });
  if (!r.ok) throw new Error(`MTN token failed (${r.status})`);
  const j = await r.json();
  mtnTok = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return mtnTok.value;
}

async function mtnRequestToPay(
  attemptId: string,
  ref: string,
  amount: number,
  msisdn: string,
  note: string,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await mtnToken()}`,
    "X-Reference-Id": ref,
    "X-Target-Environment": MTN.target,
    "Ocp-Apim-Subscription-Key": MTN.subKey,
    "Content-Type": "application/json",
  };
  // Production only: the callback host must be registered with MTN.
  if (MODE === "live") headers["X-Callback-Url"] = `${FN_URL}/mtn-callback`;
  const r = await fetch(`${MTN.base}/collection/v1_0/requesttopay`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      amount: String(amount),
      currency: MTN.currency,
      externalId: attemptId,
      payer: { partyIdType: "MSISDN", partyId: msisdn },
      payerMessage: note,
      payeeNote: note,
    }),
  });
  if (r.status !== 202) {
    console.error("MTN requesttopay rejected", r.status, await r.text());
    // 4xx (except 401/403 = our own credentials) means MTN refused this specific request.
    if (r.status >= 400 && r.status < 500 && r.status !== 401 && r.status !== 403) {
      throw new ProviderRejected(`MTN rejected the request (${r.status})`);
    }
    throw new Error(`MTN rejected the request (${r.status})`);
  }
}

async function mtnStatus(ref: string) {
  const r = await fetch(`${MTN.base}/collection/v1_0/requesttopay/${ref}`, {
    headers: {
      Authorization: `Bearer ${await mtnToken()}`,
      "X-Target-Environment": MTN.target,
      "Ocp-Apim-Subscription-Key": MTN.subKey,
    },
  });
  if (!r.ok) throw new Error(`MTN status failed (${r.status})`);
  const j = await r.json();
  const s = String(j.status ?? "").toUpperCase();
  return {
    state: s === "SUCCESSFUL" ? "success" : s === "FAILED" ? "failed" : "pending",
    txn: j.financialTransactionId ?? null,
    reason: friendlyReason(
      typeof j.reason === "string" ? j.reason : (j.reason?.code ?? j.reason?.message),
    ),
    amount: j.amount != null ? Number(j.amount) : null,
  } as {
    state: "success" | "failed" | "pending";
    txn: string | null;
    reason: string | null;
    amount: number | null;
  };
}

// ── Orange Money ────────────────────────────────────────────────────────────
async function omToken(): Promise<string> {
  if (omTok && omTok.exp > Date.now() + 30_000) return omTok.value;
  const auth = OM.auth.startsWith("Basic ") ? OM.auth : `Basic ${OM.auth}`;
  const r = await fetch("https://api.orange.com/oauth/v3/token", {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error(`Orange token failed (${r.status})`);
  const j = await r.json();
  omTok = { value: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return omTok.value;
}

async function omCreate(orderId: string, amount: number, groupId: string) {
  const r = await fetch(`${OM_BASE}/webpayment`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await omToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      merchant_key: OM.merchant,
      currency: OM.currency,
      order_id: orderId,
      amount,
      return_url: `${SITE_URL}/payment-return?group=${groupId}`,
      cancel_url: `${SITE_URL}/payment-return?group=${groupId}`,
      notif_url: `${FN_URL}/orange-notify`,
      lang: "fr",
      reference: "J-STORE",
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.payment_url) {
    console.error("Orange webpayment rejected", r.status, JSON.stringify(j));
    throw new Error(`Orange rejected the request (${r.status})`);
  }
  return {
    pay_token: j.pay_token as string,
    notif_token: j.notif_token as string,
    payment_url: j.payment_url as string,
  };
}

async function omStatus(orderId: string, amount: number, payToken: string) {
  const r = await fetch(`${OM_BASE}/transactionstatus`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await omToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: orderId, amount, pay_token: payToken }),
  });
  if (!r.ok) throw new Error(`Orange status failed (${r.status})`);
  const j = await r.json();
  const s = String(j.status ?? "").toUpperCase();
  return {
    state:
      s === "SUCCESS"
        ? "success"
        : ["FAILED", "EXPIRED", "CANCELLED", "CANCELED"].includes(s)
          ? "failed"
          : "pending",
    txn: j.txnid ?? null,
    reason: ["FAILED", "EXPIRED", "CANCELLED", "CANCELED"].includes(s) ? friendlyReason(s) : null,
    amount: null as number | null,
  } as {
    state: "success" | "failed" | "pending";
    txn: string | null;
    reason: string | null;
    amount: number | null;
  };
}

// ── core: verify with the provider, then finalize ───────────────────────────
const EXPIRE_AFTER_MS = 15 * 60 * 1000;

// allowClosed: also re-check attempts WE marked "expired" — a buyer can approve a
// prompt late (e.g. after a network crash and retry), and money must not be lost.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkAndFinalize(a: any, opts: { allowClosed?: boolean } = {}): Promise<any> {
  const reopened = opts.allowClosed === true && a.status === "expired";
  if (a.status !== "pending" && !reopened) return a;

  let res: {
    state: "success" | "failed" | "pending";
    txn: string | null;
    reason: string | null;
    amount: number | null;
  } = { state: "pending", txn: null, reason: null, amount: null };
  const ageMs = Date.now() - new Date(a.created_at).getTime();

  try {
    if (a.provider === "mock") {
      // Test mode: succeeds ~6s after start; a number ending in 0000 simulates a decline.
      if (ageMs >= 6000) {
        res = String(a.payer_phone ?? "").endsWith("0000")
          ? { state: "failed", txn: null, reason: "Payment declined (test)", amount: null }
          : {
              state: "success",
              txn: "MOCK-" + a.id.slice(0, 8),
              reason: null,
              amount: Number(a.amount),
            };
      }
    } else if (a.provider === "mtn") {
      res = await mtnStatus(a.provider_reference);
    } else if (a.provider === "orange") {
      res = await omStatus(a.provider_reference, Number(a.amount), a.pay_token);
    }
  } catch (e) {
    console.error("provider status check failed (will retry)", e);
    return a; // transient — stay as is, the next check retries
  }

  // Never confirm an order if the provider reports a different amount than we charged.
  if (res.state === "success" && res.amount != null && res.amount !== Number(a.amount)) {
    console.error("AMOUNT MISMATCH", a.id, res.amount, a.amount);
    res = { state: "failed", txn: res.txn, reason: "Amount mismatch", amount: res.amount };
  }

  let expired = false;
  if (res.state === "pending" && !reopened && ageMs > EXPIRE_AFTER_MS) {
    res = { state: "failed", txn: null, reason: "Payment request expired", amount: null };
    expired = true;
  }
  if (res.state === "pending") return a;
  if (reopened && res.state !== "success") return a; // an expired attempt only changes if it really succeeded

  let needsReview = false;
  let reviewNote: string | null = null;

  if (res.state === "success") {
    const { data: g } = await admin
      .from("order_groups")
      .select("payment_status")
      .eq("id", a.order_group_id)
      .maybeSingle();
    const gs = g?.payment_status;

    if (gs === "held_in_escrow" || gs === "released") {
      // Already paid. The same attempt finishing twice (callback + polling race) is fine;
      // a DIFFERENT attempt succeeding means the buyer paid twice.
      const { data: cur } = await admin
        .from("payment_attempts")
        .select("status")
        .eq("id", a.id)
        .maybeSingle();
      if (cur?.status === "successful") return { ...a, status: "successful" };
      needsReview = true;
      reviewNote =
        "DUPLICATE PAYMENT: this order was already paid. Refund this transaction through the provider.";
    } else if (gs === "failed") {
      needsReview = true;
      reviewNote =
        "LATE PAYMENT: money arrived after the order was cancelled. Refund it, or recreate the order for the buyer.";
    } else {
      const { error } = await admin.rpc("confirm_order_group_payment", {
        p_group: a.order_group_id,
        p_provider_txn: res.txn,
      });
      if (error) {
        console.error("confirm_order_group_payment failed (will retry)", error);
        return a; // money received but not recorded yet — stays pending so the next check retries
      }
    }
  }

  const status = res.state === "success" ? "successful" : expired ? "expired" : "failed";
  await admin
    .from("payment_attempts")
    .update({
      status,
      provider_txn_id: res.txn,
      failure_reason: res.state === "success" ? null : res.reason,
      needs_review: needsReview,
      review_note: reviewNote,
      updated_at: new Date().toISOString(),
    })
    .eq("id", a.id)
    .in("status", ["pending", "expired"]);
  return { ...a, status, provider_txn_id: res.txn, failure_reason: res.reason };
}

// Scheduled every few minutes (see supabase/scheduled_reconcile.sql). Catches payments
// whose callback was lost and buyers who never came back to the site.
async function reconcile() {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  let checked = 0;
  let confirmed = 0;

  const { data: pending } = await admin
    .from("payment_attempts")
    .select("*")
    .eq("status", "pending")
    .gte("created_at", ago(24 * 3600 * 1000))
    .order("created_at")
    .limit(100);
  for (const a of pending ?? []) {
    const r = await checkAndFinalize(a);
    checked++;
    if (r.status === "successful") confirmed++;
  }

  const { data: recentlyExpired } = await admin
    .from("payment_attempts")
    .select("*")
    .eq("status", "expired")
    .gte("updated_at", ago(2 * 3600 * 1000))
    .limit(100);
  for (const a of recentlyExpired ?? []) {
    const r = await checkAndFinalize(a, { allowClosed: true });
    checked++;
    if (r.status === "successful") confirmed++;
  }

  const { data: cancelled } = await admin.rpc("cancel_unpaid_order_groups", { p_limit: 50 });
  return { checked, confirmed, cancelled: cancelled ?? 0 };
}

// ── helpers ─────────────────────────────────────────────────────────────────
function toMsisdn(raw: string): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (MODE !== "live") return d.length >= 8 ? d : null; // sandbox uses MTN's own test numbers
  if (/^6\d{8}$/.test(d)) return "237" + d;
  if (/^2376\d{8}$/.test(d)) return d;
  return null;
}

async function authUser(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : data.user;
}

async function loadGroup(id: string, userId: string) {
  const { data } = await admin
    .from("order_groups")
    .select("id, buyer_id, total, payment_status, payment_method, group_number")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.buyer_id !== userId) return null;
  return data;
}

// ── handlers ────────────────────────────────────────────────────────────────
async function initiate(user: any, body: any) {
  const provider = body?.provider;
  if (provider !== "mtn" && provider !== "orange")
    return { error: "Choose MTN MoMo or Orange Money." };

  const group = await loadGroup(String(body?.order_group_id ?? ""), user.id);
  if (!group) return { error: "Order not found." };
  if (group.payment_status !== "pending") return { error: "This order is already paid." };
  const expectedProvider = group.payment_method === "mtn_momo" ? "mtn" : "orange";
  if (provider !== expectedProvider)
    return { error: `This order was created for ${expectedProvider === "mtn" ? "MTN MoMo" : "Orange Money"}.` };

  // The charged amount ALWAYS comes from the database, never from the browser.
  const amount = Math.round(Number(group.total));
  if (!(amount > 0)) return { error: "Invalid order total." };

  let msisdn: string | null = null;
  if (provider === "mtn") {
    msisdn = toMsisdn(body?.phone);
    if (!msisdn) return { error: "Enter a valid MTN number (6XX XXX XXX)." };
  }

  // Avoid double prompts: a recent pending attempt blocks a new one.
  const since = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const { data: recent } = await admin
    .from("payment_attempts")
    .select("*")
    .eq("order_group_id", group.id)
    .eq("status", "pending")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);
  if (recent && recent.length > 0) {
    const r = recent[0];
    if (r.provider === provider && r.payment_url)
      return { status: "pending", payment_url: r.payment_url };
    if (r.provider === provider) return { status: "pending" }; // MTN prompt already on the phone
    return {
      error: "A payment request is already in progress. Please wait a minute and try again.",
    };
  }
  // Older pending attempts are abandoned.
  await admin
    .from("payment_attempts")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("order_group_id", group.id)
    .eq("status", "pending");

  const useMock = MODE === "mock";
  const dbProvider = useMock ? "mock" : provider;
  const currency = useMock ? "XAF" : provider === "mtn" ? MTN.currency : OM.currency;
  const uuid = crypto.randomUUID();
  const reference =
    provider === "orange" && !useMock ? "JS" + uuid.replaceAll("-", "").slice(0, 20) : uuid;

  const { data: attempt, error: insErr } = await admin
    .from("payment_attempts")
    .insert({
      order_group_id: group.id,
      buyer_id: user.id,
      provider: dbProvider,
      amount,
      currency,
      provider_reference: reference,
      payer_phone: msisdn,
    })
    .select()
    .single();
  if (insErr || !attempt) {
    console.error("attempt insert failed", insErr);
    return { error: "Could not start the payment. Please try again." };
  }

  try {
    if (useMock) {
      return provider === "orange"
        ? { status: "pending", payment_url: `${SITE_URL}/payment-return?group=${group.id}` }
        : { status: "pending" };
    }
    if (provider === "mtn") {
      await mtnRequestToPay(
        attempt.id,
        reference,
        amount,
        msisdn!,
        `J-STORE ${group.group_number}`,
      );
      return { status: "pending" };
    }
    const om = await omCreate(reference, amount, group.id);
    await admin
      .from("payment_attempts")
      .update({
        pay_token: om.pay_token,
        notif_token: om.notif_token,
        payment_url: om.payment_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", attempt.id);
    return { status: "pending", payment_url: om.payment_url };
  } catch (e) {
    console.error("provider initiate failed", e);
    if (e instanceof ProviderRejected) {
      await admin
        .from("payment_attempts")
        .update({
          status: "failed",
          failure_reason: "Number rejected by provider",
          updated_at: new Date().toISOString(),
        })
        .eq("id", attempt.id);
      return {
        error:
          "MTN could not send a payment request to this number. Check that it is an active MTN MoMo number.",
      };
    }
    await admin
      .from("payment_attempts")
      .update({
        status: "failed",
        failure_reason: "Could not reach the payment provider",
        updated_at: new Date().toISOString(),
      })
      .eq("id", attempt.id);
    return {
      error: "Could not reach the payment provider. Please try again, or choose manual payment.",
    };
  }
}

async function status(user: any, body: any) {
  const group = await loadGroup(String(body?.order_group_id ?? ""), user.id);
  if (!group) return { error: "Order not found." };
  const base = { group_number: group.group_number, total: Number(group.total) };

  if (["held_in_escrow", "released"].includes(group.payment_status))
    return { status: "successful", ...base };

  const { data: latest } = await admin
    .from("payment_attempts")
    .select("*")
    .eq("order_group_id", group.id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (!latest || latest.length === 0) return { status: "none", ...base };

  const a = await checkAndFinalize(latest[0], { allowClosed: true });
  return { status: a.status, reason: a.failure_reason ?? null, ...base };
}

// ── router ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const action = new URL(req.url).pathname.replace(/\/+$/, "").split("/").pop();

  try {
    // Public callbacks: only a hint to re-check with the provider (never trusted).
    if (action === "mtn-callback") {
      const body = await req.json().catch(() => ({}));
      const id = body?.externalId ?? null;
      const ref = req.headers.get("X-Reference-Id") ?? body?.referenceId ?? null;
      let q = admin.from("payment_attempts").select("*").limit(1);
      q = id ? q.eq("id", id) : q.eq("provider_reference", ref ?? "");
      const { data } = await q;
      if (data && data[0]) await checkAndFinalize(data[0]);
      return json({ ok: true });
    }
    if (action === "orange-notify") {
      const body = await req.json().catch(() => ({}));
      if (body?.notif_token) {
        const { data } = await admin
          .from("payment_attempts")
          .select("*")
          .eq("notif_token", body.notif_token)
          .limit(1);
        if (data && data[0]) await checkAndFinalize(data[0]);
      }
      return json({ ok: true });
    }

    // Scheduled job — protected by a shared secret, never by a user login.
    if (action === "reconcile") {
      const secret = env("CRON_SECRET");
      if (!secret || req.headers.get("x-cron-secret") !== secret)
        return json({ error: "forbidden" }, 403);
      return json(await reconcile());
    }

    // Admin tools: re-check one payment now / clear its "needs review" flag.
    if (action === "recheck" || action === "resolve") {
      const user = await authUser(req);
      if (!user) return json({ error: "Please sign in again." });
      const { data: staff } = await admin.rpc("is_staff", { _user_id: user.id });
      if (!staff) return json({ error: "Not allowed." });
      const body = await req.json().catch(() => ({}));
      const { data: attempt } = await admin
        .from("payment_attempts")
        .select("*")
        .eq("id", String(body?.attempt_id ?? ""))
        .maybeSingle();
      if (!attempt) return json({ error: "Payment not found." });
      if (action === "recheck") {
        const r = await checkAndFinalize(attempt, { allowClosed: true });
        return json({ status: r.status });
      }
      await admin
        .from("payment_attempts")
        .update({ needs_review: false, updated_at: new Date().toISOString() })
        .eq("id", attempt.id);
      return json({ ok: true });
    }

    if (action === "initiate" || action === "status") {
      const user = await authUser(req);
      if (!user) return json({ error: "Please sign in again." });
      const body = await req.json().catch(() => ({}));
      return json(action === "initiate" ? await initiate(user, body) : await status(user, body));
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    console.error("payments function error", e);
    return json({ error: "Something went wrong. Please try again." });
  }
});
