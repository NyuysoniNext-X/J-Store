import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type Order = Tables<"orders">;
type OrderItem = Tables<"order_items">;

export const ordersService = {
  async list(buyerId: string) {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("buyer_id", buyerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as (Order & { order_items: OrderItem[] })[];
  },

  async getById(orderId: string) {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw error;
    return data as (Order & { order_items: OrderItem[] }) | null;
  },

  async create(payload: TablesInsert<"orders">) {
    const { data, error } = await supabase.from("orders").insert(payload).select().single();
    if (error) throw error;
    return data as Order;
  },

  async updateStatus(orderId: string, status: string) {
    const { error } = await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", orderId);
    if (error) throw error;
  },
};
