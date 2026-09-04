import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Package, TrendingUp, Wallet, Plus, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatXAF } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_seller/seller/dashboard")({
  component: SellerDashboard,
  head: () => ({ meta: [{ title: "Seller dashboard — J-STORE.cm" }] }),
});

function SellerDashboard() {
  const { user } = useAuth();

  const { data: products = [] } = useQuery({
    queryKey: ["seller-products", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("seller_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["seller-order-items", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, orders(created_at, status)")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Array<{
        id: string;
        name: string;
        unit_price: number;
        qty: number;
        created_at: string;
        orders: { created_at: string; status: string } | null;
      }>;
    },
    enabled: !!user,
  });

  const revenue = useMemo(() => items.reduce((s, i) => s + i.unit_price * i.qty, 0), [items]);
  const last7 = useMemo(() => {
    const days: { day: string; total: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString("en", { weekday: "short" });
      const total = items
        .filter((it) => (it.created_at || "").slice(0, 10) === key)
        .reduce((s, it) => s + it.unit_price * it.qty, 0);
      days.push({ day: dayLabel, total });
    }
    return days;
  }, [items]);
  const maxBar = Math.max(1, ...last7.map((d) => d.total));

  const stats = [
    { label: "Revenue (all-time)", value: formatXAF(revenue), icon: Wallet },
    { label: "Items sold", value: items.reduce((s, i) => s + i.qty, 0).toString(), icon: Package },
    {
      label: "Active products",
      value: products.filter((p) => p.active).length.toString(),
      icon: ListChecks,
    },
    { label: "Total products", value: products.length.toString(), icon: TrendingUp },
  ];

  return (
    <div className="mx-auto max-w-[1536px] px-6 py-10">
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold mb-1">
            Seller dashboard
          </p>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
        </div>
        <Button
          asChild
          className="rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
        >
          <Link to="/seller/products">
            <Plus className="h-4 w-4 mr-1.5" /> Manage products
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-card border border-border rounded-2xl p-5 shadow-elegant"
          >
            <s.icon className="h-5 w-5 text-gold mb-3" />
            <p className="font-display text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
          <h2 className="font-display font-semibold mb-4">Sales · last 7 days</h2>
          <div className="flex items-end gap-3 h-44">
            {last7.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1.5">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-gold to-gold/40 transition-all"
                  style={{ height: `${(d.total / maxBar) * 100}%`, minHeight: 4 }}
                  title={formatXAF(d.total)}
                />
                <span className="text-[10px] text-muted-foreground">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent sold items */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-display font-semibold mb-4">Recent sales</h2>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales yet.</p>
          ) : (
            <ul className="text-sm space-y-3">
              {items.slice(0, 6).map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3">
                  <span className="truncate flex-1">
                    {it.name} <span className="text-muted-foreground">×{it.qty}</span>
                  </span>
                  <span className="font-semibold whitespace-nowrap">
                    {formatXAF(it.unit_price * it.qty)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
