import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Wallet,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  RefreshCw,
} from "lucide-react";
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
  order_id: string;
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
  confirmed: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

const METHOD_LABELS: Record<string, string> = {
  mtn_momo: "MTN MoMo",
  orange_money: "Orange Money",
};

function AdminPayments() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "confirmed" | "rejected" | "all">("pending");
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});

  const { data: verifications = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-payment-verifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_verifications")
        .select("*, orders(order_number), profiles(display_name)")
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((v: Record<string, unknown>) => ({
        ...v,
        order_number: (v.orders as Record<string, unknown> | null)?.order_number as string | undefined,
        buyer_email: (v.profiles as Record<string, unknown> | null)?.display_name as string | undefined,
      })) as Verification[];
    },
  });

  const confirm = useMutation({
    mutationFn: async (v: Verification) => {
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
        .eq("id", v.order_id);
      if (oErr) throw oErr;

      // Notify buyer
      await supabase.from("notifications").insert({
        user_id: v.buyer_id,
        title: "Payment confirmed ✅",
        body: `Your payment of ${formatXAF(v.amount)} has been verified. Your order is now being processed.`,
        type: "payment_confirmed",
      });
    },
    onSuccess: () => {
      toast.success("Payment confirmed — order moved to confirmed");
      qc.invalidateQueries({ queryKey: ["admin-payment-verifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectPayment = useMutation({
    mutationFn: async ({ v, reason }: { v: Verification; reason: string }) => {
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
        type: "payment_rejected",
      });
    },
    onSuccess: () => {
      toast.success("Payment rejected — buyer notified");
      qc.invalidateQueries({ queryKey: ["admin-payment-verifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = verifications.filter((v) => filter === "all" || v.status === filter);
  const pendingCount = verifications.filter((v) => v.status === "pending").length;

  return (
    <div className="mx-auto max-w-[1536px] px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-navy text-navy-foreground flex items-center justify-center">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">Admin</p>
            <h1 className="font-display text-3xl md:text-4xl font-bold">Payment verifications</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Verify buyer MoMo transaction references before confirming orders.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge className="bg-amber-500 text-white text-sm px-3 py-1">
              {pendingCount} pending
            </Badge>
          )}
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4 flex items-start gap-3 text-sm">
        <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-amber-700 dark:text-amber-400">
          Check your MTN MoMo / Orange Money app to verify each transaction reference before confirming. Buyers were told to expect a response within 3 hours.
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
            {f.charAt(0).toUpperCase() + f.slice(1)}
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
          <p className="text-muted-foreground">No verifications in this category.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => (
            <div
              key={v.id}
              className="bg-card border border-border rounded-2xl p-5"
            >
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                {/* Info */}
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${STATUS_COLORS[v.status] ?? ""}`}
                    >
                      {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                    </Badge>
                    <span className="text-xs font-mono text-muted-foreground">
                      Order #{v.order_number ?? v.order_id.slice(0, 8)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(v.submitted_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount</p>
                      <p className="font-display font-semibold text-lg">{formatXAF(v.amount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Method</p>
                      <p className="text-sm font-medium flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-gold" />
                        {METHOD_LABELS[v.payment_method] ?? v.payment_method}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Transaction ref</p>
                      <p className="text-sm font-mono font-semibold text-gold">{v.transaction_ref}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Buyer</p>
                      <p className="text-sm truncate">{v.buyer_email ?? v.buyer_id.slice(0, 12) + "…"}</p>
                    </div>
                  </div>

                  {v.reject_reason && (
                    <p className="text-xs text-destructive mt-1">Reason: {v.reject_reason}</p>
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
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-full bg-emerald text-emerald-foreground hover:bg-emerald/90"
                        disabled={confirm.isPending || rejectPayment.isPending}
                        onClick={() => confirm.mutate(v)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Confirm
                      </Button>
                    </div>
                    <input
                      className="h-8 rounded-lg px-3 bg-secondary border border-transparent focus:outline-none focus:border-destructive text-xs w-full md:w-56"
                      placeholder="Rejection reason (optional)"
                      value={rejectReasons[v.id] ?? ""}
                      onChange={(e) =>
                        setRejectReasons((p) => ({ ...p, [v.id]: e.target.value }))
                      }
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
