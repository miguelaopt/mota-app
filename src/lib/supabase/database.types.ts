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
      work_settings: {
        Row: {
          user_id: string;
          job_name: string;
          pay_mode: Database["public"]["Enums"]["pay_mode"];
          hourly_rate_cents: number;
          monthly_salary_cents: number | null;
          monthly_hours: number | null;
          allocation_bp: number;
          target: Database["public"]["Enums"]["goal_target"];
          paid_breaks: boolean;
          reference_shift_minutes: number | null;
          shifts_per_week: number | null;
          time_zone: string;
          haptics: boolean;
          animations: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          job_name: string;
          pay_mode?: Database["public"]["Enums"]["pay_mode"];
          hourly_rate_cents: number;
          monthly_salary_cents?: number | null;
          monthly_hours?: number | null;
          allocation_bp?: number;
          target?: Database["public"]["Enums"]["goal_target"];
          paid_breaks?: boolean;
          reference_shift_minutes?: number | null;
          shifts_per_week?: number | null;
          time_zone?: string;
          haptics?: boolean;
          animations?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          job_name?: string;
          pay_mode?: Database["public"]["Enums"]["pay_mode"];
          hourly_rate_cents?: number;
          monthly_salary_cents?: number | null;
          monthly_hours?: number | null;
          allocation_bp?: number;
          target?: Database["public"]["Enums"]["goal_target"];
          paid_breaks?: boolean;
          reference_shift_minutes?: number | null;
          shifts_per_week?: number | null;
          time_zone?: string;
          haptics?: boolean;
          animations?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      scheduled_shifts: {
        Row: {
          id: string;
          user_id: string;
          starts_at: string;
          ends_at: string;
          unpaid_break_minutes: number;
          status: Database["public"]["Enums"]["scheduled_shift_status"];
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          starts_at: string;
          ends_at: string;
          unpaid_break_minutes?: number;
          status?: Database["public"]["Enums"]["scheduled_shift_status"];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          starts_at?: string;
          ends_at?: string;
          unpaid_break_minutes?: number;
          status?: Database["public"]["Enums"]["scheduled_shift_status"];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shifts: {
        Row: {
          id: string;
          user_id: string;
          motorcycle_id: string | null;
          scheduled_shift_id: string | null;
          started_at: string;
          ended_at: string | null;
          planned_end_at: string | null;
          pay_mode: Database["public"]["Enums"]["pay_mode"];
          hourly_rate_cents: number;
          allocation_bp: number;
          target: Database["public"]["Enums"]["goal_target"];
          version: number;
          edited_at: string | null;
          original_started_at: string | null;
          original_ended_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id?: string;
          motorcycle_id?: string | null;
          scheduled_shift_id?: string | null;
          started_at: string;
          ended_at?: string | null;
          planned_end_at?: string | null;
          pay_mode: Database["public"]["Enums"]["pay_mode"];
          hourly_rate_cents: number;
          allocation_bp: number;
          target: Database["public"]["Enums"]["goal_target"];
          version?: number;
          edited_at?: string | null;
          original_started_at?: string | null;
          original_ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          motorcycle_id?: string | null;
          scheduled_shift_id?: string | null;
          started_at?: string;
          ended_at?: string | null;
          planned_end_at?: string | null;
          pay_mode?: Database["public"]["Enums"]["pay_mode"];
          hourly_rate_cents?: number;
          allocation_bp?: number;
          target?: Database["public"]["Enums"]["goal_target"];
          version?: number;
          edited_at?: string | null;
          original_started_at?: string | null;
          original_ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shift_breaks: {
        Row: {
          id: string;
          user_id: string;
          shift_id: string;
          started_at: string;
          ended_at: string | null;
          paid: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          user_id?: string;
          shift_id: string;
          started_at: string;
          ended_at?: string | null;
          paid: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          shift_id?: string;
          started_at?: string;
          ended_at?: string | null;
          paid?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      savings_attributions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          snapshot_id: number | null;
          motorcycle_id: string | null;
          amount_cents: number;
          notes: string | null;
          confirmed_at: string;
          created_at: string;
        };
        Insert: {
          id: string;
          user_id?: string;
          account_id: string;
          snapshot_id?: number | null;
          motorcycle_id?: string | null;
          amount_cents: number;
          notes?: string | null;
          confirmed_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          snapshot_id?: number | null;
          motorcycle_id?: string | null;
          amount_cents?: number;
          notes?: string | null;
          confirmed_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      savings_attribution_shifts: {
        Row: {
          attribution_id: string;
          shift_id: string;
          user_id: string;
        };
        Insert: {
          attribution_id: string;
          shift_id: string;
          user_id?: string;
        };
        Update: {
          attribution_id?: string;
          shift_id?: string;
          user_id?: string;
        };
        Relationships: [];
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
      confirm_work_savings: {
        Args: {
          p_id: string;
          p_account_id: string;
          p_amount_cents: number;
          p_new_balance: number | null;
          p_snapshot_id: number | null;
          p_shift_ids: string[];
          p_notes: string | null;
        };
        Returns: string;
      };
    };
    Enums: {
      account_kind: "available" | "invested";
      gear_category: "protection" | "comfort" | "aesthetic_performance" | "other";
      item_priority: "essential" | "later";
      gear_status: "to_buy" | "bought";
      cost_kind: "one_off" | "monthly";
      pay_mode: "hourly" | "monthly";
      goal_target: "minimum" | "full";
      scheduled_shift_status: "planned" | "done" | "cancelled";
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
