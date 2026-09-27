import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
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

function formatAddress(address: Json | null): string {
  if (typeof address === "string") return address.trim() || "Address unavailable";
  if (!address || typeof address !== "object" || Array.isArray(address)) {
    return "Address unavailable";
  }
  return (
    [address.address, address.quarter, address.landmark, address.city]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .join(", ") || "Address unavailable"
  );
}

function OrdersList() {
  const { user } = useAuth();
  const {
    data: orders = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["my-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,order_number,total,status,delivery_address,created_at,order_items(quantity)")
        .eq("buyer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

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
      ) : orders.length === 0 ? (
        <div className="text-center py-20 bg-card border border-border rounded-3xl">
          <Package className="h-12 w-12 text-gold mx-auto mb-3" />
          <p className="font-display text-lg font-semibold">No orders yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            When you place an order, it will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const itemsCount = o.order_items.reduce((s, i) => s + i.quantity, 0);
            return (
              <Link
                key={o.id}
                to="/orders/track/$id"
                params={{ id: o.id }}
                className="group flex items-center gap-4 bg-card border border-border rounded-2xl p-4 md:p-5 hover:border-gold/40 hover:shadow-elegant transition-all"
              >
                <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <Package className="h-5 w-5 text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">#{o.order_number || o.id.slice(0, 8)}</p>
                    <span
                      className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${STATUS_TONE[o.status]}`}
                    >
                      {o.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {new Date(o.created_at).toLocaleDateString()} · {itemsCount} item
                    {itemsCount !== 1 ? "s" : ""} · {formatAddress(o.delivery_address)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display font-bold">{formatXAF(o.total)}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-gold transition-colors" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
