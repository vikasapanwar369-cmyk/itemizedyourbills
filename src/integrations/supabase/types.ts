export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bills: {
        Row: {
          bill_date: string
          bill_number: string | null
          bill_time: string | null
          category: string
          content_hash: string | null
          country: string
          created_at: string
          currency: string
          discount: number
          id: string
          image_phash: string | null
          image_url: string | null
          locale: string
          merchant_address: string | null
          payment_mode: string
          store: string
          subtotal: number
          tax: number
          total: number
          user_id: string
        }
        Insert: {
          bill_date?: string
          bill_number?: string | null
          bill_time?: string | null
          category?: string
          content_hash?: string | null
          country?: string
          created_at?: string
          currency?: string
          discount?: number
          id?: string
          image_phash?: string | null
          image_url?: string | null
          locale?: string
          merchant_address?: string | null
          payment_mode?: string
          store?: string
          subtotal?: number
          tax?: number
          total?: number
          user_id: string
        }
        Update: {
          bill_date?: string
          bill_number?: string | null
          bill_time?: string | null
          category?: string
          content_hash?: string | null
          country?: string
          created_at?: string
          currency?: string
          discount?: number
          id?: string
          image_phash?: string | null
          image_url?: string | null
          locale?: string
          merchant_address?: string | null
          payment_mode?: string
          store?: string
          subtotal?: number
          tax?: number
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          category: string
          created_at: string
          currency: string
          id: string
          monthly_limit: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          currency?: string
          id?: string
          monthly_limit?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          currency?: string
          id?: string
          monthly_limit?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          emoji: string
          id: string
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: string
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      items: {
        Row: {
          bill_date: string
          bill_id: string
          brand: string
          canonical_name: string | null
          categorized_at: string
          categorized_by: string
          category: string
          category_confidence: number
          category_id: string | null
          company: string | null
          created_at: string
          discount: number
          gst_percent: number | null
          id: string
          mrp: number | null
          name: string
          price: number
          qty: number
          sub: string
          subcategory_id: string | null
          unit: string
          unit_price: number
          unit_weight_or_volume: string | null
          user_id: string
        }
        Insert: {
          bill_date?: string
          bill_id: string
          brand?: string
          canonical_name?: string | null
          categorized_at?: string
          categorized_by?: string
          category?: string
          category_confidence?: number
          category_id?: string | null
          company?: string | null
          created_at?: string
          discount?: number
          gst_percent?: number | null
          id?: string
          mrp?: number | null
          name: string
          price?: number
          qty?: number
          sub?: string
          subcategory_id?: string | null
          unit?: string
          unit_price?: number
          unit_weight_or_volume?: string | null
          user_id: string
        }
        Update: {
          bill_date?: string
          bill_id?: string
          brand?: string
          canonical_name?: string | null
          categorized_at?: string
          categorized_by?: string
          category?: string
          category_confidence?: number
          category_id?: string | null
          company?: string | null
          created_at?: string
          discount?: number
          gst_percent?: number | null
          id?: string
          mrp?: number | null
          name?: string
          price?: number
          qty?: number
          sub?: string
          subcategory_id?: string | null
          unit?: string
          unit_price?: number
          unit_weight_or_volume?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_bills: {
        Row: {
          avg_amount: number
          cadence_days: number
          category: string
          created_at: string
          currency: string
          id: string
          key: string
          last_seen_date: string | null
          next_due_date: string | null
          note: string | null
          status: string
          store: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_amount?: number
          cadence_days?: number
          category?: string
          created_at?: string
          currency?: string
          id?: string
          key: string
          last_seen_date?: string | null
          next_due_date?: string | null
          note?: string | null
          status?: string
          store: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_amount?: number
          cadence_days?: number
          category?: string
          created_at?: string
          currency?: string
          id?: string
          key?: string
          last_seen_date?: string | null
          next_due_date?: string | null
          note?: string | null
          status?: string
          store?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shopping_list_items: {
        Row: {
          brand: string
          category: string
          checked: boolean
          created_at: string
          id: string
          last_price: number | null
          last_store: string | null
          name: string
          qty: number
          source: string
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string
          category?: string
          checked?: boolean
          created_at?: string
          id?: string
          last_price?: number | null
          last_store?: string | null
          name: string
          qty?: number
          source?: string
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string
          category?: string
          checked?: boolean
          created_at?: string
          id?: string
          last_price?: number | null
          last_store?: string | null
          name?: string
          qty?: number
          source?: string
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          key: string
          keywords: string[]
          label: string
          sort_order: number
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          key: string
          keywords?: string[]
          label: string
          sort_order?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          key?: string
          keywords?: string[]
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
