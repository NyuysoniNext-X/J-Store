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
  created_at: string;
};

const TX_TYPE_LABELS: Record<string, string> = {
  sale: "Sale",
  withdrawal: "Withdrawal",
  refund: "Refund",
  platform_fee: "Platform fee",
};

const PROVIDER_LABELS: Record<string, string> = {
  mtn: "MTN MoMo",
  orange: "Orange Money",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  processing: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  paid: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

function SellerWallet() {
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

  // ── Withdrawal requests ───────────────────────────────────────────────────
  const { data: withdrawals = [] } = useQuery({
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

  // ── Sales from order items (for total earnings) ───────────────────────────
  const { data: orderItems = [] } = useQuery({
    queryKey: ["seller-order-items-wallet", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        // order_items has no seller column: ownership goes order -> store -> owner.
        .select("line_total, orders!inner(status, seller_stores!inner(owner_id))")
        .eq("orders.seller_stores.owner_id", user!.id);
      if (error) throw error;
      return data as unknown as Array<{
        line_total: number;
        orders: { status: string } | null;
      }>;
    },
    enabled: !!user,
  });

  // ── Compute balances ──────────────────────────────────────────────────────
  const totalEarned = orderItems
    .filter((i) => i.orders?.status === "completed" || i.orders?.status === "delivered")
    .reduce((s, i) => s + i.line_total, 0);

  const walletBalance = transactions.reduce((s, t) => s + t.amount, 0);
  const pendingWithdrawals = withdrawals
    .filter((w) => w.status === "pending" || w.status === "processing")
    .reduce((s, w) => s + w.amount, 0);
  const availableBalance = Math.max(0, walletBalance - pendingWithdrawals);

  // ── Request withdrawal ────────────────────────────────────────────────────
  const requestWithdrawal = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(withdrawAmount);
      if (!amount || amount <= 0) throw new Error("Enter a valid amount.");
      if (amount > availableBalance) throw new Error("Insufficient available balance.");
      if (!momoNumber.trim()) throw new Error("Enter your MoMo number.");

      const { error } = await supabase.from("withdrawal_requests").insert({
        seller_id: user!.id,
        amount,
        momo_number: momoNumber.trim(),
        momo_provider: momoProvider,
        status: "pending",
      });
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: user!.id,
        title: "Withdrawal request received",
        body: `Your withdrawal of ${formatXAF(amount)} is being reviewed. We'll process it within 3 hours.`,
      });
    },
    onSuccess: () => {
      toast.success("Withdrawal request submitted — processing within 3 hours");
      setWithdrawAmount("");
      setMomoNumber("");
      setShowWithdrawForm(false);
      qc.invalidateQueries({ queryKey: ["seller-withdrawals", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = [
    {
      label: "Total earned",
      value: formatXAF(totalEarned),
      icon: TrendingUp,
      color: "text-emerald-500",
    },
    {
      label: "Wallet balance",
      value: formatXAF(walletBalance),
      icon: Wallet,
      color: "text-gold",
    },
    {
      label: "Pending withdrawals",
      value: formatXAF(pendingWithdrawals),
      icon: Clock,
      color: "text-amber-500",
    },
    {
      label: "Available to withdraw",
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
            Seller wallet
          </p>
          <h1 className="font-display text-3xl md:text-4xl font-bold">My wallet</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track earnings and request payouts.
          </p>
        </div>
        <Button
          className="rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
          onClick={() => setShowWithdrawForm((v) => !v)}
        >
          <ArrowDownToLine className="h-4 w-4 mr-1.5" />
          {showWithdrawForm ? "Cancel" : "Request withdrawal"}
        </Button>
      </div>

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
          <h3 className="font-display font-semibold">Request a withdrawal</h3>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
            <Clock className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Withdrawals are processed manually within <strong>3 hours</strong>. We'll send
              the funds directly to your MoMo number and notify you when done.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">
                Amount (FCFA) <span className="text-gold">*</span>
              </label>
              <input
                type="number"
                min="1000"
                step="100"
                className="w-full h-11 rounded-lg px-3 bg-secondary border border-transparent focus:outline-none focus:border-gold text-sm"
                placeholder={`Max: ${formatXAF(availableBalance)}`}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available: {formatXAF(availableBalance)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">
                MoMo provider <span className="text-gold">*</span>
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
                Your MoMo number <span className="text-gold">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="tel"
                  className="w-full h-11 rounded-lg pl-9 pr-3 bg-secondary border border-transparent focus:outline-none focus:border-gold text-sm"
                  placeholder="6XX XXX XXX"
                  value={momoNumber}
                  onChange={(e) => setMomoNumber(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Button
            className="rounded-full bg-gold text-gold-foreground hover:bg-gold/90"
            disabled={requestWithdrawal.isPending || !withdrawAmount || !momoNumber.trim()}
            onClick={() => requestWithdrawal.mutate()}
          >
            {requestWithdrawal.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
            )}
            Submit withdrawal request
          </Button>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        {/* Wallet transactions */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-display font-semibold mb-4">Transaction history</h2>
          {txLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-gold" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No transactions yet. Your earnings will appear here after orders are completed.
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
                      {TX_TYPE_LABELS[tx.type] ?? tx.type}
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
                      tx.amount >= 0 ? "text-emerald-500" : "text-destructive"
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
          <h2 className="font-display font-semibold mb-4">Withdrawal requests</h2>
          {withdrawals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No withdrawal requests yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {withdrawals.map((w) => (
                <li key={w.id} className="rounded-xl border border-border p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display font-semibold">{formatXAF(w.amount)}</p>
                    <Badge
                      variant="outline"
                      className={`text-xs ${STATUS_COLORS[w.status] ?? ""}`}
                    >
                      {w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {w.momo_number} · {PROVIDER_LABELS[w.momo_provider] ?? w.momo_provider}
                  </p>
                  {w.note && <p className="text-xs text-muted-foreground">{w.note}</p>}
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
