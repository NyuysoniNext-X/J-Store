import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Commission = Tables<"partner_commissions">;
type Profile = Tables<"profiles">;

export const partnersService = {
  /** The partner's own referral code + rate (null referral_code means staff hasn't assigned one yet). */
  async getOwnProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("referral_code, commission_rate")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data as Pick<Profile, "referral_code" | "commission_rate"> | null;
  },

  async listCommissions(partnerId: string) {
    const { data, error } = await supabase
      .from("partner_commissions")
      .select("*")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Commission[];
  },

  /** Referred users (signups attributed to this partner), regardless of whether they've ordered yet. */
  async listReferredUsers(partnerId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, created_at")
      .eq("referred_by", partnerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Pick<Profile, "id" | "display_name" | "created_at">[];
  },

  // ── Staff-only actions ──────────────────────────────────────────────────

  /** Staff-only: assign or change a partner's referral code. The database must
   * enforce the staff-only authorization for this operation. */
  async setReferralCode(partnerId: string, code: string) {
    const normalizedCode = code.trim();
    if (!normalizedCode) throw new Error("Referral code cannot be empty.");

    const { error } = await supabase
      .from("profiles")
      .update({ referral_code: normalizedCode })
      .eq("id", partnerId);
    if (error) throw error;
  },

  /** Staff-only: set a partner's commission rate (e.g. 0.05 for 5%). */
  async setCommissionRate(partnerId: string, rate: number) {
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      throw new Error("Commission rate must be between 0 and 1.");
    }

    const { error } = await supabase
      .from("profiles")
      .update({ commission_rate: rate })
      .eq("id", partnerId);
    if (error) throw error;
  },
};
