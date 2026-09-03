export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: Json;
        };
        Update: {
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [];
      };
      case_interests: {
        Row: {
          case_id: string;
          created_at: string;
          id: string;
          note: string | null;
          status: Database["public"]["Enums"]["case_interest_status"];
          submitted_by: string;
          tutor_id: string;
          updated_at: string;
        };
        Insert: {
          case_id: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          status?: Database["public"]["Enums"]["case_interest_status"];
          submitted_by: string;
          tutor_id: string;
          updated_at?: string;
        };
        Update: {
          case_id?: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          status?: Database["public"]["Enums"]["case_interest_status"];
          submitted_by?: string;
          tutor_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_interests_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "tutoring_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_interests_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
        ];
      };
      courses: {
        Row: {
          created_at: string;
          created_by: string | null;
          currency: string;
          description: string | null;
          district: string | null;
          id: string;
          image_url: string | null;
          is_published: boolean;
          level: string | null;
          mode: Database["public"]["Enums"]["case_mode"];
          organization_id: string;
          price: number | null;
          schedule_text: string | null;
          subject: string | null;
          summary: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string | null;
          district?: string | null;
          id?: string;
          image_url?: string | null;
          is_published?: boolean;
          level?: string | null;
          mode?: Database["public"]["Enums"]["case_mode"];
          organization_id: string;
          price?: number | null;
          schedule_text?: string | null;
          subject?: string | null;
          summary?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string | null;
          district?: string | null;
          id?: string;
          image_url?: string | null;
          is_published?: boolean;
          level?: string | null;
          mode?: Database["public"]["Enums"]["case_mode"];
          organization_id?: string;
          price?: number | null;
          schedule_text?: string | null;
          subject?: string | null;
          summary?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "courses_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_members: {
        Row: {
          claimed_at: string | null;
          created_at: string;
          email: string;
          id: string;
          invited_at: string;
          invited_by: string | null;
          organization_id: string;
          role: Database["public"]["Enums"]["org_member_role"];
          status: Database["public"]["Enums"]["org_member_status"];
          user_id: string | null;
        };
        Insert: {
          claimed_at?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          invited_at?: string;
          invited_by?: string | null;
          organization_id: string;
          role?: Database["public"]["Enums"]["org_member_role"];
          status?: Database["public"]["Enums"]["org_member_status"];
          user_id?: string | null;
        };
        Update: {
          claimed_at?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          invited_at?: string;
          invited_by?: string | null;
          organization_id?: string;
          role?: Database["public"]["Enums"]["org_member_role"];
          status?: Database["public"]["Enums"]["org_member_status"];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          contact_email: string | null;
          contact_phone: string | null;
          cover_image_url: string | null;
          created_at: string;
          created_by: string;
          description: string | null;
          district: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          plan: Database["public"]["Enums"]["org_plan"];
          slug: string;
          status: Database["public"]["Enums"]["org_status"];
          tagline: string | null;
          updated_at: string;
          website_url: string | null;
          whatsapp_number: string | null;
        };
        Insert: {
          contact_email?: string | null;
          contact_phone?: string | null;
          cover_image_url?: string | null;
          created_at?: string;
          created_by: string;
          description?: string | null;
          district?: string | null;
          id?: string;
          logo_url?: string | null;
          name: string;
          plan?: Database["public"]["Enums"]["org_plan"];
          slug: string;
          status?: Database["public"]["Enums"]["org_status"];
          tagline?: string | null;
          updated_at?: string;
          website_url?: string | null;
          whatsapp_number?: string | null;
        };
        Update: {
          contact_email?: string | null;
          contact_phone?: string | null;
          cover_image_url?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          district?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          plan?: Database["public"]["Enums"]["org_plan"];
          slug?: string;
          status?: Database["public"]["Enums"]["org_status"];
          tagline?: string | null;
          updated_at?: string;
          website_url?: string | null;
          whatsapp_number?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          locale: string;
          phone: string | null;
          theme_preference: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          locale?: string;
          phone?: string | null;
          theme_preference?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          locale?: string;
          phone?: string | null;
          theme_preference?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      saved_tutors: {
        Row: {
          created_at: string;
          id: string;
          tutor_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          tutor_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          tutor_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_tutors_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
        ];
      };
      tutor_reviews: {
        Row: {
          author_alias: string;
          author_user_id: string | null;
          comment: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          is_published: boolean;
          rating: number;
          tutor_id: string;
          updated_at: string;
        };
        Insert: {
          author_alias: string;
          author_user_id?: string | null;
          comment?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_published?: boolean;
          rating: number;
          tutor_id: string;
          updated_at?: string;
        };
        Update: {
          author_alias?: string;
          author_user_id?: string | null;
          comment?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_published?: boolean;
          rating?: number;
          tutor_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tutor_reviews_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
        ];
      };
      tutoring_cases: {
        Row: {
          admin_notes: string | null;
          budget_max: number | null;
          budget_min: number | null;
          contact_name: string;
          contact_phone: string;
          created_at: string;
          description: string | null;
          district: string | null;
          exam_system: string | null;
          id: string;
          is_public: boolean;
          language_of_instruction: string;
          mode: Database["public"]["Enums"]["case_mode"];
          parent_id: string;
          preferred_gender: Database["public"]["Enums"]["case_gender_pref"];
          preferred_tutor_type: string;
          schedule_note: string | null;
          session_length_minutes: number;
          sessions_per_week: number;
          start_date: string | null;
          status: Database["public"]["Enums"]["case_status"];
          student_grade_current: string | null;
          student_level: string;
          student_school: string | null;
          subject: string;
          title: string;
          updated_at: string;
          urgency: Database["public"]["Enums"]["case_urgency"];
          whatsapp_ok: boolean;
        };
        Insert: {
          admin_notes?: string | null;
          budget_max?: number | null;
          budget_min?: number | null;
          contact_name: string;
          contact_phone: string;
          created_at?: string;
          description?: string | null;
          district?: string | null;
          exam_system?: string | null;
          id?: string;
          is_public?: boolean;
          language_of_instruction?: string;
          mode?: Database["public"]["Enums"]["case_mode"];
          parent_id: string;
          preferred_gender?: Database["public"]["Enums"]["case_gender_pref"];
          preferred_tutor_type?: string;
          schedule_note?: string | null;
          session_length_minutes?: number;
          sessions_per_week?: number;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["case_status"];
          student_grade_current?: string | null;
          student_level: string;
          student_school?: string | null;
          subject: string;
          title: string;
          updated_at?: string;
          urgency?: Database["public"]["Enums"]["case_urgency"];
          whatsapp_ok?: boolean;
        };
        Update: {
          admin_notes?: string | null;
          budget_max?: number | null;
          budget_min?: number | null;
          contact_name?: string;
          contact_phone?: string;
          created_at?: string;
          description?: string | null;
          district?: string | null;
          exam_system?: string | null;
          id?: string;
          is_public?: boolean;
          language_of_instruction?: string;
          mode?: Database["public"]["Enums"]["case_mode"];
          parent_id?: string;
          preferred_gender?: Database["public"]["Enums"]["case_gender_pref"];
          preferred_tutor_type?: string;
          schedule_note?: string | null;
          session_length_minutes?: number;
          sessions_per_week?: number;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["case_status"];
          student_grade_current?: string | null;
          student_level?: string;
          student_school?: string | null;
          subject?: string;
          title?: string;
          updated_at?: string;
          urgency?: Database["public"]["Enums"]["case_urgency"];
          whatsapp_ok?: boolean;
        };
        Relationships: [];
      };
      tutors: {
        Row: {
          achievements: Json;
          academic_headline: string | null;
          badge: string | null;
          created_at: string;
          created_by: string | null;
          display_name: string;
          district: string | null;
          experience_years: number | null;
          exam_results: Json;
          gender: string | null;
          headline: string | null;
          card_highlights: string[];
          hourly_rate: number;
          ia_ee_tok_notes: string | null;
          ia_ee_tok_support: string[];
          id: string;
          is_published: boolean;
          languages: string[];
          lesson_mode: Database["public"]["Enums"]["case_mode"];
          photo_url: string | null;
          qualifications_summary: string | null;
          secondary_school: string | null;
          subjects: string[];
          target_students: string[];
          tutor_code: string;
          university: string | null;
          updated_at: string;
        };
        Insert: {
          achievements?: Json;
          academic_headline?: string | null;
          badge?: string | null;
          created_at?: string;
          created_by?: string | null;
          display_name: string;
          district?: string | null;
          experience_years?: number | null;
          exam_results?: Json;
          gender?: string | null;
          headline?: string | null;
          card_highlights?: string[];
          hourly_rate?: number;
          ia_ee_tok_notes?: string | null;
          ia_ee_tok_support?: string[];
          id?: string;
          is_published?: boolean;
          languages?: string[];
          lesson_mode?: Database["public"]["Enums"]["case_mode"];
          photo_url?: string | null;
          qualifications_summary?: string | null;
          secondary_school?: string | null;
          subjects?: string[];
          target_students?: string[];
          tutor_code: string;
          university?: string | null;
          updated_at?: string;
        };
        Update: {
          achievements?: Json;
          academic_headline?: string | null;
          badge?: string | null;
          created_at?: string;
          created_by?: string | null;
          display_name?: string;
          district?: string | null;
          experience_years?: number | null;
          exam_results?: Json;
          gender?: string | null;
          headline?: string | null;
          card_highlights?: string[];
          hourly_rate?: number;
          ia_ee_tok_notes?: string | null;
          ia_ee_tok_support?: string[];
          id?: string;
          is_published?: boolean;
          languages?: string[];
          lesson_mode?: Database["public"]["Enums"]["case_mode"];
          photo_url?: string | null;
          qualifications_summary?: string | null;
          secondary_school?: string | null;
          subjects?: string[];
          target_students?: string[];
          tutor_code?: string;
          university?: string | null;
          updated_at?: string;
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
          role?: Database["public"]["Enums"]["app_role"];
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
      claim_org_memberships: { Args: never; Returns: number };
      get_org_role: {
        Args: { _org_id: string; _user_id?: string };
        Returns: Database["public"]["Enums"]["org_member_role"];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_org_admin: { Args: { _org_id: string }; Returns: boolean };
      is_org_owner: { Args: { _org_id: string }; Returns: boolean };
      is_platform_admin: { Args: never; Returns: boolean };
      match_tutors_for_case: {
        Args: { _case_id: string; _limit?: number };
        Returns: {
          badge: string;
          display_name: string;
          district: string;
          experience_years: number;
          headline: string;
          hourly_rate: number;
          id: string;
          languages: string[];
          photo_url: string;
          rating: number;
          review_count: number;
          score: number;
          subjects: string[];
          tutor_code: string;
        }[];
      };
      org_is_active: { Args: { _org_id: string }; Returns: boolean };
      tutor_card_highlights_valid: {
        Args: { highlight_values: string[] };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "super_admin" | "admin" | "staff" | "tutor" | "parent";
      case_gender_pref: "any" | "male" | "female";
      case_interest_status: "pending" | "contact_released" | "declined";
      case_mode: "online" | "in_person" | "either";
      case_status: "pending" | "approved" | "matched" | "closed" | "rejected";
      case_urgency: "low" | "normal" | "high";
      org_member_role: "owner" | "admin";
      org_member_status: "pending" | "active" | "revoked";
      org_plan: "business" | "enterprise";
      org_status: "pending" | "active" | "suspended";
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["super_admin", "admin", "staff", "tutor", "parent"],
      case_gender_pref: ["any", "male", "female"],
      case_interest_status: ["pending", "contact_released", "declined"],
      case_mode: ["online", "in_person", "either"],
      case_status: ["pending", "approved", "matched", "closed", "rejected"],
      case_urgency: ["low", "normal", "high"],
      org_member_role: ["owner", "admin"],
      org_member_status: ["pending", "active", "revoked"],
      org_plan: ["business", "enterprise"],
      org_status: ["pending", "active", "suspended"],
    },
  },
} as const;
