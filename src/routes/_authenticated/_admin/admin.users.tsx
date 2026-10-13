import { useI18n } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Search, Shield, Store, User as UserIcon, Truck, Plus, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/admin/users")({
  component: AdminUsers,
});

type UserWithRoles = {
  id: string;
  display_name: string | null;
  phone: string | null;
  city: string | null;
  created_at: string;
  roles: AppRole[];
};

type RoleAction = {
  userId: string;
  userName: string;
  role: AppRole;
  action: "grant" | "revoke";
};

const MANAGEABLE_ROLES: { role: AppRole; label: string; icon: typeof UserIcon; color: string }[] = [
  {
    role: "customer",
    label: "Customer",
    icon: UserIcon,
    color: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  },
  {
    role: "seller",
    label: "Seller",
    icon: Store,
    color: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  },
  {
    role: "delivery",
    label: "Delivery",
    icon: Truck,
    color: "bg-gold-500/10 text-gold-700 border-gold-500/30",
  },
];

function AdminUsers() {
  const { t } = useI18n();
  const { user: currentUser, hasRole } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | "all">("all");
  const [pendingAction, setPendingAction] = useState<RoleAction | null>(null);

  const isSuperAdmin = hasRole("super_admin");

  // Fetch all users with their roles
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (profileError) throw profileError;

      // Get all user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rolesError) throw rolesError;

      // Combine data
      return profiles.map((profile) => {
        const userRoles = roles
          .filter((r) => r.user_id === profile.id)
          .map((r) => r.role as AppRole);

        return {
          id: profile.id,
          display_name: profile.display_name,
          phone: profile.phone,
          city: profile.city,
          created_at: profile.created_at,
          roles: userRoles,
        } as UserWithRoles;
      });
    },
  });

  // Grant role mutation
  const grantRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: (_, { role }) => {
      toast.success(`${role} role granted`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setPendingAction(null);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setPendingAction(null);
    },
  });

  // Revoke role mutation
  const revokeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);
      if (error) throw error;
    },
    onSuccess: (_, { role }) => {
      toast.success(`${role} role revoked`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setPendingAction(null);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setPendingAction(null);
    },
  });

  const handleRoleAction = (action: RoleAction) => {
    if (action.action === "grant") {
      grantRole.mutate({ userId: action.userId, role: action.role });
    } else {
      revokeRole.mutate({ userId: action.userId, role: action.role });
    }
  };

  // Filter users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      search === "" ||
      (u.display_name && u.display_name.toLowerCase().includes(search.toLowerCase())) ||
      u.id.toLowerCase().includes(search.toLowerCase()) ||
      (u.phone && u.phone.includes(search));

    const matchesRole = roleFilter === "all" || u.roles.includes(roleFilter);

    return matchesSearch && matchesRole;
  });

  const getRoleIcon = (role: AppRole) => {
    const config = MANAGEABLE_ROLES.find((r) => r.role === role);
    if (config) return <config.icon className="h-3.5 w-3.5" />;
    if (role === "admin") return <Shield className="h-3.5 w-3.5" />;
    if (role === "super_admin") return <Shield className="h-3.5 w-3.5" />;
    return null;
  };

  const getRoleColor = (role: AppRole) => {
    const config = MANAGEABLE_ROLES.find((r) => r.role === role);
    if (config) return config.color;
    if (role === "admin") return "bg-purple-500/10 text-purple-600 border-purple-500/30";
    if (role === "super_admin") return "bg-red-500/10 text-red-600 border-red-500/30";
    return "bg-gray-500/10 text-gray-600 border-gray-500/30";
  };

  return (
    <div className="mx-auto max-w-384 px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold mb-2">{t("roles.user_role_management")}</h1>
        <p className="text-muted-foreground">
          Manage user roles and permissions.{" "}
          {isSuperAdmin
            ? "Super admins can manage all roles."
            : "Admins can manage customer, seller, and delivery roles."}
        </p>
      </div>

      {/* Filters */}
      <Card className="p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("roles.search_by_name_phone_or_id")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as AppRole | "all")}>
            <SelectTrigger className="w-full sm:w-50">
              <SelectValue placeholder={t("roles.filter_by_role")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("roles.all_roles")}</SelectItem>
              <SelectItem value="customer">{t("roles.customer")}</SelectItem>
              <SelectItem value="seller">{t("roles.seller")}</SelectItem>
              <SelectItem value="delivery">Delivery</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">{t("roles.total_users")}</div>
          <div className="text-2xl font-bold">{users.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">{t("roles.sellers")}</div>
          <div className="text-2xl font-bold">
            {users.filter((u) => u.roles.includes("seller")).length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">{t("roles.customers")}</div>
          <div className="text-2xl font-bold">
            {users.filter((u) => u.roles.includes("customer")).length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">{t("roles.admins")}</div>
          <div className="text-2xl font-bold">
            {
              users.filter((u) => u.roles.includes("admin") || u.roles.includes("super_admin"))
                .length
            }
          </div>
        </Card>
      </div>

      {/* Users list */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">
                {t("roles.no_users_found_matching_your_filters")}
              </p>
            </Card>
          ) : (
            filteredUsers.map((u) => {
              const isCurrentUser = u.id === currentUser?.id;
              const canManage = u.roles.every(
                (r) => isSuperAdmin || !["admin", "super_admin"].includes(r),
              );

              return (
                <Card key={u.id} className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{u.display_name || "No name"}</h3>
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-xs">
                            {t("roles.you")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {u.phone || "No phone"} · {u.city || "No city"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        ID: {u.id.slice(0, 8)}...
                      </p>

                      <div className="flex flex-wrap gap-2 mt-3">
                        {u.roles.length === 0 ? (
                          <Badge variant="outline" className="text-xs">
                            {t("roles.no_roles")}
                          </Badge>
                        ) : (
                          u.roles.map((role) => (
                            <Badge key={role} className={`text-xs border ${getRoleColor(role)}`}>
                              {getRoleIcon(role)}
                              <span className="ml-1.5 capitalize">{role.replace("_", " ")}</span>
                              {canManage &&
                                !isCurrentUser &&
                                MANAGEABLE_ROLES.some((r) => r.role === role) && (
                                  <button
                                    onClick={() =>
                                      setPendingAction({
                                        userId: u.id,
                                        userName: u.display_name || u.id.slice(0, 8),
                                        role,
                                        action: "revoke",
                                      })
                                    }
                                    className="ml-1.5 hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>

                    {canManage && !isCurrentUser && (
                      <div className="flex flex-wrap gap-2">
                        {MANAGEABLE_ROLES.map(({ role, label, icon: Icon }) => {
                          const hasRole = u.roles.includes(role);
                          if (hasRole) return null; // Already shown in badges above

                          return (
                            <Button
                              key={role}
                              size="sm"
                              variant="outline"
                              className="rounded-full h-8 text-xs"
                              onClick={() =>
                                setPendingAction({
                                  userId: u.id,
                                  userName: u.display_name || u.id.slice(0, 8),
                                  role,
                                  action: "grant",
                                })
                              }
                            >
                              <Plus className="h-3 w-3 mr-1.5" />
                              Grant {label}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={!!pendingAction} onOpenChange={() => setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.action === "grant" ? "Grant" : "Revoke"} {pendingAction?.role} role?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.action === "grant" ? (
                <>
                  You're about to grant <strong>{pendingAction.role}</strong> role to{" "}
                  <strong>{pendingAction.userName}</strong>.
                </>
              ) : (
                <>
                  You're about to revoke <strong>{pendingAction?.role}</strong> role from{" "}
                  <strong>{pendingAction?.userName}</strong>. They will lose access to{" "}
                  {pendingAction?.role === "seller"
                    ? "seller dashboard and all seller features"
                    : pendingAction?.role === "delivery"
                      ? "delivery routes and order assignments"
                      : "associated features"}
                  .
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("roles.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingAction && handleRoleAction(pendingAction)}
              disabled={grantRole.isPending || revokeRole.isPending}
            >
              {(grantRole.isPending || revokeRole.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
