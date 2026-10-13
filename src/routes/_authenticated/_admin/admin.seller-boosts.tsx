import { useI18n } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Zap, Loader2, Star, Crown, Megaphone, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BOOST_TIER_LABELS, type SellerBoostTier } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/_admin/admin/seller-boosts")({
  component: AdminSellerBoosts,
  head: () => ({ meta: [{ title: "Seller boosts — J-STORE.cm" }] }),
});

type SellerRow = {
  id: string;
  display_name: string | null;
  // computed
  activeTier?: SellerBoostTier;
  boostId?: string;
  boostEndsAt?: string | null;
};

type ActiveBoostRow = {
  id: string;
  seller_id: string;
  tier: SellerBoostTier;
  ends_at: string | null;
  reason: string | null;
  is_active: boolean;
  created_at: string;
};

const TIER_ICONS: Record<SellerBoostTier, React.ElementType> = {
  normal: Star,
  featured: Star,
  top_seller: Crown,
  sponsored: Megaphone,
};

const TIER_COLORS: Record<SellerBoostTier, string> = {
  normal: "bg-muted text-muted-foreground border-border",
  featured: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  top_seller: "bg-gold/20 text-gold border-gold/40",
  sponsored: "bg-purple-500/15 text-purple-600 border-purple-500/30",
};

const DURATION_PRESETS = [
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
  { label: "60 days", days: 60 },
  { label: "90 days", days: 90 },
  { label: "Permanent", days: null },
];

function endsAtFromDays(days: number | null): string | null {
  if (days === null) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function AdminSellerBoosts() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [boostForm, setBoostForm] = useState<{
    sellerId: string;
    tier: SellerBoostTier;
    days: number | null;
    reason: string;
  } | null>(null);

  // ── Sellers (those with seller role) ─────────────────────────────────────
  const { data: sellers = [], isLoading: sellersLoading } = useQuery({
    queryKey: ["boost-sellers"],
    queryFn: async () => {
      const { data: roleRows, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "seller");
      if (rErr) throw rErr;
      const sellerIds = (roleRows ?? []).map((r: { user_id: string }) => r.user_id);
      if (sellerIds.length === 0) return [];
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", sellerIds);
      if (pErr) throw pErr;
      return (profiles ?? []) as SellerRow[];
    },
  });

  // ── Active boosts ─────────────────────────────────────────────────────────
  const { data: boosts = [], refetch } = useQuery({
    queryKey: ["admin-seller-boosts"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("seller_boosts")
        .select("*")
        .eq("is_active", true)
        .or(`ends_at.is.null,ends_at.gt.${now}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ActiveBoostRow[];
    },
  });

  const boostMap = new Map(boosts.map((b) => [b.seller_id, b]));

  // Merge boost data into sellers
  const enrichedSellers: SellerRow[] = sellers.map((s) => {
    const b = boostMap.get(s.id);
    return {
      ...s,
      activeTier: (b?.tier ?? "normal") as SellerBoostTier,
      boostId: b?.id,
      boostEndsAt: b?.ends_at,
    };
  });

  // ── Apply boost ───────────────────────────────────────────────────────────
  const applyBoost = useMutation({
    mutationFn: async () => {
      if (!boostForm || !user) return;
      const endsAt = endsAtFromDays(boostForm.days);

      // Deactivate any existing active boost for this seller
      await supabase
        .from("seller_boosts")
        .update({ is_active: false })
        .eq("seller_id", boostForm.sellerId)
        .eq("is_active", true);

      if (boostForm.tier !== "normal") {
        const { error } = await supabase.from("seller_boosts").insert({
          seller_id: boostForm.sellerId,
          tier: boostForm.tier,
          reason: boostForm.reason.trim() || null,
          boosted_by: user.id,
          starts_at: new Date().toISOString(),
          ends_at: endsAt,
          is_active: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t("roles.boost_applied"));
      setBoostForm(null);
      qc.invalidateQueries({ queryKey: ["admin-seller-boosts"] });
      qc.invalidateQueries({ queryKey: ["active-boosts"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Remove boost ──────────────────────────────────────────────────────────
  const removeBoost = useMutation({
    mutationFn: async (sellerId: string) => {
      const { error } = await supabase
        .from("seller_boosts")
        .update({ is_active: false })
        .eq("seller_id", sellerId)
        .eq("is_active", true);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("roles.boost_removed"));
      qc.invalidateQueries({ queryKey: ["admin-seller-boosts"] });
      qc.invalidateQueries({ queryKey: ["active-boosts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-384 px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-navy text-navy-foreground flex items-center justify-center">
            <Zap className="h-6 w-6 text-gold" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">
              {t("roles.admin")}
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-bold">
              {t("roles.seller_boosts")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("roles.control_seller_appearance")}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1.5" /> {t("roles.refresh")}
        </Button>
      </div>

      {/* Tier legend */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {(["normal", "featured", "top_seller", "sponsored"] as SellerBoostTier[]).map((tier) => {
          const Icon = TIER_ICONS[tier];
          return (
            <div key={tier} className={`rounded-2xl border p-4 ${TIER_COLORS[tier]}`}>
              <Icon className="h-5 w-5 mb-2 opacity-70" />
              <p className="font-semibold text-sm">{BOOST_TIER_LABELS[tier]}</p>
              <p className="text-xs opacity-70 mt-1">
                {tier === "normal" && t("roles.default_listing_all_sellers")}
                {tier === "featured" && t("roles.appears_homepage_featured")}
                {tier === "top_seller" && t("roles.badge_priority_search_results")}
                {tier === "sponsored" && t("roles.pinned_category_pages")}
              </p>
            </div>
          );
        })}
      </div>

      {/* Boost form */}
      {boostForm && (
        <div className="bg-card border border-gold/40 rounded-2xl p-6 mb-6 space-y-4">
          <h3 className="font-display font-semibold">
            {t("roles.setting_boost_for")}{" "}
            <span className="text-gold">
              {sellers.find((s) => s.id === boostForm.sellerId)?.display_name ?? "seller"}
            </span>
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium block mb-1.5">{t("roles.tier")}</label>
              <select
                value={boostForm.tier}
                onChange={(e) =>
                  setBoostForm((f) => f && { ...f, tier: e.target.value as SellerBoostTier })
                }
                className="w-full h-10 rounded-lg px-3 bg-secondary border border-transparent focus:outline-none focus:border-gold text-sm"
              >
                {(["featured", "top_seller", "sponsored", "normal"] as SellerBoostTier[]).map(
                  (t) => (
                    <option key={t} value={t}>
                      {BOOST_TIER_LABELS[t]}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5">{t("roles.duration")}</label>
              <select
                value={boostForm.days === null ? "null" : boostForm.days}
                onChange={(e) =>
                  setBoostForm(
                    (f) =>
                      f && {
                        ...f,
                        days: e.target.value === "null" ? null : Number(e.target.value),
                      },
                  )
                }
                className="w-full h-10 rounded-lg px-3 bg-secondary border border-transparent focus:outline-none focus:border-gold text-sm"
              >
                {DURATION_PRESETS.map((p) => (
                  <option key={p.label} value={p.days === null ? "null" : p.days}>
                    {p.days === null ? t("roles.permanent") : t(`roles.${p.days}_days`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium block mb-1.5">
                {t("roles.reason_internal_optional")}
              </label>
              <input
                className="w-full h-10 rounded-lg px-3 bg-secondary border border-transparent focus:outline-none focus:border-gold text-sm"
                placeholder={t("roles.promotion_reason_example")}
                value={boostForm.reason}
                onChange={(e) => setBoostForm((f) => f && { ...f, reason: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="rounded-full bg-gold text-gold-foreground hover:bg-gold/90"
              onClick={() => applyBoost.mutate()}
              disabled={applyBoost.isPending}
            >
              {applyBoost.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Zap className="h-4 w-4 mr-1" />
              )}
              {t("roles.apply_boost")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => setBoostForm(null)}
            >
              {t("roles.cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* Sellers table */}
      {sellersLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : enrichedSellers.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <p className="text-muted-foreground">{t("roles.no_approved_sellers_yet")}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-135">
              <thead className="text-xs text-muted-foreground border-b border-border bg-muted/30">
                <tr>
                  <th className="text-left font-medium px-5 py-3">{t("roles.seller")}</th>
                  <th className="text-left font-medium px-5 py-3">{t("roles.current_tier")}</th>
                  <th className="text-left font-medium px-5 py-3">{t("roles.expires")}</th>
                  <th className="text-right font-medium px-5 py-3">{t("roles.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {enrichedSellers.map((s) => {
                  const tier = s.activeTier ?? "normal";
                  const TierIcon = TIER_ICONS[tier];
                  return (
                    <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-medium">{s.display_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {s.id.slice(0, 12)}…
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant="outline" className={`gap-1 text-xs ${TIER_COLORS[tier]}`}>
                          <TierIcon className="h-3 w-3" />
                          {BOOST_TIER_LABELS[tier]}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground text-xs">
                        {s.boostEndsAt
                          ? new Date(s.boostEndsAt).toLocaleDateString()
                          : tier !== "normal"
                            ? "Permanent"
                            : "—"}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs rounded-full"
                          onClick={() =>
                            setBoostForm({
                              sellerId: s.id,
                              tier: tier === "normal" ? "featured" : tier,
                              days: 30,
                              reason: "",
                            })
                          }
                        >
                          <Zap className="h-3.5 w-3.5 mr-1 text-gold" />
                          {tier === "normal" ? t("roles.boost") : t("roles.change")}
                        </Button>
                        {tier !== "normal" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs rounded-full text-destructive"
                            disabled={removeBoost.isPending}
                            onClick={() => removeBoost.mutate(s.id)}
                          >
                            {t("roles.remove")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
