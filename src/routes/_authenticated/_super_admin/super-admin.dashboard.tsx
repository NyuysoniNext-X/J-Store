import { useI18n } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Crown,
  Users,
  Shield,
  Package,
  ShoppingBag,
  Activity,
  CheckCircle2,
  Loader2,
  Truck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/_super_admin/super-admin/dashboard")({
  component: SuperAdminDashboard,
  head: () => ({ meta: [{ title: "Super admin — J-STORE.cm" }] }),
});

function SuperAdminDashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: roles = [] } = useQuery({
    queryKey: ["sa-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });
  const { data: orderCount = 0 } = useQuery({
    queryKey: ["sa-orders"],
    queryFn: async () => {
      const { count } = await supabase.from("orders").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });
  const { data: productCount = 0 } = useQuery({
    queryKey: ["sa-products"],
    queryFn: async () => {
      const { count } = await supabase.from("products").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });
  const { data: userCount = 0 } = useQuery({
    queryKey: ["sa-users"],
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });
  const { data: applications = [], isLoading: appsLoading } = useQuery({
    queryKey: ["delivery-applications-review"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const review = useMutation({
    mutationFn: async ({
      appId,
      applicantId,
      status,
    }: {
      appId: string;
      applicantId: string;
      status: "approved" | "rejected";
    }) => {
      const { error: appError } = await supabase
        .from("delivery_applications")
        .update({ status, reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
        .eq("id", appId);
      if (appError) throw appError;
      if (status === "approved") {
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: applicantId, role: "delivery" });
        if (roleError && !roleError.message.toLowerCase().includes("duplicate")) throw roleError;
      }
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "approved" ? "Delivery access approved" : "Application rejected");
      qc.invalidateQueries({ queryKey: ["delivery-applications-review"] });
      qc.invalidateQueries({ queryKey: ["sa-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const admins = roles.filter((r) => r.role === "admin").length;
  const superAdmins = roles.filter((r) => r.role === "super_admin").length;
  const sellers = roles.filter((r) => r.role === "seller").length;
  const deliveryAccounts = roles.filter((r) => r.role === "delivery").length;

  const stats = [
    { label: "Users", value: userCount, icon: Users },
    { label: "Sellers", value: sellers, icon: Package },
    { label: "Admins", value: admins, icon: Shield },
    { label: "Super admins", value: superAdmins, icon: Crown },
    { label: "Delivery", value: deliveryAccounts, icon: Truck },
    { label: "Products", value: productCount, icon: Package },
    { label: "Orders", value: orderCount, icon: ShoppingBag },
  ];

  return (
    <div className="mx-auto max-w-[1536px] px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-12 w-12 rounded-2xl bg-gold text-gold-foreground flex items-center justify-center">
          <Crown className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">
            {t("roles.super_admin")}
          </p>
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            {t("roles.platform_control")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Owner-only view across the entire platform.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-card border border-border rounded-2xl p-4 shadow-elegant"
          >
            <s.icon className="h-4 w-4 text-gold mb-2" />
            <p className="font-display text-xl font-bold">{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="actions" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="actions">{t("roles.control_center")}</TabsTrigger>
          <TabsTrigger value="delivery">{t("roles.delivery_applications")}</TabsTrigger>
        </TabsList>
        <TabsContent value="actions" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/admin/dashboard"
            className="bg-card border border-border rounded-2xl p-6 hover:border-gold/40 transition-colors"
          >
            <Shield className="h-6 w-6 text-gold mb-3" />
            <h3 className="font-display font-semibold">{t("roles.admin_dashboard")}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Promote users to admin, revoke admin access, audit role grants.
            </p>
          </Link>
          <Link
            to="/admin/seller-applications"
            className="bg-card border border-border rounded-2xl p-6 hover:border-gold/40 transition-colors"
          >
            <Users className="h-6 w-6 text-gold mb-3" />
            <h3 className="font-display font-semibold">{t("roles.seller_applications")}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Review, approve or reject seller sign-up requests.
            </p>
          </Link>
          <Link
            to="/admin/products"
            className="bg-card border border-border rounded-2xl p-6 hover:border-gold/40 transition-colors"
          >
            <Package className="h-6 w-6 text-gold mb-3" />
            <h3 className="font-display font-semibold">{t("roles.product_approvals")}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Approve or reject seller product listings.
            </p>
          </Link>
          <Link
            to="/admin/payments"
            className="bg-card border border-border rounded-2xl p-6 hover:border-gold/40 transition-colors"
          >
            <Activity className="h-6 w-6 text-gold mb-3" />
            <h3 className="font-display font-semibold">{t("roles.payment_verifications")}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Confirm buyer MoMo transaction references.
            </p>
          </Link>
          <Link
            to="/admin/withdrawals"
            className="bg-card border border-border rounded-2xl p-6 hover:border-gold/40 transition-colors"
          >
            <ShoppingBag className="h-6 w-6 text-gold mb-3" />
            <h3 className="font-display font-semibold">{t("roles.withdrawal_requests")}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Process seller payout requests manually.
            </p>
          </Link>
          <Link
            to="/admin/seller-boosts"
            className="bg-card border border-border rounded-2xl p-6 hover:border-gold/40 transition-colors"
          >
            <Activity className="h-6 w-6 text-gold mb-3" />
            <h3 className="font-display font-semibold">{t("roles.seller_boosts")}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Set Featured, Top Seller, or Sponsored tiers.
            </p>
          </Link>
          <Link
            to="/super-admin/policies"
            className="bg-card border border-border rounded-2xl p-6 hover:border-gold/40 transition-colors"
          >
            <Activity className="h-6 w-6 text-gold mb-3" />
            <h3 className="font-display font-semibold">{t("roles.manage_policies")}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Update legal documents and platform agreements.
            </p>
          </Link>
        </TabsContent>
        <TabsContent value="delivery" className="rounded-3xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold">
                {t("roles.delivery_applications")}
              </h2>
              <p className="text-sm text-muted-foreground">
                Approve individual delivery partners and delivery companies.
              </p>
            </div>
            <Badge variant="outline">
              {applications.filter((app) => "pending" === app.status).length} pending
            </Badge>
          </div>
          {appsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-gold" />
            </div>
          ) : applications.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No delivery applications yet.
            </p>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <div key={app.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{app.company_name || app.full_name}</p>
                        <Badge variant="outline" className="capitalize">
                          {app.applicant_type}
                        </Badge>
                        <Badge className="capitalize bg-secondary text-secondary-foreground hover:bg-secondary">
                          {app.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {app.phone} · {app.city} ·{" "}
                        {app.vehicle_type || `${app.fleet_size ?? 0} vehicles`}
                      </p>
                      {app.coverage_zones && app.coverage_zones.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Zones: {app.coverage_zones.join(", ")}
                        </p>
                      )}
                      {app.motivation && (
                        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                          {app.motivation}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={review.isPending || app.status !== "pending"}
                        onClick={() =>
                          review.mutate({
                            appId: app.id,
                            applicantId: app.user_id,
                            status: "rejected",
                          })
                        }
                        className="rounded-full"
                      >
                        <XCircle className="mr-1.5 h-4 w-4" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={review.isPending || app.status !== "pending"}
                        onClick={() =>
                          review.mutate({
                            appId: app.id,
                            applicantId: app.user_id,
                            status: "approved",
                          })
                        }
                        className="rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
                      >
                        <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
