import { useI18n } from "@/lib/i18n";
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
import type { Json, Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { formatXAF } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/delivery/dashboard")({
  component: DeliveryDashboard,
  head: () => ({ meta: [{ title: "Delivery dashboard — J-STORE.cm" }] }),
});

type DeliveryOrder = Tables<"deliveries"> & {
  order: { total: number; address: string } | null;
};

type DeliveryAction = {
  id: string;
  status: "assigned" | "picked_up" | "delivered";
  previousStatus: Tables<"deliveries">["status"];
};

function formatAddress(parts: Array<string | null | undefined>): string {
  return (
    parts
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .join(", ") || "Address unavailable"
  );
}

function DeliveryDashboard() {
  const { t } = useI18n();
  const { user, hasAnyRole } = useAuth();
  const qc = useQueryClient();
  const canAccess = hasAnyRole(["delivery", "admin", "super_admin"]);

  const {
    data: personnel,
    isLoading: personnelLoading,
    isError: personnelError,
  } = useQuery({
    queryKey: ["delivery-personnel", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_personnel")
        .select("id,is_approved")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && canAccess,
  });

  const {
    data: orders = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["delivery-orders", user?.id],
    queryFn: async () => {
      // Couriers can't read orders/order_groups directly (buyer privacy), so
      // this goes through a function that returns only what a delivery needs.
      const { data, error } = await supabase.rpc("get_courier_deliveries");
      if (error) throw error;
      return (data ?? []).map(
        ({
          order_total,
          ship_recipient,
          ship_phone,
          ship_city,
          ship_quarter,
          ship_landmark,
          ...delivery
        }): DeliveryOrder => ({
          ...delivery,
          order: {
            total: order_total,
            address: formatAddress([
              ship_recipient,
              ship_phone,
              ship_landmark,
              ship_quarter,
              ship_city,
            ]),
          },
        }),
      );
    },
    enabled: !!user && canAccess,
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, status, previousStatus }: DeliveryAction) => {
      if (!personnel?.is_approved)
        throw new Error(t("roles.an_approved_delivery_profile_is_required"));
      const now = new Date().toISOString();
      let query = supabase
        .from("deliveries")
        .update({
          status,
          ...(status === "assigned"
            ? { delivery_personnel_id: personnel.id, assigned_at: now }
            : {}),
          ...(status === "picked_up" ? { picked_up_at: now } : {}),
          ...(status === "delivered" ? { delivered_at: now } : {}),
        })
        .eq("id", id)
        .eq("status", previousStatus);
      query =
        status === "assigned"
          ? query.is("delivery_personnel_id", null)
          : query.eq("delivery_personnel_id", personnel.id);
      const { data, error } = await query.select("id").maybeSingle();
      if (error) throw error;
      if (!data)
        throw new Error(t("roles.delivery_changed_or_access_was_denied_refresh_and_try_again"));
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["delivery-orders", user?.id] });
      toast.success(t("roles.delivery_updated"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assigned = orders.filter((o) => o.delivery_personnel_id === personnel?.id);
  const available = orders.filter((o) => !o.delivery_personnel_id && o.status === "unassigned");
  const stats = [
    { label: t("roles.assigned"), value: assigned.length, icon: Truck },
    { label: t("roles.available"), value: available.length, icon: PackageCheck },
    {
      label: t("roles.in_transit"),
      value: assigned.filter((o) => ["picked_up", "in_transit"].includes(o.status)).length,
      icon: Clock,
    },
  ];

  if (!canAccess) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <Truck className="mx-auto mb-4 h-12 w-12 text-gold" />
        <h1 className="font-display text-2xl font-bold">{t("roles.delivery_access_required")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("roles.apply_and_wait_for_approval_before_opening_the_delivery_dashboard")}
        </p>
        <Button
          asChild
          className="mt-6 rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
        >
          <Link to="/delivery/apply">{t("roles.apply_for_delivery")}</Link>
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
            {t("roles.delivery_dashboard")}
          </p>
          <h1 className="font-display text-3xl font-bold md:text-4xl">
            {t("roles.delivery_workbench")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("roles.claim_available_orders_mark_pickups_and_confirm_drop_off")}
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

      {isLoading || personnelLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : isError || personnelError ? (
        <p role="alert" className="py-10 text-center text-destructive">
          {t("roles.unable_to_load_deliveries_please_refresh_and_try_again")}
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {!personnel?.is_approved && (
            <p className="text-sm text-muted-foreground lg:col-span-2">
              {t(
                "roles.an_approved_delivery_profile_is_required_to_claim_or_update_deliveries_contact_an_administrator",
              )}
            </p>
          )}
          <OrderColumn
            title={t("roles.my_deliveries")}
            orders={assigned}
            empty={t("roles.no_deliveries_assigned_yet")}
            canUpdate={!!personnel?.is_approved}
            updateOrder={updateOrder}
          />
          <OrderColumn
            title={t("roles.available_pickups")}
            orders={available}
            empty={t("roles.no_available_pickups_right_now")}
            canUpdate={!!personnel?.is_approved}
            updateOrder={updateOrder}
          />
        </div>
      )}
    </div>
  );
}

type DeliveryUpdateMutation = UseMutationResult<void, Error, DeliveryAction>;

function OrderColumn({
  title,
  orders,
  empty,
  canUpdate,
  updateOrder,
}: {
  title: string;
  orders: DeliveryOrder[];
  empty: string;
  canUpdate: boolean;
  updateOrder: DeliveryUpdateMutation;
}) {
  const { t } = useI18n();
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
                  <p className="font-semibold">#{order.order_id.slice(0, 8)}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />{" "}
                    {order.order?.address ?? t("roles.address_unavailable")}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {order.status.replaceAll("_", " ")}
                </Badge>
              </div>
              <div className="mb-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("roles.order_total")}</span>
                <span className="font-semibold">
                  {order.order ? formatXAF(order.order.total) : "Unavailable"}
                </span>
              </div>
              {!order.delivery_personnel_id ? (
                <Button
                  size="sm"
                  disabled={!canUpdate || updateOrder.isPending}
                  onClick={() =>
                    updateOrder.mutate({
                      id: order.id,
                      status: "assigned",
                      previousStatus: order.status,
                    })
                  }
                  className="rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
                >
                  {t("roles.claim_delivery")}
                </Button>
              ) : order.status === "assigned" ? (
                <Button
                  size="sm"
                  disabled={!canUpdate || updateOrder.isPending}
                  onClick={() =>
                    updateOrder.mutate({
                      id: order.id,
                      status: "picked_up",
                      previousStatus: order.status,
                    })
                  }
                  className="rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
                >
                  {t("roles.mark_picked_up")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={!canUpdate || updateOrder.isPending}
                  onClick={() =>
                    updateOrder.mutate({
                      id: order.id,
                      status: "delivered",
                      previousStatus: order.status,
                    })
                  }
                  className="rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> {t("roles.mark_delivered")}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
