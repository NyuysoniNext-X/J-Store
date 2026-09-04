export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          parent_id: string | null;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          parent_id?: string | null;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          parent_id?: string | null;
          image_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      delivery_applications: {
        Row: {
          admin_notes: string | null;
          applicant_type: string;
          availability: string | null;
          city: string;
          company_document_url: string | null;
          company_name: string | null;
          company_registration: string | null;
          coverage_zones: string[] | null;
          created_at: string;
          experience: string | null;
          fleet_size: number | null;
          full_name: string;
          id: string;
          id_url: string | null;
          license_url: string | null;
          motivation: string | null;
          phone: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          updated_at: string;
          user_id: string;
          vehicle_type: string | null;
        };
        Insert: {
          admin_notes?: string | null;
          applicant_type?: string;
          availability?: string | null;
          city: string;
          company_document_url?: string | null;
          company_name?: string | null;
          company_registration?: string | null;
          coverage_zones?: string[] | null;
          created_at?: string;
          experience?: string | null;
          fleet_size?: number | null;
          full_name: string;
          id?: string;
          id_url?: string | null;
          license_url?: string | null;
          motivation?: string | null;
          phone: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
          vehicle_type?: string | null;
        };
        Update: {
          admin_notes?: string | null;
          applicant_type?: string;
          availability?: string | null;
          city?: string;
          company_document_url?: string | null;
          company_name?: string | null;
          company_registration?: string | null;
          coverage_zones?: string[] | null;
          created_at?: string;
          experience?: string | null;
          fleet_size?: number | null;
          full_name?: string;
          id?: string;
          id_url?: string | null;
          license_url?: string | null;
          motivation?: string | null;
          phone?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
          vehicle_type?: string | null;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          order_id: string;
          product_id: string | null;
          qty: number;
          seller_id: string;
          unit_price: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          order_id: string;
          product_id?: string | null;
          qty: number;
          seller_id: string;
          unit_price: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          order_id?: string;
          product_id?: string | null;
          qty?: number;
          seller_id?: string;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          address: string;
          awaiting_buyer_confirm: boolean;
          buyer_confirmed: boolean;
          buyer_id: string;
          city: string | null;
          created_at: string;
          delivered_at: string | null;
          delivery_notes: string | null;
          delivery_status: string;
          id: string;
          phone: string | null;
          picked_up_at: string | null;
          rider_id: string | null;
          status: string;
          total: number;
          updated_at: string;
        };
        Insert: {
          address: string;
          awaiting_buyer_confirm?: boolean;
          buyer_confirmed?: boolean;
          buyer_id: string;
          city?: string | null;
          created_at?: string;
          delivered_at?: string | null;
          delivery_notes?: string | null;
          delivery_status?: string;
          id?: string;
          phone?: string | null;
          picked_up_at?: string | null;
          rider_id?: string | null;
          status?: string;
          total: number;
          updated_at?: string;
        };
        Update: {
          address?: string;
          awaiting_buyer_confirm?: boolean;
          buyer_confirmed?: boolean;
          buyer_id?: string;
          city?: string | null;
          created_at?: string;
          delivered_at?: string | null;
          delivery_notes?: string | null;
          delivery_status?: string;
          id?: string;
          phone?: string | null;
          picked_up_at?: string | null;
          rider_id?: string | null;
          status?: string;
          total?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          active: boolean;
          badge: string | null;
          category: string;
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          name: string;
          price: number;
          seller_id: string;
          stock: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          badge?: string | null;
          category?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          name: string;
          price: number;
          seller_id: string;
          stock?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          badge?: string | null;
          category?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          name?: string;
          price?: number;
          seller_id?: string;
          stock?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          city: string | null;
          country: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          phone: string | null;
          preferred_language: string | null;
          referral_code: string | null;
          referred_by: string | null;
          commission_rate: number;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          phone?: string | null;
          preferred_language?: string | null;
          referral_code?: string | null;
          referred_by?: string | null;
          commission_rate?: number;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          phone?: string | null;
          preferred_language?: string | null;
          referral_code?: string | null;
          referred_by?: string | null;
          commission_rate?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      partner_commissions: {
        Row: {
          id: string;
          partner_id: string;
          order_id: string | null;
          referred_user_id: string | null;
          commission_amount: number;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          partner_id: string;
          order_id?: string | null;
          referred_user_id?: string | null;
          commission_amount: number;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          partner_id?: string;
          order_id?: string | null;
          referred_user_id?: string | null;
          commission_amount?: number;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          order_item_id: string;
          reviewer_id: string;
          product_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_item_id: string;
          reviewer_id: string;
          product_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_item_id?: string;
          reviewer_id?: string;
          product_id?: string;
          rating?: number;
          comment?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      seller_applications: {
        Row: {
          id: string;
          user_id: string;
          store_name: string;
          id_document_url: string;
          business_registration_url: string | null;
          business_type: string | null;
          owner_name: string | null;
          phone: string | null;
          email: string | null;
          city: string | null;
          tax_id: string | null;
          status: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          rejection_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          store_name: string;
          id_document_url: string;
          business_registration_url?: string | null;
          business_type?: string | null;
          owner_name?: string | null;
          phone?: string | null;
          email?: string | null;
          city?: string | null;
          tax_id?: string | null;
          status?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          store_name?: string;
          id_document_url?: string;
          business_registration_url?: string | null;
          business_type?: string | null;
          owner_name?: string | null;
          phone?: string | null;
          email?: string | null;
          city?: string | null;
          tax_id?: string | null;
          status?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      app_role: "customer" | "seller" | "admin" | "super_admin" | "delivery" | "partner";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["customer", "seller", "admin", "super_admin", "delivery", "partner"],
    },
  },
} as const;
