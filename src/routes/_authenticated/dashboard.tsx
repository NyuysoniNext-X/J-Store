import { useI18n } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Store,
  Users,
  Wallet,
  ShieldCheck,
  Truck,
  Settings,
  LogOut,
  Sparkles,
  Crown,
  Shield,
} from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatFCFA } from "@/lib/format";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — J-STORE.cm" }] }),
});

// ── Role-specific content maps ────────────────────────────────────────────────

function greeting(role: AppRole | string | undefined, t: (key: string) => string): string {
  switch (role) {
    case "seller":
      return t("roles.seller_dashboard");
    case "admin":
      return t("roles.admin_console");
    case "super_admin":
      return t("roles.super_admin_control");
    case "delivery":
      return t("roles.delivery_hub");
    default:
      return t("roles.my_account");
  }
}

function navItems(role: AppRole | string | undefined, t: (key: string) => string) {
  const common = { icon: LayoutDashboard, label: t("roles.overview") };
  const map: Record<string, { icon: typeof LayoutDashboard; label: string; to: string }[]> = {
    customer: [
      { ...common, to: "/dashboard" },
      { icon: ShoppingBag, label: t("roles.my_orders"), to: "/orders" },
      { icon: Package, label: t("roles.wishlist"), to: "/wishlist" },
      { icon: Wallet, label: t("roles.profile"), to: "/profile" },
    ],
    seller: [
      { ...common, to: "/dashboard" },
      { icon: Package, label: t("roles.products"), to: "/seller/products" },
      { icon: ShoppingBag, label: t("roles.orders"), to: "/orders" },
      { icon: Sparkles, label: t("roles.analytics"), to: "/seller/dashboard" },
      { icon: Wallet, label: t("roles.earnings"), to: "/seller/dashboard" },
    ],
    admin: [
      { ...common, to: "/dashboard" },
      { icon: Store, label: t("roles.sellers"), to: "/admin/dashboard" },
      { icon: Package, label: t("roles.products"), to: "/admin/products" },
      { icon: Users, label: t("roles.users"), to: "/admin/dashboard" },
    ],
    super_admin: [
      { ...common, to: "/dashboard" },
      { icon: Users, label: t("roles.admins"), to: "/super-admin/dashboard" },
      { icon: Wallet, label: t("roles.finance"), to: "/super-admin/dashboard" },
      { icon: Settings, label: t("roles.settings"), to: "/super-admin/dashboard" },
      { icon: ShieldCheck, label: t("roles.audit"), to: "/super-admin/dashboard" },
    ],
    delivery: [
      { ...common, to: "/dashboard" },
      { icon: Truck, label: t("roles.deliveries"), to: "/delivery/dashboard" },
      { icon: Wallet, label: t("roles.earnings"), to: "/delivery/dashboard" },
    ],
  };
  return map[role ?? "customer"] ?? map.customer;
}

function stats(role: AppRole | string | undefined, t: (key: string) => string) {
  const s = (label: string, value: string, delta: string, icon: typeof Wallet) => ({
    label,
    value,
    delta,
    icon,
  });
  switch (role) {
    case "seller":
      return [
        s(
          t("roles.revenue_30d"),
          formatFCFA(845_000),
          t("roles.up_12_percent_vs_last_month"),
          Wallet,
        ),
        s(t("roles.orders"), "38", t("roles.up_5_this_week"), ShoppingBag),
        s(t("roles.active_products"), "24", t("roles.2_low_stock"), Package),
      ];
    case "admin":
      return [
        s(t("roles.platform_gmv"), formatFCFA(12_400_000), t("roles.up_8_percent"), Wallet),
        s(t("roles.pending_approvals"), "6", t("roles.kyc_queue"), Store),
        s(t("roles.new_users_7d"), "142", t("roles.up_23_percent"), Users),
      ];
    case "super_admin":
      return [
        s(t("roles.escrow_balance"), formatFCFA(3_120_000), t("roles.held_funds"), Wallet),
        s(t("roles.commission_30d"), formatFCFA(620_000), t("roles.5_percent_of_gmv"), ShieldCheck),
        s(t("roles.active_sellers"), "184", t("roles.up_9"), Store),
      ];
    case "delivery":
      return [
        s(t("roles.deliveries_today"), "7", t("roles.3_in_transit"), Truck),
        s(t("roles.earnings_week"), formatFCFA(18_500), t("roles.up_2_vs_last_week"), Wallet),
        s(t("roles.avg_rating"), "4.8", t("roles.32_ratings"), Sparkles),
      ];
    default:
      return [
        s(t("roles.total_orders"), "5", t("roles.1_in_transit"), ShoppingBag),
        s(t("roles.wishlist_items"), "12", t("roles.on_sale_now"), Package),
        s(t("roles.loyalty_points"), "320", t("roles.spend_to_level_up"), Sparkles),
      ];
  }
}

function panelTitle(role: AppRole | string | undefined, t: (key: string) => string) {
  if (role === "seller") return t("roles.your_seller_toolkit");
  if (role === "admin") return t("roles.platform_moderation");
  if (role === "super_admin") return t("roles.platform_controls");
  if (role === "delivery") return t("roles.your_delivery_tools");
  return t("roles.quick_actions");
}

function features(role: AppRole | string | undefined, t: (key: string) => string): string[] {
  const map: Record<string, string[]> = {
    customer: [
      t("roles.order_tracking"),
      t("roles.order_history"),
      t("roles.wishlist"),
      t("roles.reviews_ratings"),
      t("roles.saved_addresses"),
      t("roles.notifications"),
    ],
    seller: [
      t("roles.add_edit_products"),
      t("roles.bulk_csv_upload"),
      t("roles.order_fulfilment"),
      t("roles.wallet_payouts"),
      t("roles.sales_analytics"),
      t("roles.dispute_responses"),
    ],
    admin: [
      t("roles.seller_kyc_approval"),
      t("roles.product_moderation"),
      t("roles.bulk_moderation"),
      t("roles.user_management"),
      t("roles.dispute_resolution"),
      t("roles.coupon_system"),
    ],
    super_admin: [
      t("roles.admin_management"),
      t("roles.financial_audit"),
      t("roles.user_activity_logs"),
      t("roles.commission_control"),
      t("roles.seller_suspensions"),
      t("roles.platform_settings"),
    ],
    delivery: [
      t("roles.assigned_deliveries"),
      t("roles.status_updates"),
      t("roles.proof_of_delivery"),
      t("roles.earnings_tracker"),
      t("roles.availability_toggle"),
      t("roles.route_optimisation"),
    ],
  };
  return map[role ?? "customer"] ?? map.customer;
}

function roleBadgeClass(role?: AppRole | string): string {
  if (role === "super_admin") return "bg-gold text-gold-foreground";
  if (role === "admin") return "bg-navy text-navy-foreground";
  if (role === "seller") return "bg-gold/15 text-gold border border-gold/30";
  if (role === "delivery") return "bg-gold/15 text-gold border border-gold/30";
  return "bg-secondary text-foreground";
}

// ── Dashboard component ───────────────────────────────────────────────────────

function DashboardPage() {
  const { t } = useI18n();
  const { user, roles, signOut } = useAuth();

  // Determine the "primary" role for content selection — super_admin > admin > seller > delivery > customer
  const primaryRole: AppRole = roles.includes("super_admin")
    ? "super_admin"
    : roles.includes("admin")
      ? "admin"
      : roles.includes("seller")
        ? "seller"
        : roles.includes("delivery")
          ? "delivery"
          : "customer";

  const nav = navItems(primaryRole, t);
  const statList = stats(primaryRole, t);

  return (
    <div className="mx-auto max-w-[1536px] px-4 sm:px-6 py-8">
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* ── Sidebar ── */}
        <aside className="bg-card border border-border rounded-2xl h-fit p-4 lg:sticky lg:top-24">
          <div className="mb-4 px-2 lg:hidden">
            <Logo />
          </div>
          <div className="mb-4 rounded-xl bg-secondary/60 p-3">
            <p className="text-sm font-semibold truncate">
              {user?.user_metadata?.display_name ?? user?.email?.split("@")[0] ?? t("roles.user")}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{user?.email}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {roles.map((r) => (
                <span
                  key={r}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${roleBadgeClass(r)}`}
                >
                  {r.replace("_", " ")}
                </span>
              ))}
            </div>
          </div>

          <nav className="space-y-0.5">
            {nav.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-4 pt-3 border-t border-border">
            <button
              onClick={() => void signOut()}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" /> {t("roles.sign_out")}
            </button>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div>
          <div className="mb-6">
            <h1 className="font-display text-2xl md:text-3xl font-bold">
              {greeting(primaryRole, t)}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("roles.welcome_back_role_portal", {
                role: t(
                  primaryRole === "super_admin" ? "roles.super_admin" : `roles.${primaryRole}`,
                ),
              })}
            </p>
          </div>

          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            {statList.map((s) => (
              <div
                key={s.label}
                className="bg-card border border-border rounded-2xl p-5 shadow-elegant"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <s.icon className="h-4 w-4 text-gold" />
                </div>
                <p className="font-display text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-gold-700 mt-1">{s.delta}</p>
              </div>
            ))}
          </div>

          {/* Role feature panel */}
          <div className="bg-card border border-border rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-gold" />
              <h2 className="font-display text-lg font-bold">{panelTitle(primaryRole, t)}</h2>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {features(primaryRole, t).map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2 text-sm"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-gold shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Role-specific quick links */}
          <div className="grid sm:grid-cols-2 gap-3 mb-6">
            {primaryRole === "seller" && (
              <>
                <QuickLink
                  to="/seller/dashboard"
                  icon={Store}
                  title={t("roles.seller_dashboard")}
                  desc={t("roles.products_orders_earnings")}
                />
                <QuickLink
                  to="/seller/products"
                  icon={Package}
                  title={t("roles.my_products")}
                  desc={t("roles.add_edit_or_retire_listings")}
                />
              </>
            )}
            {(primaryRole === "admin" || primaryRole === "super_admin") && (
              <>
                <QuickLink
                  to="/admin/dashboard"
                  icon={Shield}
                  title={t("roles.admin_dashboard")}
                  desc={t("roles.users_roles_moderation")}
                />
                <QuickLink
                  to="/admin/products"
                  icon={Package}
                  title={t("roles.product_moderation")}
                  desc={t("roles.hide_or_remove_listings")}
                />
                {primaryRole === "super_admin" && (
                  <QuickLink
                    to="/super-admin/dashboard"
                    icon={Crown}
                    title={t("roles.super_admin")}
                    desc={t("roles.full_platform_control")}
                  />
                )}
              </>
            )}
            {primaryRole === "delivery" && (
              <QuickLink
                to="/delivery/dashboard"
                icon={Truck}
                title={t("roles.delivery_workbench")}
                desc={t("roles.claim_update_deliveries")}
              />
            )}
            <QuickLink
              to="/shop"
              icon={ShoppingBag}
              title={t("roles.go_to_storefront")}
              desc={t("roles.browse_live_shop")}
            />
            <QuickLink
              to="/profile"
              icon={Users}
              title={t("roles.my_profile")}
              desc={t("roles.edit_your_details_roles")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  title,
  desc,
}: {
  to: string;
  icon: typeof Store;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="bg-card border border-border rounded-2xl p-4 hover:border-gold/40 hover:shadow-elegant transition-all flex items-center gap-3"
    >
      <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-gold" />
      </div>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </Link>
  );
}

// suppress unused import warning for Badge (used in roleBadgeClass)
const _badge = Badge;
