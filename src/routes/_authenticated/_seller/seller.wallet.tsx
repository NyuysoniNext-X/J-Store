import { useI18n } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Wallet,
  ArrowDownToLine,
  TrendingUp,
  Clock,
  CheckCircle2,
  Loader2,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatXAF } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/_seller/seller/wallet")({
  component: SellerWallet,
  head: () => ({ meta: [{ title: "Seller wallet — J-STORE.cm" }] }),
});

type WalletTx = {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
};

type WithdrawalReq = {
  id: string;
  amount: number;
  momo_number: string;
  momo_provider: string;
  status: string;
  note: string | null;
  payout_reference: string | null;
  created_at: string;
};

const PROVIDER_LABELS: Record<string, string> = {
  mtn: "MTN MoMo",
  orange: "Orange Money",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  processing: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  paid: "bg-gold-500/15 text-gold-700 border-gold-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

function SellerWallet() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoProvider, setMomoProvider] = useState<"mtn" | "orange">("mtn");
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);

  // ── Wallet transactions ───────────────────────────────────────────────────
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["seller-wallet-txns", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_wallet_transactions")
        .select("*")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as WalletTx[];
    },
    enabled: !!user,
  });

  const {
    data: walletSummary,
    isLoading: walletSummaryLoading,
    error: walletSummaryError,
  } = useQuery({
    queryKey: ["seller-wallet-summary", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_seller_wallet_summary");
      if (error) throw error;
      if (!data?.length) throw new Error(t("roles.wallet_summary_unavailable"));
      return data[0];
    },
    enabled: !!user,
  });

  // ── Withdrawal requests ───────────────────────────────────────────────────
  const { data: withdrawals = [], isLoading: withdrawalsLoading } = useQuery({
    queryKey: ["seller-withdrawals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as WithdrawalReq[];
    },
    enabled: !!user,
  });

  // ── Compute balances ──────────────────────────────────────────────────────
  const walletBalance = walletSummary?.wallet_balance ?? 0;
  const totalEarned = walletSummary?.total_earned ?? 0;
  const pendingWithdrawals = walletSummary?.pending_withdrawals ?? 0;
  const availableBalance = walletSummary?.available_balance ?? 0;

  // ── Request withdrawal ────────────────────────────────────────────────────
  const requestWithdrawal = useMutation({
    mutationFn: async () => {
      const amount = Number(withdrawAmount);
      if (!Number.isInteger(amount) || amount < 1000)
        throw new Error(t("roles.withdrawal_minimum_amount"));
      if (!momoNumber.trim()) throw new Error(t("roles.enter_your_momo_number"));

      const { error } = await supabase.rpc("request_seller_withdrawal", {
        p_amount: amount,
        p_momo_number: momoNumber.trim(),
        p_momo_provider: momoProvider,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("roles.withdrawal_request_submitted_processing"));
      setWithdrawAmount("");
      setMomoNumber("");
      setShowWithdrawForm(false);
      qc.invalidateQueries({ queryKey: ["seller-withdrawals", user?.id] });
      qc.invalidateQueries({ queryKey: ["seller-wallet-txns", user?.id] });
      qc.invalidateQueries({ queryKey: ["seller-wallet-summary", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = [
    {
      label: t("roles.total_earned"),
      value: formatXAF(totalEarned),
      icon: TrendingUp,
      color: "text-gold-600",
    },
    {
      label: t("roles.wallet_balance"),
      value: formatXAF(walletBalance),
      icon: Wallet,
      color: "text-gold",
    },
    {
      label: t("roles.pending_withdrawals"),
      value: formatXAF(pendingWithdrawals),
      icon: Clock,
      color: "text-amber-500",
    },
    {
      label: t("roles.available_to_withdraw"),
      value: formatXAF(availableBalance),
      icon: ArrowDownToLine,
      color: "text-blue-500",
    },
  ];

  return (
    <div className="mx-auto max-w-[1536px] px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold mb-1">
            {t("roles.seller_wallet")}
          </p>
          <h1 className="font-display text-3xl md:text-4xl font-bold">{t("roles.my_wallet")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("roles.track_earnings_and_request_payouts")}
          </p>
        </div>
        <Button
          className="rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
          onClick={() => setShowWithdrawForm((v) => !v)}
        >
          <ArrowDownToLine className="h-4 w-4 mr-1.5" />
          {showWithdrawForm ? t("roles.cancel") : t("roles.request_withdrawal")}
        </Button>
      </div>

      {walletSummaryError && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {t("roles.wallet_summary_unavailable")} {walletSummaryError.message}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-card border border-border rounded-2xl p-5 shadow-elegant"
          >
            <s.icon className={`h-5 w-5 mb-3 ${s.color}`} />
            <p className="font-display text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Withdrawal form */}
      {showWithdrawForm && (
        <div className="bg-card border border-gold/40 rounded-2xl p-6 mb-8 space-y-4">
          <h3 className="font-display font-semibold">{t("roles.request_a_withdrawal")}</h3>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
            <Clock className="h-4 w-4 mt-0.5 shrink-0" />
            <p>{t("roles.withdrawal_processing_disclosure")}</p>
          </div>
          <p className="text-xs text-muted-foreground">{t("roles.withdrawal_fee_disclosure")}</p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">
                {t("roles.amount_fcfa")} <span className="text-gold">*</span>
              </label>
              <input
                type="number"
                min="1000"
                step="100"
                className="w-full h-11 rounded-lg px-3 bg-secondary border border-transparent focus:outline-none focus:border-gold text-sm"
                placeholder={`${t("roles.max")}: ${formatXAF(availableBalance)}`}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("roles.available_balance_label")} {formatXAF(availableBalance)}
                {" · "}
                {t("roles.withdrawal_minimum_hint")}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">
                {t("roles.momo_provider")} <span className="text-gold">*</span>
              </label>
              <select
                value={momoProvider}
                onChange={(e) => setMomoProvider(e.target.value as "mtn" | "orange")}
                className="w-full h-11 rounded-lg px-3 bg-secondary border border-transparent focus:outline-none focus:border-gold text-sm"
              >
                <option value="mtn">MTN MoMo</option>
                <option value="orange">Orange Money</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium block mb-1.5">
                {t("roles.your_momo_number")} <span className="text-gold">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="tel"
                  autoComplete="tel"
                  className="w-full h-11 rounded-lg pl-9 pr-3 bg-secondary border border-transparent focus:outline-none focus:border-gold text-sm"
                  placeholder="+237 6XX XXX XXX"
                  value={momoNumber}
                  onChange={(e) => setMomoNumber(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Button
            className="rounded-full bg-gold text-gold-foreground hover:bg-gold/90"
            disabled={
              requestWithdrawal.isPending ||
              txLoading ||
              walletSummaryLoading ||
              !!walletSummaryError ||
              withdrawalsLoading ||
              availableBalance < 1000 ||
              !withdrawAmount ||
              !momoNumber.trim()
            }
            onClick={() => requestWithdrawal.mutate()}
          >
            {requestWithdrawal.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
            )}
            {t("roles.submit_withdrawal_request")}
          </Button>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        {/* Wallet transactions */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-display font-semibold mb-4">{t("roles.transaction_history")}</h2>
          {txLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-gold" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {t(
                "roles.no_transactions_yet_your_earnings_will_appear_here_after_orders_are_completed",
              )}
            </p>
          ) : (
            <ul className="space-y-3">
              {transactions.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {tx.type === "sale"
                        ? t("roles.sale")
                        : tx.type === "withdrawal"
                          ? t("roles.withdrawal")
                          : tx.type === "refund"
                            ? t("roles.refund")
                            : tx.type === "platform_fee"
                              ? t("roles.platform_fee")
                              : tx.type}
                    </p>
                    {tx.description && (
                      <p className="text-xs text-muted-foreground truncate">{tx.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`font-display font-semibold shrink-0 ${
                      tx.amount >= 0 ? "text-gold-600" : "text-destructive"
                    }`}
                  >
                    {tx.amount >= 0 ? "+" : ""}
                    {formatXAF(tx.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Withdrawal history */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-display font-semibold mb-4">{t("roles.withdrawal_requests")}</h2>
          {withdrawals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {t("roles.no_withdrawal_requests_yet")}
            </p>
          ) : (
            <ul className="space-y-3">
              {withdrawals.map((w) => (
                <li key={w.id} className="rounded-xl border border-border p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display font-semibold">{formatXAF(w.amount)}</p>
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[w.status] ?? ""}`}>
                      {t(`roles.withdrawal_status_${w.status}`)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {w.momo_number} · {PROVIDER_LABELS[w.momo_provider] ?? w.momo_provider}
                  </p>
                  {w.note && <p className="text-xs text-muted-foreground">{w.note}</p>}
                  {w.payout_reference && (
                    <p className="text-xs text-muted-foreground">
                      {t("roles.payout_reference")}: {w.payout_reference}
                    </p>
                  )}
                  {w.status === "rejected" ? (
                    <p className="text-xs text-muted-foreground">
                      {t("roles.withdrawal_amount_released")}
                    </p>
                  ) : (
                    <ol
                      className="flex flex-wrap gap-2 text-[11px] text-muted-foreground"
                      aria-label={t("roles.withdrawal_status_timeline")}
                    >
                      {(["pending", "processing", "paid"] as const).map((status, index) => {
                        const currentIndex =
                          w.status === "pending" ? 0 : w.status === "processing" ? 1 : 2;
                        return (
                          <li
                            key={status}
                            className={
                              index <= currentIndex ? "font-semibold text-foreground" : undefined
                            }
                          >
                            {index > 0 && <span aria-hidden="true"> → </span>}
                            {t(`roles.withdrawal_status_${status}`)}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(w.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
