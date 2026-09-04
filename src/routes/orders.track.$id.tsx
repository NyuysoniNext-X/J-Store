import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Package, Truck, MapPin, Check, ChevronLeft, X } from "lucide-react";
import { ORDERS, STATUS_META, type OrderStatus, type Order } from "@/lib/mock-orders";
import { formatXAF } from "@/lib/mock-data";

export const Route = createFileRoute("/orders/track/$id")({
  component: TrackOrderPage,
  loader: ({ params }) => {
    const order = ORDERS.find((o) => o.id === params.id);
    if (!order) throw notFound();
    return { order };
  },
  head: ({ params }) => ({ meta: [{ title: `Track ${params.id} — J-STORE.cm` }] }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-md py-20 px-6 text-center">
      <h1 className="font-display text-2xl font-bold">Order not found</h1>
      <p className="text-sm text-muted-foreground mt-2">
        We couldn't find an order with that reference.
      </p>
      <Link to="/orders" className="inline-block mt-6 text-gold font-medium">
        Back to my orders →
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-md py-20 px-6 text-center">
      <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
    </div>
  ),
});

const FLOW: { status: OrderStatus; icon: typeof Check; label: string }[] = [
  { status: "placed", icon: Check, label: "Order placed" },
  { status: "packed", icon: Package, label: "Packed by seller" },
  { status: "shipping", icon: Truck, label: "Out for delivery" },
  { status: "delivered", icon: MapPin, label: "Delivered" },
];

function progressIndex(status: OrderStatus) {
  if (status === "cancelled") return -1;
  return FLOW.findIndex((s) => s.status === status);
}

function TrackOrderPage() {
  const { order } = Route.useLoaderData() as { order: Order };
  const current = progressIndex(order.status);
  const meta = STATUS_META[order.status];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        to="/orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="h-4 w-4" /> All orders
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Order {order.id}</h1>
          <p className="text-muted-foreground mt-1">
            {order.date} · {order.address}
          </p>
        </div>
        <span
          className={`text-xs uppercase tracking-wider font-semibold px-3 py-1.5 rounded-full ${meta.tone}`}
        >
          {meta.label}
        </span>
      </div>

      {order.status === "cancelled" ? (
        <div className="mt-10 bg-card border border-destructive/30 rounded-3xl p-8 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <X className="h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold">This order was cancelled</p>
            <p className="text-sm text-muted-foreground">
              Any payment has been refunded to your MoMo wallet within 24h.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-10 bg-card border border-border rounded-3xl p-8">
          <div className="space-y-8">
            {FLOW.map((s, i) => {
              const done = i <= current;
              const active = i === current;
              const Icon = s.icon;
              return (
                <div key={s.status} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`h-11 w-11 rounded-full flex items-center justify-center ${done ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground"} ${active ? "ring-4 ring-gold/30" : ""}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    {i < FLOW.length - 1 && (
                      <div
                        className={`w-px flex-1 ${i < current ? "bg-gold" : "bg-border"} my-2`}
                      />
                    )}
                  </div>
                  <div className="pb-8">
                    <p className={`font-medium ${done ? "" : "text-muted-foreground"}`}>
                      {s.label}
                    </p>
                    {active && order.eta && (
                      <p className="text-xs text-gold mt-1 font-medium">Expected {order.eta}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {order.rider && order.status === "shipping" && (
        <div className="mt-6 p-6 bg-gradient-navy text-navy-foreground rounded-3xl flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-gold flex items-center justify-center text-gold-foreground font-bold">
            {order.rider[0]}
          </div>
          <div className="flex-1">
            <p className="font-semibold">{order.rider} — your J-STORE rider</p>
            <p className="text-xs text-navy-foreground/70">4.95 ★ · 1 200+ deliveries</p>
          </div>
          <button className="rounded-full bg-gold text-gold-foreground px-4 py-2 text-sm font-medium">
            Call
          </button>
        </div>
      )}

      {/* Items */}
      <div className="mt-8 bg-card border border-border rounded-3xl p-6">
        <h2 className="font-display font-semibold mb-4">Items ({order.itemsCount})</h2>
        <ul className="divide-y divide-border">
          {order.items.map((it, idx) => (
            <li key={idx} className="py-3 flex items-center justify-between gap-4 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{it.name}</p>
                <p className="text-xs text-muted-foreground">Qty {it.qty}</p>
              </div>
              <p className="font-semibold shrink-0">{formatXAF(it.price * it.qty)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="font-display text-lg font-bold">{formatXAF(order.total)}</span>
        </div>
      </div>
    </div>
  );
}
