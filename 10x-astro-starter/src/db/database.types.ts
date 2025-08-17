export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          timezone: string | null
          locale: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          timezone?: string | null
          locale?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          timezone?: string | null
          locale?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_flashcard_edits: {
        Row: {
          edited_at: string
          field_name: string
          flashcard_id: string
          id: string
          new_value: string
          old_value: string | null
          user_id: string
        }
        Insert: {
          edited_at?: string
          field_name: string
          flashcard_id: string
          id?: string
          new_value: string
          old_value?: string | null
          user_id: string
        }
        Update: {
          edited_at?: string
          field_name?: string
          flashcard_id?: string
          id?: string
          new_value?: string
          old_value?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_flashcard_edits_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }

      decks: {
        Row: {
          id: string
          user_id: string
          name: string
          slug: string
          language_code: string | null
          is_archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          slug: string
          language_code?: string | null
          is_archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          slug?: string
          language_code?: string | null
          is_archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      cards: {
        Row: {
          id: string
          user_id: string
          deck_id: string
          front: string
          back: string
          source: string
          is_archived: boolean
          language_code: string | null
          created_at: string
          updated_at: string
          due_at: string | null
          last_reviewed_at: string | null
          repetitions_count: number
          lapses_count: number
          ease_factor: number
          interval_days: number
        }
        Insert: {
          id?: string
          user_id: string
          deck_id: string
          front: string
          back: string
          source?: string
          is_archived?: boolean
          language_code?: string | null
          created_at?: string
          updated_at?: string
          due_at?: string | null
          last_reviewed_at?: string | null
          repetitions_count?: number
          lapses_count?: number
          ease_factor?: number
          interval_days?: number
        }
        Update: {
          id?: string
          user_id?: string
          deck_id?: string
          front?: string
          back?: string
          source?: string
          is_archived?: boolean
          language_code?: string | null
          created_at?: string
          updated_at?: string
          due_at?: string | null
          last_reviewed_at?: string | null
          repetitions_count?: number
          lapses_count?: number
          ease_factor?: number
          interval_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "cards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }

      reviews: {
        Row: {
          id: string
          user_id: string
          card_id: string
          reviewed_at: string
          rating: number
          duration_ms: number | null
          pre_ease_factor: number | null
          post_ease_factor: number | null
          pre_interval_days: number | null
          post_interval_days: number | null
          pre_repetitions_count: number | null
          post_repetitions_count: number | null
          pre_lapses_count: number | null
          post_lapses_count: number | null
          pre_stability: number | null
          post_stability: number | null
          pre_difficulty: number | null
          post_difficulty: number | null
          pre_elapsed_days: number | null
          post_elapsed_days: number | null
          pre_scheduled_days: number | null
          post_scheduled_days: number | null
        }
        Insert: {
          id?: string
          user_id: string
          card_id: string
          reviewed_at?: string
          rating: number
          duration_ms?: number | null
          pre_ease_factor?: number | null
          post_ease_factor?: number | null
          pre_interval_days?: number | null
          post_interval_days?: number | null
          pre_repetitions_count?: number | null
          post_repetitions_count?: number | null
          pre_lapses_count?: number | null
          post_lapses_count?: number | null
          pre_stability?: number | null
          post_stability?: number | null
          pre_difficulty?: number | null
          post_difficulty?: number | null
          pre_elapsed_days?: number | null
          post_elapsed_days?: number | null
          pre_scheduled_days?: number | null
          post_scheduled_days?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          card_id?: string
          reviewed_at?: string
          rating?: number
          duration_ms?: number | null
          pre_ease_factor?: number | null
          post_ease_factor?: number | null
          pre_interval_days?: number | null
          post_interval_days?: number | null
          pre_repetitions_count?: number | null
          post_repetitions_count?: number | null
          pre_lapses_count?: number | null
          post_lapses_count?: number | null
          pre_stability?: number | null
          post_stability?: number | null
          pre_difficulty?: number | null
          post_difficulty?: number | null
          pre_elapsed_days?: number | null
          post_elapsed_days?: number | null
          pre_scheduled_days?: number | null
          post_scheduled_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }

      ai_generations: {
        Row: {
          id: string
          user_id: string
          source_text: string
          model: string | null
          prompt_version: string | null
          tokens_input: number | null
          tokens_output: number | null
          cost_usd: number | null
          status: string | null
          error: Json | null
          ai_metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source_text: string
          model?: string | null
          prompt_version?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          cost_usd?: number | null
          status?: string | null
          error?: Json | null
          ai_metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          source_text?: string
          model?: string | null
          prompt_version?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          cost_usd?: number | null
          status?: string | null
          error?: Json | null
          ai_metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      ai_suggestions: {
        Row: {
          id: string
          user_id: string
          generation_id: string
          front: string
          back: string
          status: string
          accepted_at: string | null
          card_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          generation_id: string
          front: string
          back: string
          status?: string
          accepted_at?: string | null
          card_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          generation_id?: string
          front?: string
          back?: string
          status?: string
          accepted_at?: string | null
          card_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "ai_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }

      study_sessions: {
        Row: {
          id: string
          user_id: string
          started_at: string
          ended_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          started_at?: string
          ended_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          started_at?: string
          ended_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

