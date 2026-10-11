import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Package, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { formatXAF } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/orders/")({
  component: OrdersList,
  head: () => ({ meta: [{ title: "My orders — J-STORE.cm" }] }),
});

const STATUS_TONE: Record<Tables<"orders">["status"], string> = {
  pending: "bg-secondary text-foreground",
  confirmed: "bg-secondary text-foreground",
  processing: "bg-secondary text-foreground",
  shipped: "bg-gold/15 text-gold border border-gold/30",
  out_for_delivery: "bg-gold/15 text-gold border border-gold/30",
  delivered: "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30",
  completed: "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30",
  cancelled: "bg-destructive/10 text-destructive border border-destructive/30",
  disputed: "bg-destructive/10 text-destructive border border-destructive/30",
  refunded: "bg-secondary text-foreground",
};

const AMBER = "bg-amber-500/15 text-amber-600 border border-amber-500/30";
const GREEN = "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30";
const RED = "bg-destructive/10 text-destructive border border-destructive/30";

function paymentBadge(status: string): { text: string; tone: string } | null {
  if (status === "pending") return { text: "Awaiting payment", tone: AMBER };
  if (status === "failed") return { text: "Payment failed / cancelled", tone: RED };
  if (status === "refunded") return { text: "Refunded", tone: STATUS_TONE.refunded };
  return null; // held_in_escrow / released => paid, so the order status says it all
}

type OrderGroupRow = {
  id: string;
  group_number: string;
  total: number;
  payment_status: string;
  payment_method: string;
  created_at: string;
  shipping_city: string | null;
  shipping_quarter: string | null;
  shipping_landmark: string | null;
  orders: { id: string; status: Tables<"orders">["status"]; order_items: { quantity: number }[] }[];
};

function OrdersList() {
  const { user } = useAuth();
  const [checking, setChecking] = useState<string | null>(null);
  const {
    data: groups = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["my-orders", user?.id],
    queryFn: async () => {
      // One checkout = one order group (one payment) containing one order per seller.
      const { data, error } = await supabase
        .from("order_groups")
        .select(
          "id, group_number, total, payment_status, payment_method, created_at, shipping_city, shipping_quarter, shipping_landmark, orders(id, status, order_items(quantity))",
        )
        .eq("buyer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as OrderGroupRow[];
    },
    enabled: !!user,
  });

  async function checkPayment(groupId: string) {
    setChecking(groupId);
    try {
      const { data, error } = await supabase.functions.invoke("payments/status", {
        body: { order_group_id: groupId },
      });
      if (error || !data) throw new Error("Could not check right now. Please try again.");
      if (data.error) throw new Error(data.error);
      if (data.status === "successful") toast.success("Payment confirmed ✅");
      else if (data.status === "pending")
        toast.info("Still waiting for MTN / Orange to confirm. Try again in a minute.");
      else if (data.status === "none")
        toast.info("No instant payment was started for this order. If you paid manually, we will verify it soon.");
      else toast.error(data.reason ?? "The payment was not completed.");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not check the payment.");
    } finally {
      setChecking(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold mb-1">My orders</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold">Recent orders</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track shipments and reorder favourites.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : isError ? (
        <div role="alert" className="py-20 text-center">
          <p className="mb-4 text-sm text-destructive">
            Unable to load your orders. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20 bg-card border border-border rounded-3xl">
          <Package className="h-12 w-12 text-gold mx-auto mb-3" />
          <p className="font-display text-lg font-semibold">No orders yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            When you place an order, it will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const itemsCount = g.orders.reduce(
              (n, o) => n + o.order_items.reduce((s, i) => s + i.quantity, 0),
              0,
            );
            const pay = paymentBadge(g.payment_status);
            const statuses = [...new Set(g.orders.map((o) => o.status))];
            const first = g.orders[0];
            const address = [g.shipping_landmark, g.shipping_quarter, g.shipping_city]
              .filter((p): p is string => !!p && p.trim().length > 0)
              .join(", ");
            const canCheck =
              g.payment_status === "pending" &&
              (g.payment_method === "mtn_momo" || g.payment_method === "orange_money");
            const body = (
              <>
                <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <Package className="h-5 w-5 text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">#{g.group_number}</p>
                    {pay ? (
                      <span
                        className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${pay.tone}`}
                      >
                        {pay.text}
                      </span>
                    ) : (
                      statuses.map((st) => (
                        <span
                          key={st}
                          className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${STATUS_TONE[st]}`}
                        >
                          {st.replaceAll("_", " ")}
                        </span>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {new Date(g.created_at).toLocaleDateString()} · {itemsCount} item
                    {itemsCount !== 1 ? "s" : ""} · {address || "Address unavailable"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display font-bold">{formatXAF(g.total)}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-gold transition-colors" />
              </>
            );
            const cardClass =
              "group flex items-center gap-4 p-4 md:p-5 hover:bg-muted/20 transition-colors";
            return (
              <div
                key={g.id}
                className="bg-card border border-border rounded-2xl overflow-hidden hover:border-gold/40 transition-all"
              >
                {first ? (
                  <Link to="/orders/track/$id" params={{ id: first.id }} className={cardClass}>
                    {body}
                  </Link>
                ) : (
                  <div className={cardClass}>{body}</div>
                )}
                {canCheck && (
                  <div className="flex items-center justify-between gap-3 border-t border-border bg-amber-500/5 px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      Paid already? It can take a minute to confirm.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full h-8 text-xs"
                      disabled={checking === g.id}
                      onClick={() => checkPayment(g.id)}
                    >
                      {checking === g.id ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Check payment status
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
