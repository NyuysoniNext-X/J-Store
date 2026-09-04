import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { formatXAF } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/_seller/seller/products")({
  component: SellerProducts,
  head: () => ({ meta: [{ title: "My products — J-STORE.cm" }] }),
});

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  stock: number;
  image_url: string | null;
  active: boolean;
};

const EMPTY = {
  name: "",
  description: "",
  price: 0,
  category: "Fashion",
  stock: 0,
  image_url: "",
  active: true,
};

function SellerProducts() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["seller-products", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ProductRow[];
    },
    enabled: !!user,
  });

  const upsert = useMutation({
    mutationFn: async () => {
      const payload = { ...form, seller_id: user!.id };
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Product updated" : "Product added");
      qc.invalidateQueries({ queryKey: ["seller-products", user?.id] });
      setOpen(false);
      setEditing(null);
      setForm(EMPTY);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: ["seller-products", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (p: ProductRow) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      price: p.price,
      category: p.category,
      stock: p.stock,
      image_url: p.image_url ?? "",
      active: p.active,
    });
    setOpen(true);
  };

  return (
    <div className="mx-auto max-w-[1536px] px-6 py-10">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold mb-1">Seller</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold">My products</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add, edit, or retire products in your shop.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openNew}
              className="rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                upsert.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <Label>Name</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Price (FCFA)</Label>
                  <Input
                    required
                    type="number"
                    min={0}
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Stock</Label>
                  <Input
                    required
                    type="number"
                    min={0}
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Image URL</Label>
                  <Input
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                />
                <Label>Active (visible in shop)</Label>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={upsert.isPending}
                  className="rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
                >
                  {upsert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-card border border-border rounded-3xl">
          <Package className="h-12 w-12 text-gold mx-auto mb-3" />
          <p className="font-display text-lg font-semibold">No products yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Click “Add product” to publish your first item.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left font-medium py-3 px-4">Product</th>
                  <th className="text-left font-medium py-3 hidden sm:table-cell">Category</th>
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
                      {!p.active && (
                        <span className="text-[10px] uppercase text-muted-foreground">Hidden</span>
                      )}
                    </td>
                    <td className="py-3 text-muted-foreground hidden sm:table-cell">
                      {p.category}
                    </td>
                    <td className="py-3 text-right font-semibold">{formatXAF(p.price)}</td>
                    <td className="py-3 text-right">{p.stock}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete "${p.name}"?`)) del.mutate(p.id);
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
