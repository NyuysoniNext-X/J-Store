import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { usersService } from "./users";

type DeliveryStatus = Tables<"deliveries">["status"];
type DeliveryEvidence = Pick<
  TablesUpdate<"deliveries">,
  "proof_photo_url" | "customer_signature_url"
>;

export const deliveryService = {
  async listActiveOrders() {
    const { data, error } = await supabase
      .from("deliveries")
      .select("*, order:orders(id,delivery_address,phone,total,status,created_at)")
      .in("status", ["unassigned", "assigned", "picked_up", "in_transit"])
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async claimOrder(orderId: string, riderId: string) {
    const { data: personnel, error: personnelError } = await supabase
      .from("delivery_personnel")
      .select("id,is_approved")
      .eq("user_id", riderId)
      .maybeSingle();
    if (personnelError) throw personnelError;
    if (!personnel?.is_approved) throw new Error("An approved delivery profile is required.");

    const { data, error } = await supabase
      .from("deliveries")
      .update({
        delivery_personnel_id: personnel.id,
        status: "assigned",
        assigned_at: new Date().toISOString(),
      })
      .eq("order_id", orderId)
      .eq("status", "unassigned")
      .is("delivery_personnel_id", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Delivery is unavailable or access was denied.");
  },

  async updateDeliveryStatus(
    orderId: string,
    status: Exclude<DeliveryStatus, "unassigned" | "assigned">,
    evidence?: DeliveryEvidence,
  ) {
    const now = new Date().toISOString();
    const patch: TablesUpdate<"deliveries"> = {
      proof_photo_url: evidence?.proof_photo_url,
      customer_signature_url: evidence?.customer_signature_url,
      status,
      updated_at: now,
      ...(status === "picked_up" ? { picked_up_at: now } : {}),
      ...(status === "delivered" ? { delivered_at: now } : {}),
    };
    const previousStatuses: Record<typeof status, DeliveryStatus[]> = {
      picked_up: ["assigned"],
      in_transit: ["picked_up"],
      delivered: ["picked_up", "in_transit"],
      failed: ["assigned", "picked_up", "in_transit"],
    };
    const { data, error } = await supabase
      .from("deliveries")
      .update(patch)
      .eq("order_id", orderId)
      .in("status", previousStatuses[status])
      .not("delivery_personnel_id", "is", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Delivery status changed or access was denied.");
  },

  async submitApplication(payload: TablesInsert<"delivery_applications">) {
    const { data, error } = await supabase
      .from("delivery_applications")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listApplications() {
    const { data, error } = await supabase
      .from("delivery_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async reviewApplication(appId: string, reviewerId: string, status: "approved" | "rejected") {
    const { data, error } = await supabase
      .from("delivery_applications")
      .update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
      .eq("id", appId)
      .select("user_id")
      .single();
    if (error) throw error;
    if (status === "approved") {
      await usersService.grantRole(data.user_id, "delivery");
    }
  },
};
