import { useI18n } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Wallet, Loader2, CheckCircle2, XCircle, Clock, Phone, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatXAF } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/_admin/admin/payments")({
  component: AdminPayments,
  head: () => ({ meta: [{ title: "Payment verifications — J-STORE.cm" }] }),
});

type Verification = {
  id: string;
  order_id: string | null;
  order_group_id: string | null;
  buyer_id: string;
  amount: number;
  payment_method: string;
  transaction_ref: string;
  status: string;
  verified_by: string | null;
  verified_at: string | null;
  reject_reason: string | null;
  submitted_at: string;
  // joined
  buyer_email?: string;
  order_number?: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  confirmed: "bg-gold-500/15 text-gold-700 border-gold-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

const METHOD_LABELS: Record<string, string> = {
  mtn_momo: "MTN MoMo",
  orange_money: "Orange Money",
};

function AdminPayments() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "confirmed" | "rejected" | "all">("pending");
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});

  const {
    data: verifications = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["admin-payment-verifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_verifications")
        .select("*, orders(order_number), order_groups(group_number)")
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
      const buyerIds = [...new Set(rows.map((v) => v.buyer_id as string))];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", buyerIds);
      const names = new Map((profs ?? []).map((p) => [p.id, p.display_name]));
      return rows.map((v) => ({
        ...v,
        order_number: ((v.orders as Record<string, unknown> | null)?.order_number ??
          (v.order_groups as Record<string, unknown> | null)?.group_number) as string | undefined,
        buyer_email: (names.get(v.buyer_id as string) ?? undefined) as string | undefined,
      })) as unknown as Verification[];
    },
  });

  const confirm = useMutation({
    mutationFn: async (v: Verification) => {
      // New checkouts: one shared function confirms the whole order group (every
      // per-store order, the escrow status) and notifies the buyer.
      if (v.order_group_id) {
        const { error } = await supabase.rpc("confirm_order_group_payment", {
          p_group: v.order_group_id,
        });
        if (error) throw error;
        return;
      }
      // Legacy single-order payments
      // Mark verification confirmed
      const { error: vErr } = await supabase
        .from("payment_verifications")
        .update({
          status: "confirmed",
          verified_by: user!.id,
          verified_at: new Date().toISOString(),
        })
        .eq("id", v.id);
      if (vErr) throw vErr;

      // Update order status to confirmed
      const { error: oErr } = await supabase
        .from("orders")
        .update({ status: "confirmed" })
        .eq("id", v.order_id as string);
      if (oErr) throw oErr;

      // Notify buyer
      await supabase.from("notifications").insert({
        user_id: v.buyer_id,
        title: "Payment confirmed",
        body: `Your payment of ${formatXAF(v.amount)} has been verified. Your order is now being processed.`,
      });
    },
    onSuccess: () => {
      toast.success(t("roles.payment_confirmed_order_moved"));
      qc.invalidateQueries({ queryKey: ["admin-payment-verifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectPayment = useMutation({
    mutationFn: async ({ v, reason }: { v: Verification; reason: string }) => {
      if (v.order_group_id) {
        const { error } = await supabase.rpc("reject_manual_payment", {
          p_verification: v.id,
          p_reason: reason.trim() || null,
        });
        if (error) throw error;
        return { stockReleased: true };
      }

      const { error: vErr } = await supabase
        .from("payment_verifications")
        .update({
          status: "rejected",
          reject_reason: reason.trim() || null,
          verified_by: user!.id,
          verified_at: new Date().toISOString(),
        })
        .eq("id", v.id);
      if (vErr) throw vErr;

      await supabase.from("notifications").insert({
        user_id: v.buyer_id,
        title: "Payment reference not verified",
        body: reason.trim()
          ? `We could not verify your transaction: ${reason}. Please contact support or resubmit.`
          : "We could not verify your payment reference. Please contact support.",
      });
      return { stockReleased: false };
    },
    onSuccess: ({ stockReleased }) => {
      toast.success(
        stockReleased
          ? t("roles.payment_rejected_buyer_notified_and_stock_released")
          : t("roles.payment_rejected_buyer_notified"),
      );
      qc.invalidateQueries({ queryKey: ["admin-payment-verifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = verifications.filter((v) => filter === "all" || v.status === filter);
  const pendingCount = verifications.filter((v) => v.status === "pending").length;

  return (
    <div className="mx-auto max-w-384 px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-navy text-navy-foreground flex items-center justify-center">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">
              {t("roles.admin")}
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-bold">
              {t("roles.payment_verifications")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("roles.verify_buyer_momo_transaction_references")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge className="bg-amber-500 text-white text-sm px-3 py-1">
              {t("roles.pending_count", { count: pendingCount })}
            </Badge>
          )}
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> {t("roles.refresh")}
          </Button>
        </div>
      </div>

      <AttentionPanel />

      {/* Info banner */}
      <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4 flex items-start gap-3 text-sm">
        <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-amber-700 dark:text-amber-400">
          {t(
            "roles.check_your_mtn_momo_orange_money_app_to_verify_each_transaction_reference_before_confirming_buyers_were_told_to_expect_a_response_within_3_hours",
          )}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(["pending", "all", "confirmed", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-9 px-4 rounded-full text-sm font-medium border transition-colors ${
              filter === f
                ? "bg-navy text-navy-foreground border-navy"
                : "border-border hover:border-gold/40"
            }`}
          >
            {f === "all" ? t("roles.all") : f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <p className="text-muted-foreground">{t("roles.no_verifications_in_this_category")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => (
            <div key={v.id} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                {/* Info */}
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[v.status] ?? ""}`}>
                      {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                    </Badge>
                    <span className="text-xs font-mono text-muted-foreground">
                      Order #{v.order_number ?? (v.order_id ?? v.order_group_id ?? "").slice(0, 8)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(v.submitted_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t("roles.amount")}
                      </p>
                      <p className="font-display font-semibold text-lg">{formatXAF(v.amount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t("roles.method")}
                      </p>
                      <p className="text-sm font-medium flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-gold" />
                        {METHOD_LABELS[v.payment_method] ?? v.payment_method}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t("roles.transaction_ref")}
                      </p>
                      <p className="text-sm font-mono font-semibold text-gold">
                        {v.transaction_ref}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t("roles.buyer")}
                      </p>
                      <p className="text-sm truncate">
                        {v.buyer_email ?? v.buyer_id.slice(0, 12) + "…"}
                      </p>
                    </div>
                  </div>

                  {v.reject_reason && (
                    <p className="text-xs text-destructive mt-1">
                      {t("roles.reason_value", { reason: v.reject_reason })}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {v.status === "pending" && (
                  <div className="flex flex-col gap-2 shrink-0 md:items-end">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-destructive hover:bg-destructive/10"
                        disabled={rejectPayment.isPending || confirm.isPending}
                        onClick={() =>
                          rejectPayment.mutate({ v, reason: rejectReasons[v.id] ?? "" })
                        }
                      >
                        <XCircle className="h-4 w-4 mr-1" /> {t("roles.reject")}
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-full bg-gold text-gold-foreground hover:bg-gold/90"
                        disabled={confirm.isPending || rejectPayment.isPending}
                        onClick={() => confirm.mutate(v)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" /> {t("roles.confirm")}
                      </Button>
                    </div>
                    <input
                      className="h-8 rounded-lg px-3 bg-secondary border border-transparent focus:outline-none focus:border-destructive text-xs w-full md:w-56"
                      placeholder={t("roles.rejection_reason_optional")}
                      value={rejectReasons[v.id] ?? ""}
                      onChange={(e) => setRejectReasons((p) => ({ ...p, [v.id]: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type AttentionRow = {
  id: string;
  provider: string;
  amount: number;
  status: string;
  created_at: string;
  needs_review: boolean;
  review_note: string | null;
  failure_reason: string | null;
  payer_phone: string | null;
  order_groups: { group_number: string } | null;
};

// Instant (MTN/Orange API) payments that are stuck or need a human decision.
function AttentionPanel() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const {
    data: rows = [],
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["payment-attention"],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("payment_attempts")
        .select(
          "id, provider, amount, status, created_at, needs_review, review_note, failure_reason, payer_phone, order_groups(group_number)",
        )
        .or(`needs_review.eq.true,and(status.eq.pending,created_at.lt.${cutoff})`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as AttentionRow[];
    },
    refetchInterval: 60_000,
  });

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "recheck" | "resolve" }) => {
      const { data, error } = await supabase.functions.invoke(`payments/${action}`, {
        body: { attempt_id: id },
      });
      if (error || !data) throw new Error(t("roles.request_failed_please_try_again"));
      if (data.error) throw new Error(data.error);
      return { action, data };
    },
    onSuccess: ({ action, data }) => {
      toast.success(
        action === "resolve"
          ? t("roles.marked_resolved")
          : t("roles.rechecked_payment_status", { status: data.status }),
      );
      qc.invalidateQueries({ queryKey: ["payment-attention"] });
      qc.invalidateQueries({ queryKey: ["admin-payment-verifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const label = (p: string) =>
    p === "mtn" ? "MTN MoMo" : p === "orange" ? "Orange Money" : "Test";

  return (
    <div
      className={`mb-6 rounded-2xl border px-5 py-4 ${
        rows.length > 0 ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">
          {t("roles.instant_payments_needing_attention")}
          {rows.length > 0 ? ` (${rows.length})` : ""}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> {t("roles.refresh")}
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground mt-1">{t("roles.nothing_stuck")}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map((r) => {
            const mins = Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000);
            return (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    #{r.order_groups?.group_number ?? r.id.slice(0, 8)} · {label(r.provider)} ·{" "}
                    {formatXAF(r.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("roles.payment_started_ago", { status: r.status, minutes: mins })}
                    {r.payer_phone ? ` · ${r.payer_phone}` : ""}
                  </p>
                  {r.review_note && (
                    <p className="text-xs text-destructive mt-1">{r.review_note}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {(r.status === "pending" || r.status === "expired") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full h-8 text-xs"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ id: r.id, action: "recheck" })}
                    >
                      {t("roles.recheck_now")}
                    </Button>
                  )}
                  {r.needs_review && (
                    <Button
                      size="sm"
                      className="rounded-full h-8 text-xs"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ id: r.id, action: "resolve" })}
                    >
                      {t("roles.mark_resolved")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
