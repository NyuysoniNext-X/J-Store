import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  User as UserIcon,
  LogOut,
  Shield,
  Store,
  Globe,
  Truck,
  CheckCircle,
  XCircle,
  Handshake,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleSwitcher } from "@/components/account/RoleSwitcher";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "My profile — J-STORE.cm" }] }),
});

const ROLE_META: Record<AppRole, { label: string; icon: typeof UserIcon; color: string }> = {
  customer: { label: "Customer", icon: UserIcon, color: "bg-secondary text-foreground" },
  seller: { label: "Seller", icon: Store, color: "bg-gold/15 text-gold border border-gold/30" },
  delivery: { label: "Delivery", icon: Truck, color: "bg-gold/15 text-gold border border-gold/30" },
  admin: { label: "Admin", icon: Shield, color: "bg-navy text-navy-foreground" },
  super_admin: { label: "Super admin", icon: Shield, color: "bg-gold text-gold-foreground" },
  partner: {
    label: "Partner",
    icon: Handshake,
    color: "bg-gold/15 text-gold border border-gold/30",
  },
};

function ProfilePage() {
  const { user, roles, signOut, refreshRoles } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    display_name: "",
    phone: "",
    city: "",
    country: "Cameroon",
    preferred_language: "en",
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? "",
        phone: profile.phone ?? "",
        city: profile.city ?? "",
        country: profile.country ?? "Cameroon",
        preferred_language: profile.preferred_language ?? "en",
      });
    }
  }, [profile]);

  const [roleLoading, setRoleLoading] = useState(false);

  const activateSeller = async () => {
    if (!user) return;
    setRoleLoading(true);

    if (roles.includes("seller")) {
      toast.info("You're already a seller!");
      setRoleLoading(false);
      return;
    }

    const result = await supabase
      .from("seller_applications")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    const application = result.data as { status: string } | null;
    const appError = result.error;

    if (appError) {
      toast.error("Error checking application status");
      setRoleLoading(false);
      return;
    }

    if (!application) {
      toast.error("Please apply to become a seller first", {
        description: "Go to Seller Registration to submit your application.",
      });
      setRoleLoading(false);
      return;
    }

    if (application.status !== "approved") {
      toast.error("Your seller application is still pending approval", {
        description:
          application.status === "pending"
            ? "Wait for admin approval."
            : "Your application was rejected. Please re-apply.",
      });
      setRoleLoading(false);
      return;
    }

    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: user.id, role: "seller" });

    if (error) {
      toast.error("Failed to activate seller: " + error.message);
    } else {
      toast.success("Seller account activated!");
      await refreshRoles();
    }

    setRoleLoading(false);
  };

  const releaseSeller = async () => {
    if (!user) return;
    setRoleLoading(true);

    if (
      !confirm(
        "Are you sure you want to release your seller role? You'll lose access to seller features.",
      )
    ) {
      setRoleLoading(false);
      return;
    }

    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", user.id)
      .eq("role", "seller");

    if (error) {
      toast.error("Failed to release seller role: " + error.message);
    } else {
      toast.success("Seller role released. You're now a customer.");
      await refreshRoles();
    }

    setRoleLoading(false);
  };

  const handleActivateSeller = async () => {
    if (roles.includes("seller")) {
      await releaseSeller();
    } else {
      await activateSeller();
    }
  };

  const updateMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update(form).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  const isSeller = roles.includes("seller");

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold mb-1">
            My account
          </p>
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            {form.display_name || "Your profile"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
        </div>
        <Button variant="outline" onClick={() => signOut()} className="rounded-full">
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </div>

      {/* Roles */}
      <div className="flex flex-wrap gap-2 mb-8">
        {roles.length === 0 && (
          <span className="text-sm text-muted-foreground">No roles assigned</span>
        )}
        {roles.map((r) => {
          const meta = ROLE_META[r];
          const Icon = meta.icon;
          return (
            <span
              key={r}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${meta.color}`}
            >
              <Icon className="h-3.5 w-3.5" /> {meta.label}
            </span>
          );
        })}
      </div>

      {/* Roles & Access Card */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-8">
        <h2 className="font-semibold text-lg mb-4">Roles & Access</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Switch on the role you need. Admin access is granted manually by the platform team.
        </p>

        {/* Customer - Always active */}
        <div className="flex items-center justify-between py-3 border-b border-border">
          <div>
            <p className="font-medium">Customer</p>
            <p className="text-sm text-muted-foreground">
              Buy products, track orders, leave reviews.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" /> Active
          </span>
        </div>

        {/* Seller - Toggleable */}
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium">Seller</p>
            <p className="text-sm text-muted-foreground">
              List products, manage orders, withdraw earnings.
            </p>
          </div>
          <Button
            onClick={handleActivateSeller}
            disabled={roleLoading}
            variant={isSeller ? "destructive" : "default"}
            className={
              isSeller
                ? "bg-red-500 hover:bg-red-600 text-white rounded-full px-6"
                : "bg-gold text-navy hover:bg-gold/90 rounded-full px-6"
            }
          >
            {roleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : isSeller ? (
              <XCircle className="h-4 w-4 mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            {isSeller ? "Release" : "Activate"}
          </Button>
        </div>
      </div>

      {/* Quick links by role */}
      <div className="grid sm:grid-cols-2 gap-3 mb-10">
        {roles.includes("seller") && (
          <Link
            to="/seller/dashboard"
            className="bg-card border border-border rounded-2xl p-4 hover:border-gold/40 hover:shadow-elegant transition-all flex items-center gap-3"
          >
            <Store className="h-5 w-5 text-gold" />
            <div>
              <p className="font-semibold text-sm">Seller dashboard</p>
              <p className="text-xs text-muted-foreground">Manage your products & orders</p>
            </div>
          </Link>
        )}
        {roles.includes("delivery") && (
          <Link
            to="/delivery/dashboard"
            className="bg-card border border-border rounded-2xl p-4 hover:border-gold/40 hover:shadow-elegant transition-all flex items-center gap-3"
          >
            <Truck className="h-5 w-5 text-gold" />
            <div>
              <p className="font-semibold text-sm">Delivery dashboard</p>
              <p className="text-xs text-muted-foreground">Claim pickups and update deliveries</p>
            </div>
          </Link>
        )}
        {roles.includes("admin") && (
          <Link
            to="/admin/dashboard"
            className="bg-card border border-border rounded-2xl p-4 hover:border-gold/40 hover:shadow-elegant transition-all flex items-center gap-3"
          >
            <Shield className="h-5 w-5 text-gold" />
            <div>
              <p className="font-semibold text-sm">Admin dashboard</p>
              <p className="text-xs text-muted-foreground">Platform moderation & settings</p>
            </div>
          </Link>
        )}
        {!roles.includes("seller") && (
          <Link
            to="/seller/register"
            className="bg-card border border-border rounded-2xl p-4 hover:border-gold/40 hover:shadow-elegant transition-all flex items-center gap-3"
          >
            <Store className="h-5 w-5 text-gold" />
            <div>
              <p className="font-semibold text-sm">Become a seller</p>
              <p className="text-xs text-muted-foreground">Open your shop on J-STORE</p>
            </div>
          </Link>
        )}
        {roles.includes("seller") && (
          <button
            onClick={handleActivateSeller}
            disabled={roleLoading}
            className="bg-card border border-border rounded-2xl p-4 hover:border-gold/40 hover:shadow-elegant transition-all flex items-center gap-3 text-left"
          >
            {roleLoading ? (
              <Loader2 className="h-5 w-5 text-gold animate-spin" />
            ) : (
              <Store className="h-5 w-5 text-gold" />
            )}
            <div>
              <p className="font-semibold text-sm">Release seller role</p>
              <p className="text-xs text-muted-foreground">Revert to customer account</p>
            </div>
          </button>
        )}
      </div>

      {/* Role switcher */}
      <div className="mb-6">
        <RoleSwitcher />
      </div>

      {/* Profile form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateMut.mutate();
        }}
        className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-elegant space-y-5"
      >
        <h2 className="font-display text-xl font-bold">Personal details</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1"
              placeholder="+237 ..."
            />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="mt-1"
              placeholder="Douala"
            />
          </div>
          <div>
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="lang">Preferred language</Label>
            <div className="mt-1 flex gap-2">
              {(["en", "fr"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setForm({ ...form, preferred_language: l })}
                  className={`px-4 py-2 rounded-full text-sm border ${
                    form.preferred_language === l
                      ? "bg-navy text-navy-foreground border-navy"
                      : "bg-secondary border-transparent hover:border-gold/40"
                  }`}
                >
                  <Globe className="inline h-4 w-4 mr-1.5" /> {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={updateMut.isPending}
            className="rounded-full h-11 px-7 bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
          >
            {updateMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}
