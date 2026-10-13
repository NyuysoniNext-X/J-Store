import { useI18n } from "@/lib/i18n";
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

export const Route = createFileRoute("/_authenticated/_seller/seller/products")({
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
  rejection_reason: string | null;
  // Joined in — images live in product_images, stock in product_variants.
  product_images: { url: string; position: number }[];
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

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending review",
  approved: "Live",
  rejected: "Rejected",
  flagged: "Flagged",
  archived: "Archived",
};

// Generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function SellerProducts() {
  const { t } = useI18n();
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
      toast.error(t("roles.please_select_an_image_file"));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("roles.image_must_be_less_than_5mb"));
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
      toast.error(t("roles.failed_to_upload_image"));
      return null;
    } finally {
      setUploading(false);
    }
  };

  const upsert = useMutation({
    mutationFn: async () => {
      if (!sellerStore?.id) {
        throw new Error(t("roles.you_must_create_a_store_before_adding_products"));
      }

      if (!form.title.trim()) throw new Error(t("roles.enter_a_product_title"));
      if (!(form.base_price > 0)) throw new Error(t("roles.enter_a_price_greater_than_0"));
      if (!Number.isInteger(form.stock) || form.stock < 0) {
        throw new Error(t("roles.stock_must_be_a_whole_number_0_or_more"));
      }

      const uploadedUrl = await uploadImage();
      const slug = editing?.slug || generateSlug(form.title);

      // NOTE: status and store_id are deliberately NOT sent on update — a DB
      // trigger blocks sellers from changing them. New products must start as
      // 'draft'; submit_product_for_review moves them to the admin queue.
      const fields = {
        title: form.title.trim(),
        slug,
        description: form.description,
        base_price: form.base_price,
        category_id: form.category_id || null,
      };

      let productId: string;

      if (editing) {
        productId = editing.id;
        const { error } = await supabase.from("products").update(fields).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert({ ...fields, store_id: sellerStore.id, status: "draft" })
          .select()
          .single();
        if (error) throw error;
        productId = data.id;
      }

      // Image + stock are saved by one function that checks ownership itself,
      // so this doesn't depend on table-level policies on product_images /
      // product_variants (which were rejecting the insert with a 403).
      const { error: mediaErr } = await supabase.rpc("save_product_media", {
        p_product_id: productId,
        p_image_url: uploadedUrl ?? undefined,
        p_stock: form.stock,
      });
      if (mediaErr)
        throw new Error(t("roles.saved_but_image_stock_failed", { error: mediaErr.message }));

      // New products go straight into the review queue so they can go live.
      if (!editing) {
        const { error: subErr } = await supabase.rpc("submit_product_for_review", {
          p_product_id: productId,
        });
        if (subErr)
          throw new Error(t("roles.saved_as_draft_submit_failed", { error: subErr.message }));
      }
    },
    onSuccess: () => {
      toast.success(editing ? t("roles.product_updated") : t("roles.product_submitted_for_review"));
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

  const submitForReview = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("submit_product_for_review", { p_product_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("roles.submitted_for_review"));
      qc.invalidateQueries({ queryKey: ["seller-products", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("roles.product_deleted"));
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
          <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold mb-1">
            {t("roles.seller")}
          </p>
          <h1 className="font-display text-3xl md:text-4xl font-bold">{t("roles.my_products")}</h1>
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
                <Label>{t("roles.product_name")}</Label>
                <Input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={t("roles.enter_product_name")}
                />
              </div>

              <div>
                <Label>{t("roles.description")}</Label>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={t("roles.describe_your_product")}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>{t("roles.price_fcfa")}</Label>
                  <Input
                    required
                    type="number"
                    min={0}
                    value={form.base_price}
                    onChange={(e) => setForm({ ...form, base_price: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>{t("roles.category")}</Label>
                  <Select
                    value={form.category_id}
                    onValueChange={(value) => setForm({ ...form, category_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("roles.select_category")} />
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
                <Label>{t("roles.stock_quantity")}</Label>
                <Input
                  required
                  type="number"
                  min={0}
                  step={1}
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                />
              </div>

              <div>
                <Label>{t("roles.product_image")}</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("roles.png_jpg_webp_up_to_5mb")}
                </p>
                {previewUrl && (
                  <div className="mt-3">
                    <img
                      src={previewUrl}
                      alt={t("roles.image_preview")}
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
                  {(upsert.isPending || uploading) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {uploading ? t("roles.uploading") : t("roles.save")}
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
          <p className="font-display text-lg font-semibold">{t("roles.create_your_store_first")}</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {t("roles.before_you_can_add_products_set_up_store")}
          </p>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-card border border-border rounded-3xl">
          <Package className="h-12 w-12 text-gold mx-auto mb-3" />
          <p className="font-display text-lg font-semibold">{t("roles.no_products_yet")}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("roles.click_add_product_to_list_first_item")}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left font-medium py-3 px-4">{t("roles.product")}</th>
                  <th className="text-left font-medium py-3 hidden md:table-cell">
                    {t("roles.image")}
                  </th>
                  <th className="text-right font-medium py-3">{t("roles.price")}</th>
                  <th className="text-center font-medium py-3">{t("roles.status")}</th>
                  <th className="text-right font-medium py-3 px-4">{t("roles.actions")}</th>
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
                      <span
                        className="text-xs px-2 py-1 rounded-full bg-secondary"
                        title={p.rejection_reason ?? undefined}
                      >
                        {p.status === "pending_approval"
                          ? t("roles.pending_review")
                          : p.status === "approved"
                            ? t("roles.live")
                            : p.status === "draft"
                              ? t("roles.draft")
                              : p.status === "rejected"
                                ? t("roles.rejected")
                                : p.status === "flagged"
                                  ? t("roles.flagged")
                                  : p.status === "archived"
                                    ? t("roles.archived")
                                    : p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {(p.status === "draft" || p.status === "rejected") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full h-8 text-xs mr-1"
                          disabled={submitForReview.isPending}
                          onClick={() => submitForReview.mutate(p.id)}
                        >
                          {t("roles.submit_for_review")}
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(t("roles.delete_product_simple", { product: p.title })))
                            del.mutate(p.id);
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
