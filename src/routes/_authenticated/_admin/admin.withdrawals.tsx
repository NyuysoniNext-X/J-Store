import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowDownToLine,
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

export const Route = createFileRoute("/_authenticated/_admin/admin/withdrawals")({
  component: AdminWithdrawals,
  head: () => ({ meta: [{ title: "Withdrawal requests — J-STORE.cm" }] }),
});

type WithdrawalRequest = {
  id: string;
  seller_id: string;
  amount: number;
  momo_number: string;
  momo_provider: string;
  status: string;
  note: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  // joined
  seller_name?: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  processing: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  paid: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

const PROVIDER_LABELS: Record<string, string> = {
  mtn: "MTN MoMo",
  orange: "Orange Money",
};

function AdminWithdrawals() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "processing" | "paid" | "rejected" | "all">(
    "pending",
  );
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-withdrawal-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*, profiles(display_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        seller_name: (r.profiles as Record<string, unknown> | null)?.display_name as
          | string
          | undefined,
      })) as WithdrawalRequest[];
    },
  });

  const markPaid = useMutation({
    mutationFn: async ({ req, note }: { req: WithdrawalRequest; note: string }) => {
      const { error: rErr } = await supabase
        .from("withdrawal_requests")
        .update({
          status: "paid",
          note: note.trim() || null,
          processed_by: user!.id,
          processed_at: new Date().toISOString(),
        })
        .eq("id", req.id);
      if (rErr) throw rErr;

      // Debit the seller wallet
      const { error: wErr } = await supabase.from("seller_wallet_transactions").insert({
        seller_id: req.seller_id,
        type: "withdrawal",
        amount: -req.amount,
        description: `Withdrawal paid to ${PROVIDER_LABELS[req.momo_provider] ?? req.momo_provider} ${req.momo_number}`,
      });
      if (wErr) throw wErr;

      // Notify seller
      await supabase.from("notifications").insert({
        user_id: req.seller_id,
        title: "Withdrawal processed ✅",
        body: `${formatXAF(req.amount)} has been sent to your ${PROVIDER_LABELS[req.momo_provider] ?? req.momo_provider} account (${req.momo_number}).`,
        type: "withdrawal_paid",
      });
    },
    onSuccess: () => {
      toast.success("Marked as paid — seller notified");
      qc.invalidateQueries({ queryKey: ["admin-withdrawal-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markProcessing = useMutation({
    mutationFn: async (req: WithdrawalRequest) => {
      const { error } = await supabase
        .from("withdrawal_requests")
        .update({ status: "processing", processed_by: user!.id })
        .eq("id", req.id);
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: req.seller_id,
        title: "Withdrawal is being processed",
        body: `Your withdrawal of ${formatXAF(req.amount)} is being processed. Funds should arrive shortly.`,
        type: "withdrawal_processing",
      });
    },
    onSuccess: () => {
      toast.success("Marked as processing");
      qc.invalidateQueries({ queryKey: ["admin-withdrawal-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectWithdrawal = useMutation({
    mutationFn: async ({ req, note }: { req: WithdrawalRequest; note: string }) => {
      const { error } = await supabase
        .from("withdrawal_requests")
        .update({
          status: "rejected",
          note: note.trim() || null,
          processed_by: user!.id,
          processed_at: new Date().toISOString(),
        })
        .eq("id", req.id);
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: req.seller_id,
        title: "Withdrawal request rejected",
        body: note.trim()
          ? `Your withdrawal of ${formatXAF(req.amount)} was rejected: ${note}`
          : `Your withdrawal of ${formatXAF(req.amount)} could not be processed. Please contact support.`,
        type: "withdrawal_rejected",
      });
    },
    onSuccess: () => {
      toast.success("Withdrawal rejected — seller notified");
      qc.invalidateQueries({ queryKey: ["admin-withdrawal-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = requests.filter((r) => filter === "all" || r.status === filter);
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  // Totals
  const totalPending = requests
    .filter((r) => r.status === "pending")
    .reduce((s, r) => s + r.amount, 0);

  return (
    <div className="mx-auto max-w-[1536px] px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-navy text-navy-foreground flex items-center justify-center">
            <ArrowDownToLine className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">Admin</p>
            <h1 className="font-display text-3xl md:text-4xl font-bold">Withdrawal requests</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Process seller payouts manually via MoMo or Orange Money.
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

      {/* Summary cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border rounded-2xl p-5">
          <Clock className="h-5 w-5 text-amber-500 mb-3" />
          <p className="font-display text-2xl font-bold">{pendingCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Pending requests</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <ArrowDownToLine className="h-5 w-5 text-amber-500 mb-3" />
          <p className="font-display text-2xl font-bold">{formatXAF(totalPending)}</p>
          <p className="text-xs text-muted-foreground mt-1">Total pending amount</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 mb-3" />
          <p className="font-display text-2xl font-bold">
            {requests.filter((r) => r.status === "paid").length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Paid (all time)</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="mb-6 bg-blue-500/10 border border-blue-500/30 rounded-2xl px-5 py-4 flex items-start gap-3 text-sm">
        <Phone className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-blue-700 dark:text-blue-400">
          Send funds manually to the seller's MoMo number shown below, then click "Mark as paid". The seller's wallet will be updated automatically.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(["pending", "processing", "all", "paid", "rejected"] as const).map((f) => (
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

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <p className="text-muted-foreground">No requests in this category.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => (
            <div key={req.id} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                {/* Info */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${STATUS_COLORS[req.status] ?? ""}`}
                    >
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(req.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Seller</p>
                      <p className="text-sm font-medium truncate">
                        {req.seller_name ?? req.seller_id.slice(0, 10) + "…"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount</p>
                      <p className="font-display font-semibold text-lg">{formatXAF(req.amount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Send to</p>
                      <p className="text-sm font-medium flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-gold" />
                        {req.momo_number}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {PROVIDER_LABELS[req.momo_provider] ?? req.momo_provider}
                      </p>
                    </div>
                    {req.note && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Note</p>
                        <p className="text-sm">{req.note}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {(req.status === "pending" || req.status === "processing") && (
                  <div className="flex flex-col gap-2 shrink-0 md:items-end">
                    <div className="flex flex-wrap gap-2">
                      {req.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          disabled={markProcessing.isPending}
                          onClick={() => markProcessing.mutate(req)}
                        >
                          Processing
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-destructive hover:bg-destructive/10"
                        disabled={rejectWithdrawal.isPending || markPaid.isPending}
                        onClick={() =>
                          rejectWithdrawal.mutate({ req, note: notes[req.id] ?? "" })
                        }
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-full bg-emerald text-emerald-foreground hover:bg-emerald/90"
                        disabled={markPaid.isPending || rejectWithdrawal.isPending}
                        onClick={() => markPaid.mutate({ req, note: notes[req.id] ?? "" })}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Mark as paid
                      </Button>
                    </div>
                    <input
                      className="h-8 rounded-lg px-3 bg-secondary border border-transparent focus:outline-none focus:border-gold text-xs w-full md:w-56"
                      placeholder="Optional note…"
                      value={notes[req.id] ?? ""}
                      onChange={(e) => setNotes((p) => ({ ...p, [req.id]: e.target.value }))}
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
