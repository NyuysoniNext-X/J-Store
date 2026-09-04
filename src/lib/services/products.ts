import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type Product = Tables<"products">;

export const productsService = {
  async list(opts?: { category?: string; sellerId?: string; active?: boolean }) {
    let query = supabase.from("products").select("*");
    if (opts?.category) query = query.eq("category", opts.category);
    if (opts?.sellerId) query = query.eq("seller_id", opts.sellerId);
    if (opts?.active !== undefined) query = query.eq("active", opts.active);
    const { data, error } = await query.order("created_at", { ascending: false });
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

  async create(payload: TablesInsert<"products">) {
    const { data, error } = await supabase.from("products").insert(payload).select().single();
    if (error) throw error;
    return data as Product;
  },

  async update(productId: string, payload: TablesInsert<"products">) {
    const { error } = await supabase.from("products").update(payload).eq("id", productId);
    if (error) throw error;
  },

  async remove(productId: string) {
    const { error } = await supabase.from("products").update({ active: false }).eq("id", productId);
    if (error) throw error;
  },
};
