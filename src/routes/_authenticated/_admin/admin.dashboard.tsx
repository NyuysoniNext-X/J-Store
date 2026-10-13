import { useI18n } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  Users,
  Package,
  ShoppingBag,
  Loader2,
  Trash2,
  UserPlus,
  ClipboardList,
  Wallet,
  ArrowDownToLine,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/_admin/admin/dashboard")({
  component: AdminDashboard,
  head: () => ({ meta: [{ title: "Admin dashboard — J-STORE.cm" }] }),
});

function AdminDashboard() {
  const { t } = useI18n();
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const canManageAdmins = hasRole("super_admin");

  const { data: profiles = [], isLoading: pl } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: allRoles = [] } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data as Array<{ id: string; user_id: string; role: AppRole }>;
    },
  });
  const { data: orderCount = 0 } = useQuery({
    queryKey: ["admin-order-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
  const { data: productCount = 0 } = useQuery({
    queryKey: ["admin-product-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: pendingSellerApps = 0 } = useQuery({
    queryKey: ["admin-pending-seller-apps"],
    queryFn: async () => {
      const { count } = await supabase
        .from("seller_applications")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
  });

  const { data: pendingPayments = 0 } = useQuery({
    queryKey: ["admin-pending-payments"],
    queryFn: async () => {
      const { count } = await supabase
        .from("payment_verifications")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
  });

  const { data: pendingWithdrawals = 0 } = useQuery({
    queryKey: ["admin-pending-withdrawals"],
    queryFn: async () => {
      const { count } = await supabase
        .from("withdrawal_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
  });

  const { data: pendingProducts = 0 } = useQuery({
    queryKey: ["admin-pending-products"],
    queryFn: async () => {
      const { count } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_approval");
      return count ?? 0;
    },
  });

  const rolesByUser = new Map<string, AppRole[]>();
  for (const r of allRoles) {
    const arr = rolesByUser.get(r.user_id) ?? [];
    arr.push(r.role);
    rolesByUser.set(r.user_id, arr);
  }

  const grant = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(t("roles.granted_role", { role: v.role }));
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);
      if (error) throw error;
      return { userId, role };
    },
    onSuccess: (_d, v) => {
      toast.success(t("roles.revoked_role", { role: v.role }));
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
      // Force role refresh for all clients - trigger a realtime event
      // by updating the profile timestamp (non-destructive trigger)
      void supabase
        .from("profiles")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", v.userId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = [
    { label: t("roles.users"), value: profiles.length.toString(), icon: Users },
    {
      label: t("roles.sellers"),
      value: allRoles.filter((r) => r.role === "seller").length.toString(),
      icon: Shield,
    },
    { label: t("roles.products"), value: productCount.toString(), icon: Package },
    { label: t("roles.orders"), value: orderCount.toString(), icon: ShoppingBag },
  ];

  return (
    <div className="mx-auto max-w-384 px-6 py-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-navy text-navy-foreground flex items-center justify-center">
          <Shield className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">
            {t("roles.admin")}
          </p>
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            {t("roles.platform_overview")}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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

      {/* Quick-action nav cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link
          to="/admin/seller-applications"
          className="bg-card border border-border rounded-2xl p-5 hover:border-gold/40 transition-colors group"
        >
          <div className="flex items-start justify-between">
            <ClipboardList className="h-5 w-5 text-gold mb-3" />
            {pendingSellerApps > 0 && (
              <Badge className="bg-amber-500 text-white text-xs">{pendingSellerApps}</Badge>
            )}
          </div>
          <p className="font-display font-semibold group-hover:text-gold transition-colors">
            {t("roles.seller_applications")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("roles.review_approve_reject_seller_requests")}
          </p>
        </Link>
        <Link
          to="/admin/products"
          className="bg-card border border-border rounded-2xl p-5 hover:border-gold/40 transition-colors group"
        >
          <div className="flex items-start justify-between">
            <Package className="h-5 w-5 text-gold mb-3" />
            {pendingProducts > 0 && (
              <Badge className="bg-amber-500 text-white text-xs">{pendingProducts}</Badge>
            )}
          </div>
          <p className="font-display font-semibold group-hover:text-gold transition-colors">
            {t("roles.product_approvals")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("roles.approve_reject_seller_listings")}
          </p>
        </Link>
        <Link
          to="/admin/payments"
          className="bg-card border border-border rounded-2xl p-5 hover:border-gold/40 transition-colors group"
        >
          <div className="flex items-start justify-between">
            <Wallet className="h-5 w-5 text-gold mb-3" />
            {pendingPayments > 0 && (
              <Badge className="bg-amber-500 text-white text-xs">{pendingPayments}</Badge>
            )}
          </div>
          <p className="font-display font-semibold group-hover:text-gold transition-colors">
            {t("roles.payment_verifications")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{t("roles.confirm_buyer_momo_refs")}</p>
        </Link>
        <Link
          to="/admin/withdrawals"
          className="bg-card border border-border rounded-2xl p-5 hover:border-gold/40 transition-colors group"
        >
          <div className="flex items-start justify-between">
            <ArrowDownToLine className="h-5 w-5 text-gold mb-3" />
            {pendingWithdrawals > 0 && (
              <Badge className="bg-amber-500 text-white text-xs">{pendingWithdrawals}</Badge>
            )}
          </div>
          <p className="font-display font-semibold group-hover:text-gold transition-colors">
            {t("roles.withdrawal_requests")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("roles.process_seller_payout_requests")}
          </p>
        </Link>
        <Link
          to="/admin/users"
          className="bg-card border border-border rounded-2xl p-5 hover:border-gold/40 transition-colors group"
        >
          <div className="flex items-start justify-between">
            <Users className="h-5 w-5 text-gold mb-3" />
          </div>
          <p className="font-display font-semibold group-hover:text-gold transition-colors">
            {t("roles.user_role_management_title")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("roles.manage_users_roles_detail")}
          </p>
        </Link>
      </div>

      <div className="bg-card border border-border rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold">{t("roles.users_roles")}</h2>
          <Link to="/admin/products" className="text-xs text-gold font-medium hover:underline">
            {t("roles.moderate_products")}
          </Link>
        </div>
        {pl ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-gold" />
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm min-w-140">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left font-medium py-2">{t("roles.user")}</th>
                  <th className="text-left font-medium py-2">{t("roles.phone_city")}</th>
                  <th className="text-left font-medium py-2">{t("roles.roles")}</th>
                  <th className="text-right font-medium py-2">{t("roles.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {profiles.map((p) => {
                  const r = rolesByUser.get(p.id) ?? [];
                  const isAdmin = r.includes("admin") || r.includes("super_admin");
                  return (
                    <tr key={p.id}>
                      <td className="py-3">
                        <p className="font-medium">{p.display_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-45">{p.id}</p>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {p.phone ?? "—"} · {p.city ?? "—"}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          {r.length === 0 ? (
                            <span className="text-xs text-muted-foreground">{t("roles.none")}</span>
                          ) : (
                            r.map((x) => (
                              <Badge key={x} variant="outline" className="text-[10px]">
                                {x}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        {!r.includes("seller") ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => grant.mutate({ userId: p.id, role: "seller" })}
                          >
                            <UserPlus className="h-3 w-3 mr-1" /> {t("roles.seller")}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-destructive"
                            onClick={() => revoke.mutate({ userId: p.id, role: "seller" })}
                          >
                            <Trash2 className="h-3 w-3 mr-1" /> {t("roles.revoke_seller")}
                          </Button>
                        )}
                        {canManageAdmins && !isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => grant.mutate({ userId: p.id, role: "admin" })}
                          >
                            <Shield className="h-3 w-3 mr-1" /> {t("roles.make_admin")}
                          </Button>
                        )}
                        {canManageAdmins && r.includes("admin") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-destructive"
                            onClick={() => revoke.mutate({ userId: p.id, role: "admin" })}
                          >
                            <Trash2 className="h-3 w-3 mr-1" /> {t("roles.revoke_admin")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
