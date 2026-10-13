import { Link, useRouterState } from "@tanstack/react-router";
import {
  Heart,
  ShoppingCart,
  Menu,
  Moon,
  Sun,
  User,
  Bell,
  Globe,
  X,
  LogOut,
  Store,
  Shield,
  UserCircle,
  Crown,
  Package,
  Truck,
  Building2,
} from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCart, useWishlist } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useCategories } from "@/lib/queries";
import { CartSheet } from "@/components/shop/CartSheet";
import { SearchBox } from "@/components/shop/SearchBox";

export function Navbar() {
  const cartCount = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));
  const wishCount = useWishlist((s) => s.ids.length);
  const { theme, toggle } = useTheme();
  const { lang, setLang, t } = useI18n();
  const { user, isAuthenticated, roles, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: categories = [] } = useCategories();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showCategoryBar = pathname.startsWith("/shop");

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
      <div className="hidden md:flex bg-navy text-navy-foreground text-xs">
        <div className="mx-auto max-w-[1536px] w-full px-6 h-9 flex items-center justify-between">
          <span>{t("delivery.freeOver")}</span>
          <div className="flex items-center gap-4">
            <Link to="/seller/register" className="hover:text-gold transition-colors">
              {t("nav.sell")}
            </Link>
            <Link to="/delivery/apply" className="hover:text-gold transition-colors">
              {t("nav.deliver")}
            </Link>
            <Link to="/orders" className="hover:text-gold transition-colors">
              {t("nav.trackOrder")}
            </Link>
            <Link to="/help" className="hover:text-gold transition-colors">
              {t("nav.help")}
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1536px] px-4 md:px-6 h-16 flex items-center gap-4">
        <button
          className="md:hidden p-2 -ml-2"
          onClick={() => setMobileOpen(true)}
          aria-label={t("nav.menu")}
        >
          <Menu className="h-5 w-5" />
        </button>
        <Logo />
        <SearchBox className="flex-1 max-w-2xl mx-auto hidden md:block" />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLang(lang === "en" ? "fr" : "en")}
            className="hidden sm:inline-flex"
            aria-label={t("nav.language")}
          >
            <Globe className="h-5 w-5" />
            <span className="sr-only">{t("nav.language")}</span>
          </Button>
          <span className="hidden sm:inline text-xs font-semibold uppercase">{lang}</span>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label={t("nav.theme")}>
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Link to="/wishlist" className="relative p-2 rounded-md hover:bg-muted">
            <Heart className="h-5 w-5" />
            {wishCount > 0 && (
              <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 bg-gold text-gold-foreground">
                {wishCount}
              </Badge>
            )}
          </Link>
          <CartSheet
            trigger={
              <button className="relative p-2 rounded-md hover:bg-muted" aria-label={t("nav.cart")}>
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 bg-gold text-gold-foreground">
                    {cartCount}
                  </Badge>
                )}
              </button>
            }
          />

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-2 rounded-md hover:bg-muted hidden sm:inline-flex"
                  aria-label={t("nav.account")}
                >
                  <UserCircle className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">
                    <User className="h-4 w-4 mr-2" /> {t("nav.myProfile")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/orders">
                    <ShoppingCart className="h-4 w-4 mr-2" /> {t("nav.trackOrder")}
                  </Link>
                </DropdownMenuItem>
                {roles.includes("seller") && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/seller/dashboard">
                        <Store className="h-4 w-4 mr-2" /> {t("nav.sellerDashboard")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/seller/products">
                        <Package className="h-4 w-4 mr-2" /> {t("nav.myProducts")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/seller/wallet">
                        <ShoppingCart className="h-4 w-4 mr-2" /> {t("nav.myWallet")}
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                {roles.includes("delivery") && (
                  <DropdownMenuItem asChild>
                    <Link to="/delivery/dashboard">
                      <Truck className="h-4 w-4 mr-2" /> {t("nav.deliveryDashboard")}
                    </Link>
                  </DropdownMenuItem>
                )}
                {(roles.includes("admin") || roles.includes("super_admin")) && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/admin/dashboard">
                        <Shield className="h-4 w-4 mr-2" /> {t("nav.adminDashboard")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/admin/seller-applications">
                        <Store className="h-4 w-4 mr-2" /> {t("nav.sellerApplications")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/admin/products">
                        <Package className="h-4 w-4 mr-2" /> {t("nav.productApprovals")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/admin/payments">
                        <Package className="h-4 w-4 mr-2" /> {t("nav.paymentVerifications")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/admin/withdrawals">
                        <Package className="h-4 w-4 mr-2" /> {t("nav.withdrawals")}
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                {roles.includes("super_admin") && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/admin/seller-boosts">
                        <Package className="h-4 w-4 mr-2" /> {t("nav.sellerBoosts")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/super-admin/dashboard">
                        <Crown className="h-4 w-4 mr-2" /> {t("nav.superAdmin")}
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void signOut()}>
                  <LogOut className="h-4 w-4 mr-2" /> {t("nav.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/login" className="p-2 rounded-md hover:bg-muted hidden sm:inline-flex">
              <User className="h-5 w-5" />
            </Link>
          )}
        </div>
      </div>
      
    {showCategoryBar && (
        <nav className="hidden md:block border-t border-border">
          <div className="w-full px-6 h-11 flex items-center justify-between gap-4 text-sm overflow-x-auto whitespace-nowrap"> 
            <Link to="/shop" className="font-medium hover:text-gold transition-colors">
              {t("common.all")}
            </Link>
            {categories.map((c) => (
              <Link
                key={c.slug}
                to="/shop"
                search={{ category: c.slug }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </nav>
      )}

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-background p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <Logo />
              <button onClick={() => setMobileOpen(false)} aria-label={t("nav.close")}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <SearchBox className="mb-6" onNavigate={() => setMobileOpen(false)} />
            <div className="space-y-1">
              <Link
                to="/shop"
                onClick={() => setMobileOpen(false)}
                className="block py-2 font-medium"
              >
                {t("nav.shopAll")}
              </Link>
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  to="/shop"
                  search={{ category: c.slug }}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 py-2 text-muted-foreground hover:text-foreground"
                >
                  <c.icon className="h-5 w-5 text-gold shrink-0" /> {c.name}
                </Link>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t border-border space-y-1">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 py-2 font-medium"
                  >
                    <UserCircle className="h-4 w-4" /> {user?.email ?? t("nav.myAccount")}
                  </Link>
                  <Link
                    to="/orders"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 py-2 text-muted-foreground hover:text-foreground"
                  >
                    <ShoppingCart className="h-4 w-4" /> {t("nav.myOrders")}
                  </Link>
                  {roles.includes("seller") && (
                    <>
                      <Link
                        to="/seller/dashboard"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 py-2 text-muted-foreground hover:text-foreground"
                      >
                        <Store className="h-4 w-4" /> {t("nav.sellerDashboard")}
                      </Link>
                      <Link
                        to="/seller/wallet"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 py-2 text-muted-foreground hover:text-foreground"
                      >
                        <ShoppingCart className="h-4 w-4" /> {t("nav.myWallet")}
                      </Link>
                    </>
                  )}
                  {roles.includes("delivery") && (
                    <Link
                      to="/delivery/dashboard"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 py-2 text-muted-foreground hover:text-foreground"
                    >
                      <Truck className="h-4 w-4" /> {t("nav.deliveryDashboard")}
                    </Link>
                  )}
                  {(roles.includes("admin") || roles.includes("super_admin")) && (
                    <>
                      <Link
                        to="/admin/dashboard"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 py-2 text-muted-foreground hover:text-foreground"
                      >
                        <Shield className="h-4 w-4" /> {t("nav.admin")}
                      </Link>
                      <Link
                        to="/admin/seller-applications"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 py-2 text-muted-foreground hover:text-foreground"
                      >
                        <Store className="h-4 w-4" /> {t("nav.sellerApps")}
                      </Link>
                      <Link
                        to="/admin/products"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 py-2 text-muted-foreground hover:text-foreground"
                      >
                        <Package className="h-4 w-4" /> {t("nav.productApprovals")}
                      </Link>
                      <Link
                        to="/admin/payments"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 py-2 text-muted-foreground hover:text-foreground"
                      >
                        <Package className="h-4 w-4" /> {t("nav.payments")}
                      </Link>
                      <Link
                        to="/admin/withdrawals"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 py-2 text-muted-foreground hover:text-foreground"
                      >
                        <Package className="h-4 w-4" /> {t("nav.withdrawals")}
                      </Link>
                    </>
                  )}
                  {roles.includes("super_admin") && (
                    <Link
                      to="/admin/seller-boosts"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 py-2 text-muted-foreground hover:text-foreground"
                    >
                      <Package className="h-4 w-4" /> {t("nav.sellerBoosts")}
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      void signOut();
                      setMobileOpen(false);
                    }}
                    className="flex items-center gap-2 py-2 w-full text-left text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="h-4 w-4" /> {t("nav.signOut")}
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 py-2 font-medium"
                >
                  <User className="h-4 w-4" /> {t("nav.signIn")}
                </Link>
              )}
              <div className="pt-2 border-t border-border mt-2 space-y-1">
                <Link
                  to="/seller/register"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 py-2 text-muted-foreground hover:text-foreground"
                >
                  <Store className="h-4 w-4" /> {t("nav.sell")}
                </Link>
                <Link
                  to="/delivery/apply"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 py-2 text-muted-foreground hover:text-foreground"
                >
                  <Truck className="h-4 w-4" /> {t("nav.deliver")}
                </Link>
                <Link
                  to="/delivery/company"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 py-2 text-muted-foreground hover:text-foreground"
                >
                  <Building2 className="h-4 w-4" /> {t("nav.deliveryCompany")}
                </Link>
                <Link
                  to="/orders"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 py-2 text-muted-foreground hover:text-foreground"
                >
                  <Package className="h-4 w-4" /> {t("nav.trackOrder")}
                </Link>
                <Link
                  to="/help"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 py-2 text-muted-foreground hover:text-foreground"
                >
                  {t("nav.help")}
                </Link>
              </div>
              <div className="pt-2 border-t border-border mt-2 flex items-center gap-3">
                <button
                  onClick={() => setLang(lang === "en" ? "fr" : "en")}
                  className="flex items-center gap-1.5 py-2 text-muted-foreground hover:text-foreground text-sm"
                >
                  <Globe className="h-4 w-4" /> {lang === "en" ? "Français" : "English"}
                </button>
                <button
                  onClick={toggle}
                  className="flex items-center gap-1.5 py-2 text-muted-foreground hover:text-foreground text-sm"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {theme === "dark" ? t("nav.lightMode") : t("nav.darkMode")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
