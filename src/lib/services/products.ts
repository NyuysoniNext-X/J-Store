import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Product = Tables<"products">;
type ProductVariant = Tables<"product_variants">;
type ProductImage = Tables<"product_images">;

// Shape the storefront UI (ProductCard, shop, product detail, cart) renders.
// Kept identical to the old mock `Product` shape so existing UI components
// don't need to change — only where the data comes from does.
export type StorefrontProduct = {
  id: string;
  name: string;
  price: number;
  oldPrice?: number;
  rating: number;
  reviews: number;
  category: string;
  seller: string;
  image: string;
  imageSrc?: string;
  badge?: "new" | "hot" | "sale";
  description: string;
  stock: number;
};

type ProductJoinRow = Product & {
  categories: { name: string } | null;
  seller_stores: { store_name: string } | null;
  product_images: Pick<ProductImage, "url" | "position">[];
  product_variants: Pick<ProductVariant, "price_override" | "stock_quantity">[];
};

const PUBLIC_SELECT = `
  *,
  categories ( name ),
  seller_stores ( store_name ),
  product_images ( url, position ),
  product_variants ( price_override, stock_quantity )
`;

const FALLBACK_HUES = [25, 45, 200, 220, 260, 320, 10, 45, 45, 340];

function mapToStorefront(row: ProductJoinRow, index = 0): StorefrontProduct {
  const images = [...(row.product_images ?? [])].sort((a, b) => a.position - b.position);
  const variants = row.product_variants ?? [];

  // Effective price: cheapest variant override if any exist, else base_price.
  const overridePrices = variants
    .map((v) => v.price_override)
    .filter((p): p is number => p != null);
  const price = overridePrices.length > 0 ? Math.min(...overridePrices) : Number(row.base_price);

  const stock = variants.reduce((sum, v) => sum + (v.stock_quantity ?? 0), 0);

  return {
    id: row.id,
    name: row.title,
    price,
    rating: 0,
    reviews: 0,
    category: row.categories?.name ?? "General",
    seller: row.seller_stores?.store_name ?? "J-STORE seller",
    image: `hsl(${FALLBACK_HUES[index % FALLBACK_HUES.length]} 60% 55%)`,
    imageSrc: images[0]?.url,
    description: row.description ?? "",
    stock,
  };
}

export const productsService = {
  /** Approved products only — what buyers see on the storefront. */
  async listPublic(opts?: { categoryId?: string; storeId?: string; limit?: number }) {
    let query = supabase.from("products").select(PUBLIC_SELECT).eq("status", "approved");
    if (opts?.categoryId) query = query.eq("category_id", opts.categoryId);
    if (opts?.storeId) query = query.eq("store_id", opts.storeId);
    query = query.order("created_at", { ascending: false });
    if (opts?.limit) query = query.limit(opts.limit);

    const { data, error } = await query;
    if (error) throw error;
    return (data as unknown as ProductJoinRow[]).map((row, i) => mapToStorefront(row, i));
  },

  /** Single approved product for the product detail page. */
  async getPublicById(productId: string) {
    const { data, error } = await supabase
      .from("products")
      .select(PUBLIC_SELECT)
      .eq("id", productId)
      .eq("status", "approved")
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return mapToStorefront(data as unknown as ProductJoinRow);
  },

  /** Seller's own products regardless of status (dashboard/management view). */
  async listForStore(storeId: string) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Product[];
  },

  async getById(productId: string) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle();
    if (error) throw error;
    return data as Product | null;
  },

  /**
   * Creates a draft product plus its one required default variant (stock
   * lives on the variant, never on the product row). New products must start
   * as 'draft' (DB trigger) — call submitForReview() to queue it for admins.
   */
  async create(payload: TablesInsert<"products">, initialStock = 0) {
    const { data, error } = await supabase.from("products").insert(payload).select().single();
    if (error) throw error;

    const { error: variantErr } = await supabase.from("product_variants").insert({
      product_id: data.id,
      name: "Default",
      value: "Standard",
      stock_quantity: initialStock,
    });
    if (variantErr) throw variantErr;

    return data as Product;
  },

  /** Moves a draft/rejected product into the admin approval queue. */
  async submitForReview(productId: string) {
    const { error } = await supabase.rpc("submit_product_for_review", {
      p_product_id: productId,
    });
    if (error) throw error;
  },

  async update(productId: string, payload: TablesUpdate<"products">) {
    const { error } = await supabase.from("products").update(payload).eq("id", productId);
    if (error) throw error;
  },

  async remove(productId: string) {
    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) throw error;
  },
};
