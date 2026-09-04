import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatXAF } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/orders/")({
  component: OrdersList,
  head: () => ({ meta: [{ title: "My orders — J-STORE.cm" }] }),
});

const STATUS_TONE: Record<string, string> = {
  placed: "bg-secondary text-foreground",
  packed: "bg-secondary text-foreground",
  shipping: "bg-gold/15 text-gold border border-gold/30",
  delivered: "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30",
  cancelled: "bg-destructive/10 text-destructive border border-destructive/30",
};

function OrdersList() {
  const { user } = useAuth();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(qty)")
        .eq("buyer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Array<{
        id: string;
        total: number;
        status: string;
        address: string;
        created_at: string;
        order_items: { qty: number }[];
      }>;
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
            const itemsCount = o.order_items.reduce((s, i) => s + i.qty, 0);
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
                    <p className="font-semibold">#{o.id.slice(0, 8)}</p>
                    <span
                      className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${STATUS_TONE[o.status] ?? STATUS_TONE.placed}`}
                    >
                      {o.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {new Date(o.created_at).toLocaleDateString()} · {itemsCount} item
                    {itemsCount > 1 ? "s" : ""} · {o.address}
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
