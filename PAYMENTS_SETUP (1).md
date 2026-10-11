# MTN MoMo + Orange Money — setup guide

The payment code runs in ONE Supabase Edge Function (`payments`), so it works
wherever your website is hosted and your API keys never reach the browser.

## How it works
1. Buyer picks **Pay instantly** at checkout -> the order is created (stock reserved).
2. **MTN:** a payment request pops up on the buyer's phone; they approve with their PIN.
   **Orange:** the buyer is sent to Orange Money's page, pays, and comes back.
3. The site shows "Confirming your payment…" and checks every 3 seconds.
4. When MTN/Orange confirm the payment (the server asks them directly — callbacks are
   never trusted), the order group becomes paid and every per-store order -> `confirmed`.
5. **Send manually** (old flow) still works as a fallback; admins confirm it from the payments page.

## Step 1 — Database
Supabase -> SQL Editor -> paste and run `supabase/migrations/20260926000001_payment_api.sql`.
(Adds a table + functions, changes no existing data. Safe to re-run.)

## Step 2 — Deploy the function (pick one)
**CLI:** `supabase functions deploy payments --no-verify-jwt`
**Dashboard:** Edge Functions -> *Deploy a new function* -> *Via Editor* -> name it exactly
`payments` -> paste `supabase/functions/payments/index.ts` -> Deploy. Then open the function's
settings and turn **OFF** "Enforce JWT verification" (MTN/Orange callbacks carry no login;
the function checks the buyer's login itself for the other routes).

## Step 3 — Secrets (Dashboard -> Edge Functions -> Secrets)
Start in **test mode** — no accounts needed:

| Name | Value |
|---|---|
| `PAYMENTS_MODE` | `mock` |
| `SITE_URL` | `http://localhost:5173` (your real domain later) |

Test it: checkout -> Pay instantly -> after ~6 seconds the order confirms by itself.
A MoMo number ending in `0000` simulates a declined payment.

## Step 4 — Sandbox (when you have developer keys)
Set `PAYMENTS_MODE` = `sandbox`, plus:

**MTN** (momodeveloper.mtn.com -> subscribe to *Collections*)
`MTN_SUBSCRIPTION_KEY`, `MTN_API_USER`, `MTN_API_KEY`
(sandbox currency is EUR and uses MTN's own test phone numbers — handled automatically)

**Orange** (developer.orange.com -> your app -> *Orange Money WebPay* for Cameroon)
`ORANGE_AUTH_HEADER` (the app's Authorization header value, `Basic …`), `ORANGE_MERCHANT_KEY`
(Orange's sandbox needs test numbers enabled by Orange support.)

## Step 5 — Go live
Set `PAYMENTS_MODE` = `live` (MTN uses `mtncameroon` + XAF; Orange uses the `cm` path + XAF automatically).
- **MTN:** apply for production through MTN's partner onboarding for Cameroon. When creating
  the live API user, register your callback host: `<your-project-ref>.supabase.co`.
- **Orange:** production needs approval from Orange Money Cameroon (merchant account + merchant key).
- Put your real website address in `SITE_URL` (Orange sends buyers back there).

## Step 6 — Safety net for dropped connections (do this before going live)
If a buyer pays but their connection dies, the money is safe with MTN/Orange — the question is how
fast your site learns about it. Three layers cover it:
1. **Callbacks** from MTN/Orange (instant, but MTN sends only one).
2. **The buyer** reopens `/payment-return` or taps **Check payment status** on *My orders*.
3. **A scheduled job** every 5 minutes re-checks every unconfirmed payment, so nothing depends on
   the buyer or on a lost callback.

Set up layer 3:
1. SQL Editor -> run `supabase/migrations/20260926000002_payment_reconcile.sql`.
2. Dashboard -> Database -> Extensions -> enable **pg_cron** and **pg_net**.
3. Edge Functions -> Secrets -> add `CRON_SECRET` (a long random string).
4. Open `supabase/scheduled_reconcile.sql`, fill in your project ref and the same secret, run it once.
5. Redeploy the `payments` function (new version of `index.ts`).

What the job does besides re-checking:
- **Cancels unpaid instant-payment orders** after about 1 hour and **puts the stock back**. The buyer is
  notified. Manual-transfer orders are never touched.
- **Re-checks recently expired attempts** for 2 hours, in case a buyer approved a prompt late.

## When money arrives but the system can't sort it out
Admin -> Payments now shows an **"Instant payments needing attention"** panel with:
- payments still pending after 15 minutes (button: *Re-check now* asks MTN/Orange again), and
- flagged payments: **DUPLICATE PAYMENT** (buyer paid twice — refund one through the provider) and
  **LATE PAYMENT** (money arrived after the order was cancelled — refund it or recreate the order).
  Press *Mark resolved* once handled.

Support fallback if everything above fails: ask the buyer for the confirmation SMS / transaction ID,
look it up in your MTN or Orange merchant dashboard, and confirm the order from the admin page.

## What I could not test
I have no MTN/Orange credentials or network access here, so the provider calls follow their
published docs but have never run against the real APIs. Test in sandbox first, and compare
field names with the portal docs when you get access — fixes will be small, in one file.

## Known limits / next steps
- Refunds for duplicate/late payments are done by you in the provider dashboard (not through the site yet).
- No refunds through the API yet.
- Escrow release to sellers (after delivery) is not built yet; paid orders are marked `held_in_escrow`.
