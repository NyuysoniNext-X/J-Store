import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, MapPin, PackageCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatXAF } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/delivery/dashboard")({
  component: DeliveryDashboard,
  head: () => ({ meta: [{ title: "Delivery dashboard — J-STORE.cm" }] }),
});

type DeliveryOrder = {
  id: string;
  address: string;
  city: string | null;
  phone: string | null;
  total: number;
  status: string;
  delivery_status: string;
  rider_id: string | null;
  created_at: string;
};

function DeliveryDashboard() {
  const { user, hasAnyRole } = useAuth();
  const qc = useQueryClient();
  const canAccess = hasAnyRole(["delivery", "admin", "super_admin"]);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["delivery-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,address,city,phone,total,status,delivery_status,rider_id,created_at")
        .in("delivery_status", ["unassigned", "assigned", "picked_up", "out_for_delivery"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DeliveryOrder[];
    },
    enabled: !!user && canAccess,
  });

  const updateOrder = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<DeliveryOrder> & {
        picked_up_at?: string;
        delivered_at?: string;
        awaiting_buyer_confirm?: boolean;
      };
    }) => {
      const { error } = await supabase.from("orders").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Delivery updated");
      qc.invalidateQueries({ queryKey: ["delivery-orders", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assigned = orders.filter((o) => o.rider_id === user?.id);
  const available = orders.filter((o) => !o.rider_id);
  const stats = [
    { label: "Assigned", value: assigned.length, icon: Truck },
    { label: "Available", value: available.length, icon: PackageCheck },
    {
      label: "In transit",
      value: assigned.filter((o) => ["picked_up", "out_for_delivery"].includes(o.delivery_status))
        .length,
      icon: Clock,
    },
  ];

  if (!canAccess) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <Truck className="mx-auto mb-4 h-12 w-12 text-gold" />
        <h1 className="font-display text-2xl font-bold">Delivery access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apply and wait for approval before opening the delivery dashboard.
        </p>
        <Button
          asChild
          className="mt-6 rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
        >
          <Link to="/delivery/apply">Apply for delivery</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1536px] px-6 py-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy text-navy-foreground">
          <Truck className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Delivery dashboard
          </p>
          <h1 className="font-display text-3xl font-bold md:text-4xl">Delivery workbench</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Claim available orders, mark pickups, and confirm drop-off.
          </p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border bg-card p-5 shadow-elegant"
          >
            <s.icon className="mb-3 h-5 w-5 text-gold" />
            <p className="font-display text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <OrderColumn
            title="My deliveries"
            orders={assigned}
            empty="No deliveries assigned yet."
            userId={user!.id}
            updateOrder={updateOrder}
          />
          <OrderColumn
            title="Available pickups"
            orders={available}
            empty="No available pickups right now."
            userId={user!.id}
            updateOrder={updateOrder}
          />
        </div>
      )}
    </div>
  );
}

type DeliveryUpdateMutation = UseMutationResult<
  void,
  Error,
  {
    id: string;
    patch: Partial<DeliveryOrder> & {
      picked_up_at?: string;
      delivered_at?: string;
      awaiting_buyer_confirm?: boolean;
    };
  }
>;

function OrderColumn({
  title,
  orders,
  empty,
  userId,
  updateOrder,
}: {
  title: string;
  orders: DeliveryOrder[];
  empty: string;
  userId: string;
  updateOrder: DeliveryUpdateMutation;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <h2 className="mb-4 font-display text-xl font-semibold">{title}</h2>
      {orders.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl border border-border p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">#{order.id.slice(0, 8)}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {order.address}, {order.city ?? "Cameroon"}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {order.delivery_status.replaceAll("_", " ")}
                </Badge>
              </div>
              <div className="mb-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Order total</span>
                <span className="font-semibold">{formatXAF(order.total)}</span>
              </div>
              {!order.rider_id ? (
                <Button
                  size="sm"
                  disabled={updateOrder.isPending}
                  onClick={() =>
                    updateOrder.mutate({
                      id: order.id,
                      patch: { rider_id: userId, delivery_status: "assigned" },
                    })
                  }
                  className="rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
                >
                  Claim delivery
                </Button>
              ) : order.delivery_status === "assigned" ? (
                <Button
                  size="sm"
                  disabled={updateOrder.isPending}
                  onClick={() =>
                    updateOrder.mutate({
                      id: order.id,
                      patch: {
                        delivery_status: "picked_up",
                        picked_up_at: new Date().toISOString(),
                      },
                    })
                  }
                  className="rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
                >
                  Mark picked up
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={updateOrder.isPending}
                  onClick={() =>
                    updateOrder.mutate({
                      id: order.id,
                      patch: {
                        delivery_status: "delivered",
                        status: "delivered",
                        delivered_at: new Date().toISOString(),
                        awaiting_buyer_confirm: true,
                      },
                    })
                  }
                  className="rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Mark delivered
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
