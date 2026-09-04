import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { ShieldAlert, Store } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_seller")({
  component: SellerLayout,
});

function SellerLayout() {
  const { hasRole } = useAuth();

  if (!hasRole("seller") && !hasRole("admin")) {
    return (
      <div className="mx-auto max-w-md text-center py-20 px-6">
        <ShieldAlert className="h-12 w-12 text-gold mx-auto mb-4" />
        <h1 className="font-display text-2xl font-bold">Seller access required</h1>
        <p className="text-muted-foreground text-sm mt-2">
          You need a seller account to view this page. Apply to open your shop on J-STORE.
        </p>
        <Button
          asChild
          className="mt-6 rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
        >
          <Link to="/seller/register">
            <Store className="h-4 w-4 mr-2" /> Become a seller
          </Link>
        </Button>
      </div>
    );
  }

  return <Outlet />;
}
