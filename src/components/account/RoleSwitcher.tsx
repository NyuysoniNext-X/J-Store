import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Store, User as UserIcon, Shield, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const SWITCHABLE: { role: AppRole; label: string; icon: typeof UserIcon; desc: string }[] = [
  {
    role: "customer",
    label: "Customer",
    icon: UserIcon,
    desc: "Buy products, track orders, leave reviews.",
  },
  {
    role: "seller",
    label: "Seller",
    icon: Store,
    desc: "List products, manage orders, withdraw earnings.",
  },
];

export function RoleSwitcher() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();

  const claim = useMutation({
    mutationFn: async (role: AppRole) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: user!.id, role });
      if (error) throw error;
    },
    onSuccess: (_d, role) => {
      toast.success(`You're now a ${role}`);
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
    },
    onSuccess: (_d, role) => {
      toast.success(`Released ${role} role`);
      window.location.reload();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-elegant">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-xl font-bold">Roles & access</h2>
        {roles.includes("admin") && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-navy text-navy-foreground">
            <Shield className="h-3.5 w-3.5" /> Admin
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Switch on the role you need. Admin access is granted manually by the platform team.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
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
                  <p className="font-semibold text-sm">{label}</p>
                  {has && <Check className="h-3.5 w-3.5 text-gold" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
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
                      Release
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="rounded-full h-8 text-xs bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
                      disabled={pending}
                      onClick={() => claim.mutate(role)}
                    >
                      {pending && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                      Activate
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
