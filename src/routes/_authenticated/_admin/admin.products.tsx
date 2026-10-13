import { useI18n } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Trash2,
  EyeOff,
  Eye,
  Package,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatXAF } from "@/lib/mock-data";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/_admin/admin/products")({
  component: AdminProducts,
  head: () => ({ meta: [{ title: "Product moderation — J-STORE.cm" }] }),
});

type AdminProduct = {
  id: string;
  title: string;
  base_price: number;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "flagged" | "archived";
  created_at: string;
  category: { name: string } | null;
  seller_stores: { store_name: string } | null;
  product_variants: { stock_quantity: number }[];
};

function AdminProducts() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("pending");

  const {
    data: products = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin-all-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, title, base_price, status, created_at, category:categories(name), seller_stores(store_name), product_variants(stock_quantity)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as AdminProduct[];
    },
  });

  // Drafts are the seller's private work-in-progress; only submitted
  // products (pending_approval) belong in the moderation queue.
  const filtered = products.filter((p) => {
    if (filter === "pending") return p.status === "pending_approval";
    if (filter === "approved") return p.status === "approved";
    return true;
  });

  const pendingCount = products.filter((p) => p.status === "pending_approval").length;

  // Hide/Show: no separate visibility flag exists — status alone gates the
  // storefront (only 'approved' shows), so hiding = archiving.
  const toggleVisible = useMutation({
    mutationFn: async ({ id, hide }: { id: string; hide: boolean }) => {
      const { error } = await supabase
        .from("products")
        .update({ status: hide ? "archived" : "approved" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-all-products"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(t("roles.visibility_updated"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const update = approved
        ? {
            status: "approved" as const,
            approved_by: user!.id,
            approved_at: new Date().toISOString(),
          }
        : { status: "rejected" as const, approved_by: null, approved_at: null };
      const { error } = await supabase.from("products").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async (_d, vars) => {
      await qc.invalidateQueries({ queryKey: ["admin-all-products"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(vars.approved ? t("roles.product_approved") : t("roles.approval_revoked"));
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-all-products"] });
      toast.success(t("roles.deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-384 px-6 py-10">
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-gold" />
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">
              {t("roles.admin")}
            </p>
            <h1 className="font-display text-3xl font-bold">{t("roles.product_moderation")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("roles.approve_or_hide_products")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge className="bg-amber-500 text-white text-sm px-3 py-1">
              {t("roles.pending_count", { count: pendingCount })}
            </Badge>
          )}
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> {t("roles.refresh")}
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(["pending", "all", "approved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-9 px-4 rounded-full text-sm font-medium border transition-colors ${
              filter === f
                ? "bg-navy text-navy-foreground border-navy"
                : "border-border hover:border-gold/40"
            }`}
          >
            {f === "pending"
              ? t("roles.pending_approval")
              : f === "all"
                ? t("roles.all")
                : t("roles.approved")}
            {f === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : isError ? (
        <div role="alert" className="py-20 text-center">
          <p className="mb-4 text-sm text-destructive">{t("roles.unable_to_load_products")}</p>
          <Button variant="outline" onClick={() => refetch()}>
            {t("roles.try_again")}
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-20 text-center text-sm text-muted-foreground">
          {filter === "pending"
            ? t("roles.no_products_pending_approval")
            : filter === "approved"
              ? t("roles.no_approved_products_yet")
              : t("roles.no_products_yet")}
        </p>
      ) : (
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-160">
              <thead className="text-xs text-muted-foreground border-b border-border bg-muted/30">
                <tr>
                  <th className="text-left font-medium py-3 px-4">{t("roles.product")}</th>
                  <th className="text-left font-medium py-3">{t("roles.seller")}</th>
                  <th className="text-right font-medium py-3">{t("roles.price")}</th>
                  <th className="text-right font-medium py-3">{t("roles.stock")}</th>
                  <th className="text-center font-medium py-3">{t("roles.status")}</th>
                  <th className="text-right font-medium py-3 px-4">{t("roles.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => {
                  const stock = p.product_variants.reduce((n, v) => n + (v.stock_quantity ?? 0), 0);
                  const hidden = p.status === "archived";
                  return (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.category?.name ?? t("roles.uncategorized")}
                        </p>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        <p className="text-xs truncate max-w-35">
                          {p.seller_stores?.store_name ?? "—"}
                        </p>
                      </td>
                      <td className="py-3 text-right font-medium">{formatXAF(p.base_price)}</td>
                      <td className="py-3 text-right">{stock}</td>
                      <td className="py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              p.status === "approved"
                                ? "bg-gold-500/15 text-gold-700 border-gold-500/30"
                                : p.status === "rejected"
                                  ? "bg-destructive/15 text-destructive border-destructive/30"
                                  : "bg-amber-500/15 text-amber-600 border-amber-500/30"
                            }`}
                          >
                            {p.status === "pending_approval" ? t("roles.pending") : p.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {p.status !== "approved" ? (
                          <Button
                            size="sm"
                            className="rounded-full bg-gold-500 text-gold-foreground hover:bg-gold-600 h-8 text-xs mr-1"
                            onClick={() => approve.mutate({ id: p.id, approved: true })}
                            disabled={approve.isPending || del.isPending}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {t("roles.approve")}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full h-8 text-xs text-amber-600 mr-1"
                            onClick={() => approve.mutate({ id: p.id, approved: false })}
                            disabled={approve.isPending || del.isPending}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" /> {t("roles.unapprove")}
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => toggleVisible.mutate({ id: p.id, hide: !hidden })}
                          title={hidden ? t("roles.show") : t("roles.hide")}
                          aria-label={`${hidden ? t("roles.show") : t("roles.hide")} ${p.title}`}
                          disabled={toggleVisible.isPending || del.isPending || approve.isPending}
                        >
                          {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          aria-label={t("roles.delete_product", { product: p.title })}
                          disabled={toggleVisible.isPending || del.isPending || approve.isPending}
                          onClick={() => {
                            if (confirm(t("roles.delete_product_confirm", { product: p.title })))
                              del.mutate(p.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
