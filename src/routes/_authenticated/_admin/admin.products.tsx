import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, EyeOff, Eye, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatXAF } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/_admin/admin/products")({
  component: AdminProducts,
  head: () => ({ meta: [{ title: "Product moderation — J-STORE.cm" }] }),
});

function AdminProducts() {
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-all-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("products").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-products"] });
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-products"] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-[1536px] px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Package className="h-6 w-6 text-gold" />
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">Admin</p>
          <h1 className="font-display text-3xl font-bold">Product moderation</h1>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left font-medium py-3 px-4">Product</th>
                  <th className="text-left font-medium py-3 hidden md:table-cell">Seller</th>
                  <th className="text-right font-medium py-3">Price</th>
                  <th className="text-right font-medium py-3">Stock</th>
                  <th className="text-right font-medium py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.category}</p>
                    </td>
                    <td className="py-3 text-muted-foreground hidden md:table-cell truncate max-w-[160px]">
                      {p.seller_id.slice(0, 8)}…
                    </td>
                    <td className="py-3 text-right">{formatXAF(p.price)}</td>
                    <td className="py-3 text-right">{p.stock}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggle.mutate({ id: p.id, active: !p.active })}
                        title={p.active ? "Hide" : "Show"}
                      >
                        {p.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Delete this product?")) del.mutate(p.id);
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
