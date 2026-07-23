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
      answers: {
        Row: {
          attempt_id: string
          id: string
          is_correct: boolean | null
          marks_awarded: number | null
          question_id: string
          response: Json | null
          time_spent_seconds: number | null
          updated_at: string
        }
        Insert: {
          attempt_id: string
          id?: string
          is_correct?: boolean | null
          marks_awarded?: number | null
          question_id: string
          response?: Json | null
          time_spent_seconds?: number | null
          updated_at?: string
        }
        Update: {
          attempt_id?: string
          id?: string
          is_correct?: boolean | null
          marks_awarded?: number | null
          question_id?: string
          response?: Json | null
          time_spent_seconds?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          due_at: string | null
          exam_id: string
          id: string
          max_attempts: number
          student_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          due_at?: string | null
          exam_id: string
          id?: string
          max_attempts?: number
          student_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          due_at?: string | null
          exam_id?: string
          id?: string
          max_attempts?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          assignment_id: string
          auto_submitted: boolean
          ends_at: string
          exam_id: string
          id: string
          max_score: number | null
          question_order: Json | null
          score: number | null
          session_token: string | null
          started_at: string
          status: string
          student_id: string
          submitted_at: string | null
          warning_count: number
        }
        Insert: {
          assignment_id: string
          auto_submitted?: boolean
          ends_at: string
          exam_id: string
          id?: string
          max_score?: number | null
          question_order?: Json | null
          score?: number | null
          session_token?: string | null
          started_at?: string
          status?: string
          student_id: string
          submitted_at?: string | null
          warning_count?: number
        }
        Update: {
          assignment_id?: string
          auto_submitted?: boolean
          ends_at?: string
          exam_id?: string
          id?: string
          max_score?: number | null
          question_order?: Json | null
          score?: number | null
          session_token?: string | null
          started_at?: string
          status?: string
          student_id?: string
          submitted_at?: string | null
          warning_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "attempts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_drafts: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          pattern: string
          pattern_config: Json | null
          questions: Json
          show_answer_book: boolean
          show_answer_sheet: boolean
          show_result_after_submit: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          pattern?: string
          pattern_config?: Json | null
          questions?: Json
          show_answer_book?: boolean
          show_answer_sheet?: boolean
          show_result_after_submit?: boolean
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          pattern?: string
          pattern_config?: Json | null
          questions?: Json
          show_answer_book?: boolean
          show_answer_sheet?: boolean
          show_result_after_submit?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      exams: {
        Row: {
          access_code: string
          created_at: string
          created_by: string
          description: string | null
          duration_minutes: number
          end_at: string | null
          id: string
          negative_mark_per_wrong: number
          pattern: string
          pattern_config: Json | null
          show_answer_book: boolean
          show_answer_sheet: boolean
          show_result_after_submit: boolean
          shuffle_options: boolean
          shuffle_questions: boolean
          start_at: string | null
          status: string
          title: string
          total_marks: number
          updated_at: string
        }
        Insert: {
          access_code: string
          created_at?: string
          created_by: string
          description?: string | null
          duration_minutes?: number
          end_at?: string | null
          id?: string
          negative_mark_per_wrong?: number
          pattern?: string
          pattern_config?: Json | null
          show_answer_book?: boolean
          show_answer_sheet?: boolean
          show_result_after_submit?: boolean
          shuffle_options?: boolean
          shuffle_questions?: boolean
          start_at?: string | null
          status?: string
          title: string
          total_marks?: number
          updated_at?: string
        }
        Update: {
          access_code?: string
          created_at?: string
          created_by?: string
          description?: string | null
          duration_minutes?: number
          end_at?: string | null
          id?: string
          negative_mark_per_wrong?: number
          pattern?: string
          pattern_config?: Json | null
          show_answer_book?: boolean
          show_answer_sheet?: boolean
          show_result_after_submit?: boolean
          shuffle_options?: boolean
          shuffle_questions?: boolean
          start_at?: string | null
          status?: string
          title?: string
          total_marks?: number
          updated_at?: string
        }
        Relationships: []
      }
      insights: {
        Row: {
          attempt_id: string
          generated_at: string
          id: string
          recommendations: string | null
          strong_topics: Json | null
          summary: string | null
          weak_topics: Json | null
        }
        Insert: {
          attempt_id: string
          generated_at?: string
          id?: string
          recommendations?: string | null
          strong_topics?: Json | null
          summary?: string | null
          weak_topics?: Json | null
        }
        Update: {
          attempt_id?: string
          generated_at?: string
          id?: string
          recommendations?: string | null
          strong_topics?: Json | null
          summary?: string | null
          weak_topics?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "insights_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_code: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_code?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_code?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_explanations: {
        Row: {
          created_at: string
          explanation: string
          question_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          explanation: string
          question_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          explanation?: string
          question_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_explanations_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          correct_answer: Json | null
          created_at: string
          difficulty: string | null
          exam_id: string
          id: string
          marks: number
          options: Json | null
          order_index: number
          prompt: string
          topic: string | null
          type: string
        }
        Insert: {
          correct_answer?: Json | null
          created_at?: string
          difficulty?: string | null
          exam_id: string
          id?: string
          marks?: number
          options?: Json | null
          order_index?: number
          prompt: string
          topic?: string | null
          type: string
        }
        Update: {
          correct_answer?: Json | null
          created_at?: string
          difficulty?: string | null
          exam_id?: string
          id?: string
          marks?: number
          options?: Json | null
          order_index?: number
          prompt?: string
          topic?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          class_name: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          name: string
          notes: string | null
          student_code: string
          updated_at: string
        }
        Insert: {
          class_name?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          student_code: string
          updated_at?: string
        }
        Update: {
          class_name?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          student_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gen_admin_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "student" | "super_admin"
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
    Enums: {
      app_role: ["admin", "student", "super_admin"],
    },
  },
} as const
