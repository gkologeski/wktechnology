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
      activities: {
        Row: {
          body: string | null
          completed: boolean
          created_at: string
          due_date: string | null
          id: string
          outcome: string | null
          outcome_set_at: string | null
          owner_id: string
          related_company_id: string | null
          related_contact_id: string | null
          related_deal_id: string | null
          related_lead_id: string | null
          subject: string | null
          type: Database["public"]["Enums"]["activity_type"]
          updated_at: string
        }
        Insert: {
          body?: string | null
          completed?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          outcome?: string | null
          outcome_set_at?: string | null
          owner_id: string
          related_company_id?: string | null
          related_contact_id?: string | null
          related_deal_id?: string | null
          related_lead_id?: string | null
          subject?: string | null
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
        }
        Update: {
          body?: string | null
          completed?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          outcome?: string | null
          outcome_set_at?: string | null
          owner_id?: string
          related_company_id?: string | null
          related_contact_id?: string | null
          related_deal_id?: string | null
          related_lead_id?: string | null
          subject?: string | null
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_related_company_id_fkey"
            columns: ["related_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_related_contact_id_fkey"
            columns: ["related_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_related_deal_id_fkey"
            columns: ["related_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          cep: string | null
          city: string | null
          created_at: string
          domain: string | null
          id: string
          industry: string | null
          is_target_account: boolean
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          size: string | null
          state: string | null
          target_account_tier: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          cep?: string | null
          city?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          industry?: string | null
          is_target_account?: boolean
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          size?: string | null
          state?: string | null
          target_account_tier?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          cep?: string | null
          city?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          industry?: string | null
          is_target_account?: boolean
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          size?: string | null
          state?: string | null
          target_account_tier?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      contact_subscriptions: {
        Row: {
          contact_id: string
          id: string
          opted_in: boolean
          owner_id: string
          source: string | null
          subscription_type_id: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          id?: string
          opted_in?: boolean
          owner_id?: string
          source?: string | null
          subscription_type_id: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          id?: string
          opted_in?: boolean
          owner_id?: string
          source?: string | null
          subscription_type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_subscriptions_subscription_type_id_fkey"
            columns: ["subscription_type_id"]
            isOneToOne: false
            referencedRelation: "subscription_types"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string | null
          consent_date: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          job_title: string | null
          label: string | null
          last_name: string | null
          legal_basis: string | null
          marketing_status: string | null
          notes: string | null
          owner_id: string
          phone: string | null
          score: number
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          consent_date?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          job_title?: string | null
          label?: string | null
          last_name?: string | null
          legal_basis?: string | null
          marketing_status?: string | null
          notes?: string | null
          owner_id: string
          phone?: string | null
          score?: number
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          consent_date?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          job_title?: string | null
          label?: string | null
          last_name?: string | null
          legal_basis?: string | null
          marketing_status?: string | null
          notes?: string | null
          owner_id?: string
          phone?: string | null
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          integration_id: string | null
          job_id: string | null
          owner_id: string
          provider: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          integration_id?: string | null
          job_id?: string | null
          owner_id: string
          provider: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          integration_id?: string | null
          job_id?: string | null
          owner_id?: string
          provider?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "enrichment_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_limits: {
        Row: {
          created_at: string
          id: string
          integration_id: string | null
          monthly_limit: number | null
          owner_id: string
          per_run_confirm_above: number
          provider: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          integration_id?: string | null
          monthly_limit?: number | null
          owner_id: string
          per_run_confirm_above?: number
          provider: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          integration_id?: string | null
          monthly_limit?: number | null
          owner_id?: string
          per_run_confirm_above?: number
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_limits_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_contacts: {
        Row: {
          contact_id: string
          deal_id: string
        }
        Insert: {
          contact_id: string
          deal_id: string
        }
        Update: {
          contact_id?: string
          deal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_contacts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          company_id: string | null
          created_at: string
          currency: string
          expected_close_date: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          pipeline_id: string | null
          primary_contact_id: string | null
          stage: Database["public"]["Enums"]["deal_stage"]
          updated_at: string
          value: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          currency?: string
          expected_close_date?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          pipeline_id?: string | null
          primary_contact_id?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          updated_at?: string
          value?: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          currency?: string
          expected_close_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          pipeline_id?: string | null
          primary_contact_id?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_job_items: {
        Row: {
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          error: string | null
          id: string
          job_id: string
          status: string
        }
        Insert: {
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          error?: string | null
          id?: string
          job_id: string
          status?: string
        }
        Update: {
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          error?: string | null
          id?: string
          job_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "enrichment_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_jobs: {
        Row: {
          created_at: string
          credits_used: number
          entity: Database["public"]["Enums"]["job_entity"] | null
          error: string | null
          failed: number
          finished_at: string | null
          id: string
          integration_id: string | null
          kind: Database["public"]["Enums"]["job_kind"]
          owner_id: string
          processed: number
          provider: string
          scope: Json
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          succeeded: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits_used?: number
          entity?: Database["public"]["Enums"]["job_entity"] | null
          error?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          integration_id?: string | null
          kind: Database["public"]["Enums"]["job_kind"]
          owner_id: string
          processed?: number
          provider: string
          scope?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          succeeded?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits_used?: number
          entity?: Database["public"]["Enums"]["job_entity"] | null
          error?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          integration_id?: string | null
          kind?: Database["public"]["Enums"]["job_kind"]
          owner_id?: string
          processed?: number
          provider?: string
          scope?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          succeeded?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_jobs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json
          created_at: string
          credentials_secret_ref: string | null
          id: string
          last_used_at: string | null
          oauth_tokens: Json | null
          owner_id: string
          provider: string
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          credentials_secret_ref?: string | null
          id?: string
          last_used_at?: string | null
          oauth_tokens?: Json | null
          owner_id: string
          provider: string
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          credentials_secret_ref?: string | null
          id?: string
          last_used_at?: string | null
          oauth_tokens?: Json | null
          owner_id?: string
          provider?: string
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          company_name: string | null
          converted_at: string | null
          converted_contact_id: string | null
          converted_deal_id: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          label: string | null
          last_name: string | null
          notes: string | null
          owner_id: string
          phone: string | null
          pipeline_id: string | null
          score: number
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          converted_at?: string | null
          converted_contact_id?: string | null
          converted_deal_id?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          label?: string | null
          last_name?: string | null
          notes?: string | null
          owner_id: string
          phone?: string | null
          pipeline_id?: string | null
          score?: number
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          converted_at?: string | null
          converted_contact_id?: string | null
          converted_deal_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          label?: string | null
          last_name?: string | null
          notes?: string | null
          owner_id?: string
          phone?: string | null
          pipeline_id?: string | null
          score?: number
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: []
      }
      pipelines: {
        Row: {
          config: Json
          created_at: string
          entity: string
          id: string
          is_default: boolean
          name: string
          owner_id: string
          stages: Json
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          entity: string
          id?: string
          is_default?: boolean
          name: string
          owner_id?: string
          stages?: Json
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          entity?: string
          id?: string
          is_default?: boolean
          name?: string
          owner_id?: string
          stages?: Json
          updated_at?: string
        }
        Relationships: []
      }
      playbook_responses: {
        Row: {
          completed_at: string | null
          created_at: string
          entity: string
          entity_id: string
          id: string
          owner_id: string
          playbook_id: string
          responses: Json
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          entity: string
          entity_id: string
          id?: string
          owner_id?: string
          playbook_id: string
          responses?: Json
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          entity?: string
          entity_id?: string
          id?: string
          owner_id?: string
          playbook_id?: string
          responses?: Json
        }
        Relationships: [
          {
            foreignKeyName: "playbook_responses_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      playbooks: {
        Row: {
          content: Json
          created_at: string
          enabled: boolean
          entity: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          enabled?: boolean
          entity: string
          id?: string
          name: string
          owner_id?: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          enabled?: boolean
          entity?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      property_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          entity: string
          entity_id: string
          id: string
          new_value: Json | null
          old_value: Json | null
          owner_id: string
          property: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          entity: string
          entity_id: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          owner_id: string
          property: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          entity?: string
          entity_id?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          owner_id?: string
          property?: string
        }
        Relationships: []
      }
      record_layouts: {
        Row: {
          created_at: string
          entity: string
          id: string
          owner_id: string
          sections: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity: string
          id?: string
          owner_id?: string
          sections?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity?: string
          id?: string
          owner_id?: string
          sections?: Json
          updated_at?: string
        }
        Relationships: []
      }
      saved_views: {
        Row: {
          column_order: string[] | null
          created_at: string
          entity: string
          filters: Json
          id: string
          is_default: boolean
          is_shared: boolean
          name: string
          owner_id: string
          quick_filters: Json
          sort_by: string | null
          sort_dir: string | null
          updated_at: string
        }
        Insert: {
          column_order?: string[] | null
          created_at?: string
          entity: string
          filters?: Json
          id?: string
          is_default?: boolean
          is_shared?: boolean
          name: string
          owner_id?: string
          quick_filters?: Json
          sort_by?: string | null
          sort_dir?: string | null
          updated_at?: string
        }
        Update: {
          column_order?: string[] | null
          created_at?: string
          entity?: string
          filters?: Json
          id?: string
          is_default?: boolean
          is_shared?: boolean
          name?: string
          owner_id?: string
          quick_filters?: Json
          sort_by?: string | null
          sort_dir?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scoring_rules: {
        Row: {
          condition: Json
          created_at: string
          enabled: boolean
          entity: string
          id: string
          name: string
          owner_id: string
          points: number
          updated_at: string
        }
        Insert: {
          condition?: Json
          created_at?: string
          enabled?: boolean
          entity: string
          id?: string
          name: string
          owner_id?: string
          points?: number
          updated_at?: string
        }
        Update: {
          condition?: Json
          created_at?: string
          enabled?: boolean
          entity?: string
          id?: string
          name?: string
          owner_id?: string
          points?: number
          updated_at?: string
        }
        Relationships: []
      }
      segment_members: {
        Row: {
          added_at: string
          entity_id: string
          segment_id: string
        }
        Insert: {
          added_at?: string
          entity_id: string
          segment_id: string
        }
        Update: {
          added_at?: string
          entity_id?: string
          segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "segment_members_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      segments: {
        Row: {
          created_at: string
          entity: string
          filters: Json
          id: string
          kind: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity: string
          filters?: Json
          id?: string
          kind?: string
          name: string
          owner_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity?: string
          filters?: Json
          id?: string
          kind?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sequence_enrollments: {
        Row: {
          current_step: number
          enrolled_at: string
          entity_id: string
          finished_at: string | null
          id: string
          next_run_at: string | null
          owner_id: string
          sequence_id: string
          status: string
        }
        Insert: {
          current_step?: number
          enrolled_at?: string
          entity_id: string
          finished_at?: string | null
          id?: string
          next_run_at?: string | null
          owner_id?: string
          sequence_id: string
          status?: string
        }
        Update: {
          current_step?: number
          enrolled_at?: string
          entity_id?: string
          finished_at?: string | null
          id?: string
          next_run_at?: string | null
          owner_id?: string
          sequence_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences: {
        Row: {
          created_at: string
          enabled: boolean
          entity: string
          id: string
          name: string
          owner_id: string
          steps: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          entity: string
          id?: string
          name: string
          owner_id?: string
          steps?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          entity?: string
          id?: string
          name?: string
          owner_id?: string
          steps?: Json
          updated_at?: string
        }
        Relationships: []
      }
      subscription_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          member_user_id: string
          role: Database["public"]["Enums"]["team_role"]
          workspace_owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_user_id: string
          role?: Database["public"]["Enums"]["team_role"]
          workspace_owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_user_id?: string
          role?: Database["public"]["Enums"]["team_role"]
          workspace_owner_id?: string
        }
        Relationships: []
      }
      workflows: {
        Row: {
          actions: Json
          created_at: string
          enabled: boolean
          entity: string
          id: string
          name: string
          owner_id: string
          trigger: Json
          updated_at: string
        }
        Insert: {
          actions?: Json
          created_at?: string
          enabled?: boolean
          entity: string
          id?: string
          name: string
          owner_id?: string
          trigger?: Json
          updated_at?: string
        }
        Update: {
          actions?: Json
          created_at?: string
          enabled?: boolean
          entity?: string
          id?: string
          name?: string
          owner_id?: string
          trigger?: Json
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
      activity_type: "note" | "task" | "call" | "email" | "meeting"
      deal_stage:
        | "new"
        | "qualified"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
      integration_status: "connected" | "pending" | "error" | "disconnected"
      job_entity: "lead" | "contact" | "company" | "deal"
      job_kind: "import" | "enrich" | "export" | "sync"
      job_status: "queued" | "running" | "done" | "failed" | "partial"
      lead_status: "new" | "contacted" | "qualified" | "disqualified"
      team_role: "owner" | "admin" | "member"
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
      activity_type: ["note", "task", "call", "email", "meeting"],
      deal_stage: [
        "new",
        "qualified",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ],
      integration_status: ["connected", "pending", "error", "disconnected"],
      job_entity: ["lead", "contact", "company", "deal"],
      job_kind: ["import", "enrich", "export", "sync"],
      job_status: ["queued", "running", "done", "failed", "partial"],
      lead_status: ["new", "contacted", "qualified", "disqualified"],
      team_role: ["owner", "admin", "member"],
    },
  },
} as const
