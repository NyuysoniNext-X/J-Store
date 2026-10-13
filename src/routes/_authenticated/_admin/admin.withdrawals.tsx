import { useI18n } from "@/lib/i18n";
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
  payout_reference: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  events: WithdrawalEvent[];
  seller_name?: string;
};

type WithdrawalEvent = {
  id: string;
  actor_id: string | null;
  from_status: string | null;
  to_status: string;
  note: string | null;
  payout_reference: string | null;
  created_at: string;
  withdrawal_request_id: string;
  actor_name?: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  processing: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  paid: "bg-gold-500/15 text-gold-700 border-gold-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

const PROVIDER_LABELS: Record<string, string> = {
  mtn: "MTN MoMo",
  orange: "Orange Money",
};

function AdminWithdrawals() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "processing" | "paid" | "rejected" | "all">(
    "pending",
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [payoutReferences, setPayoutReferences] = useState<Record<string, string>>({});

  const {
    data: requests = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["admin-withdrawal-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const requestIds = rows.map((request) => request.id);
      let events: WithdrawalEvent[] = [];

      if (requestIds.length > 0) {
        const { data: eventRows, error: eventsError } = await supabase
          .from("withdrawal_request_events")
          .select("*")
          .in("withdrawal_request_id", requestIds)
          .order("created_at", { ascending: true });
        if (eventsError) throw eventsError;
        events = eventRows ?? [];
      }

      const actorIds = events.flatMap((event) => (event.actor_id ? [event.actor_id] : []));
      const userIds = [...new Set([...rows.map((request) => request.seller_id), ...actorIds])];
      const names = new Map<string, string>();

      if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);
        if (profileError) throw profileError;
        for (const profile of profiles ?? []) {
          if (profile.display_name) names.set(profile.id, profile.display_name);
        }
      }

      return rows.map((request) => ({
        ...request,
        seller_name: names.get(request.seller_id),
        events: events
          .filter((event) => event.withdrawal_request_id === request.id)
          .map((event) => ({
            ...event,
            actor_name: event.actor_id
              ? names.get(event.actor_id) ?? event.actor_id.slice(0, 10) + "…"
              : undefined,
          })),
      })) as WithdrawalRequest[];
    },
  });

  const transitionWithdrawal = useMutation({
    mutationFn: async ({
      req,
      action,
      note,
      payoutReference,
    }: {
      req: WithdrawalRequest;
      action: "processing" | "paid" | "rejected";
      note: string;
      payoutReference?: string;
    }) => {
      const { error } = await supabase.rpc("admin_transition_withdrawal", {
        p_request_id: req.id,
        p_action: action,
        p_note: note.trim() || null,
        p_payout_reference: payoutReference?.trim() || null,
      });
      if (error) throw error;
      return action;
    },
    onSuccess: (action) => {
      toast.success(
        action === "paid"
          ? t("roles.withdrawal_marked_paid")
          : action === "rejected"
            ? t("roles.withdrawal_rejected")
            : t("roles.withdrawal_marked_processing"),
      );
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
    <div className="mx-auto max-w-384 px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-navy text-navy-foreground flex items-center justify-center">
            <ArrowDownToLine className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">
              {t("roles.admin")}
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-bold">
              {t("roles.withdrawal_requests")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("roles.process_seller_payouts_manually")}
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

      {/* Summary cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border rounded-2xl p-5">
          <Clock className="h-5 w-5 text-amber-500 mb-3" />
          <p className="font-display text-2xl font-bold">{pendingCount}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("roles.pending_requests")}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <ArrowDownToLine className="h-5 w-5 text-amber-500 mb-3" />
          <p className="font-display text-2xl font-bold">{formatXAF(totalPending)}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("roles.total_pending_amount")}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <CheckCircle2 className="h-5 w-5 text-gold-600 mb-3" />
          <p className="font-display text-2xl font-bold">
            {requests.filter((r) => r.status === "paid").length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{t("roles.paid_all_time")}</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="mb-6 bg-blue-500/10 border border-blue-500/30 rounded-2xl px-5 py-4 flex items-start gap-3 text-sm">
        <Phone className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-blue-700 dark:text-blue-400">
          {t("roles.manual_withdrawal_instructions")}
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
            {f === "all" ? t("roles.all") : f.charAt(0).toUpperCase() + f.slice(1)}
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
          <p className="text-muted-foreground">{t("roles.no_requests_in_this_category")}</p>
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
                      {t(`roles.withdrawal_status_${req.status}`)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(req.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t("roles.seller")}
                      </p>
                      <p className="text-sm font-medium truncate">
                        {req.seller_name ?? req.seller_id.slice(0, 10) + "…"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t("roles.amount")}
                      </p>
                      <p className="font-display font-semibold text-lg">{formatXAF(req.amount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t("roles.send_to")}
                      </p>
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
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {t("roles.note")}
                        </p>
                        <p className="text-sm">{req.note}</p>
                      </div>
                    )}
                    {req.payout_reference && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {t("roles.payout_reference")}
                        </p>
                        <p className="text-sm font-medium break-all">{req.payout_reference}</p>
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
                          disabled={transitionWithdrawal.isPending}
                          onClick={() =>
                            transitionWithdrawal.mutate({
                              req,
                              action: "processing",
                              note: notes[req.id] ?? "",
                            })
                          }
                        >
                          {t("roles.processing")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-destructive hover:bg-destructive/10"
                        disabled={transitionWithdrawal.isPending || !(notes[req.id] ?? "").trim()}
                        onClick={() =>
                          transitionWithdrawal.mutate({
                            req,
                            action: "rejected",
                            note: notes[req.id] ?? "",
                          })
                        }
                      >
                        <XCircle className="h-4 w-4 mr-1" /> {t("roles.reject")}
                      </Button>
                      {req.status === "processing" && (
                        <Button
                          size="sm"
                          className="rounded-full bg-gold text-gold-foreground hover:bg-gold/90"
                          disabled={
                            transitionWithdrawal.isPending ||
                            !(payoutReferences[req.id] ?? "").trim()
                          }
                          onClick={() =>
                            transitionWithdrawal.mutate({
                              req,
                              action: "paid",
                              note: notes[req.id] ?? "",
                              payoutReference: payoutReferences[req.id] ?? "",
                            })
                          }
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" /> {t("roles.mark_as_paid")}
                        </Button>
                      )}
                    </div>
                    <input
                      className="h-8 rounded-lg px-3 bg-secondary border border-transparent focus:outline-none focus:border-gold text-xs w-full md:w-56"
                      placeholder={t("roles.withdrawal_note_or_rejection_reason")}
                      value={notes[req.id] ?? ""}
                      onChange={(e) => setNotes((p) => ({ ...p, [req.id]: e.target.value }))}
                    />
                    {req.status === "processing" && (
                      <input
                        className="h-8 rounded-lg px-3 bg-secondary border border-transparent focus:outline-none focus:border-gold text-xs w-full md:w-56"
                        placeholder={t("roles.payout_reference_required")}
                        value={payoutReferences[req.id] ?? ""}
                        onChange={(e) =>
                          setPayoutReferences((previous) => ({
                            ...previous,
                            [req.id]: e.target.value,
                          }))
                        }
                      />
                    )}
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
