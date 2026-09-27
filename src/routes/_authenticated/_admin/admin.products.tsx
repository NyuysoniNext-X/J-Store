import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, EyeOff, Eye, Package, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
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

function AdminProducts() {
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
        .select("*, category:categories(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Array<{
        id: string;
        name: string;
        price: number;
        stock: number;
        active: boolean;
        approved: boolean;
        seller_id: string;
        created_at: string;
        category: { name: string } | null;
      }>;
    },
  });

  const filtered = products.filter((p) => {
    if (filter === "pending") return !p.approved;
    if (filter === "approved") return p.approved;
    return true;
  });

  const pendingCount = products.filter((p) => !p.approved).length;

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("products").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-all-products"] });
      toast.success("Visibility updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const update = approved
        ? { approved: true, approved_by: user!.id, approved_at: new Date().toISOString() }
        : { approved: false, approved_by: null, approved_at: null };
      
      const { error } = await supabase.from("products").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async (_d, vars) => {
      await qc.invalidateQueries({ queryKey: ["admin-all-products"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(vars.approved ? "Product approved ✅" : "Approval revoked");
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
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-[1536px] px-6 py-10">
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-gold" />
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">Admin</p>
            <h1 className="font-display text-3xl font-bold">Product moderation</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Approve or hide products from appearing on the site.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge className="bg-amber-500 text-white text-sm px-3 py-1">
              {pendingCount} pending
            </Badge>
          )}
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
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
            {f === "pending" ? "Pending approval" : f === "all" ? "All" : "Approved"}
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
          <p className="mb-4 text-sm text-destructive">
            Unable to load products. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-20 text-center text-sm text-muted-foreground">
          {filter === "pending"
            ? "No products pending approval."
            : filter === "approved"
              ? "No approved products yet."
              : "No products yet."}
        </p>
      ) : (
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-xs text-muted-foreground border-b border-border bg-muted/30">
                <tr>
                  <th className="text-left font-medium py-3 px-4">Product</th>
                  <th className="text-left font-medium py-3">Seller</th>
                  <th className="text-right font-medium py-3">Price</th>
                  <th className="text-right font-medium py-3">Stock</th>
                  <th className="text-center font-medium py-3">Status</th>
                  <th className="text-right font-medium py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.category?.name ?? "Uncategorized"}
                      </p>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      <p className="font-mono text-xs truncate max-w-[120px]">
                        {p.seller_id.slice(0, 12)}…
                      </p>
                    </td>
                    <td className="py-3 text-right font-medium">{formatXAF(p.price)}</td>
                    <td className="py-3 text-right">{p.stock}</td>
                    <td className="py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            p.approved
                              ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                              : "bg-amber-500/15 text-amber-600 border-amber-500/30"
                          }`}
                        >
                          {p.approved ? "Approved" : "Pending"}
                        </Badge>
                        {!p.active && (
                          <Badge variant="outline" className="text-xs bg-muted">
                            Hidden
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {!p.approved ? (
                        <Button
                          size="sm"
                          className="rounded-full bg-emerald-500 text-white hover:bg-emerald-600 h-8 text-xs mr-1"
                          onClick={() => approve.mutate({ id: p.id, approved: true })}
                          disabled={approve.isPending || del.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full h-8 text-xs text-amber-600 mr-1"
                          onClick={() => approve.mutate({ id: p.id, approved: false })}
                          disabled={approve.isPending || del.isPending}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Unapprove
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => toggle.mutate({ id: p.id, active: !p.active })}
                        title={p.active ? "Hide" : "Show"}
                        aria-label={`${p.active ? "Hide" : "Show"} ${p.name}`}
                        disabled={toggle.isPending || del.isPending || approve.isPending}
                      >
                        {p.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label={`Delete ${p.name}`}
                        disabled={toggle.isPending || del.isPending || approve.isPending}
                        onClick={() => {
                          if (confirm(`Delete "${p.name}"? This cannot be undone.`)) del.mutate(p.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
