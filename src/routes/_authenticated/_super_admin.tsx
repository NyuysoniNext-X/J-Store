import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_super_admin")({
  component: SuperAdminLayout,
});

function SuperAdminLayout() {
  const { hasRole } = useAuth();
  if (!hasRole("super_admin")) {
    return (
      <div className="mx-auto max-w-md text-center py-20 px-6">
        <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h1 className="font-display text-2xl font-bold">Super admin access only</h1>
        <p className="text-muted-foreground text-sm mt-2">
          This area is reserved for platform owners.
        </p>
        <Button asChild variant="outline" className="mt-6 rounded-full">
          <Link to="/">Back home</Link>
        </Button>
      </div>
    );
  }
  return <Outlet />;
}
