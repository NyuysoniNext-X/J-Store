import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { usersService } from "./users";

type Order = Tables<"orders">;
type DeliveryApplication = Tables<"delivery_applications">;

export const deliveryService = {
  async listActiveOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select("id,address,city,phone,total,status,delivery_status,rider_id,created_at")
      .in("delivery_status", ["unassigned", "assigned", "picked_up", "out_for_delivery"])
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Pick<
      Order,
      | "id"
      | "address"
      | "city"
      | "phone"
      | "total"
      | "status"
      | "delivery_status"
      | "rider_id"
      | "created_at"
    >[];
  },

  async claimOrder(orderId: string, riderId: string) {
    const { error } = await supabase
      .from("orders")
      .update({ rider_id: riderId, delivery_status: "assigned" })
      .eq("id", orderId);
    if (error) throw error;
  },

  async updateDeliveryStatus(orderId: string, status: string, extra?: Record<string, string>) {
    const patch: TablesUpdate<"orders"> = {
      delivery_status: status,
      updated_at: new Date().toISOString(),
      ...extra,
    };
    if (status === "delivered") {
      patch.status = "delivered";
      patch.awaiting_buyer_confirm = true;
    }
    const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
    if (error) throw error;
  },

  async submitApplication(payload: TablesInsert<"delivery_applications">) {
    const { data, error } = await supabase
      .from("delivery_applications")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as DeliveryApplication;
  },

  async listApplications() {
    const { data, error } = await supabase
      .from("delivery_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as DeliveryApplication[];
  },

  async reviewApplication(appId: string, reviewerId: string, status: "approved" | "rejected") {
    const { error } = await supabase
      .from("delivery_applications")
      .update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
      .eq("id", appId);
    if (error) throw error;
    if (status === "approved") {
      const app = await supabase
        .from("delivery_applications")
        .select("user_id")
        .eq("id", appId)
        .single();
      if (app.data) {
        await usersService.grantRole(app.data.user_id, "delivery");
      }
    }
  },
};
