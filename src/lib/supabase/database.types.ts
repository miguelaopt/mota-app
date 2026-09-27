// Tipos da base de dados (espelham supabase/migrations).
// Podes regenerá-los com:
//   npx supabase gen types typescript --project-id <id> --schema public > src/lib/supabase/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      settings: {
        Row: {
          user_id: string;
          monthly_goal: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          monthly_goal?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          monthly_goal?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          kind: Database["public"]["Enums"]["account_kind"];
          balance: number | null;
          balance_updated_at: string | null;
          count_pct: number;
          safety_margin_pct: number;
          source: string;
          sort_order: number;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          kind?: Database["public"]["Enums"]["account_kind"];
          balance?: number | null;
          balance_updated_at?: string | null;
          count_pct?: number;
          safety_margin_pct?: number;
          source?: string;
          sort_order?: number;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          kind?: Database["public"]["Enums"]["account_kind"];
          balance?: number | null;
          balance_updated_at?: string | null;
          count_pct?: number;
          safety_margin_pct?: number;
          source?: string;
          sort_order?: number;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      balance_snapshots: {
        Row: {
          id: number;
          user_id: string;
          account_id: string;
          balance: number;
          kind: Database["public"]["Enums"]["account_kind"];
          count_pct: number;
          safety_margin_pct: number;
          recorded_at: string;
        };
        Insert: {
          id?: never;
          user_id?: string;
          account_id: string;
          balance: number;
          kind: Database["public"]["Enums"]["account_kind"];
          count_pct: number;
          safety_margin_pct: number;
          recorded_at?: string;
        };
        Update: {
          id?: never;
          user_id?: string;
          account_id?: string;
          balance?: number;
          kind?: Database["public"]["Enums"]["account_kind"];
          count_pct?: number;
          safety_margin_pct?: number;
          recorded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "balance_snapshots_account_id_user_id_fkey";
            columns: ["account_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      motorcycles: {
        Row: {
          id: string;
          user_id: string;
          model: string;
          price: number;
          photo_path: string | null;
          listing_url: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          model: string;
          price?: number;
          photo_path?: string | null;
          listing_url?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          model?: string;
          price?: number;
          photo_path?: string | null;
          listing_url?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      gear_items: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          price: number;
          category: Database["public"]["Enums"]["gear_category"];
          priority: Database["public"]["Enums"]["item_priority"];
          status: Database["public"]["Enums"]["gear_status"];
          purchased_at: string | null;
          store_url: string | null;
          photo_path: string | null;
          notes: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          price?: number;
          category?: Database["public"]["Enums"]["gear_category"];
          priority?: Database["public"]["Enums"]["item_priority"];
          status?: Database["public"]["Enums"]["gear_status"];
          purchased_at?: string | null;
          store_url?: string | null;
          photo_path?: string | null;
          notes?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          price?: number;
          category?: Database["public"]["Enums"]["gear_category"];
          priority?: Database["public"]["Enums"]["item_priority"];
          status?: Database["public"]["Enums"]["gear_status"];
          purchased_at?: string | null;
          store_url?: string | null;
          photo_path?: string | null;
          notes?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      costs: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          amount: number;
          kind: Database["public"]["Enums"]["cost_kind"];
          priority: Database["public"]["Enums"]["item_priority"];
          motorcycle_id: string | null;
          notes: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          amount?: number;
          kind: Database["public"]["Enums"]["cost_kind"];
          priority?: Database["public"]["Enums"]["item_priority"];
          motorcycle_id?: string | null;
          notes?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          amount?: number;
          kind?: Database["public"]["Enums"]["cost_kind"];
          priority?: Database["public"]["Enums"]["item_priority"];
          motorcycle_id?: string | null;
          notes?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "costs_motorcycle_id_user_id_fkey";
            columns: ["motorcycle_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "motorcycles";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      set_active_motorcycle: {
        Args: { p_motorcycle_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      account_kind: "available" | "invested";
      gear_category: "protection" | "comfort" | "aesthetic_performance" | "other";
      item_priority: "essential" | "later";
      gear_status: "to_buy" | "bought";
      cost_kind: "one_off" | "monthly";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
