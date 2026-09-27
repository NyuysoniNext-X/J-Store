import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type Order = Tables<"orders">;
type OrderItem = Tables<"order_items">;

export const ordersService = {
  async create(payload: TablesInsert<"orders">) {
    const { data, error } = await supabase.from("orders").insert(payload).select().single();
    if (error) throw error;
    return data as Order;
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

  async list(buyerId: string) {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("buyer_id", buyerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as (Order & { order_items: OrderItem[] })[];
  },

  async updateStatus(orderId: string, status: any) {
    const { error } = await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", orderId); // <-- Removed the extra ')'
    if (error) throw error;
  },
};
