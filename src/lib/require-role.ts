import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Role } from "@/lib/types";

// Was previously its own hand-maintained union ("admin" | "seller" | "customer")
// that had drifted from the real role list — it was missing "super_admin" and
// "delivery", so requireRole() couldn't type-check checks for either. Deriving
// from Role directly means this can't drift again.
export type AppRole = Role;

/**
 * Server-side role enforcement. Wraps requireSupabaseAuth and asserts the
 * authenticated user holds at least one of the allowed roles by querying
 * user_roles under RLS (users can read their own roles).
 *
 * Use this on every server function that returns admin- or seller-scoped data.
 * Never rely on client-side hasRole() alone for data access decisions.
 */
export function requireRole(allowed: AppRole | AppRole[]) {
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ next, context }) => {
      const { supabase, userId } = context;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .in("role", roles);

      if (error) {
        console.error("[requireRole] role lookup failed:", error);
        throw new Error("Forbidden");
      }
      if (!data || data.length === 0) {
        throw new Error("Forbidden");
      }

      return next({ context: { roles: data.map((r) => r.role as AppRole) } });
    });
}
