import { createFileRoute, Outlet, Navigate, useLocation } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" search={{ redirect: location.href }} />;
  }

  return <Outlet />;
}
