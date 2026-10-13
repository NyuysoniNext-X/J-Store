import { useI18n } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Store, User as UserIcon, Shield, Check, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";

const SWITCHABLE: { role: AppRole; label: string; icon: typeof UserIcon; desc: string }[] = [
  {
    role: "customer",
    label: "roles.customer",
    icon: UserIcon,
    desc: "roles.buy_products_track_orders_leave_reviews",
  },
];

export function RoleSwitcher() {
  const { t } = useI18n();
  const { user, roles, refreshRoles } = useAuth();
  const qc = useQueryClient();

  // Check if user has a pending/approved seller application
  const { data: sellerApp } = useQuery({
    queryKey: ["seller-app-status", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("seller_applications")
        .select("status, store_name")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { status: string; store_name: string } | null;
    },
    enabled: !!user,
  });

  const isSeller = roles.includes("seller");

  const claim = useMutation({
    mutationFn: async (role: AppRole) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: user!.id, role });
      if (error) throw error;
    },
    onSuccess: (_d, role) => {
      toast.success(t("roles.you_are_now_a_role", { role: t(`roles.${role}`) }));
      qc.invalidateQueries({ queryKey: ["roles", user?.id] });
      // Hard refresh of auth roles (auth.tsx fetches on session change; force a re-fetch via reload of roles).
      window.location.reload();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const release = useMutation({
    mutationFn: async (role: AppRole) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", user!.id)
        .eq("role", role);
      if (error) throw error;
      return role;
    },
    onSuccess: async (_d, role) => {
      toast.success(t("roles.released_role", { role: t(`roles.${role}`) }));

      // Immediately update local state (optimistic update)
      const updatedRoles = roles.filter((r) => r !== role);

      // Force refresh from database
      await refreshRoles();

      // If releasing seller role, navigate away from seller routes
      if (role === "seller" && window.location.pathname.includes("/seller/")) {
        window.location.href = "/account";
      } else {
        // For other roles, just reload to update UI
        window.location.reload();
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-elegant">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-xl font-bold">{t("roles.roles_access")}</h2>
        {(roles.includes("admin") || roles.includes("super_admin")) && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-navy text-navy-foreground">
            <Shield className="h-3.5 w-3.5" />{" "}
            {roles.includes("super_admin") ? t("roles.super_admin") : t("roles.admin")}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        {t(
          "roles.switch_on_the_role_you_need_admin_access_is_granted_manually_by_the_platform_team",
        )}
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        {/* Switchable roles (customer only) */}
        {SWITCHABLE.map(({ role, label, icon: Icon, desc }) => {
          const has = roles.includes(role);
          const pending = claim.isPending || release.isPending;
          return (
            <div
              key={role}
              className={`rounded-2xl border p-4 flex items-start gap-3 transition-colors ${has ? "border-gold/50 bg-gold/5" : "border-border"}`}
            >
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${has ? "bg-gold text-gold-foreground" : "bg-secondary text-foreground"}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{t(label)}</p>
                  {has && <Check className="h-3.5 w-3.5 text-gold" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{t(desc)}</p>
                <div className="mt-3">
                  {has ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full h-8 text-xs"
                      disabled={pending}
                      onClick={() => release.mutate(role)}
                    >
                      {pending && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                      {t("roles.release")}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="rounded-full h-8 text-xs bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
                      disabled={pending}
                      onClick={() => claim.mutate(role)}
                    >
                      {pending && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                      {t("roles.activate")}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Seller role — application-gated */}
        <div
          className={`rounded-2xl border p-4 flex items-start gap-3 transition-colors ${isSeller ? "border-gold/50 bg-gold/5" : "border-border"}`}
        >
          <div
            className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${isSeller ? "bg-gold text-gold-foreground" : "bg-secondary text-foreground"}`}
          >
            <Store className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">{t("roles.seller")}</p>
              {isSeller && <Check className="h-3.5 w-3.5 text-gold" />}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("roles.list_products_manage_orders_withdraw_earnings")}
            </p>
            <div className="mt-3">
              {isSeller ? (
                <div className="flex items-center gap-2">
                  <Badge className="bg-gold-500/15 text-gold-700 border-gold-500/30 border text-xs">
                    {t("roles.active_seller")}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full h-8 text-xs"
                    disabled={claim.isPending || release.isPending}
                    onClick={() => release.mutate("seller")}
                  >
                    {release.isPending && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                    {t("roles.release")}
                  </Button>
                </div>
              ) : sellerApp?.status === "approved" ? (
                <div className="flex items-center gap-2">
                  <Badge className="bg-gold-500/15 text-gold-700 border-gold-500/30 border text-xs">
                    {t("roles.application_approved")}
                  </Badge>
                  <Button
                    size="sm"
                    className="rounded-full h-8 text-xs bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
                    disabled={claim.isPending || release.isPending}
                    onClick={() => claim.mutate("seller")}
                  >
                    {claim.isPending && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                    {t("roles.activate")}
                  </Button>
                </div>
              ) : sellerApp?.status === "pending" ? (
                <div className="space-y-1">
                  <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 border text-xs">
                    {t("roles.application_pending_review")}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    {t("roles.we_will_notify_you_within_24_hours")}
                  </p>
                </div>
              ) : sellerApp?.status === "info_requested" ? (
                <div className="space-y-1">
                  <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 border text-xs">
                    {t("roles.more_info_requested")}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    {t("roles.check_your_notifications_for_details")}
                  </p>
                </div>
              ) : sellerApp?.status === "rejected" ? (
                <div className="space-y-1">
                  <Badge className="bg-destructive/15 text-destructive border-destructive/30 border text-xs">
                    {t("roles.application_rejected")}
                  </Badge>
                  <Link
                    to="/seller/register"
                    className="text-xs text-gold hover:underline block mt-1"
                  >
                    <ClipboardList className="h-3 w-3 inline mr-1" />
                    {t("roles.reapply")}
                  </Link>
                </div>
              ) : (
                <Link to="/seller/register">
                  <Button
                    size="sm"
                    className="rounded-full h-8 text-xs bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
                  >
                    <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
                    {t("roles.apply_to_sell")}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
