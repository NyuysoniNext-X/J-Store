import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { AppRole } from "@/lib/auth";

type Profile = Tables<"profiles">;

export const usersService = {
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data as Profile | null;
  },

  async updateProfile(userId: string, payload: TablesInsert<"profiles">) {
    const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
    if (error) throw error;
  },

  async listRoles() {
    const { data, error } = await supabase.from("user_roles").select("*");
    if (error) throw error;
    return data as { id: string; user_id: string; role: AppRole }[];
  },

  async grantRole(userId: string, role: AppRole) {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error && !error.message.toLowerCase().includes("duplicate")) throw error;
  },

  async revokeRole(userId: string, role: AppRole) {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role);
    if (error) throw error;
  },

  async listProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Profile[];
  },
};
