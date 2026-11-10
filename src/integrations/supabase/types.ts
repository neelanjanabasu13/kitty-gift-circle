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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agent_events: {
        Row: {
          at: string
          id: string
          kind: string
          message: string
          payload: Json
          pot_id: string
        }
        Insert: {
          at?: string
          id?: string
          kind: string
          message: string
          payload?: Json
          pot_id: string
        }
        Update: {
          at?: string
          id?: string
          kind?: string
          message?: string
          payload?: Json
          pot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_events_pot_id_fkey"
            columns: ["pot_id"]
            isOneToOne: false
            referencedRelation: "pots"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          band: string | null
          category: string | null
          channel3_product_id: string | null
          currency: string | null
          fetched_at: string
          fit_score: number | null
          id: string
          image_url: string | null
          offer_url: string | null
          pot_id: string
          price: number | null
          rank: number | null
          reason: string | null
          retailer: string | null
          signals: Json
          title: string
          total_score: number | null
        }
        Insert: {
          band?: string | null
          category?: string | null
          channel3_product_id?: string | null
          currency?: string | null
          fetched_at?: string
          fit_score?: number | null
          id?: string
          image_url?: string | null
          offer_url?: string | null
          pot_id: string
          price?: number | null
          rank?: number | null
          reason?: string | null
          retailer?: string | null
          signals?: Json
          title: string
          total_score?: number | null
        }
        Update: {
          band?: string | null
          category?: string | null
          channel3_product_id?: string | null
          currency?: string | null
          fetched_at?: string
          fit_score?: number | null
          id?: string
          image_url?: string | null
          offer_url?: string | null
          pot_id?: string
          price?: number | null
          rank?: number | null
          reason?: string | null
          retailer?: string | null
          signals?: Json
          title?: string
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_pot_id_fkey"
            columns: ["pot_id"]
            isOneToOne: false
            referencedRelation: "pots"
            referencedColumns: ["id"]
          },
        ]
      }
      card_signatures: {
        Row: {
          contribution_id: string | null
          created_at: string
          id: string
          message: string
          name: string
          pot_id: string
        }
        Insert: {
          contribution_id?: string | null
          created_at?: string
          id?: string
          message: string
          name: string
          pot_id: string
        }
        Update: {
          contribution_id?: string | null
          created_at?: string
          id?: string
          message?: string
          name?: string
          pot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_signatures_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_signatures_pot_id_fkey"
            columns: ["pot_id"]
            isOneToOne: false
            referencedRelation: "pots"
            referencedColumns: ["id"]
          },
        ]
      }
      category_votes: {
        Row: {
          category: string
          contribution_id: string | null
          created_at: string
          id: string
          pot_id: string
        }
        Insert: {
          category: string
          contribution_id?: string | null
          created_at?: string
          id?: string
          pot_id: string
        }
        Update: {
          category?: string
          contribution_id?: string | null
          created_at?: string
          id?: string
          pot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_votes_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_votes_pot_id_fkey"
            columns: ["pot_id"]
            isOneToOne: false
            referencedRelation: "pots"
            referencedColumns: ["id"]
          },
        ]
      }
      contributions: {
        Row: {
          amount: number
          auth_expires_at: string | null
          authorization_id: string | null
          capture_id: string | null
          captured_amount: number | null
          created_at: string
          display_name: string
          honor_expires_at: string | null
          id: string
          is_seeded: boolean
          paypal_order_id: string | null
          pot_id: string
          status: string
          visibility: string
        }
        Insert: {
          amount: number
          auth_expires_at?: string | null
          authorization_id?: string | null
          capture_id?: string | null
          captured_amount?: number | null
          created_at?: string
          display_name?: string
          honor_expires_at?: string | null
          id?: string
          is_seeded?: boolean
          paypal_order_id?: string | null
          pot_id: string
          status?: string
          visibility?: string
        }
        Update: {
          amount?: number
          auth_expires_at?: string | null
          authorization_id?: string | null
          capture_id?: string | null
          captured_amount?: number | null
          created_at?: string
          display_name?: string
          honor_expires_at?: string | null
          id?: string
          is_seeded?: boolean
          paypal_order_id?: string | null
          pot_id?: string
          status?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "contributions_pot_id_fkey"
            columns: ["pot_id"]
            isOneToOne: false
            referencedRelation: "pots"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          buy_at: string | null
          candidate_id: string | null
          created_at: string
          decided_by: string | null
          id: string
          pot_id: string
          swapped_to: string | null
          vetoed_at: string | null
        }
        Insert: {
          buy_at?: string | null
          candidate_id?: string | null
          created_at?: string
          decided_by?: string | null
          id?: string
          pot_id: string
          swapped_to?: string | null
          vetoed_at?: string | null
        }
        Update: {
          buy_at?: string | null
          candidate_id?: string | null
          created_at?: string
          decided_by?: string | null
          id?: string
          pot_id?: string
          swapped_to?: string | null
          vetoed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decisions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_pot_id_fkey"
            columns: ["pot_id"]
            isOneToOne: false
            referencedRelation: "pots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_swapped_to_fkey"
            columns: ["swapped_to"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      final_votes: {
        Row: {
          candidate_id: string | null
          contribution_id: string | null
          created_at: string
          id: string
          pot_id: string
        }
        Insert: {
          candidate_id?: string | null
          contribution_id?: string | null
          created_at?: string
          id?: string
          pot_id: string
        }
        Update: {
          candidate_id?: string | null
          contribution_id?: string | null
          created_at?: string
          id?: string
          pot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "final_votes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_votes_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_votes_pot_id_fkey"
            columns: ["pot_id"]
            isOneToOne: false
            referencedRelation: "pots"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number | null
          buy_url: string | null
          created_at: string
          id: string
          item_id: string | null
          payout_batch_id: string | null
          pot_id: string
          status: string | null
        }
        Insert: {
          amount?: number | null
          buy_url?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          payout_batch_id?: string | null
          pot_id: string
          status?: string | null
        }
        Update: {
          amount?: number | null
          buy_url?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          payout_batch_id?: string | null
          pot_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_pot_id_fkey"
            columns: ["pot_id"]
            isOneToOne: false
            referencedRelation: "pots"
            referencedColumns: ["id"]
          },
        ]
      }
      pots: {
        Row: {
          admin_token: string
          agent_lock_at: string | null
          agent_pending: boolean
          agent_working: string | null
          closeness: string
          created_at: string
          currency: string
          deadline_at: string
          demo_speed: boolean
          dislikes: string[]
          expected_count: number
          id: string
          last_search_band: number
          last_top_categories: string[]
          likes: string[]
          mode: string
          occasion: string
          organiser_name: string
          organiser_paypal_email: string
          recipient_name: string
          reminders_enabled: boolean
          slug: string
          status: string
          target_amount: number
          vote_window: string
          wishlist_image_path: string | null
          wishlist_url: string | null
        }
        Insert: {
          admin_token: string
          agent_lock_at?: string | null
          agent_pending?: boolean
          agent_working?: string | null
          closeness: string
          created_at?: string
          currency?: string
          deadline_at: string
          demo_speed?: boolean
          dislikes?: string[]
          expected_count?: number
          id?: string
          last_search_band?: number
          last_top_categories?: string[]
          likes?: string[]
          mode?: string
          occasion: string
          organiser_name: string
          organiser_paypal_email: string
          recipient_name: string
          reminders_enabled?: boolean
          slug: string
          status?: string
          target_amount: number
          vote_window?: string
          wishlist_image_path?: string | null
          wishlist_url?: string | null
        }
        Update: {
          admin_token?: string
          agent_lock_at?: string | null
          agent_pending?: boolean
          agent_working?: string | null
          closeness?: string
          created_at?: string
          currency?: string
          deadline_at?: string
          demo_speed?: boolean
          dislikes?: string[]
          expected_count?: number
          id?: string
          last_search_band?: number
          last_top_categories?: string[]
          likes?: string[]
          mode?: string
          occasion?: string
          organiser_name?: string
          organiser_paypal_email?: string
          recipient_name?: string
          reminders_enabled?: boolean
          slug?: string
          status?: string
          target_amount?: number
          vote_window?: string
          wishlist_image_path?: string | null
          wishlist_url?: string | null
        }
        Relationships: []
      }
      reminders: {
        Row: {
          approved_at: string | null
          created_at: string
          draft_text: string | null
          id: string
          pot_id: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          draft_text?: string | null
          id?: string
          pot_id: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          draft_text?: string | null
          id?: string
          pot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_pot_id_fkey"
            columns: ["pot_id"]
            isOneToOne: false
            referencedRelation: "pots"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
