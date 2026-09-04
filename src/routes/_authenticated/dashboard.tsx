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

function greeting(role?: AppRole | string): string {
  switch (role) {
    case "seller":
      return "Seller Dashboard";
    case "admin":
      return "Admin Console";
    case "super_admin":
      return "Super Admin Control";
    case "delivery":
      return "Delivery Hub";
    default:
      return "My Account";
  }
}

function navItems(role?: AppRole | string) {
  const common = { icon: LayoutDashboard, label: "Overview" };
  const map: Record<string, { icon: typeof LayoutDashboard; label: string; to: string }[]> = {
    customer: [
      { ...common, to: "/dashboard" },
      { icon: ShoppingBag, label: "My Orders", to: "/orders" },
      { icon: Package, label: "Wishlist", to: "/wishlist" },
      { icon: Wallet, label: "Profile", to: "/profile" },
    ],
    seller: [
      { ...common, to: "/dashboard" },
      { icon: Package, label: "Products", to: "/seller/products" },
      { icon: ShoppingBag, label: "Orders", to: "/orders" },
      { icon: Sparkles, label: "Analytics", to: "/seller/dashboard" },
      { icon: Wallet, label: "Earnings", to: "/seller/dashboard" },
    ],
    admin: [
      { ...common, to: "/dashboard" },
      { icon: Store, label: "Sellers", to: "/admin/dashboard" },
      { icon: Package, label: "Products", to: "/admin/products" },
      { icon: Users, label: "Users", to: "/admin/dashboard" },
    ],
    super_admin: [
      { ...common, to: "/dashboard" },
      { icon: Users, label: "Admins", to: "/super-admin/dashboard" },
      { icon: Wallet, label: "Finance", to: "/super-admin/dashboard" },
      { icon: Settings, label: "Settings", to: "/super-admin/dashboard" },
      { icon: ShieldCheck, label: "Audit", to: "/super-admin/dashboard" },
    ],
    delivery: [
      { ...common, to: "/dashboard" },
      { icon: Truck, label: "Deliveries", to: "/delivery/dashboard" },
      { icon: Wallet, label: "Earnings", to: "/delivery/dashboard" },
    ],
  };
  return map[role ?? "customer"] ?? map.customer;
}

function stats(role?: AppRole | string) {
  const s = (label: string, value: string, delta: string, icon: typeof Wallet) => ({
    label,
    value,
    delta,
    icon,
  });
  switch (role) {
    case "seller":
      return [
        s("Revenue (30d)", formatFCFA(845_000), "↑ 12% vs last month", Wallet),
        s("Orders", "38", "↑ 5 this week", ShoppingBag),
        s("Active products", "24", "2 low stock", Package),
      ];
    case "admin":
      return [
        s("Platform GMV", formatFCFA(12_400_000), "↑ 8%", Wallet),
        s("Pending approvals", "6", "KYC queue", Store),
        s("New users (7d)", "142", "↑ 23%", Users),
      ];
    case "super_admin":
      return [
        s("Escrow balance", formatFCFA(3_120_000), "Held funds", Wallet),
        s("Commission (30d)", formatFCFA(620_000), "5% of GMV", ShieldCheck),
        s("Active sellers", "184", "↑ 9", Store),
      ];
    case "delivery":
      return [
        s("Deliveries today", "7", "3 in transit", Truck),
        s("Earnings (week)", formatFCFA(18_500), "↑ 2 vs last wk", Wallet),
        s("Avg rating", "4.8", "32 ratings", Sparkles),
      ];
    default:
      return [
        s("Total orders", "5", "1 in transit", ShoppingBag),
        s("Wishlist items", "12", "On sale now", Package),
        s("Loyalty points", "320", "Spend to level up", Sparkles),
      ];
  }
}

function panelTitle(role?: AppRole | string) {
  if (role === "seller") return "Your seller toolkit";
  if (role === "admin") return "Platform moderation";
  if (role === "super_admin") return "Platform controls";
  if (role === "delivery") return "Your delivery tools";
  return "Quick actions";
}

function features(role?: AppRole | string): string[] {
  const map: Record<string, string[]> = {
    customer: [
      "Order tracking",
      "Order history",
      "Wishlist",
      "Reviews & ratings",
      "Saved addresses",
      "Notifications",
    ],
    seller: [
      "Add / edit products",
      "Bulk CSV upload",
      "Order fulfilment",
      "Wallet & payouts",
      "Sales analytics",
      "Dispute responses",
    ],
    admin: [
      "Seller KYC approval",
      "Product moderation",
      "Bulk moderation",
      "User management",
      "Dispute resolution",
      "Coupon system",
    ],
    super_admin: [
      "Admin management",
      "Financial audit",
      "User activity logs",
      "Commission control",
      "Seller suspensions",
      "Platform settings",
    ],
    delivery: [
      "Assigned deliveries",
      "Status updates",
      "Proof of delivery",
      "Earnings tracker",
      "Availability toggle",
      "Route optimisation",
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

  const nav = navItems(primaryRole);
  const statList = stats(primaryRole);

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
              {user?.user_metadata?.display_name ?? user?.email?.split("@")[0] ?? "User"}
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
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div>
          <div className="mb-6">
            <h1 className="font-display text-2xl md:text-3xl font-bold">{greeting(primaryRole)}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Welcome back. This is your {primaryRole.replace("_", " ")} portal.
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
                <p className="text-xs text-emerald-600 mt-1">{s.delta}</p>
              </div>
            ))}
          </div>

          {/* Role feature panel */}
          <div className="bg-card border border-border rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-gold" />
              <h2 className="font-display text-lg font-bold">{panelTitle(primaryRole)}</h2>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {features(primaryRole).map((f) => (
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
                  title="Seller dashboard"
                  desc="Products, orders & earnings"
                />
                <QuickLink
                  to="/seller/products"
                  icon={Package}
                  title="My products"
                  desc="Add, edit or retire listings"
                />
              </>
            )}
            {(primaryRole === "admin" || primaryRole === "super_admin") && (
              <>
                <QuickLink
                  to="/admin/dashboard"
                  icon={Shield}
                  title="Admin dashboard"
                  desc="Users, roles & moderation"
                />
                <QuickLink
                  to="/admin/products"
                  icon={Package}
                  title="Product moderation"
                  desc="Hide or remove listings"
                />
                {primaryRole === "super_admin" && (
                  <QuickLink
                    to="/super-admin/dashboard"
                    icon={Crown}
                    title="Super admin"
                    desc="Full platform control"
                  />
                )}
              </>
            )}
            {primaryRole === "delivery" && (
              <QuickLink
                to="/delivery/dashboard"
                icon={Truck}
                title="Delivery workbench"
                desc="Claim & update deliveries"
              />
            )}
            <QuickLink
              to="/shop"
              icon={ShoppingBag}
              title="Go to storefront"
              desc="Browse the live shop"
            />
            <QuickLink
              to="/profile"
              icon={Users}
              title="My profile"
              desc="Edit your details & roles"
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
