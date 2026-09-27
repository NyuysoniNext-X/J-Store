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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatXAF } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/_seller/seller/products/OLD")({
  component: SellerProducts,
  head: () => ({ meta: [{ title: "My products — J-STORE.cm" }] }),
});

type ProductRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  base_price: number;
  category_id: string | null;
  status: string;
  store_id: string;
  // Joined in, not a real products column — images live in product_images.
  product_images: { url: string; position: number }[];
  // Joined in, not a real products column — stock lives in product_variants.
  product_variants: { id: string; stock_quantity: number }[];
};

type Category = {
  id: string;
  name: string;
  slug: string;
};

const EMPTY = {
  title: "",
  description: "",
  base_price: 0,
  category_id: "",
  stock: 0,
};

// Generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function SellerProducts() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  
  // Image upload states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug")
        .order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  // Fetch products
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["seller-products", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: store } = await supabase
        .from("seller_stores")
        .select("id")
        .eq("owner_id", user.id)
        .single();
      
      if (!store) return [];
      
      const { data, error } = await supabase
        .from("products")
        .select("*, product_images ( url, position ), product_variants ( id, stock_quantity )")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ProductRow[];
    },
    enabled: !!user,
  });

  // Fetch seller's store
  const { data: sellerStore } = useQuery({
    queryKey: ["seller-store", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_stores")
        .select("id, store_name")
        .eq("owner_id", user!.id)
        .single();
      
      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }

      return data;
    },
    enabled: !!user,
  });

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Upload image
  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;

    setUploading(true);
    try {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, imageFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("product-images").getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const upsert = useMutation({
    mutationFn: async () => {
      if (!sellerStore?.id) {
        throw new Error("You must create a store before adding products");
      }

      const uploadedUrl = await uploadImage();

      const slug = editing?.slug || generateSlug(form.title);

      const payload = {
        title: form.title,
        slug,
        description: form.description,
        base_price: form.base_price,
        category_id: form.category_id || null,
        store_id: sellerStore.id,
        status: "draft" as const,
      };

      if (editing) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;

        if (uploadedUrl) {
          // Replace the existing image (simple single-image flow for now).
          await supabase.from("product_images").delete().eq("product_id", editing.id);
          const { error: imgErr } = await supabase
            .from("product_images")
            .insert({ product_id: editing.id, url: uploadedUrl, position: 0 });
          if (imgErr) throw imgErr;
        }

        const existingVariantId = editing.product_variants?.[0]?.id;
        if (existingVariantId) {
          const { error: variantErr } = await supabase
            .from("product_variants")
            .update({ stock_quantity: form.stock })
            .eq("id", existingVariantId);
          if (variantErr) throw variantErr;
        } else {
          const { error: variantErr } = await supabase.from("product_variants").insert({
            product_id: editing.id,
            name: "Default",
            value: "Standard",
            stock_quantity: form.stock,
          });
          if (variantErr) throw variantErr;
        }
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select().single();
        if (error) throw error;

        if (uploadedUrl) {
          const { error: imgErr } = await supabase
            .from("product_images")
            .insert({ product_id: data.id, url: uploadedUrl, position: 0 });
          if (imgErr) throw imgErr;
        }

        // Every product needs at least one variant — stock lives here, not
        // on the product row.
        const { error: variantErr } = await supabase.from("product_variants").insert({
          product_id: data.id,
          name: "Default",
          value: "Standard",
          stock_quantity: form.stock,
        });
        if (variantErr) throw variantErr;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Product updated" : "Product created");
      qc.invalidateQueries({ queryKey: ["seller-products", user?.id] });
      setOpen(false);
      setEditing(null);
      setForm(EMPTY);
      setImageFile(null);
      setPreviewUrl(null);
    },
    onError: (e: Error) => {
      console.error("Upsert error:", e);
      toast.error(e.message);
    },
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
    setImageFile(null);
    setPreviewUrl(null);
    setOpen(true);
  };
  
  const openEdit = (p: ProductRow) => {
    const currentImage = [...(p.product_images ?? [])].sort((a, b) => a.position - b.position)[0];
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description ?? "",
      base_price: p.base_price,
      category_id: p.category_id ?? "",
      stock: p.product_variants?.[0]?.stock_quantity ?? 0,
    });
    setImageFile(null);
    setPreviewUrl(currentImage?.url ?? null);
    setOpen(true);
  };

  return (
    <div className="mx-auto max-w-[1536px] px-6 py-10">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold mb-1">Seller</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold">My products</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add, edit, or manage your products. Products start as drafts.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openNew}
              disabled={!sellerStore}
              className="rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
              title={!sellerStore ? "Create a store first" : "Add product"}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                <Label>Product Name</Label>
                <Input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Enter product name"
                />
              </div>
              
              <div>
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe your product"
                />
              </div>
              
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Price (FCFA)</Label>
                  <Input
                    required
                    type="number"
                    min={0}
                    value={form.base_price}
                    onChange={(e) => setForm({ ...form, base_price: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select
                    value={form.category_id}
                    onValueChange={(value) => setForm({ ...form, category_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Stock quantity</Label>
                <Input
                  required
                  type="number"
                  min={0}
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                />
              </div>
              
              <div>
                <Label>Product Image</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, WEBP up to 5MB
                </p>
                {previewUrl && (
                  <div className="mt-3">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="h-32 w-32 rounded-lg object-cover border border-border"
                    />
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={upsert.isPending || uploading}
                  className="rounded-full bg-navy text-navy-foreground hover:bg-gold hover:text-gold-foreground"
                >
                  {(upsert.isPending || uploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {uploading ? "Uploading..." : "Save"}
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
      ) : !sellerStore ? (
        <div className="text-center py-20 bg-card border border-border rounded-3xl">
          <Package className="h-12 w-12 text-amber-500 mx-auto mb-3" />
          <p className="font-display text-lg font-semibold">Create your store first</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Before you can add products, you need to set up your seller store with business details.
          </p>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-card border border-border rounded-3xl">
          <Package className="h-12 w-12 text-gold mx-auto mb-3" />
          <p className="font-display text-lg font-semibold">No products yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Click "Add product" to list your first item.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left font-medium py-3 px-4">Product</th>
                  <th className="text-left font-medium py-3 hidden md:table-cell">Image</th>
                  <th className="text-right font-medium py-3">Price</th>
                  <th className="text-center font-medium py-3">Status</th>
                  <th className="text-right font-medium py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4">
                      <p className="font-medium">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{p.slug}</p>
                    </td>
                    <td className="py-3 hidden md:table-cell">
                      {p.product_images?.[0]?.url ? (
                        <img
                          src={p.product_images[0].url}
                          alt={p.title}
                          className="h-12 w-12 rounded-lg object-cover border border-border"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-secondary border border-border flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-right font-semibold">{formatXAF(p.base_price)}</td>
                    <td className="py-3 text-center">
                      <span className="text-xs capitalize px-2 py-1 rounded-full bg-secondary">
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete "${p.title}"?`)) del.mutate(p.id);
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
