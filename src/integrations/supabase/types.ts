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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      answer_aliases: {
        Row: {
          alias_type: string
          canonical_text: string
          created_at: string
          id: string
          source_text: string
          status: string
        }
        Insert: {
          alias_type?: string
          canonical_text: string
          created_at?: string
          id?: string
          source_text: string
          status?: string
        }
        Update: {
          alias_type?: string
          canonical_text?: string
          created_at?: string
          id?: string
          source_text?: string
          status?: string
        }
        Relationships: []
      }
      answers: {
        Row: {
          created_at: string
          id: string
          normalized_answer: string
          prompt_id: string
          raw_answer: string
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          normalized_answer: string
          prompt_id: string
          raw_answer: string
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          normalized_answer?: string
          prompt_id?: string
          raw_answer?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_terms: {
        Row: {
          created_at: string
          id: string
          reason: string
          term: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string
          term: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          term?: string
        }
        Relationships: []
      }
      import_sources: {
        Row: {
          created_at: string
          id: string
          last_sync: string
          name: string
          rows_imported: number
          sheet_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_sync?: string
          name: string
          rows_imported?: number
          sheet_name?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_sync?: string
          name?: string
          rows_imported?: number
          sheet_name?: string
        }
        Relationships: []
      }
      prompts: {
        Row: {
          active: boolean
          created_at: string
          date: string
          id: string
          mode: string
          performance: string | null
          prompt_score: number
          prompt_status: string
          prompt_tag: string | null
          results_unlock_at: string | null
          top_answer_pct: number
          total_players: number
          unique_answers: number
          word_a: string
          word_b: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          date?: string
          id?: string
          mode?: string
          performance?: string | null
          prompt_score?: number
          prompt_status?: string
          prompt_tag?: string | null
          results_unlock_at?: string | null
          top_answer_pct?: number
          total_players?: number
          unique_answers?: number
          word_a: string
          word_b: string
        }
        Update: {
          active?: boolean
          created_at?: string
          date?: string
          id?: string
          mode?: string
          performance?: string | null
          prompt_score?: number
          prompt_status?: string
          prompt_tag?: string | null
          results_unlock_at?: string | null
          top_answer_pct?: number
          total_players?: number
          unique_answers?: number
          word_a?: string
          word_b?: string
        }
        Relationships: []
      }
      tuning_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      words: {
        Row: {
          avg_top_answer_pct: number
          avg_unique_answers: number
          category: string
          created_at: string
          decent_appearances: number
          deck_override: string | null
          id: string
          in_core_deck: boolean
          jinx_score: number
          notes: string
          source: string
          status: string
          strong_appearances: number
          times_used: number
          updated_at: string
          weak_appearances: number
          word: string
        }
        Insert: {
          avg_top_answer_pct?: number
          avg_unique_answers?: number
          category?: string
          created_at?: string
          decent_appearances?: number
          deck_override?: string | null
          id?: string
          in_core_deck?: boolean
          jinx_score?: number
          notes?: string
          source?: string
          status?: string
          strong_appearances?: number
          times_used?: number
          updated_at?: string
          weak_appearances?: number
          word: string
        }
        Update: {
          avg_top_answer_pct?: number
          avg_unique_answers?: number
          category?: string
          created_at?: string
          decent_appearances?: number
          deck_override?: string | null
          id?: string
          in_core_deck?: boolean
          jinx_score?: number
          notes?: string
          source?: string
          status?: string
          strong_appearances?: number
          times_used?: number
          updated_at?: string
          weak_appearances?: number
          word?: string
        }
        Relationships: []
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
