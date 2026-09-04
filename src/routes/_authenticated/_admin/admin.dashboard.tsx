import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Users, Package, ShoppingBag, Loader2, Trash2, UserPlus } from "lucide-react";
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
      toast.success(`Granted ${v.role}`);
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
    },
    onSuccess: (_d, v) => {
      toast.success(`Revoked ${v.role}`);
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = [
    { label: "Users", value: profiles.length.toString(), icon: Users },
    {
      label: "Sellers",
      value: allRoles.filter((r) => r.role === "seller").length.toString(),
      icon: Shield,
    },
    { label: "Products", value: productCount.toString(), icon: Package },
    { label: "Orders", value: orderCount.toString(), icon: ShoppingBag },
  ];

  return (
    <div className="mx-auto max-w-[1536px] px-6 py-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-navy text-navy-foreground flex items-center justify-center">
          <Shield className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">Admin</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Platform overview</h1>
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

      <div className="bg-card border border-border rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold">Users & roles</h2>
          <Link to="/admin/products" className="text-xs text-gold font-medium hover:underline">
            Moderate products →
          </Link>
        </div>
        {pl ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-gold" />
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left font-medium py-2">User</th>
                  <th className="text-left font-medium py-2">Phone / city</th>
                  <th className="text-left font-medium py-2">Roles</th>
                  <th className="text-right font-medium py-2">Actions</th>
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
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {p.id}
                        </p>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {p.phone ?? "—"} · {p.city ?? "—"}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          {r.length === 0 ? (
                            <span className="text-xs text-muted-foreground">none</span>
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
                        {!r.includes("seller") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => grant.mutate({ userId: p.id, role: "seller" })}
                          >
                            <UserPlus className="h-3 w-3 mr-1" /> Seller
                          </Button>
                        )}
                        {canManageAdmins && !isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => grant.mutate({ userId: p.id, role: "admin" })}
                          >
                            <Shield className="h-3 w-3 mr-1" /> Make admin
                          </Button>
                        )}
                        {canManageAdmins && r.includes("admin") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-destructive"
                            onClick={() => revoke.mutate({ userId: p.id, role: "admin" })}
                          >
                            <Trash2 className="h-3 w-3 mr-1" /> Admin
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
