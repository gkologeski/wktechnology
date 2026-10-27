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
      ab_test_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          owner_id: string
          subject_id: string | null
          test_id: string
          variant_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          owner_id: string
          subject_id?: string | null
          test_id: string
          variant_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          owner_id?: string
          subject_id?: string | null
          test_id?: string
          variant_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_events_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_test_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ab_tests: {
        Row: {
          created_at: string
          ended_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          name: string
          owner_id: string
          started_at: string | null
          status: string
          success_metric: string
          updated_at: string
          variants: Json
          winner_variant_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          name: string
          owner_id: string
          started_at?: string | null
          status?: string
          success_metric?: string
          updated_at?: string
          variants?: Json
          winner_variant_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          name?: string
          owner_id?: string
          started_at?: string | null
          status?: string
          success_metric?: string
          updated_at?: string
          variants?: Json
          winner_variant_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ab_tests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      access_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
          target_user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          target_user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          target_user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      access_profile_permissions: {
        Row: {
          create_enabled: boolean
          delete_scope: Database["public"]["Enums"]["access_scope"]
          edit_scope: Database["public"]["Enums"]["access_scope"]
          id: string
          module_id: string | null
          object_key: string
          profile_id: string
          view_scope: Database["public"]["Enums"]["access_scope"]
        }
        Insert: {
          create_enabled?: boolean
          delete_scope?: Database["public"]["Enums"]["access_scope"]
          edit_scope?: Database["public"]["Enums"]["access_scope"]
          id?: string
          module_id?: string | null
          object_key: string
          profile_id: string
          view_scope?: Database["public"]["Enums"]["access_scope"]
        }
        Update: {
          create_enabled?: boolean
          delete_scope?: Database["public"]["Enums"]["access_scope"]
          edit_scope?: Database["public"]["Enums"]["access_scope"]
          id?: string
          module_id?: string | null
          object_key?: string
          profile_id?: string
          view_scope?: Database["public"]["Enums"]["access_scope"]
        }
        Relationships: [
          {
            foreignKeyName: "access_profile_permissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_profile_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      access_profile_tools: {
        Row: {
          enabled: boolean
          id: string
          profile_id: string
          tool_key: string
        }
        Insert: {
          enabled?: boolean
          id?: string
          profile_id: string
          tool_key: string
        }
        Update: {
          enabled?: boolean
          id?: string
          profile_id?: string
          tool_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_profile_tools_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      access_profiles: {
        Row: {
          base_role: Database["public"]["Enums"]["app_role"]
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          updated_at: string
          workspace_owner_id: string
        }
        Insert: {
          base_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string
          workspace_owner_id: string
        }
        Update: {
          base_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string
          workspace_owner_id?: string
        }
        Relationships: []
      }
      activities: {
        Row: {
          activity_date: string | null
          assigned_to: string | null
          attachments: Json
          body: string | null
          completed: boolean
          contacted_contact_ids: string[] | null
          created_at: string
          created_by: string | null
          custom_fields: Json
          deleted_at: string | null
          disposition: string | null
          due_date: string | null
          duration_ms: number | null
          email_direction: string | null
          email_status: string | null
          external_ids: Json
          follow_up_of: string | null
          hs_createdate: string | null
          hs_lastmodifieddate: string | null
          hs_object_id: string | null
          hs_raw: Json | null
          hubspot_owner_id: string | null
          id: string
          meeting_key: string | null
          meeting_location: string | null
          meeting_outcome: string | null
          mentions: string[]
          outcome: string | null
          outcome_set_at: string | null
          owner_id: string
          pinned_at: string | null
          recording_channels: number | null
          recording_duration_seconds: number | null
          recording_sid: string | null
          recording_url: string | null
          recurrence: Json | null
          recurrence_parent_id: string | null
          related_company_id: string | null
          related_contact_id: string | null
          related_deal_id: string | null
          related_lead_id: string | null
          related_ticket_id: string | null
          relink_checked_at: string | null
          remind_before_minutes: number | null
          reminder_sent_at: string | null
          subject: string | null
          task_priority: string | null
          task_status: string | null
          task_type: string | null
          transcription: string | null
          transcription_model: string | null
          transcription_status: string | null
          type: Database["public"]["Enums"]["activity_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          activity_date?: string | null
          assigned_to?: string | null
          attachments?: Json
          body?: string | null
          completed?: boolean
          contacted_contact_ids?: string[] | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          deleted_at?: string | null
          disposition?: string | null
          due_date?: string | null
          duration_ms?: number | null
          email_direction?: string | null
          email_status?: string | null
          external_ids?: Json
          follow_up_of?: string | null
          hs_createdate?: string | null
          hs_lastmodifieddate?: string | null
          hs_object_id?: string | null
          hs_raw?: Json | null
          hubspot_owner_id?: string | null
          id?: string
          meeting_key?: string | null
          meeting_location?: string | null
          meeting_outcome?: string | null
          mentions?: string[]
          outcome?: string | null
          outcome_set_at?: string | null
          owner_id: string
          pinned_at?: string | null
          recording_channels?: number | null
          recording_duration_seconds?: number | null
          recording_sid?: string | null
          recording_url?: string | null
          recurrence?: Json | null
          recurrence_parent_id?: string | null
          related_company_id?: string | null
          related_contact_id?: string | null
          related_deal_id?: string | null
          related_lead_id?: string | null
          related_ticket_id?: string | null
          relink_checked_at?: string | null
          remind_before_minutes?: number | null
          reminder_sent_at?: string | null
          subject?: string | null
          task_priority?: string | null
          task_status?: string | null
          task_type?: string | null
          transcription?: string | null
          transcription_model?: string | null
          transcription_status?: string | null
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          activity_date?: string | null
          assigned_to?: string | null
          attachments?: Json
          body?: string | null
          completed?: boolean
          contacted_contact_ids?: string[] | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          deleted_at?: string | null
          disposition?: string | null
          due_date?: string | null
          duration_ms?: number | null
          email_direction?: string | null
          email_status?: string | null
          external_ids?: Json
          follow_up_of?: string | null
          hs_createdate?: string | null
          hs_lastmodifieddate?: string | null
          hs_object_id?: string | null
          hs_raw?: Json | null
          hubspot_owner_id?: string | null
          id?: string
          meeting_key?: string | null
          meeting_location?: string | null
          meeting_outcome?: string | null
          mentions?: string[]
          outcome?: string | null
          outcome_set_at?: string | null
          owner_id?: string
          pinned_at?: string | null
          recording_channels?: number | null
          recording_duration_seconds?: number | null
          recording_sid?: string | null
          recording_url?: string | null
          recurrence?: Json | null
          recurrence_parent_id?: string | null
          related_company_id?: string | null
          related_contact_id?: string | null
          related_deal_id?: string | null
          related_lead_id?: string | null
          related_ticket_id?: string | null
          relink_checked_at?: string | null
          remind_before_minutes?: number | null
          reminder_sent_at?: string | null
          subject?: string | null
          task_priority?: string | null
          task_status?: string | null
          task_type?: string | null
          transcription?: string | null
          transcription_model?: string | null
          transcription_status?: string | null
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
          workspace_id?: string
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
            foreignKeyName: "activities_related_contact_id_fkey"
            columns: ["related_contact_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_contacts"
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
            foreignKeyName: "activities_related_deal_id_fkey"
            columns: ["related_deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_related_ticket_id_fkey"
            columns: ["related_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_comments: {
        Row: {
          activity_id: string
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          mentions: string[]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          activity_id: string
          author_id?: string
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          mentions?: string[]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          activity_id?: string
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          mentions?: string[]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_comments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_survey_responses: {
        Row: {
          activity_id: string
          answers: Json
          created_at: string
          id: string
          idempotency_key: string | null
          max_score: number | null
          owner_id: string
          responded_at: string
          responded_by: string | null
          schema_snapshot: Json | null
          score: number | null
          source: string
          source_id: string
          source_name: string | null
          template_version: number | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          activity_id: string
          answers?: Json
          created_at?: string
          id?: string
          idempotency_key?: string | null
          max_score?: number | null
          owner_id: string
          responded_at?: string
          responded_by?: string | null
          schema_snapshot?: Json | null
          score?: number | null
          source: string
          source_id: string
          source_name?: string | null
          template_version?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          activity_id?: string
          answers?: Json
          created_at?: string
          id?: string
          idempotency_key?: string | null
          max_score?: number | null
          owner_id?: string
          responded_at?: string
          responded_by?: string | null
          schema_snapshot?: Json | null
          score?: number | null
          source?: string
          source_id?: string
          source_name?: string | null
          template_version?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_survey_responses_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: true
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_accounts: {
        Row: {
          access_token: string | null
          created_at: string
          display_name: string | null
          external_account_id: string
          id: string
          metadata: Json
          owner_id: string
          provider: string
          refresh_token: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          display_name?: string | null
          external_account_id: string
          id?: string
          metadata?: Json
          owner_id: string
          provider: string
          refresh_token?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          display_name?: string | null
          external_account_id?: string
          id?: string
          metadata?: Json
          owner_id?: string
          provider?: string
          refresh_token?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_audiences: {
        Row: {
          account_id: string
          created_at: string
          external_audience_id: string | null
          id: string
          last_synced_at: string | null
          name: string
          owner_id: string
          segment_id: string | null
          size_estimate: number | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          external_audience_id?: string | null
          id?: string
          last_synced_at?: string | null
          name: string
          owner_id: string
          segment_id?: string | null
          size_estimate?: number | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          external_audience_id?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string
          owner_id?: string
          segment_id?: string | null
          size_estimate?: number | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_audiences_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ads_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_audiences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_lead_forms: {
        Row: {
          account_id: string
          campaign_name: string | null
          created_at: string
          external_form_id: string
          field_mapping: Json
          id: string
          is_active: boolean
          name: string
          owner_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id: string
          campaign_name?: string | null
          created_at?: string
          external_form_id: string
          field_mapping?: Json
          id?: string
          is_active?: boolean
          name: string
          owner_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string
          campaign_name?: string | null
          created_at?: string
          external_form_id?: string
          field_mapping?: Json
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_lead_forms_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ads_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_lead_forms_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_call_logs: {
        Row: {
          completion_tokens: number | null
          created_at: string
          duration_ms: number | null
          error: string | null
          estimated_cost_usd: number | null
          feature: string
          id: string
          model: string | null
          prompt_tokens: number | null
          provider: string
          status: string
          trigger_source: string
          triggered_by: string | null
          workspace_id: string | null
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          estimated_cost_usd?: number | null
          feature?: string
          id?: string
          model?: string | null
          prompt_tokens?: number | null
          provider: string
          status: string
          trigger_source?: string
          triggered_by?: string | null
          workspace_id?: string | null
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          estimated_cost_usd?: number | null
          feature?: string
          id?: string
          model?: string | null
          prompt_tokens?: number | null
          provider?: string
          status?: string
          trigger_source?: string
          triggered_by?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_summaries: {
        Row: {
          created_at: string
          entity: string
          entity_id: string
          id: string
          key_points: Json
          kind: string
          model: string | null
          next_actions: Json
          owner_id: string
          sentiment: string | null
          source_count: number
          source_refs: Json
          summary: string
          updated_at: string
          window_from: string | null
          window_to: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          entity: string
          entity_id: string
          id?: string
          key_points?: Json
          kind?: string
          model?: string | null
          next_actions?: Json
          owner_id: string
          sentiment?: string | null
          source_count?: number
          source_refs?: Json
          summary: string
          updated_at?: string
          window_from?: string | null
          window_to?: string | null
          workspace_id?: string
        }
        Update: {
          created_at?: string
          entity?: string
          entity_id?: string
          id?: string
          key_points?: Json
          kind?: string
          model?: string | null
          next_actions?: Json
          owner_id?: string
          sentiment?: string | null
          source_count?: number
          source_refs?: Json
          summary?: string
          updated_at?: string
          window_from?: string | null
          window_to?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_summaries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_idempotency_keys: {
        Row: {
          api_key_id: string
          created_at: string
          endpoint: string
          expires_at: string
          id: string
          idem_key: string
          request_hash: string
          response: Json
          workspace_id: string
        }
        Insert: {
          api_key_id: string
          created_at?: string
          endpoint: string
          expires_at?: string
          id?: string
          idem_key: string
          request_hash: string
          response: Json
          workspace_id: string
        }
        Update: {
          api_key_id?: string
          created_at?: string
          endpoint?: string
          expires_at?: string
          id?: string
          idem_key?: string
          request_hash?: string
          response?: Json
          workspace_id?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          owner_id: string
          prefix: string
          revoked_at: string | null
          scopes: string[]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          owner_id: string
          prefix: string
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          owner_id?: string
          prefix?: string
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_rate_buckets: {
        Row: {
          api_key_id: string
          hits: number
          window_start: string
        }
        Insert: {
          api_key_id: string
          hits?: number
          window_start: string
        }
        Update: {
          api_key_id?: string
          hits?: number
          window_start?: string
        }
        Relationships: []
      }
      apollo_phone_reveals: {
        Row: {
          apollo_person_id: string | null
          applied_at: string | null
          created_at: string
          email: string | null
          entity_id: string
          entity_type: string
          id: string
          linkedin_url: string | null
          mobile_phone: string | null
          signal: string | null
          status: string
          updated_at: string
          work_phone: string | null
          workspace_id: string
        }
        Insert: {
          apollo_person_id?: string | null
          applied_at?: string | null
          created_at?: string
          email?: string | null
          entity_id: string
          entity_type: string
          id?: string
          linkedin_url?: string | null
          mobile_phone?: string | null
          signal?: string | null
          status?: string
          updated_at?: string
          work_phone?: string | null
          workspace_id: string
        }
        Update: {
          apollo_person_id?: string | null
          applied_at?: string | null
          created_at?: string
          email?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          linkedin_url?: string | null
          mobile_phone?: string | null
          signal?: string | null
          status?: string
          updated_at?: string
          work_phone?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      ats_application_events: {
        Row: {
          actor_id: string | null
          application_id: string
          candidate_id: string
          created_at: string
          event_type: string
          from_stage: string | null
          id: string
          job_id: string
          metadata: Json
          owner_id: string
          to_stage: string | null
          workspace_id: string | null
        }
        Insert: {
          actor_id?: string | null
          application_id: string
          candidate_id: string
          created_at?: string
          event_type: string
          from_stage?: string | null
          id?: string
          job_id: string
          metadata?: Json
          owner_id: string
          to_stage?: string | null
          workspace_id?: string | null
        }
        Update: {
          actor_id?: string | null
          application_id?: string
          candidate_id?: string
          created_at?: string
          event_type?: string
          from_stage?: string | null
          id?: string
          job_id?: string
          metadata?: Json
          owner_id?: string
          to_stage?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "ats_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_application_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_applications: {
        Row: {
          ai_match_score: number | null
          ai_match_summary: string | null
          applied_at: string
          assigned_to: string | null
          candidate_id: string
          created_at: string
          hiring_details: Json | null
          id: string
          job_id: string
          moved_at: string
          owner_id: string
          position: number
          provider: string | null
          provider_applicant_id: string | null
          rejection_reason: string | null
          source: string
          stage_value: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ai_match_score?: number | null
          ai_match_summary?: string | null
          applied_at?: string
          assigned_to?: string | null
          candidate_id: string
          created_at?: string
          hiring_details?: Json | null
          id?: string
          job_id: string
          moved_at?: string
          owner_id: string
          position?: number
          provider?: string | null
          provider_applicant_id?: string | null
          rejection_reason?: string | null
          source?: string
          stage_value?: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ai_match_score?: number | null
          ai_match_summary?: string | null
          applied_at?: string
          assigned_to?: string | null
          candidate_id?: string
          created_at?: string
          hiring_details?: Json | null
          id?: string
          job_id?: string
          moved_at?: string
          owner_id?: string
          position?: number
          provider?: string | null
          provider_applicant_id?: string | null
          rejection_reason?: string | null
          source?: string
          stage_value?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ats_applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ats_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ats_applications_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_async_video_responses: {
        Row: {
          created_at: string
          duration_sec: number | null
          id: string
          interview_id: string
          mime_type: string | null
          owner_id: string
          question_id: string
          size_bytes: number | null
          storage_path: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          duration_sec?: number | null
          id?: string
          interview_id: string
          mime_type?: string | null
          owner_id: string
          question_id: string
          size_bytes?: number | null
          storage_path: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          duration_sec?: number | null
          id?: string
          interview_id?: string
          mime_type?: string | null
          owner_id?: string
          question_id?: string
          size_bytes?: number | null
          storage_path?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_async_video_responses_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "ats_interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_async_video_responses_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_ats_interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_async_video_responses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_candidate_consents: {
        Row: {
          candidate_id: string
          created_at: string
          evidence: Json | null
          expires_at: string | null
          granted: boolean
          granted_at: string
          id: string
          legal_basis: string | null
          owner_id: string
          purpose: string
          revoked_at: string | null
          source: string
          workspace_id: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          evidence?: Json | null
          expires_at?: string | null
          granted?: boolean
          granted_at?: string
          id?: string
          legal_basis?: string | null
          owner_id: string
          purpose: string
          revoked_at?: string | null
          source?: string
          workspace_id?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          evidence?: Json | null
          expires_at?: string | null
          granted?: boolean
          granted_at?: string
          id?: string
          legal_basis?: string | null
          owner_id?: string
          purpose?: string
          revoked_at?: string | null
          source?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_candidate_consents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_candidate_consents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_candidate_consents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_candidate_email_queue: {
        Row: {
          application_id: string | null
          attempts: number
          body_html: string
          body_text: string | null
          candidate_id: string
          created_at: string
          error: string | null
          id: string
          job_id: string | null
          owner_id: string
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string
          to_email: string
          workspace_id: string | null
        }
        Insert: {
          application_id?: string | null
          attempts?: number
          body_html: string
          body_text?: string | null
          candidate_id: string
          created_at?: string
          error?: string | null
          id?: string
          job_id?: string | null
          owner_id: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject: string
          to_email: string
          workspace_id?: string | null
        }
        Update: {
          application_id?: string | null
          attempts?: number
          body_html?: string
          body_text?: string | null
          candidate_id?: string
          created_at?: string
          error?: string | null
          id?: string
          job_id?: string | null
          owner_id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string
          to_email?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_candidate_email_queue_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "ats_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_candidate_email_queue_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_candidate_flags: {
        Row: {
          candidate_id: string
          created_at: string
          details: Json
          id: string
          kind: string
          owner_id: string
          resolved: boolean
          severity: string
          workspace_id: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          details?: Json
          id?: string
          kind: string
          owner_id: string
          resolved?: boolean
          severity?: string
          workspace_id?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          details?: Json
          id?: string
          kind?: string
          owner_id?: string
          resolved?: boolean
          severity?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_candidate_flags_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_candidate_flags_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_candidate_flags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_candidates: {
        Row: {
          about: string | null
          archived: boolean
          assigned_to: string | null
          available_actions: Json | null
          capture_version: string | null
          captured_at: string | null
          certifications: Json | null
          connection_degree: string | null
          created_at: string
          created_by: string | null
          current_company: string | null
          current_company_data: Json | null
          current_position: string | null
          cv_parsed: Json | null
          cv_url: string | null
          dei_disability: string | null
          dei_gender: string | null
          dei_lgbtqia: string | null
          dei_race: string | null
          education: Json | null
          email: string | null
          experiences: Json | null
          external_links: Json | null
          full_name: string
          headline: string | null
          id: string
          languages: Json | null
          last_touch_at: string | null
          lgpd_redacted_at: string | null
          linkedin_url: string | null
          location: string | null
          next_action_at: string | null
          notes: string | null
          open_to_work: boolean | null
          owner_id: string
          phone: string | null
          photo_url: string | null
          projects: Json | null
          publications: Json | null
          recent_activity: Json | null
          recommendations: Json | null
          relationship_owner_id: string | null
          relationship_status: string
          retention_until: string | null
          score: number | null
          skills: string[]
          skills_detailed: Json | null
          source: string
          tags: string[]
          updated_at: string
          volunteering: Json | null
          workspace_id: string
        }
        Insert: {
          about?: string | null
          archived?: boolean
          assigned_to?: string | null
          available_actions?: Json | null
          capture_version?: string | null
          captured_at?: string | null
          certifications?: Json | null
          connection_degree?: string | null
          created_at?: string
          created_by?: string | null
          current_company?: string | null
          current_company_data?: Json | null
          current_position?: string | null
          cv_parsed?: Json | null
          cv_url?: string | null
          dei_disability?: string | null
          dei_gender?: string | null
          dei_lgbtqia?: string | null
          dei_race?: string | null
          education?: Json | null
          email?: string | null
          experiences?: Json | null
          external_links?: Json | null
          full_name: string
          headline?: string | null
          id?: string
          languages?: Json | null
          last_touch_at?: string | null
          lgpd_redacted_at?: string | null
          linkedin_url?: string | null
          location?: string | null
          next_action_at?: string | null
          notes?: string | null
          open_to_work?: boolean | null
          owner_id: string
          phone?: string | null
          photo_url?: string | null
          projects?: Json | null
          publications?: Json | null
          recent_activity?: Json | null
          recommendations?: Json | null
          relationship_owner_id?: string | null
          relationship_status?: string
          retention_until?: string | null
          score?: number | null
          skills?: string[]
          skills_detailed?: Json | null
          source?: string
          tags?: string[]
          updated_at?: string
          volunteering?: Json | null
          workspace_id: string
        }
        Update: {
          about?: string | null
          archived?: boolean
          assigned_to?: string | null
          available_actions?: Json | null
          capture_version?: string | null
          captured_at?: string | null
          certifications?: Json | null
          connection_degree?: string | null
          created_at?: string
          created_by?: string | null
          current_company?: string | null
          current_company_data?: Json | null
          current_position?: string | null
          cv_parsed?: Json | null
          cv_url?: string | null
          dei_disability?: string | null
          dei_gender?: string | null
          dei_lgbtqia?: string | null
          dei_race?: string | null
          education?: Json | null
          email?: string | null
          experiences?: Json | null
          external_links?: Json | null
          full_name?: string
          headline?: string | null
          id?: string
          languages?: Json | null
          last_touch_at?: string | null
          lgpd_redacted_at?: string | null
          linkedin_url?: string | null
          location?: string | null
          next_action_at?: string | null
          notes?: string | null
          open_to_work?: boolean | null
          owner_id?: string
          phone?: string | null
          photo_url?: string | null
          projects?: Json | null
          publications?: Json | null
          recent_activity?: Json | null
          recommendations?: Json | null
          relationship_owner_id?: string | null
          relationship_status?: string
          retention_until?: string | null
          score?: number | null
          skills?: string[]
          skills_detailed?: Json | null
          source?: string
          tags?: string[]
          updated_at?: string
          volunteering?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ats_candidates_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_daily_briefings: {
        Row: {
          created_at: string
          generated_at: string
          headline: string | null
          id: string
          metrics: Json
          owner_id: string
          period_end: string
          period_start: string
          priorities: Json
          recommendations: Json
          risks: Json
          summary: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          generated_at?: string
          headline?: string | null
          id?: string
          metrics?: Json
          owner_id: string
          period_end: string
          period_start: string
          priorities?: Json
          recommendations?: Json
          risks?: Json
          summary?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          generated_at?: string
          headline?: string | null
          id?: string
          metrics?: Json
          owner_id?: string
          period_end?: string
          period_start?: string
          priorities?: Json
          recommendations?: Json
          risks?: Json
          summary?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_daily_briefings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_dsar_requests: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          notes: string | null
          owner_id: string
          processed_at: string | null
          processed_by: string | null
          request_type: string
          requested_by: string | null
          result: Json | null
          status: string
          subject_email: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          notes?: string | null
          owner_id: string
          processed_at?: string | null
          processed_by?: string | null
          request_type: string
          requested_by?: string | null
          result?: Json | null
          status?: string
          subject_email?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string
          processed_at?: string | null
          processed_by?: string | null
          request_type?: string
          requested_by?: string | null
          result?: Json | null
          status?: string
          subject_email?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_dsar_requests_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_dsar_requests_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_dsar_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_hiring_decisions: {
        Row: {
          actor_id: string
          application_id: string
          created_at: string
          event: string
          from_status: string | null
          id: string
          to_status: string | null
          workspace_id: string
        }
        Insert: {
          actor_id: string
          application_id: string
          created_at?: string
          event: string
          from_status?: string | null
          id?: string
          to_status?: string | null
          workspace_id: string
        }
        Update: {
          actor_id?: string
          application_id?: string
          created_at?: string
          event?: string
          from_status?: string | null
          id?: string
          to_status?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ats_hiring_decisions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_hunting_captures: {
        Row: {
          candidate_id: string
          captured_at: string
          captured_by: string | null
          id: string
          owner_id: string
          parser_version: string | null
          raw_payload: Json
          session_id: string | null
          source_url: string
          workspace_id: string | null
        }
        Insert: {
          candidate_id: string
          captured_at?: string
          captured_by?: string | null
          id?: string
          owner_id: string
          parser_version?: string | null
          raw_payload?: Json
          session_id?: string | null
          source_url: string
          workspace_id?: string | null
        }
        Update: {
          candidate_id?: string
          captured_at?: string
          captured_by?: string | null
          id?: string
          owner_id?: string
          parser_version?: string | null
          raw_payload?: Json
          session_id?: string | null
          source_url?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_hunting_captures_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_hunting_captures_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_hunting_captures_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_hunting_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          name: string
          owner_id: string
          subject: string | null
          updated_at: string
          variables: Json
          workspace_id: string | null
        }
        Insert: {
          body: string
          channel: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name: string
          owner_id: string
          subject?: string | null
          updated_at?: string
          variables?: Json
          workspace_id?: string | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          owner_id?: string
          subject?: string | null
          updated_at?: string
          variables?: Json
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_hunting_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_interview_kits: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          owner_id: string
          pipeline_id: string | null
          questions: Json
          stage_value: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          owner_id: string
          pipeline_id?: string | null
          questions?: Json
          stage_value?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          owner_id?: string
          pipeline_id?: string | null
          questions?: Json
          stage_value?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_interview_kits_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "ats_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_interview_kits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_interviewer_availability: {
        Row: {
          created_at: string
          end_minute: number
          id: string
          interviewer_id: string
          owner_id: string
          start_minute: number
          timezone: string
          weekday: number
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          end_minute: number
          id?: string
          interviewer_id: string
          owner_id: string
          start_minute: number
          timezone?: string
          weekday: number
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          end_minute?: number
          id?: string
          interviewer_id?: string
          owner_id?: string
          start_minute?: number
          timezone?: string
          weekday?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_interviewer_availability_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_interviewer_pool_members: {
        Row: {
          created_at: string
          id: string
          interviewer_id: string
          owner_id: string
          pool_id: string
          weight: number
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          interviewer_id: string
          owner_id: string
          pool_id: string
          weight?: number
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          interviewer_id?: string
          owner_id?: string
          pool_id?: string
          weight?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_interviewer_pool_members_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "ats_interviewer_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_interviewer_pool_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_interviewer_pools: {
        Row: {
          created_at: string
          description: string | null
          id: string
          load_window_days: number
          name: string
          owner_id: string
          rotation_cursor: number
          rotation_strategy: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          load_window_days?: number
          name: string
          owner_id: string
          rotation_cursor?: number
          rotation_strategy?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          load_window_days?: number
          name?: string
          owner_id?: string
          rotation_cursor?: number
          rotation_strategy?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_interviewer_pools_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_interviews: {
        Row: {
          ai_concerns: Json | null
          ai_followups: Json | null
          ai_generated_at: string | null
          ai_model: string | null
          ai_recommendation: string | null
          ai_score: number | null
          ai_strengths: Json | null
          ai_summary: string | null
          application_id: string
          assigned_to: string | null
          async_questions_snapshot: Json | null
          auto_rescheduled_from: string | null
          candidate_id: string
          created_at: string
          duration_min: number
          id: string
          interview_kit_id: string | null
          interviewer_id: string | null
          job_id: string
          kind: string
          location: string | null
          meet_url: string | null
          meeting_id: string | null
          notes: string | null
          offered_slots: Json
          owner_id: string
          panel_interviewer_ids: string[]
          pool_id: string | null
          reminder_1h_sent_at: string | null
          reminder_d1_sent_at: string | null
          scheduled_at: string | null
          self_schedule_expires_at: string | null
          self_schedule_token: string | null
          self_scheduled_at: string | null
          slots: Json | null
          stage_value: string | null
          status: string
          transcript: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          ai_concerns?: Json | null
          ai_followups?: Json | null
          ai_generated_at?: string | null
          ai_model?: string | null
          ai_recommendation?: string | null
          ai_score?: number | null
          ai_strengths?: Json | null
          ai_summary?: string | null
          application_id: string
          assigned_to?: string | null
          async_questions_snapshot?: Json | null
          auto_rescheduled_from?: string | null
          candidate_id: string
          created_at?: string
          duration_min?: number
          id?: string
          interview_kit_id?: string | null
          interviewer_id?: string | null
          job_id: string
          kind?: string
          location?: string | null
          meet_url?: string | null
          meeting_id?: string | null
          notes?: string | null
          offered_slots?: Json
          owner_id: string
          panel_interviewer_ids?: string[]
          pool_id?: string | null
          reminder_1h_sent_at?: string | null
          reminder_d1_sent_at?: string | null
          scheduled_at?: string | null
          self_schedule_expires_at?: string | null
          self_schedule_token?: string | null
          self_scheduled_at?: string | null
          slots?: Json | null
          stage_value?: string | null
          status?: string
          transcript?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          ai_concerns?: Json | null
          ai_followups?: Json | null
          ai_generated_at?: string | null
          ai_model?: string | null
          ai_recommendation?: string | null
          ai_score?: number | null
          ai_strengths?: Json | null
          ai_summary?: string | null
          application_id?: string
          assigned_to?: string | null
          async_questions_snapshot?: Json | null
          auto_rescheduled_from?: string | null
          candidate_id?: string
          created_at?: string
          duration_min?: number
          id?: string
          interview_kit_id?: string | null
          interviewer_id?: string | null
          job_id?: string
          kind?: string
          location?: string | null
          meet_url?: string | null
          meeting_id?: string | null
          notes?: string | null
          offered_slots?: Json
          owner_id?: string
          panel_interviewer_ids?: string[]
          pool_id?: string | null
          reminder_1h_sent_at?: string | null
          reminder_d1_sent_at?: string | null
          scheduled_at?: string | null
          self_schedule_expires_at?: string | null
          self_schedule_token?: string | null
          self_scheduled_at?: string | null
          slots?: Json | null
          stage_value?: string | null
          status?: string
          transcript?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "ats_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_interviews_auto_rescheduled_from_fkey"
            columns: ["auto_rescheduled_from"]
            isOneToOne: false
            referencedRelation: "ats_interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_interviews_auto_rescheduled_from_fkey"
            columns: ["auto_rescheduled_from"]
            isOneToOne: false
            referencedRelation: "shared_fields_ats_interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_interviews_interview_kit_id_fkey"
            columns: ["interview_kit_id"]
            isOneToOne: false
            referencedRelation: "ats_interview_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_interviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ats_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_interviews_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_interviews_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "ats_interviewer_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_interviews_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_job_postings: {
        Row: {
          created_at: string
          external_id: string | null
          external_url: string | null
          id: string
          is_mock: boolean
          job_id: string
          last_error: string | null
          last_synced_at: string | null
          metadata: Json
          owner_id: string
          provider: string
          status: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          external_url?: string | null
          id?: string
          is_mock?: boolean
          job_id: string
          last_error?: string | null
          last_synced_at?: string | null
          metadata?: Json
          owner_id: string
          provider: string
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          external_id?: string | null
          external_url?: string | null
          id?: string
          is_mock?: boolean
          job_id?: string
          last_error?: string | null
          last_synced_at?: string | null
          metadata?: Json
          owner_id?: string
          provider?: string
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_job_postings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ats_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_job_postings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_jobs: {
        Row: {
          assigned_to: string | null
          company_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          employment_type: string | null
          filled_at: string | null
          hiring_manager_id: string | null
          id: string
          linkedin_apply_type: string | null
          linkedin_apply_url: string | null
          linkedin_budget_amount: number | null
          linkedin_budget_currency: string | null
          linkedin_budget_period: string | null
          linkedin_company_id: string | null
          linkedin_company_name: string | null
          linkedin_employment_status: string | null
          linkedin_location_id: string | null
          linkedin_location_name: string | null
          linkedin_notification_email: string | null
          linkedin_publish_mode: string | null
          linkedin_workplace: string | null
          location: string | null
          metadata: Json
          opened_at: string | null
          owner_id: string
          pipeline_id: string | null
          recruiter_id: string | null
          remote_mode: string | null
          requirements: string | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          seniority: string | null
          slug: string | null
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          company_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          employment_type?: string | null
          filled_at?: string | null
          hiring_manager_id?: string | null
          id?: string
          linkedin_apply_type?: string | null
          linkedin_apply_url?: string | null
          linkedin_budget_amount?: number | null
          linkedin_budget_currency?: string | null
          linkedin_budget_period?: string | null
          linkedin_company_id?: string | null
          linkedin_company_name?: string | null
          linkedin_employment_status?: string | null
          linkedin_location_id?: string | null
          linkedin_location_name?: string | null
          linkedin_notification_email?: string | null
          linkedin_publish_mode?: string | null
          linkedin_workplace?: string | null
          location?: string | null
          metadata?: Json
          opened_at?: string | null
          owner_id: string
          pipeline_id?: string | null
          recruiter_id?: string | null
          remote_mode?: string | null
          requirements?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          seniority?: string | null
          slug?: string | null
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          employment_type?: string | null
          filled_at?: string | null
          hiring_manager_id?: string | null
          id?: string
          linkedin_apply_type?: string | null
          linkedin_apply_url?: string | null
          linkedin_budget_amount?: number | null
          linkedin_budget_currency?: string | null
          linkedin_budget_period?: string | null
          linkedin_company_id?: string | null
          linkedin_company_name?: string | null
          linkedin_employment_status?: string | null
          linkedin_location_id?: string | null
          linkedin_location_name?: string | null
          linkedin_notification_email?: string | null
          linkedin_publish_mode?: string | null
          linkedin_workplace?: string | null
          location?: string | null
          metadata?: Json
          opened_at?: string | null
          owner_id?: string
          pipeline_id?: string | null
          recruiter_id?: string | null
          remote_mode?: string | null
          requirements?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          seniority?: string | null
          slug?: string | null
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ats_jobs_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "ats_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ats_jobs_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_match_scores: {
        Row: {
          application_id: string | null
          candidate_id: string
          created_at: string
          gaps: Json
          id: string
          job_id: string
          model: string | null
          owner_id: string
          score: number
          strengths: Json
          summary: string | null
          workspace_id: string | null
        }
        Insert: {
          application_id?: string | null
          candidate_id: string
          created_at?: string
          gaps?: Json
          id?: string
          job_id: string
          model?: string | null
          owner_id: string
          score: number
          strengths?: Json
          summary?: string | null
          workspace_id?: string | null
        }
        Update: {
          application_id?: string | null
          candidate_id?: string
          created_at?: string
          gaps?: Json
          id?: string
          job_id?: string
          model?: string | null
          owner_id?: string
          score?: number
          strengths?: Json
          summary?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_match_scores_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "ats_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_match_scores_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_match_scores_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_match_scores_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ats_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_match_scores_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_offer_approvals: {
        Row: {
          actor_id: string
          created_at: string
          event: string
          id: string
          note: string | null
          offer_id: string
          revision: number
          workspace_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          event: string
          id?: string
          note?: string | null
          offer_id: string
          revision: number
          workspace_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          event?: string
          id?: string
          note?: string | null
          offer_id?: string
          revision?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ats_offer_approvals_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "ats_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_offer_approvals_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_ats_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_offer_approvals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_offers: {
        Row: {
          application_id: string | null
          approval_note: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          approved_revision: number | null
          assigned_to: string | null
          body: string
          candidate_id: string
          created_at: string
          decline_reason: string | null
          declined_at: string | null
          esign_document_id: string | null
          id: string
          job_id: string | null
          owner_id: string
          promote_to_stage: string | null
          public_token: string | null
          revision: number
          salary_amount: number | null
          salary_currency: string
          sent_at: string | null
          signed_at: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
          viewed_at: string | null
          workspace_id: string | null
        }
        Insert: {
          application_id?: string | null
          approval_note?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          approved_revision?: number | null
          assigned_to?: string | null
          body?: string
          candidate_id: string
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          esign_document_id?: string | null
          id?: string
          job_id?: string | null
          owner_id: string
          promote_to_stage?: string | null
          public_token?: string | null
          revision?: number
          salary_amount?: number | null
          salary_currency?: string
          sent_at?: string | null
          signed_at?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          viewed_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          application_id?: string | null
          approval_note?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          approved_revision?: number | null
          assigned_to?: string | null
          body?: string
          candidate_id?: string
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          esign_document_id?: string | null
          id?: string
          job_id?: string | null
          owner_id?: string
          promote_to_stage?: string | null
          public_token?: string | null
          revision?: number
          salary_amount?: number | null
          salary_currency?: string
          sent_at?: string | null
          signed_at?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          viewed_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_offers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "ats_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_offers_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_offers_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_offers_esign_document_id_fkey"
            columns: ["esign_document_id"]
            isOneToOne: false
            referencedRelation: "esign_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_offers_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ats_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_offers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_pipelines: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          owner_id: string
          stages: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          owner_id: string
          stages?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          owner_id?: string
          stages?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ats_pipelines_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_referral_programs: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          default_bonus_cents: number
          eligibility_rules: Json
          enable_public_form: boolean
          enabled: boolean
          id: string
          landing_body: string | null
          landing_headline: string | null
          name: string
          owner_id: string
          public_slug: string | null
          terms_url: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          default_bonus_cents?: number
          eligibility_rules?: Json
          enable_public_form?: boolean
          enabled?: boolean
          id?: string
          landing_body?: string | null
          landing_headline?: string | null
          name: string
          owner_id: string
          public_slug?: string | null
          terms_url?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          default_bonus_cents?: number
          eligibility_rules?: Json
          enable_public_form?: boolean
          enabled?: boolean
          id?: string
          landing_body?: string | null
          landing_headline?: string | null
          name?: string
          owner_id?: string
          public_slug?: string | null
          terms_url?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_referral_programs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_referrals: {
        Row: {
          assigned_to: string | null
          bonus_cents: number
          bonus_paid_at: string | null
          bonus_status: string
          candidate_email: string | null
          candidate_id: string | null
          candidate_linkedin: string | null
          candidate_name: string | null
          candidate_phone: string | null
          created_at: string
          decided_at: string | null
          decision_notes: string | null
          hired_at: string | null
          id: string
          job_id: string | null
          notes: string | null
          owner_id: string
          program_id: string | null
          referrer_email: string | null
          referrer_name: string | null
          referrer_user_id: string | null
          relationship: string | null
          source: string
          status: string
          submitted_at: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          bonus_cents?: number
          bonus_paid_at?: string | null
          bonus_status?: string
          candidate_email?: string | null
          candidate_id?: string | null
          candidate_linkedin?: string | null
          candidate_name?: string | null
          candidate_phone?: string | null
          created_at?: string
          decided_at?: string | null
          decision_notes?: string | null
          hired_at?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          owner_id: string
          program_id?: string | null
          referrer_email?: string | null
          referrer_name?: string | null
          referrer_user_id?: string | null
          relationship?: string | null
          source?: string
          status?: string
          submitted_at?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          bonus_cents?: number
          bonus_paid_at?: string | null
          bonus_status?: string
          candidate_email?: string | null
          candidate_id?: string | null
          candidate_linkedin?: string | null
          candidate_name?: string | null
          candidate_phone?: string | null
          created_at?: string
          decided_at?: string | null
          decision_notes?: string | null
          hired_at?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          owner_id?: string
          program_id?: string | null
          referrer_email?: string | null
          referrer_name?: string | null
          referrer_user_id?: string | null
          relationship?: string | null
          source?: string
          status?: string
          submitted_at?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_referrals_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_referrals_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_referrals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ats_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_referrals_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "ats_referral_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_referrals_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "ats_referral_programs_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_referrals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_scorecard_responses: {
        Row: {
          application_id: string
          created_at: string
          evaluator_id: string | null
          id: string
          notes: string | null
          owner_id: string
          recommendation: string | null
          scorecard_id: string
          scores: Json
          total_score: number | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          evaluator_id?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          recommendation?: string | null
          scorecard_id: string
          scores?: Json
          total_score?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          evaluator_id?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          recommendation?: string | null
          scorecard_id?: string
          scores?: Json
          total_score?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_scorecard_responses_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "ats_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_scorecard_responses_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "ats_scorecards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_scorecard_responses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_scorecards: {
        Row: {
          created_at: string
          criteria: Json
          description: string | null
          id: string
          is_active: boolean
          job_id: string | null
          name: string
          owner_id: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          criteria?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          job_id?: string | null
          name: string
          owner_id: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          criteria?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          job_id?: string | null
          name?: string
          owner_id?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_scorecards_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ats_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_scorecards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_sourcing_enrollments: {
        Row: {
          candidate_id: string
          created_at: string
          current_step: number
          finished_at: string | null
          id: string
          last_error: string | null
          next_run_at: string | null
          owner_id: string
          sequence_id: string
          started_at: string
          started_by: string | null
          status: string
          updated_at: string
          waiting_for_invite_log_id: string | null
          waiting_since: string | null
          workspace_id: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          current_step?: number
          finished_at?: string | null
          id?: string
          last_error?: string | null
          next_run_at?: string | null
          owner_id: string
          sequence_id: string
          started_at?: string
          started_by?: string | null
          status?: string
          updated_at?: string
          waiting_for_invite_log_id?: string | null
          waiting_since?: string | null
          workspace_id?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          current_step?: number
          finished_at?: string | null
          id?: string
          last_error?: string | null
          next_run_at?: string | null
          owner_id?: string
          sequence_id?: string
          started_at?: string
          started_by?: string | null
          status?: string
          updated_at?: string
          waiting_for_invite_log_id?: string | null
          waiting_since?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_sourcing_enrollments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_sourcing_enrollments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_sourcing_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "ats_sourcing_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_sourcing_enrollments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_sourcing_sequence_steps: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          delay_days: number
          id: string
          max_wait_days: number | null
          on_timeout: string | null
          owner_id: string
          poll_interval_hours: number | null
          sequence_id: string
          step_order: number
          subject: string | null
          task_instructions: string | null
          template_ref: string | null
          variant_label: string
          variant_weight: number
          workspace_id: string | null
        }
        Insert: {
          body?: string | null
          channel: string
          created_at?: string
          delay_days?: number
          id?: string
          max_wait_days?: number | null
          on_timeout?: string | null
          owner_id: string
          poll_interval_hours?: number | null
          sequence_id: string
          step_order: number
          subject?: string | null
          task_instructions?: string | null
          template_ref?: string | null
          variant_label?: string
          variant_weight?: number
          workspace_id?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          delay_days?: number
          id?: string
          max_wait_days?: number | null
          on_timeout?: string | null
          owner_id?: string
          poll_interval_hours?: number | null
          sequence_id?: string
          step_order?: number
          subject?: string | null
          task_instructions?: string | null
          template_ref?: string | null
          variant_label?: string
          variant_weight?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_sourcing_sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "ats_sourcing_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_sourcing_sequence_steps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_sourcing_sequences: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          daily_send_limit: number | null
          description: string | null
          enabled: boolean
          id: string
          name: string
          owner_id: string
          pool_id: string | null
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          send_days: number[]
          timezone: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          daily_send_limit?: number | null
          description?: string | null
          enabled?: boolean
          id?: string
          name: string
          owner_id: string
          pool_id?: string | null
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          send_days?: number[]
          timezone?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          daily_send_limit?: number | null
          description?: string | null
          enabled?: boolean
          id?: string
          name?: string
          owner_id?: string
          pool_id?: string | null
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          send_days?: number[]
          timezone?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_sourcing_sequences_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "ats_talent_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_sourcing_sequences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_sourcing_step_log: {
        Row: {
          channel: string
          created_at: string
          enrollment_id: string
          error: string | null
          id: string
          metadata: Json
          owner_id: string
          ref_id: string | null
          status: string
          step_order: number
          workspace_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          enrollment_id: string
          error?: string | null
          id?: string
          metadata?: Json
          owner_id: string
          ref_id?: string | null
          status: string
          step_order: number
          workspace_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          enrollment_id?: string
          error?: string | null
          id?: string
          metadata?: Json
          owner_id?: string
          ref_id?: string | null
          status?: string
          step_order?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ats_sourcing_step_log_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "ats_sourcing_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_sourcing_step_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_stage_email_log: {
        Row: {
          application_id: string
          body: string
          candidate_id: string
          created_at: string
          error: string | null
          id: string
          job_id: string | null
          owner_id: string
          sent_at: string | null
          stage_value: string
          status: string
          subject: string
          to_email: string
          workspace_id: string | null
        }
        Insert: {
          application_id: string
          body: string
          candidate_id: string
          created_at?: string
          error?: string | null
          id?: string
          job_id?: string | null
          owner_id: string
          sent_at?: string | null
          stage_value: string
          status?: string
          subject: string
          to_email: string
          workspace_id?: string | null
        }
        Update: {
          application_id?: string
          body?: string
          candidate_id?: string
          created_at?: string
          error?: string | null
          id?: string
          job_id?: string | null
          owner_id?: string
          sent_at?: string | null
          stage_value?: string
          status?: string
          subject?: string
          to_email?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_stage_email_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_stage_emails: {
        Row: {
          body: string
          created_at: string
          enabled: boolean
          id: string
          owner_id: string
          stage_value: string
          subject: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          enabled?: boolean
          id?: string
          owner_id: string
          stage_value: string
          subject: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          enabled?: boolean
          id?: string
          owner_id?: string
          stage_value?: string
          subject?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_stage_emails_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_talent_pool_members: {
        Row: {
          added_at: string
          added_by: string | null
          candidate_id: string
          id: string
          notes: string | null
          owner_id: string
          pool_id: string
          source: string
          workspace_id: string | null
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          candidate_id: string
          id?: string
          notes?: string | null
          owner_id: string
          pool_id: string
          source?: string
          workspace_id?: string | null
        }
        Update: {
          added_at?: string
          added_by?: string | null
          candidate_id?: string
          id?: string
          notes?: string | null
          owner_id?: string
          pool_id?: string
          source?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_talent_pool_members_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_talent_pool_members_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_talent_pool_members_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "ats_talent_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_talent_pool_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_talent_pools: {
        Row: {
          assigned_to: string | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          filters: Json
          id: string
          name: string
          owner_id: string
          system_key: string | null
          type: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          filters?: Json
          id?: string
          name: string
          owner_id: string
          system_key?: string | null
          type?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          filters?: Json
          id?: string
          name?: string
          owner_id?: string
          system_key?: string | null
          type?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_talent_pools_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      attribution_touchpoints: {
        Row: {
          campaign: string | null
          channel: string
          contact_id: string | null
          content: string | null
          created_at: string
          deal_id: string | null
          id: string
          lead_id: string | null
          medium: string | null
          metadata: Json
          occurred_at: string
          owner_id: string
          source: string | null
          term: string | null
          url: string | null
          workspace_id: string
        }
        Insert: {
          campaign?: string | null
          channel: string
          contact_id?: string | null
          content?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          lead_id?: string | null
          medium?: string | null
          metadata?: Json
          occurred_at?: string
          owner_id: string
          source?: string | null
          term?: string | null
          url?: string | null
          workspace_id: string
        }
        Update: {
          campaign?: string | null
          channel?: string
          contact_id?: string | null
          content?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          lead_id?: string | null
          medium?: string | null
          metadata?: Json
          occurred_at?: string
          owner_id?: string
          source?: string | null
          term?: string | null
          url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attribution_touchpoints_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_export_runs: {
        Row: {
          created_at: string
          error_message: string | null
          export_id: string
          finished_at: string | null
          id: string
          output_url: string | null
          owner_id: string
          records_count: number | null
          started_at: string
          status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          export_id: string
          finished_at?: string | null
          id?: string
          output_url?: string | null
          owner_id: string
          records_count?: number | null
          started_at?: string
          status?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          export_id?: string
          finished_at?: string | null
          id?: string
          output_url?: string | null
          owner_id?: string
          records_count?: number | null
          started_at?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_export_runs_export_id_fkey"
            columns: ["export_id"]
            isOneToOne: false
            referencedRelation: "audit_exports"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_exports: {
        Row: {
          config: Json
          created_at: string
          cursor_at: string | null
          cursor_id: string | null
          destination: string
          enabled: boolean
          format: string
          hmac_secret: string | null
          id: string
          last_run_at: string | null
          last_status: string | null
          name: string
          owner_id: string
          schedule_cron: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          cursor_at?: string | null
          cursor_id?: string | null
          destination: string
          enabled?: boolean
          format?: string
          hmac_secret?: string | null
          id?: string
          last_run_at?: string | null
          last_status?: string | null
          name: string
          owner_id: string
          schedule_cron?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          cursor_at?: string | null
          cursor_id?: string | null
          destination?: string
          enabled?: boolean
          format?: string
          hmac_secret?: string | null
          id?: string
          last_run_at?: string | null
          last_status?: string | null
          name?: string
          owner_id?: string
          schedule_cron?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_exports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata: Json
          module_id: string | null
          session_id: string | null
          workspace_owner_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          metadata?: Json
          module_id?: string | null
          session_id?: string | null
          workspace_owner_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata?: Json
          module_id?: string | null
          session_id?: string | null
          workspace_owner_id?: string
        }
        Relationships: []
      }
      bank_charges: {
        Row: {
          amount: number
          assigned_to: string | null
          boleto_barcode: string | null
          boleto_digitable_line: string | null
          boleto_url: string | null
          canceled_at: string | null
          connection_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          external_id: string | null
          financial_entry_id: string | null
          id: string
          metadata: Json
          paid_at: string | null
          payer_document: string | null
          payer_name: string | null
          pix_copy_paste: string | null
          pix_qr_code: string | null
          status: string
          type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          assigned_to?: string | null
          boleto_barcode?: string | null
          boleto_digitable_line?: string | null
          boleto_url?: string | null
          canceled_at?: string | null
          connection_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          external_id?: string | null
          financial_entry_id?: string | null
          id?: string
          metadata?: Json
          paid_at?: string | null
          payer_document?: string | null
          payer_name?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          status?: string
          type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          assigned_to?: string | null
          boleto_barcode?: string | null
          boleto_digitable_line?: string | null
          boleto_url?: string | null
          canceled_at?: string | null
          connection_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          external_id?: string | null
          financial_entry_id?: string | null
          id?: string
          metadata?: Json
          paid_at?: string | null
          payer_document?: string | null
          payer_name?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          status?: string
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_charges_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_charges_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_connection_events: {
        Row: {
          actor_id: string | null
          connection_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          connection_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          connection_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_connection_events_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_connection_tokens: {
        Row: {
          access_token: string
          connection_id: string
          created_at: string
          expires_at: string | null
          id: string
          refresh_token: string | null
          rotated_at: string | null
          scope: string | null
          token_type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          access_token: string
          connection_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          rotated_at?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          access_token?: string
          connection_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          rotated_at?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_connection_tokens_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_connections: {
        Row: {
          balance_synced_at: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          current_balance: number | null
          display_name: string | null
          external_account_id: string | null
          id: string
          last_error: string | null
          last_statement_sync_at: string | null
          last_sync_at: string | null
          metadata: Json
          mode: string
          provider: string
          scopes: string[]
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          balance_synced_at?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          current_balance?: number | null
          display_name?: string | null
          external_account_id?: string | null
          id?: string
          last_error?: string | null
          last_statement_sync_at?: string | null
          last_sync_at?: string | null
          metadata?: Json
          mode?: string
          provider: string
          scopes?: string[]
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          balance_synced_at?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          current_balance?: number | null
          display_name?: string | null
          external_account_id?: string | null
          id?: string
          last_error?: string | null
          last_statement_sync_at?: string | null
          last_sync_at?: string | null
          metadata?: Json
          mode?: string
          provider?: string
          scopes?: string[]
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      bank_payments: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          assigned_to: string | null
          boleto_barcode: string | null
          boleto_digitable_line: string | null
          connection_id: string
          created_at: string
          created_by: string | null
          description: string | null
          external_id: string | null
          failure_reason: string | null
          favored_document: string | null
          favored_name: string | null
          financial_entry_id: string | null
          id: string
          metadata: Json
          paid_at: string | null
          pix_key: string | null
          pix_key_type: string | null
          scheduled_for: string | null
          status: string
          type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          boleto_barcode?: string | null
          boleto_digitable_line?: string | null
          connection_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_id?: string | null
          failure_reason?: string | null
          favored_document?: string | null
          favored_name?: string | null
          financial_entry_id?: string | null
          id?: string
          metadata?: Json
          paid_at?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          scheduled_for?: string | null
          status?: string
          type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          boleto_barcode?: string | null
          boleto_digitable_line?: string | null
          connection_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_id?: string | null
          failure_reason?: string | null
          favored_document?: string | null
          favored_name?: string | null
          financial_entry_id?: string | null
          id?: string
          metadata?: Json
          paid_at?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          scheduled_for?: string | null
          status?: string
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_payments_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_payments_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          bank_account_id: string | null
          category: string | null
          connection_id: string
          counterparty: string | null
          created_at: string
          description: string | null
          direction: string
          external_id: string
          id: string
          matched_payment_id: string | null
          posted_at: string
          raw: Json
          reconciliation_status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          bank_account_id?: string | null
          category?: string | null
          connection_id: string
          counterparty?: string | null
          created_at?: string
          description?: string | null
          direction: string
          external_id: string
          id?: string
          matched_payment_id?: string | null
          posted_at: string
          raw?: Json
          reconciliation_status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          bank_account_id?: string | null
          category?: string | null
          connection_id?: string
          counterparty?: string | null
          created_at?: string
          description?: string | null
          direction?: string
          external_id?: string
          id?: string
          matched_payment_id?: string | null
          posted_at?: string
          raw?: Json
          reconciliation_status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "financial_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_transactions_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_pages: {
        Row: {
          active: boolean
          availability: Json
          buffer_after_minutes: number
          buffer_before_minutes: number
          calendar_account_id: string | null
          color: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          location: string | null
          max_advance_days: number
          min_notice_hours: number
          owner_id: string
          slug: string
          target: string
          timezone: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          availability?: Json
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          calendar_account_id?: string | null
          color?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          location?: string | null
          max_advance_days?: number
          min_notice_hours?: number
          owner_id: string
          slug: string
          target?: string
          timezone?: string
          title: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          active?: boolean
          availability?: Json
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          calendar_account_id?: string | null
          color?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          location?: string | null
          max_advance_days?: number
          min_notice_hours?: number
          owner_id?: string
          slug?: string
          target?: string
          timezone?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_pages_calendar_account_id_fkey"
            columns: ["calendar_account_id"]
            isOneToOne: false
            referencedRelation: "calendar_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_pages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          activity_id: string | null
          assigned_to: string | null
          calendar_sync_error: string | null
          cancel_reason: string | null
          canceled_at: string | null
          contact_id: string | null
          created_at: string
          end_at: string
          gcal_event_id: string | null
          id: string
          invitee_email: string
          invitee_name: string
          invitee_phone: string | null
          lead_id: string | null
          meet_link: string | null
          notes: string | null
          owner_id: string
          page_id: string
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          timezone: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          activity_id?: string | null
          assigned_to?: string | null
          calendar_sync_error?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          contact_id?: string | null
          created_at?: string
          end_at: string
          gcal_event_id?: string | null
          id?: string
          invitee_email: string
          invitee_name: string
          invitee_phone?: string | null
          lead_id?: string | null
          meet_link?: string | null
          notes?: string | null
          owner_id: string
          page_id: string
          start_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          timezone?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          activity_id?: string | null
          assigned_to?: string | null
          calendar_sync_error?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          contact_id?: string | null
          created_at?: string
          end_at?: string
          gcal_event_id?: string | null
          id?: string
          invitee_email?: string
          invitee_name?: string
          invitee_phone?: string | null
          lead_id?: string | null
          meet_link?: string | null
          notes?: string | null
          owner_id?: string
          page_id?: string
          start_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          timezone?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "booking_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_report_analyses: {
        Row: {
          bug_report_id: string
          confidence: number | null
          created_at: string
          error: string | null
          id: string
          lovable_prompt: string | null
          model: string
          proposed_fix: string | null
          reproduction_steps: Json
          root_cause: string | null
          severity: string | null
          status: string
          summary: string | null
          suspected_area: string | null
          suspected_files: Json
        }
        Insert: {
          bug_report_id: string
          confidence?: number | null
          created_at?: string
          error?: string | null
          id?: string
          lovable_prompt?: string | null
          model: string
          proposed_fix?: string | null
          reproduction_steps?: Json
          root_cause?: string | null
          severity?: string | null
          status?: string
          summary?: string | null
          suspected_area?: string | null
          suspected_files?: Json
        }
        Update: {
          bug_report_id?: string
          confidence?: number | null
          created_at?: string
          error?: string | null
          id?: string
          lovable_prompt?: string | null
          model?: string
          proposed_fix?: string | null
          reproduction_steps?: Json
          root_cause?: string | null
          severity?: string | null
          status?: string
          summary?: string | null
          suspected_area?: string | null
          suspected_files?: Json
        }
        Relationships: [
          {
            foreignKeyName: "bug_report_analyses_bug_report_id_fkey"
            columns: ["bug_report_id"]
            isOneToOne: false
            referencedRelation: "bug_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_reports: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          image_paths: string[]
          kind: string
          owner_id: string
          page_url: string | null
          qa_test_case_id: string | null
          qa_test_case_title: string | null
          recording_has_audio: boolean
          recording_path: string | null
          resolution_text: string | null
          resolved_at: string | null
          status: string
          subtype: string
          updated_at: string
          user_agent: string | null
          user_resolution_at: string | null
          user_resolution_confirmed: boolean | null
          user_resolution_feedback: string | null
          workspace_id: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          image_paths?: string[]
          kind: string
          owner_id: string
          page_url?: string | null
          qa_test_case_id?: string | null
          qa_test_case_title?: string | null
          recording_has_audio?: boolean
          recording_path?: string | null
          resolution_text?: string | null
          resolved_at?: string | null
          status?: string
          subtype: string
          updated_at?: string
          user_agent?: string | null
          user_resolution_at?: string | null
          user_resolution_confirmed?: boolean | null
          user_resolution_feedback?: string | null
          workspace_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          image_paths?: string[]
          kind?: string
          owner_id?: string
          page_url?: string | null
          qa_test_case_id?: string | null
          qa_test_case_title?: string | null
          recording_has_audio?: boolean
          recording_path?: string | null
          resolution_text?: string | null
          resolved_at?: string | null
          status?: string
          subtype?: string
          updated_at?: string
          user_agent?: string | null
          user_resolution_at?: string | null
          user_resolution_confirmed?: boolean | null
          user_resolution_feedback?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bug_reports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_accounts: {
        Row: {
          access_token: string | null
          auto_create_meet_link: boolean
          created_at: string
          email: string
          expires_at: string | null
          id: string
          last_error: string | null
          last_status: string | null
          last_synced_at: string | null
          meet_index_cursor: string | null
          owner_id: string
          primary_calendar_id: string | null
          provider: string
          refresh_token: string | null
          scopes: string[] | null
          sync_enabled: boolean
          sync_in_progress: boolean
          sync_page_token: string | null
          sync_token: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          access_token?: string | null
          auto_create_meet_link?: boolean
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          last_error?: string | null
          last_status?: string | null
          last_synced_at?: string | null
          meet_index_cursor?: string | null
          owner_id: string
          primary_calendar_id?: string | null
          provider: string
          refresh_token?: string | null
          scopes?: string[] | null
          sync_enabled?: boolean
          sync_in_progress?: boolean
          sync_page_token?: string | null
          sync_token?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          access_token?: string | null
          auto_create_meet_link?: boolean
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          last_error?: string | null
          last_status?: string | null
          last_synced_at?: string | null
          meet_index_cursor?: string | null
          owner_id?: string
          primary_calendar_id?: string | null
          provider?: string
          refresh_token?: string | null
          scopes?: string[] | null
          sync_enabled?: boolean
          sync_in_progress?: boolean
          sync_page_token?: string | null
          sync_token?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          attendees: Json
          calendar_account_id: string | null
          conference_id: string | null
          created_at: string
          description: string | null
          end_at: string | null
          hangout_link: string | null
          html_link: string | null
          id: string
          last_synced_at: string
          location: string | null
          owner_id: string
          provider_event_id: string
          recording_attempts: number
          recording_drive_file_id: string | null
          recording_last_error: string | null
          recording_matched_by: string | null
          recording_mime_type: string | null
          recording_status: string | null
          recording_synced_at: string | null
          recording_url: string | null
          recurring_event_id: string | null
          related_activity_id: string | null
          related_contact_id: string | null
          start_at: string | null
          status: string | null
          summary_error: string | null
          summary_generated_at: string | null
          summary_status: string | null
          summary_text: string | null
          title: string | null
          transcript: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          all_day?: boolean
          attendees?: Json
          calendar_account_id?: string | null
          conference_id?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          hangout_link?: string | null
          html_link?: string | null
          id?: string
          last_synced_at?: string
          location?: string | null
          owner_id: string
          provider_event_id: string
          recording_attempts?: number
          recording_drive_file_id?: string | null
          recording_last_error?: string | null
          recording_matched_by?: string | null
          recording_mime_type?: string | null
          recording_status?: string | null
          recording_synced_at?: string | null
          recording_url?: string | null
          recurring_event_id?: string | null
          related_activity_id?: string | null
          related_contact_id?: string | null
          start_at?: string | null
          status?: string | null
          summary_error?: string | null
          summary_generated_at?: string | null
          summary_status?: string | null
          summary_text?: string | null
          title?: string | null
          transcript?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          all_day?: boolean
          attendees?: Json
          calendar_account_id?: string | null
          conference_id?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          hangout_link?: string | null
          html_link?: string | null
          id?: string
          last_synced_at?: string
          location?: string | null
          owner_id?: string
          provider_event_id?: string
          recording_attempts?: number
          recording_drive_file_id?: string | null
          recording_last_error?: string | null
          recording_matched_by?: string | null
          recording_mime_type?: string | null
          recording_status?: string | null
          recording_synced_at?: string | null
          recording_url?: string | null
          recurring_event_id?: string | null
          related_activity_id?: string | null
          related_contact_id?: string | null
          start_at?: string | null
          status?: string | null
          summary_error?: string | null
          summary_generated_at?: string | null
          summary_status?: string | null
          summary_text?: string | null
          title?: string | null
          transcript?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_calendar_account_id_fkey"
            columns: ["calendar_account_id"]
            isOneToOne: false
            referencedRelation: "calendar_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_related_contact_id_fkey"
            columns: ["related_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_related_contact_id_fkey"
            columns: ["related_contact_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_health_checks: {
        Row: {
          channel: string
          checked_at: string
          ready: boolean
          reason: string | null
          transient: boolean
        }
        Insert: {
          channel: string
          checked_at?: string
          ready: boolean
          reason?: string | null
          transient?: boolean
        }
        Update: {
          channel?: string
          checked_at?: string
          ready?: boolean
          reason?: string | null
          transient?: boolean
        }
        Relationships: []
      }
      charging_templates: {
        Row: {
          active: boolean
          body: string
          channel: string
          created_at: string
          id: string
          name: string
          owner_id: string
          subject: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          body: string
          channel: string
          created_at?: string
          id?: string
          name: string
          owner_id: string
          subject?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          body?: string
          channel?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          subject?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      chat_conversation_members: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string | null
          muted: boolean
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          kind: string
          last_message_at: string | null
          title: string | null
          updated_at: string
          workspace_owner_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          kind: string
          last_message_at?: string | null
          title?: string | null
          updated_at?: string
          workspace_owner_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          last_message_at?: string | null
          title?: string | null
          updated_at?: string
          workspace_owner_id?: string
        }
        Relationships: []
      }
      chat_message_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          message_id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          message_id: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          message_id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          sender_user_id: string
          workspace_owner_id: string
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_user_id: string
          workspace_owner_id: string
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_user_id?: string
          workspace_owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      clockify_connections: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_ciphertext: string | null
          key_last4: string | null
          last_error: string | null
          last_tested_at: string | null
          region: string
          source_access: string | null
          source_plan: string | null
          source_verified_at: string | null
          source_workspace_id: string | null
          source_workspace_name: string | null
          status: string
          subdomain: string | null
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_ciphertext?: string | null
          key_last4?: string | null
          last_error?: string | null
          last_tested_at?: string | null
          region?: string
          source_access?: string | null
          source_plan?: string | null
          source_verified_at?: string | null
          source_workspace_id?: string | null
          source_workspace_name?: string | null
          status?: string
          subdomain?: string | null
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_ciphertext?: string | null
          key_last4?: string | null
          last_error?: string | null
          last_tested_at?: string | null
          region?: string
          source_access?: string | null
          source_plan?: string | null
          source_verified_at?: string | null
          source_workspace_id?: string | null
          source_workspace_name?: string | null
          status?: string
          subdomain?: string | null
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clockify_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      clockify_import_links: {
        Row: {
          created_at: string
          entity_type: string
          external_id: string
          id: string
          imported_snapshot: Json
          last_run_id: string | null
          local_date: string | null
          meta: Json
          segment: number
          source_end_utc: string | null
          source_hash: string
          source_seconds: number | null
          source_start_utc: string | null
          source_timezone: string | null
          source_workspace_id: string
          target_id: string
          target_table: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          external_id: string
          id?: string
          imported_snapshot?: Json
          last_run_id?: string | null
          local_date?: string | null
          meta?: Json
          segment?: number
          source_end_utc?: string | null
          source_hash: string
          source_seconds?: number | null
          source_start_utc?: string | null
          source_timezone?: string | null
          source_workspace_id: string
          target_id: string
          target_table: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          external_id?: string
          id?: string
          imported_snapshot?: Json
          last_run_id?: string | null
          local_date?: string | null
          meta?: Json
          segment?: number
          source_end_utc?: string | null
          source_hash?: string
          source_seconds?: number | null
          source_start_utc?: string | null
          source_timezone?: string | null
          source_workspace_id?: string
          target_id?: string
          target_table?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clockify_import_links_last_run_id_fkey"
            columns: ["last_run_id"]
            isOneToOne: false
            referencedRelation: "clockify_import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clockify_import_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      clockify_import_runs: {
        Row: {
          checkpoint: Json
          counts: Json
          created_at: string
          delegation_authorized_at: string | null
          delegation_authorized_by: string | null
          error: string | null
          finished_at: string | null
          heartbeat_at: string | null
          id: string
          kind: string
          lease_until: string | null
          options: Json
          phase: string
          preview_confirmed_at: string | null
          preview_confirmed_by: string | null
          preview_run_id: string | null
          report: Json | null
          requested_by: string
          source_workspace_id: string
          started_at: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          checkpoint?: Json
          counts?: Json
          created_at?: string
          delegation_authorized_at?: string | null
          delegation_authorized_by?: string | null
          error?: string | null
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          kind: string
          lease_until?: string | null
          options?: Json
          phase?: string
          preview_confirmed_at?: string | null
          preview_confirmed_by?: string | null
          preview_run_id?: string | null
          report?: Json | null
          requested_by: string
          source_workspace_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          checkpoint?: Json
          counts?: Json
          created_at?: string
          delegation_authorized_at?: string | null
          delegation_authorized_by?: string | null
          error?: string | null
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          kind?: string
          lease_until?: string | null
          options?: Json
          phase?: string
          preview_confirmed_at?: string | null
          preview_confirmed_by?: string | null
          preview_run_id?: string | null
          report?: Json | null
          requested_by?: string
          source_workspace_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clockify_import_runs_preview_run_id_fkey"
            columns: ["preview_run_id"]
            isOneToOne: false
            referencedRelation: "clockify_import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clockify_import_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      clockify_mappings: {
        Row: {
          candidates: Json
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: string
          entity_type: string
          external_id: string
          id: string
          label: string | null
          method: string
          note: string | null
          source_workspace_id: string
          target_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          candidates?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          entity_type: string
          external_id: string
          id?: string
          label?: string | null
          method?: string
          note?: string | null
          source_workspace_id: string
          target_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          candidates?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          entity_type?: string
          external_id?: string
          id?: string
          label?: string | null
          method?: string
          note?: string | null
          source_workspace_id?: string
          target_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clockify_mappings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      clockify_staging_records: {
        Row: {
          entity_type: string
          external_id: string
          first_seen_at: string
          id: string
          last_run_id: string | null
          last_seen_at: string
          payload: Json
          payload_hash: string
          reason_code: string | null
          reason_detail: string | null
          source_workspace_id: string
          status: string
          workspace_id: string
        }
        Insert: {
          entity_type: string
          external_id: string
          first_seen_at?: string
          id?: string
          last_run_id?: string | null
          last_seen_at?: string
          payload: Json
          payload_hash: string
          reason_code?: string | null
          reason_detail?: string | null
          source_workspace_id: string
          status?: string
          workspace_id: string
        }
        Update: {
          entity_type?: string
          external_id?: string
          first_seen_at?: string
          id?: string
          last_run_id?: string | null
          last_seen_at?: string
          payload?: Json
          payload_hash?: string
          reason_code?: string | null
          reason_detail?: string | null
          source_workspace_id?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clockify_staging_records_last_run_id_fkey"
            columns: ["last_run_id"]
            isOneToOne: false
            referencedRelation: "clockify_import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clockify_staging_records_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          annualrevenue: number | null
          assigned_to: string | null
          assigned_user_id: string | null
          cep: string | null
          city: string | null
          cnpj: string | null
          cnpj_enriched_at: string | null
          country: string | null
          created_at: string
          custom_fields: Json
          deleted_at: string | null
          description: string | null
          domain: string | null
          external_ids: Json
          facebook_company_page: string | null
          hs_createdate: string | null
          hs_lastmodifieddate: string | null
          hs_lead_status: string | null
          hs_object_id: string | null
          hs_raw: Json | null
          hubspot_owner_id: string | null
          id: string
          industry: string | null
          is_target_account: boolean
          lifecyclestage: string | null
          linkedin_company_page: string | null
          logo_source: string
          logo_updated_at: string | null
          logo_url: string | null
          name: string
          notes: string | null
          owner_id: string
          parent_company_id: string | null
          phone: string | null
          phone_ext: string | null
          score: number
          size: string | null
          size_description: string | null
          state: string | null
          target_account_tier: string | null
          timezone: string | null
          twitterhandle: string | null
          type: string | null
          updated_at: string
          website: string | null
          workspace_id: string
        }
        Insert: {
          address?: string | null
          annualrevenue?: number | null
          assigned_to?: string | null
          assigned_user_id?: string | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          cnpj_enriched_at?: string | null
          country?: string | null
          created_at?: string
          custom_fields?: Json
          deleted_at?: string | null
          description?: string | null
          domain?: string | null
          external_ids?: Json
          facebook_company_page?: string | null
          hs_createdate?: string | null
          hs_lastmodifieddate?: string | null
          hs_lead_status?: string | null
          hs_object_id?: string | null
          hs_raw?: Json | null
          hubspot_owner_id?: string | null
          id?: string
          industry?: string | null
          is_target_account?: boolean
          lifecyclestage?: string | null
          linkedin_company_page?: string | null
          logo_source?: string
          logo_updated_at?: string | null
          logo_url?: string | null
          name: string
          notes?: string | null
          owner_id: string
          parent_company_id?: string | null
          phone?: string | null
          phone_ext?: string | null
          score?: number
          size?: string | null
          size_description?: string | null
          state?: string | null
          target_account_tier?: string | null
          timezone?: string | null
          twitterhandle?: string | null
          type?: string | null
          updated_at?: string
          website?: string | null
          workspace_id?: string
        }
        Update: {
          address?: string | null
          annualrevenue?: number | null
          assigned_to?: string | null
          assigned_user_id?: string | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          cnpj_enriched_at?: string | null
          country?: string | null
          created_at?: string
          custom_fields?: Json
          deleted_at?: string | null
          description?: string | null
          domain?: string | null
          external_ids?: Json
          facebook_company_page?: string | null
          hs_createdate?: string | null
          hs_lastmodifieddate?: string | null
          hs_lead_status?: string | null
          hs_object_id?: string | null
          hs_raw?: Json | null
          hubspot_owner_id?: string | null
          id?: string
          industry?: string | null
          is_target_account?: boolean
          lifecyclestage?: string | null
          linkedin_company_page?: string | null
          logo_source?: string
          logo_updated_at?: string | null
          logo_url?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          parent_company_id?: string | null
          phone?: string | null
          phone_ext?: string | null
          score?: number
          size?: string | null
          size_description?: string | null
          state?: string | null
          target_account_tier?: string | null
          timezone?: string | null
          twitterhandle?: string | null
          type?: string | null
          updated_at?: string
          website?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_parent_company_id_fkey"
            columns: ["parent_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contaazul_sync_state: {
        Row: {
          created_at: string
          cursor: string | null
          entity: string
          failed_count: number
          id: string
          imported_count: number
          last_error: string | null
          last_synced_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          cursor?: string | null
          entity: string
          failed_count?: number
          id?: string
          imported_count?: number
          last_error?: string | null
          last_synced_at?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          cursor?: string | null
          entity?: string
          failed_count?: number
          id?: string
          imported_count?: number
          last_error?: string | null
          last_synced_at?: string | null
          updated_at?: string
          workspace_id?: string
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
          workspace_id: string
        }
        Insert: {
          contact_id: string
          id?: string
          opted_in?: boolean
          owner_id?: string
          source?: string | null
          subscription_type_id: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          contact_id?: string
          id?: string
          opted_in?: boolean
          owner_id?: string
          source?: string | null
          subscription_type_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_subscriptions_subscription_type_id_fkey"
            columns: ["subscription_type_id"]
            isOneToOne: false
            referencedRelation: "subscription_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          area_atuacao: string | null
          assigned_to: string | null
          assigned_user_id: string | null
          cargo_catalog_version: number | null
          cargo_resumido: string | null
          cep: string | null
          city: string | null
          company_id: string | null
          company_name: string | null
          consent_date: string | null
          country: string | null
          created_at: string
          custom_fields: Json
          deleted_at: string | null
          email: string | null
          external_ids: Json
          first_name: string
          hs_createdate: string | null
          hs_lastmodifieddate: string | null
          hs_lead_status: string | null
          hs_object_id: string | null
          hs_raw: Json | null
          hubspot_owner_id: string | null
          id: string
          job_title: string | null
          label: string | null
          last_name: string | null
          legal_basis: string | null
          lifecyclestage: string | null
          linkedin_url: string | null
          marketing_status: string | null
          mobile_phone: string | null
          mobile_phone_digits: string | null
          nivel_hierarquico: string | null
          notes: string | null
          owner_id: string
          phone: string | null
          phone_digits: string | null
          phone_ext: string | null
          photo_source: string | null
          photo_updated_at: string | null
          photo_url: string | null
          portal_enabled: boolean
          portal_token: string | null
          score: number
          state: string | null
          twitter_handle: string | null
          updated_at: string
          website: string | null
          whatsapp_digits: string | null
          whatsapp_e164: string | null
          workspace_id: string
        }
        Insert: {
          address?: string | null
          area_atuacao?: string | null
          assigned_to?: string | null
          assigned_user_id?: string | null
          cargo_catalog_version?: number | null
          cargo_resumido?: string | null
          cep?: string | null
          city?: string | null
          company_id?: string | null
          company_name?: string | null
          consent_date?: string | null
          country?: string | null
          created_at?: string
          custom_fields?: Json
          deleted_at?: string | null
          email?: string | null
          external_ids?: Json
          first_name: string
          hs_createdate?: string | null
          hs_lastmodifieddate?: string | null
          hs_lead_status?: string | null
          hs_object_id?: string | null
          hs_raw?: Json | null
          hubspot_owner_id?: string | null
          id?: string
          job_title?: string | null
          label?: string | null
          last_name?: string | null
          legal_basis?: string | null
          lifecyclestage?: string | null
          linkedin_url?: string | null
          marketing_status?: string | null
          mobile_phone?: string | null
          mobile_phone_digits?: string | null
          nivel_hierarquico?: string | null
          notes?: string | null
          owner_id: string
          phone?: string | null
          phone_digits?: string | null
          phone_ext?: string | null
          photo_source?: string | null
          photo_updated_at?: string | null
          photo_url?: string | null
          portal_enabled?: boolean
          portal_token?: string | null
          score?: number
          state?: string | null
          twitter_handle?: string | null
          updated_at?: string
          website?: string | null
          whatsapp_digits?: string | null
          whatsapp_e164?: string | null
          workspace_id?: string
        }
        Update: {
          address?: string | null
          area_atuacao?: string | null
          assigned_to?: string | null
          assigned_user_id?: string | null
          cargo_catalog_version?: number | null
          cargo_resumido?: string | null
          cep?: string | null
          city?: string | null
          company_id?: string | null
          company_name?: string | null
          consent_date?: string | null
          country?: string | null
          created_at?: string
          custom_fields?: Json
          deleted_at?: string | null
          email?: string | null
          external_ids?: Json
          first_name?: string
          hs_createdate?: string | null
          hs_lastmodifieddate?: string | null
          hs_lead_status?: string | null
          hs_object_id?: string | null
          hs_raw?: Json | null
          hubspot_owner_id?: string | null
          id?: string
          job_title?: string | null
          label?: string | null
          last_name?: string | null
          legal_basis?: string | null
          lifecyclestage?: string | null
          linkedin_url?: string | null
          marketing_status?: string | null
          mobile_phone?: string | null
          mobile_phone_digits?: string | null
          nivel_hierarquico?: string | null
          notes?: string | null
          owner_id?: string
          phone?: string | null
          phone_digits?: string | null
          phone_ext?: string | null
          photo_source?: string | null
          photo_updated_at?: string | null
          photo_url?: string | null
          portal_enabled?: boolean
          portal_token?: string | null
          score?: number
          state?: string | null
          twitter_handle?: string | null
          updated_at?: string
          website?: string | null
          whatsapp_digits?: string | null
          whatsapp_e164?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_approvals: {
        Row: {
          approver_id: string | null
          assigned_to: string | null
          comment: string | null
          contract_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          generation: string | null
          id: string
          owner_id: string
          sort_order: number
          stage: Database["public"]["Enums"]["contract_approval_stage"]
          status: Database["public"]["Enums"]["contract_approval_status"]
          superseded_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          approver_id?: string | null
          assigned_to?: string | null
          comment?: string | null
          contract_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          generation?: string | null
          id?: string
          owner_id: string
          sort_order?: number
          stage: Database["public"]["Enums"]["contract_approval_stage"]
          status?: Database["public"]["Enums"]["contract_approval_status"]
          superseded_at?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          approver_id?: string | null
          assigned_to?: string | null
          comment?: string | null
          contract_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          generation?: string | null
          id?: string
          owner_id?: string
          sort_order?: number
          stage?: Database["public"]["Enums"]["contract_approval_stage"]
          status?: Database["public"]["Enums"]["contract_approval_status"]
          superseded_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_approvals_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_defaults: {
        Row: {
          created_at: string
          defaults: Json
          document_kind: string | null
          id: string
          owner_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          defaults?: Json
          document_kind?: string | null
          id?: string
          owner_id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          defaults?: Json
          document_kind?: string | null
          id?: string
          owner_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_defaults_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_events: {
        Row: {
          actor_id: string | null
          contract_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json
          source_txid: number | null
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          contract_id: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          source_txid?: number | null
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          contract_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          source_txid?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_link_ai_suggestions: {
        Row: {
          confidence: string
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          evidence: Json
          id: string
          kind: string
          pending_contract_id: string
          reason: string
          run_id: string
          source: string
          status: string
          target_contract_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          confidence: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          evidence?: Json
          id?: string
          kind: string
          pending_contract_id: string
          reason?: string
          run_id: string
          source?: string
          status?: string
          target_contract_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          confidence?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          evidence?: Json
          id?: string
          kind?: string
          pending_contract_id?: string
          reason?: string
          run_id?: string
          source?: string
          status?: string
          target_contract_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_link_ai_suggestions_pending_contract_id_fkey"
            columns: ["pending_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_link_ai_suggestions_target_contract_id_fkey"
            columns: ["target_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_template_services: {
        Row: {
          created_at: string
          id: string
          service_catalog_id: string
          template_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          service_catalog_id: string
          template_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          service_catalog_id?: string
          template_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_template_services_service_catalog_id_fkey"
            columns: ["service_catalog_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_template_services_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          assigned_to: string | null
          body_html: string | null
          created_at: string
          defaults: Json
          description: string | null
          id: string
          imported_from: string
          is_default: boolean
          name: string
          owner_id: string
          role: Database["public"]["Enums"]["contract_role"]
          service_type: string | null
          source_file_path: string | null
          status: string
          updated_at: string
          variables: Json
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          body_html?: string | null
          created_at?: string
          defaults?: Json
          description?: string | null
          id?: string
          imported_from?: string
          is_default?: boolean
          name: string
          owner_id?: string
          role?: Database["public"]["Enums"]["contract_role"]
          service_type?: string | null
          source_file_path?: string | null
          status?: string
          updated_at?: string
          variables?: Json
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          body_html?: string | null
          created_at?: string
          defaults?: Json
          description?: string | null
          id?: string
          imported_from?: string
          is_default?: boolean
          name?: string
          owner_id?: string
          role?: Database["public"]["Enums"]["contract_role"]
          service_type?: string | null
          source_file_path?: string | null
          status?: string
          updated_at?: string
          variables?: Json
          workspace_id?: string
        }
        Relationships: []
      }
      contracting_presets: {
        Row: {
          active: boolean
          billing_model: Database["public"]["Enums"]["billing_model"] | null
          cadence: string | null
          code: string | null
          competencies: string[]
          created_at: string
          currency: string
          default_unit_cost: number
          default_unit_price: number
          description: string | null
          id: string
          job_profile_id: string | null
          name: string
          notes: string | null
          owner_id: string
          percent: number | null
          seniority: string | null
          service_catalog_id: string | null
          unit: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          billing_model?: Database["public"]["Enums"]["billing_model"] | null
          cadence?: string | null
          code?: string | null
          competencies?: string[]
          created_at?: string
          currency?: string
          default_unit_cost?: number
          default_unit_price?: number
          description?: string | null
          id?: string
          job_profile_id?: string | null
          name: string
          notes?: string | null
          owner_id?: string
          percent?: number | null
          seniority?: string | null
          service_catalog_id?: string | null
          unit?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          billing_model?: Database["public"]["Enums"]["billing_model"] | null
          cadence?: string | null
          code?: string | null
          competencies?: string[]
          created_at?: string
          currency?: string
          default_unit_cost?: number
          default_unit_price?: number
          description?: string | null
          id?: string
          job_profile_id?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          percent?: number | null
          seniority?: string | null
          service_catalog_id?: string | null
          unit?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracting_presets_job_profile_id_fkey"
            columns: ["job_profile_id"]
            isOneToOne: false
            referencedRelation: "job_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracting_presets_service_catalog_id_fkey"
            columns: ["service_catalog_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracting_presets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          amendment_effective_at: string | null
          amendment_number: string | null
          amendment_of_id: string | null
          assigned_to: string | null
          auto_renew: boolean
          body_html: string | null
          confidentiality_term_months: number | null
          contracting_legal_entity_id: string | null
          counterparty_company_id: string | null
          created_at: string
          cure_period_days: number | null
          currency: string
          deal_id: string | null
          document_kind: string
          ends_at: string | null
          expense_reimbursement_days: number | null
          governing_law: string | null
          hours_per_month: number | null
          id: string
          import_confidence: number | null
          imported_from: string | null
          jurisdiction: string | null
          late_fee_percent: number | null
          late_interest_monthly_percent: number | null
          metadata: Json
          monthly_value: number | null
          notice_days: number
          number: string | null
          owner_id: string
          parent_contract_id: string | null
          payment_day: number | null
          payment_method: string | null
          payment_terms: Json
          penalty_percent: number | null
          proposal_id: string | null
          public_token: string | null
          quote_id: string | null
          readjustment_index: string | null
          readjustment_period: string | null
          role: Database["public"]["Enums"]["contract_role"]
          service_location: string | null
          service_scope: string | null
          service_type: string | null
          signature_document_id: string | null
          signature_operation_id: string | null
          signature_provider: string | null
          signed_at: string | null
          signed_pdf_path: string | null
          source_file_path: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["contract_status"]
          title: string
          total_value: number
          trial_period_days: number | null
          unilateral_termination_notice_days: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amendment_effective_at?: string | null
          amendment_number?: string | null
          amendment_of_id?: string | null
          assigned_to?: string | null
          auto_renew?: boolean
          body_html?: string | null
          confidentiality_term_months?: number | null
          contracting_legal_entity_id?: string | null
          counterparty_company_id?: string | null
          created_at?: string
          cure_period_days?: number | null
          currency?: string
          deal_id?: string | null
          document_kind?: string
          ends_at?: string | null
          expense_reimbursement_days?: number | null
          governing_law?: string | null
          hours_per_month?: number | null
          id?: string
          import_confidence?: number | null
          imported_from?: string | null
          jurisdiction?: string | null
          late_fee_percent?: number | null
          late_interest_monthly_percent?: number | null
          metadata?: Json
          monthly_value?: number | null
          notice_days?: number
          number?: string | null
          owner_id: string
          parent_contract_id?: string | null
          payment_day?: number | null
          payment_method?: string | null
          payment_terms?: Json
          penalty_percent?: number | null
          proposal_id?: string | null
          public_token?: string | null
          quote_id?: string | null
          readjustment_index?: string | null
          readjustment_period?: string | null
          role?: Database["public"]["Enums"]["contract_role"]
          service_location?: string | null
          service_scope?: string | null
          service_type?: string | null
          signature_document_id?: string | null
          signature_operation_id?: string | null
          signature_provider?: string | null
          signed_at?: string | null
          signed_pdf_path?: string | null
          source_file_path?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title: string
          total_value?: number
          trial_period_days?: number | null
          unilateral_termination_notice_days?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amendment_effective_at?: string | null
          amendment_number?: string | null
          amendment_of_id?: string | null
          assigned_to?: string | null
          auto_renew?: boolean
          body_html?: string | null
          confidentiality_term_months?: number | null
          contracting_legal_entity_id?: string | null
          counterparty_company_id?: string | null
          created_at?: string
          cure_period_days?: number | null
          currency?: string
          deal_id?: string | null
          document_kind?: string
          ends_at?: string | null
          expense_reimbursement_days?: number | null
          governing_law?: string | null
          hours_per_month?: number | null
          id?: string
          import_confidence?: number | null
          imported_from?: string | null
          jurisdiction?: string | null
          late_fee_percent?: number | null
          late_interest_monthly_percent?: number | null
          metadata?: Json
          monthly_value?: number | null
          notice_days?: number
          number?: string | null
          owner_id?: string
          parent_contract_id?: string | null
          payment_day?: number | null
          payment_method?: string | null
          payment_terms?: Json
          penalty_percent?: number | null
          proposal_id?: string | null
          public_token?: string | null
          quote_id?: string | null
          readjustment_index?: string | null
          readjustment_period?: string | null
          role?: Database["public"]["Enums"]["contract_role"]
          service_location?: string | null
          service_scope?: string | null
          service_type?: string | null
          signature_document_id?: string | null
          signature_operation_id?: string | null
          signature_provider?: string | null
          signed_at?: string | null
          signed_pdf_path?: string | null
          source_file_path?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title?: string
          total_value?: number
          trial_period_days?: number | null
          unilateral_termination_notice_days?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_amendment_of_id_fkey"
            columns: ["amendment_of_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_contracting_legal_entity_id_fkey"
            columns: ["contracting_legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_counterparty_company_id_fkey"
            columns: ["counterparty_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_parent_contract_id_fkey"
            columns: ["parent_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          parts: Json
          role: string
          session_id: string
          sources: Json
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parts?: Json
          role: string
          session_id: string
          sources?: Json
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          session_id?: string
          sources?: Json
        }
        Relationships: [
          {
            foreignKeyName: "copilot_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "copilot_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_sessions: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          title: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          title?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          title?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
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
          workspace_id: string
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
          workspace_id?: string
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
          workspace_id?: string
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
          {
            foreignKeyName: "credit_ledger_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
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
          workspace_id?: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_limits_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_limits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_derivation_backup: {
        Row: {
          captured_at: string
          entity: string
          record_id: string
          run_key: string
          snapshot: Json
          workspace_id: string
        }
        Insert: {
          captured_at?: string
          entity: string
          record_id: string
          run_key: string
          snapshot: Json
          workspace_id: string
        }
        Update: {
          captured_at?: string
          entity?: string
          record_id?: string
          run_key?: string
          snapshot?: Json
          workspace_id?: string
        }
        Relationships: []
      }
      crm_derivation_catalog: {
        Row: {
          active: boolean
          created_at: string
          rules: Json
          version: number
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          rules: Json
          version: number
          workspace_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          rules?: Json
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_derivation_catalog_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_run_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error: string | null
          finished_at: string | null
          id: string
          job_name: string
          metrics: Json
          started_at: string
          status: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name: string
          metrics?: Json
          started_at?: string
          status?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name?: string
          metrics?: Json
          started_at?: string
          status?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      custom_object_records: {
        Row: {
          assigned_to: string | null
          created_at: string
          data: Json
          id: string
          object_id: string
          owner_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          data?: Json
          id?: string
          object_id: string
          owner_id: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          data?: Json
          id?: string
          object_id?: string
          owner_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_object_records_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "custom_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_object_records_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_objects: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          owner_id: string
          schema: Json
          slug: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          owner_id: string
          schema?: Json
          slug: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          owner_id?: string
          schema?: Json
          slug?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_objects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_properties: {
        Row: {
          ai_prompt: string | null
          created_at: string
          enabled: boolean
          entity: string
          group_name: string | null
          id: string
          key: string
          label: string
          options: Json
          owner_id: string
          position: number
          required: boolean
          type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ai_prompt?: string | null
          created_at?: string
          enabled?: boolean
          entity: string
          group_name?: string | null
          id?: string
          key: string
          label: string
          options?: Json
          owner_id?: string
          position?: number
          required?: boolean
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          ai_prompt?: string | null
          created_at?: string
          enabled?: boolean
          entity?: string
          group_name?: string | null
          id?: string
          key?: string
          label?: string
          options?: Json
          owner_id?: string
          position?: number
          required?: boolean
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_properties_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_reports: {
        Row: {
          assigned_to: string | null
          config: Json
          created_at: string
          description: string | null
          entity: string
          id: string
          is_favorite: boolean
          name: string
          owner_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          config?: Json
          created_at?: string
          description?: string | null
          entity: string
          id?: string
          is_favorite?: boolean
          name: string
          owner_id: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          assigned_to?: string | null
          config?: Json
          created_at?: string
          description?: string | null
          entity?: string
          id?: string
          is_favorite?: boolean
          name?: string
          owner_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_reports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_invoices: {
        Row: {
          amount: number
          assigned_to: string | null
          barcode: string | null
          cancelled_at: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          currency: string
          deal_id: string | null
          description: string | null
          due_date: string
          external_id: string | null
          gateway: string | null
          gateway_mode: string | null
          id: string
          invoice_number: string
          issued_at: string
          legal_entity_id: string | null
          metadata: Json
          owner_id: string
          paid_at: string | null
          payment_method: string | null
          payment_url: string | null
          pix_copy_paste: string | null
          pix_qr_code: string | null
          quote_id: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount?: number
          assigned_to?: string | null
          barcode?: string | null
          cancelled_at?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          description?: string | null
          due_date: string
          external_id?: string | null
          gateway?: string | null
          gateway_mode?: string | null
          id?: string
          invoice_number: string
          issued_at?: string
          legal_entity_id?: string | null
          metadata?: Json
          owner_id: string
          paid_at?: string | null
          payment_method?: string | null
          payment_url?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          quote_id?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          assigned_to?: string | null
          barcode?: string | null
          cancelled_at?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string
          external_id?: string | null
          gateway?: string | null
          gateway_mode?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string
          legal_entity_id?: string | null
          metadata?: Json
          owner_id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_url?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          quote_id?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payments: {
        Row: {
          amount: number
          assigned_to: string | null
          created_at: string
          currency: string
          external_payment_id: string | null
          gateway: string
          id: string
          invoice_id: string | null
          method: string | null
          raw: Json
          received_at: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          assigned_to?: string | null
          created_at?: string
          currency?: string
          external_payment_id?: string | null
          gateway: string
          id?: string
          invoice_id?: string | null
          method?: string | null
          raw?: Json
          received_at?: string | null
          status: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          assigned_to?: string | null
          created_at?: string
          currency?: string
          external_payment_id?: string | null
          gateway?: string
          id?: string
          invoice_id?: string | null
          method?: string | null
          raw?: Json
          received_at?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_widgets: {
        Row: {
          config: Json
          created_at: string
          dashboard_id: string
          height: number
          id: string
          owner_id: string
          position: number
          report_id: string | null
          title: string
          updated_at: string
          widget_type: string
          width: number
          workspace_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          dashboard_id: string
          height?: number
          id?: string
          owner_id: string
          position?: number
          report_id?: string | null
          title: string
          updated_at?: string
          widget_type?: string
          width?: number
          workspace_id?: string
        }
        Update: {
          config?: Json
          created_at?: string
          dashboard_id?: string
          height?: number
          id?: string
          owner_id?: string
          position?: number
          report_id?: string | null
          title?: string
          updated_at?: string
          widget_type?: string
          width?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_widgets_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_widgets_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "custom_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_widgets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboards: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          is_favorite: boolean
          name: string
          owner_id: string
          position: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          is_favorite?: boolean
          name: string
          owner_id: string
          position?: number
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          is_favorite?: boolean
          name?: string
          owner_id?: string
          position?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
            foreignKeyName: "deal_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_contacts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_contacts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_delivery_events: {
        Row: {
          actor: string | null
          after: Json | null
          batch_id: string | null
          before: Json | null
          created_at: string
          deal_id: string | null
          id: string
          job_id: string | null
          kind: string
          needs_review: boolean
          note: string | null
          origin: string | null
          project_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          reverted_at: string | null
          reverted_by: string | null
          workspace_id: string
        }
        Insert: {
          actor?: string | null
          after?: Json | null
          batch_id?: string | null
          before?: Json | null
          created_at?: string
          deal_id?: string | null
          id?: string
          job_id?: string | null
          kind: string
          needs_review?: boolean
          note?: string | null
          origin?: string | null
          project_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
          workspace_id: string
        }
        Update: {
          actor?: string | null
          after?: Json | null
          batch_id?: string | null
          before?: Json | null
          created_at?: string
          deal_id?: string | null
          id?: string
          job_id?: string | null
          kind?: string
          needs_review?: boolean
          note?: string | null
          origin?: string | null
          project_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_delivery_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_delivery_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_delivery_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "deal_delivery_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_delivery_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_delivery_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_delivery_items: {
        Row: {
          deal_id: string
          group_key: string
          group_label: string | null
          line_item_id: string
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          deal_id: string
          group_key: string
          group_label?: string | null
          line_item_id: string
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          deal_id?: string
          group_key?: string
          group_label?: string | null
          line_item_id?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_delivery_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_delivery_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_delivery_items_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: true
            referencedRelation: "deal_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_delivery_items_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: true
            referencedRelation: "shared_fields_deal_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_delivery_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_delivery_jobs: {
        Row: {
          actor: string | null
          attempts: number
          created_at: string
          deal_id: string
          finished_at: string | null
          id: string
          last_error: string | null
          lease_token: string | null
          lease_until: string | null
          max_attempts: number
          next_run_at: string
          origin: string
          result: Json | null
          skip_reason: string | null
          status: string
          transition_key: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          actor?: string | null
          attempts?: number
          created_at?: string
          deal_id: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          lease_token?: string | null
          lease_until?: string | null
          max_attempts?: number
          next_run_at?: string
          origin: string
          result?: Json | null
          skip_reason?: string | null
          status?: string
          transition_key: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          actor?: string | null
          attempts?: number
          created_at?: string
          deal_id?: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          lease_token?: string | null
          lease_until?: string | null
          max_attempts?: number
          next_run_at?: string
          origin?: string
          result?: Json | null
          skip_reason?: string | null
          status?: string
          transition_key?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_delivery_jobs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_delivery_jobs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_delivery_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_delivery_policies: {
        Row: {
          activated_at: string | null
          allow_groups: boolean
          created_at: string
          created_by: string | null
          default_operational_owner_id: string | null
          enabled: boolean
          origins: Json
          project_creator_id: string | null
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          activated_at?: string | null
          allow_groups?: boolean
          created_at?: string
          created_by?: string | null
          default_operational_owner_id?: string | null
          enabled?: boolean
          origins?: Json
          project_creator_id?: string | null
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          activated_at?: string | null
          allow_groups?: boolean
          created_at?: string
          created_by?: string | null
          default_operational_owner_id?: string | null
          enabled?: boolean
          origins?: Json
          project_creator_id?: string | null
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_delivery_policies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_delivery_worker_state: {
        Row: {
          id: number
          last_processed: number
          last_run_at: string | null
          last_work_at: string | null
          runs: number
        }
        Insert: {
          id?: number
          last_processed?: number
          last_run_at?: string | null
          last_work_at?: string | null
          runs?: number
        }
        Update: {
          id?: number
          last_processed?: number
          last_run_at?: string | null
          last_work_at?: string | null
          runs?: number
        }
        Relationships: []
      }
      deal_line_items: {
        Row: {
          billing_model: Database["public"]["Enums"]["billing_model"] | null
          cadence: string | null
          contracting_preset_id: string | null
          created_at: string
          deal_id: string
          description: string | null
          discount_amount: number
          discount_pct: number
          discount_type: string
          id: string
          job_profile_id: string | null
          name: string
          owner_id: string
          percent: number | null
          percent_base_amount: number | null
          position: number
          quantity: number
          seniority: string | null
          service_catalog_id: string | null
          tax_rate: number
          unit: string | null
          unit_price: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          billing_model?: Database["public"]["Enums"]["billing_model"] | null
          cadence?: string | null
          contracting_preset_id?: string | null
          created_at?: string
          deal_id: string
          description?: string | null
          discount_amount?: number
          discount_pct?: number
          discount_type?: string
          id?: string
          job_profile_id?: string | null
          name: string
          owner_id: string
          percent?: number | null
          percent_base_amount?: number | null
          position?: number
          quantity?: number
          seniority?: string | null
          service_catalog_id?: string | null
          tax_rate?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          billing_model?: Database["public"]["Enums"]["billing_model"] | null
          cadence?: string | null
          contracting_preset_id?: string | null
          created_at?: string
          deal_id?: string
          description?: string | null
          discount_amount?: number
          discount_pct?: number
          discount_type?: string
          id?: string
          job_profile_id?: string | null
          name?: string
          owner_id?: string
          percent?: number | null
          percent_base_amount?: number | null
          position?: number
          quantity?: number
          seniority?: string | null
          service_catalog_id?: string | null
          tax_rate?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_line_items_contracting_preset_id_fkey"
            columns: ["contracting_preset_id"]
            isOneToOne: false
            referencedRelation: "contracting_presets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_line_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_line_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_line_items_job_profile_id_fkey"
            columns: ["job_profile_id"]
            isOneToOne: false
            referencedRelation: "job_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_line_items_service_catalog_id_fkey"
            columns: ["service_catalog_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_line_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_loss_reasons: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          hubspot_synced_at: string | null
          id: string
          is_active: boolean
          label: string
          owner_id: string
          sort_order: number
          source: string
          updated_at: string
          value: string
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          hubspot_synced_at?: string | null
          id?: string
          is_active?: boolean
          label: string
          owner_id: string
          sort_order?: number
          source?: string
          updated_at?: string
          value: string
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          hubspot_synced_at?: string | null
          id?: string
          is_active?: boolean
          label?: string
          owner_id?: string
          sort_order?: number
          source?: string
          updated_at?: string
          value?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      deal_role_profile_attachments: {
        Row: {
          created_at: string
          deleted_at: string | null
          filename: string
          id: string
          mime: string
          profile_id: string
          size_bytes: number
          storage_path: string
          uploaded_by: string | null
          uploaded_by_kind: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          filename: string
          id?: string
          mime: string
          profile_id: string
          size_bytes: number
          storage_path: string
          uploaded_by?: string | null
          uploaded_by_kind?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          filename?: string
          id?: string
          mime?: string
          profile_id?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string | null
          uploaded_by_kind?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_role_profile_attachments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "deal_role_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_role_profile_attachments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_role_profile_client_proposals: {
        Row: {
          base_revision: number
          confirmed: boolean
          created_at: string
          id: string
          link_id: string
          payload: Json
          profile_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          base_revision: number
          confirmed?: boolean
          created_at?: string
          id?: string
          link_id: string
          payload: Json
          profile_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          base_revision?: number
          confirmed?: boolean
          created_at?: string
          id?: string
          link_id?: string
          payload?: Json
          profile_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_role_profile_client_proposals_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "deal_role_profile_share_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_role_profile_client_proposals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "deal_role_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_role_profile_client_proposals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_role_profile_commercial: {
        Row: {
          data: Json
          profile_id: string
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          data?: Json
          profile_id: string
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          data?: Json
          profile_id?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_role_profile_commercial_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "deal_role_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_role_profile_commercial_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_role_profile_events: {
        Row: {
          actor_id: string | null
          actor_kind: string
          created_at: string
          details: Json
          from_status: string | null
          id: string
          kind: string
          profile_id: string
          reason: string | null
          to_status: string | null
          version: number | null
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_kind?: string
          created_at?: string
          details?: Json
          from_status?: string | null
          id?: string
          kind: string
          profile_id: string
          reason?: string | null
          to_status?: string | null
          version?: number | null
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          actor_kind?: string
          created_at?: string
          details?: Json
          from_status?: string | null
          id?: string
          kind?: string
          profile_id?: string
          reason?: string | null
          to_status?: string | null
          version?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_role_profile_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "deal_role_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_role_profile_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_role_profile_handoffs: {
        Row: {
          ats_job_id: string | null
          authorized_by: string | null
          created_at: string
          created_by: string
          early: boolean
          early_reason: string | null
          id: string
          last_synced_at: string
          last_synced_version: number
          profile_id: string
          version_id: string
          workspace_id: string
        }
        Insert: {
          ats_job_id?: string | null
          authorized_by?: string | null
          created_at?: string
          created_by: string
          early?: boolean
          early_reason?: string | null
          id?: string
          last_synced_at?: string
          last_synced_version: number
          profile_id: string
          version_id: string
          workspace_id: string
        }
        Update: {
          ats_job_id?: string | null
          authorized_by?: string | null
          created_at?: string
          created_by?: string
          early?: boolean
          early_reason?: string | null
          id?: string
          last_synced_at?: string
          last_synced_version?: number
          profile_id?: string
          version_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_role_profile_handoffs_ats_job_id_fkey"
            columns: ["ats_job_id"]
            isOneToOne: false
            referencedRelation: "ats_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_role_profile_handoffs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "deal_role_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_role_profile_handoffs_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "deal_role_profile_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_role_profile_handoffs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_role_profile_imports: {
        Row: {
          content_hash: string
          created_at: string
          created_by: string
          deal_id: string
          error: string | null
          id: string
          profile_id: string | null
          result: Json | null
          source_kind: string
          source_name: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          created_by: string
          deal_id: string
          error?: string | null
          id?: string
          profile_id?: string | null
          result?: Json | null
          source_kind: string
          source_name?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          created_by?: string
          deal_id?: string
          error?: string | null
          id?: string
          profile_id?: string | null
          result?: Json | null
          source_kind?: string
          source_name?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_role_profile_imports_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_role_profile_imports_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_role_profile_imports_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "deal_role_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_role_profile_imports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_role_profile_share_links: {
        Row: {
          allowed_fields: string[]
          base_revision: number
          created_at: string
          created_by: string
          expires_at: string
          id: string
          last_access_at: string | null
          max_reads: number
          max_writes: number
          profile_id: string
          read_count: number
          revoked_at: string | null
          token_hash: string
          workspace_id: string
          write_count: number
        }
        Insert: {
          allowed_fields?: string[]
          base_revision: number
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          last_access_at?: string | null
          max_reads?: number
          max_writes?: number
          profile_id: string
          read_count?: number
          revoked_at?: string | null
          token_hash: string
          workspace_id: string
          write_count?: number
        }
        Update: {
          allowed_fields?: string[]
          base_revision?: number
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          last_access_at?: string | null
          max_reads?: number
          max_writes?: number
          profile_id?: string
          read_count?: number
          revoked_at?: string | null
          token_hash?: string
          workspace_id?: string
          write_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_role_profile_share_links_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "deal_role_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_role_profile_share_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_role_profile_templates: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string
          id: string
          modality: string
          name: string
          payload: Json
          seniority: string | null
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          modality: string
          name: string
          payload: Json
          seniority?: string | null
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          modality?: string
          name?: string
          payload?: Json
          seniority?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_role_profile_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_role_profile_versions: {
        Row: {
          approved_at: string
          approved_by: string
          commercial_snapshot: Json | null
          id: string
          profile_id: string
          snapshot: Json
          version: number
          workspace_id: string
        }
        Insert: {
          approved_at?: string
          approved_by: string
          commercial_snapshot?: Json | null
          id?: string
          profile_id: string
          snapshot: Json
          version: number
          workspace_id: string
        }
        Update: {
          approved_at?: string
          approved_by?: string
          commercial_snapshot?: Json | null
          id?: string
          profile_id?: string
          snapshot?: Json
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_role_profile_versions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "deal_role_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_role_profile_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_role_profiles: {
        Row: {
          approved_version_id: string | null
          archived_at: string | null
          assigned_to: string | null
          ats_job_id: string | null
          ats_synced_version: number | null
          company_id: string | null
          contact_id: string | null
          contracting_preset_id: string | null
          created_at: string
          created_by: string
          data: Json
          deal_id: string
          id: string
          job_profile_id: string | null
          last_version: number
          modality: string
          priority: string
          quantity: number
          revision: number
          seniority: string | null
          source_line_item_id: string | null
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          approved_version_id?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          ats_job_id?: string | null
          ats_synced_version?: number | null
          company_id?: string | null
          contact_id?: string | null
          contracting_preset_id?: string | null
          created_at?: string
          created_by: string
          data?: Json
          deal_id: string
          id?: string
          job_profile_id?: string | null
          last_version?: number
          modality?: string
          priority?: string
          quantity?: number
          revision?: number
          seniority?: string | null
          source_line_item_id?: string | null
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          approved_version_id?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          ats_job_id?: string | null
          ats_synced_version?: number | null
          company_id?: string | null
          contact_id?: string | null
          contracting_preset_id?: string | null
          created_at?: string
          created_by?: string
          data?: Json
          deal_id?: string
          id?: string
          job_profile_id?: string | null
          last_version?: number
          modality?: string
          priority?: string
          quantity?: number
          revision?: number
          seniority?: string | null
          source_line_item_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_role_profiles_approved_version_fk"
            columns: ["approved_version_id"]
            isOneToOne: false
            referencedRelation: "deal_role_profile_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_role_profiles_ats_job_id_fkey"
            columns: ["ats_job_id"]
            isOneToOne: false
            referencedRelation: "ats_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_role_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_role_profiles_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_role_profiles_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_role_profiles_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_role_profiles_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_role_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          assigned_to: string | null
          assigned_user_id: string | null
          closed_at: string | null
          closed_lost_reason: string | null
          closed_won_reason: string | null
          company_id: string | null
          created_at: string
          currency: string
          custom_fields: Json
          dealtype: string | null
          deleted_at: string | null
          description: string | null
          expected_close_date: string | null
          external_ids: Json
          hs_createdate: string | null
          hs_deal_stage_probability: number | null
          hs_lastmodifieddate: string | null
          hs_object_id: string | null
          hs_priority: string | null
          hs_raw: Json | null
          hubspot_owner_id: string | null
          id: string
          lead_id: string | null
          lost_at: string | null
          name: string
          notes: string | null
          num_associated_contacts: number | null
          owner_id: string
          pipeline_id: string | null
          primary_contact_id: string | null
          service_line: string | null
          source: string | null
          stage: Database["public"]["Enums"]["deal_stage"]
          stage_id: string | null
          stage_substatus_id: string | null
          updated_at: string
          value: number
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          assigned_user_id?: string | null
          closed_at?: string | null
          closed_lost_reason?: string | null
          closed_won_reason?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          custom_fields?: Json
          dealtype?: string | null
          deleted_at?: string | null
          description?: string | null
          expected_close_date?: string | null
          external_ids?: Json
          hs_createdate?: string | null
          hs_deal_stage_probability?: number | null
          hs_lastmodifieddate?: string | null
          hs_object_id?: string | null
          hs_priority?: string | null
          hs_raw?: Json | null
          hubspot_owner_id?: string | null
          id?: string
          lead_id?: string | null
          lost_at?: string | null
          name: string
          notes?: string | null
          num_associated_contacts?: number | null
          owner_id: string
          pipeline_id?: string | null
          primary_contact_id?: string | null
          service_line?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          stage_id?: string | null
          stage_substatus_id?: string | null
          updated_at?: string
          value?: number
          workspace_id?: string
        }
        Update: {
          assigned_to?: string | null
          assigned_user_id?: string | null
          closed_at?: string | null
          closed_lost_reason?: string | null
          closed_won_reason?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          custom_fields?: Json
          dealtype?: string | null
          deleted_at?: string | null
          description?: string | null
          expected_close_date?: string | null
          external_ids?: Json
          hs_createdate?: string | null
          hs_deal_stage_probability?: number | null
          hs_lastmodifieddate?: string | null
          hs_object_id?: string | null
          hs_priority?: string | null
          hs_raw?: Json | null
          hubspot_owner_id?: string | null
          id?: string
          lead_id?: string | null
          lost_at?: string | null
          name?: string
          notes?: string | null
          num_associated_contacts?: number | null
          owner_id?: string
          pipeline_id?: string | null
          primary_contact_id?: string | null
          service_line?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          stage_id?: string | null
          stage_substatus_id?: string | null
          updated_at?: string
          value?: number
          workspace_id?: string
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
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_substatus_id_fkey"
            columns: ["stage_substatus_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stage_substatuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_events: {
        Row: {
          attempts: number
          created_at: string
          dedupe_key: string | null
          entity_id: string | null
          entity_type: string | null
          event_name: string
          id: string
          last_error: string | null
          occurred_at: string
          owner_id: string
          payload: Json
          processed_at: string | null
          source: string
          workspace_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          dedupe_key?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_name: string
          id?: string
          last_error?: string | null
          occurred_at?: string
          owner_id: string
          payload?: Json
          processed_at?: string | null
          source?: string
          workspace_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          dedupe_key?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_name?: string
          id?: string
          last_error?: string | null
          occurred_at?: string
          owner_id?: string
          payload?: Json
          processed_at?: string | null
          source?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      dunning_policies: {
        Row: {
          active: boolean
          created_at: string
          id: string
          is_default: boolean
          name: string
          owner_id: string
          segment_id: string | null
          steps: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          owner_id: string
          segment_id?: string | null
          steps?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          owner_id?: string
          segment_id?: string | null
          steps?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dunning_policies_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dunning_policies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dunning_runs: {
        Row: {
          created_at: string
          current_step: number
          history: Json
          id: string
          invoice_id: string
          next_run_at: string | null
          policy_id: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          current_step?: number
          history?: Json
          id?: string
          invoice_id: string
          next_run_at?: string | null
          policy_id: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          current_step?: number
          history?: Json
          id?: string
          invoice_id?: string
          next_run_at?: string | null
          policy_id?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dunning_runs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dunning_runs_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "dunning_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dunning_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          access_token: string | null
          created_at: string
          email: string
          expires_at: string | null
          history_id: string | null
          id: string
          last_error: string | null
          last_sync_at: string | null
          owner_id: string
          provider: string
          refresh_token: string | null
          scopes: string[]
          signature_html: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          email: string
          expires_at?: string | null
          history_id?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          owner_id: string
          provider?: string
          refresh_token?: string | null
          scopes?: string[]
          signature_html?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          email?: string
          expires_at?: string | null
          history_id?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          owner_id?: string
          provider?: string
          refresh_token?: string | null
          scopes?: string[]
          signature_html?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_broadcast_recipients: {
        Row: {
          broadcast_id: string
          contact_id: string | null
          created_at: string
          email: string
          error: string | null
          id: string
          lead_id: string | null
          name: string | null
          override_recent: boolean
          owner_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["email_broadcast_recipient_status"]
          variables: Json
          workspace_id: string
        }
        Insert: {
          broadcast_id: string
          contact_id?: string | null
          created_at?: string
          email: string
          error?: string | null
          id?: string
          lead_id?: string | null
          name?: string | null
          override_recent?: boolean
          owner_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_broadcast_recipient_status"]
          variables?: Json
          workspace_id?: string
        }
        Update: {
          broadcast_id?: string
          contact_id?: string | null
          created_at?: string
          email?: string
          error?: string | null
          id?: string
          lead_id?: string | null
          name?: string | null
          override_recent?: boolean
          owner_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_broadcast_recipient_status"]
          variables?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_broadcast_recipients_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "email_broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_broadcast_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_broadcast_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_broadcast_recipients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_broadcast_recipients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_broadcast_recipients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_broadcasts: {
        Row: {
          assigned_to: string | null
          body_html: string | null
          body_text: string | null
          created_at: string
          email_account_id: string | null
          failed: number
          finished_at: string | null
          id: string
          last_error: string | null
          name: string
          owner_id: string
          rate_per_minute: number
          recent_contact_days: number
          reply_to: string | null
          scheduled_at: string
          segment_id: string | null
          sent: number
          started_at: string | null
          status: Database["public"]["Enums"]["email_broadcast_status"]
          subject: string
          template_id: string | null
          total: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          email_account_id?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          last_error?: string | null
          name: string
          owner_id?: string
          rate_per_minute?: number
          recent_contact_days?: number
          reply_to?: string | null
          scheduled_at?: string
          segment_id?: string | null
          sent?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["email_broadcast_status"]
          subject: string
          template_id?: string | null
          total?: number
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          assigned_to?: string | null
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          email_account_id?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          last_error?: string | null
          name?: string
          owner_id?: string
          rate_per_minute?: number
          recent_contact_days?: number
          reply_to?: string | null
          scheduled_at?: string
          segment_id?: string | null
          sent?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["email_broadcast_status"]
          subject?: string
          template_id?: string | null
          total?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_broadcasts_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_broadcasts_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_broadcasts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_broadcasts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          account_id: string
          attachments: Json | null
          bcc_emails: string[]
          body_html: string | null
          body_text: string | null
          cc_emails: string[]
          click_count: number
          created_at: string
          direction: string
          first_opened_at: string | null
          from_email: string | null
          from_name: string | null
          has_attachments: boolean
          headers: Json | null
          id: string
          in_reply_to: string | null
          message_id_header: string | null
          open_count: number
          owner_id: string
          provider_message_id: string
          received_at: string | null
          sent_at: string | null
          snippet: string | null
          subject: string | null
          thread_id: string | null
          to_emails: string[]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id: string
          attachments?: Json | null
          bcc_emails?: string[]
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[]
          click_count?: number
          created_at?: string
          direction: string
          first_opened_at?: string | null
          from_email?: string | null
          from_name?: string | null
          has_attachments?: boolean
          headers?: Json | null
          id?: string
          in_reply_to?: string | null
          message_id_header?: string | null
          open_count?: number
          owner_id: string
          provider_message_id: string
          received_at?: string | null
          sent_at?: string | null
          snippet?: string | null
          subject?: string | null
          thread_id?: string | null
          to_emails?: string[]
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          account_id?: string
          attachments?: Json | null
          bcc_emails?: string[]
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[]
          click_count?: number
          created_at?: string
          direction?: string
          first_opened_at?: string | null
          from_email?: string | null
          from_name?: string | null
          has_attachments?: boolean
          headers?: Json | null
          id?: string
          in_reply_to?: string | null
          message_id_header?: string | null
          open_count?: number
          owner_id?: string
          provider_message_id?: string
          received_at?: string | null
          sent_at?: string | null
          snippet?: string | null
          subject?: string | null
          thread_id?: string | null
          to_emails?: string[]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_snippets: {
        Row: {
          body: string
          created_at: string
          id: string
          owner_id: string
          shortcut: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          owner_id?: string
          shortcut: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          owner_id?: string
          shortcut?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_snippets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string | null
          body_text: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          subject: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          subject?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          subject?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_threads: {
        Row: {
          account_id: string
          assigned_to: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          id: string
          identity_status: string
          last_message_at: string | null
          lead_id: string | null
          message_count: number
          owner_id: string
          provider_thread_id: string
          snippet: string | null
          subject: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id: string
          assigned_to?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          identity_status?: string
          last_message_at?: string | null
          lead_id?: string | null
          message_count?: number
          owner_id: string
          provider_thread_id: string
          snippet?: string | null
          subject?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          account_id?: string
          assigned_to?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          identity_status?: string
          last_message_at?: string | null
          lead_id?: string | null
          message_count?: number
          owner_id?: string
          provider_thread_id?: string
          snippet?: string | null
          subject?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_threads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_tracking_events: {
        Row: {
          event_type: string
          id: string
          ip: string | null
          message_id: string
          occurred_at: string
          owner_id: string
          url: string | null
          user_agent: string | null
          workspace_id: string
        }
        Insert: {
          event_type: string
          id?: string
          ip?: string | null
          message_id: string
          occurred_at?: string
          owner_id: string
          url?: string | null
          user_agent?: string | null
          workspace_id?: string
        }
        Update: {
          event_type?: string
          id?: string
          ip?: string | null
          message_id?: string
          occurred_at?: string
          owner_id?: string
          url?: string | null
          user_agent?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_tracking_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "email_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_tracking_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      email_unsubscribes: {
        Row: {
          created_at: string
          email: string
          id: string
          owner_id: string
          reason: string | null
          token: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          owner_id: string
          reason?: string | null
          token?: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          owner_id?: string
          reason?: string | null
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_unsubscribes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          assigned_to: string | null
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
          step_logs: Json
          succeeded: number
          total: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
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
          step_logs?: Json
          succeeded?: number
          total?: number
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          assigned_to?: string | null
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
          step_logs?: Json
          succeeded?: number
          total?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_jobs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      esign_attachments: {
        Row: {
          created_at: string
          document_id: string
          file_name: string
          file_url: string
          id: string
          mime_type: string | null
          owner_id: string
          sha256: string | null
          size_bytes: number | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          file_name: string
          file_url: string
          id?: string
          mime_type?: string | null
          owner_id: string
          sha256?: string | null
          size_bytes?: number | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          file_name?: string
          file_url?: string
          id?: string
          mime_type?: string | null
          owner_id?: string
          sha256?: string | null
          size_bytes?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "esign_attachments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "esign_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esign_attachments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      esign_audit: {
        Row: {
          created_at: string
          document_id: string
          event: string
          id: string
          ip_address: string | null
          metadata: Json | null
          owner_id: string
          signer_id: string | null
          user_agent: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          event: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          owner_id: string
          signer_id?: string | null
          user_agent?: string | null
          workspace_id?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          event?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          owner_id?: string
          signer_id?: string | null
          user_agent?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "esign_audit_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "esign_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esign_audit_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "esign_signers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esign_audit_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      esign_documents: {
        Row: {
          body: string
          completed_at: string | null
          contact_id: string | null
          content_hash: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          expires_at: string | null
          id: string
          ordered: boolean
          owner_id: string
          sealed_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["esign_doc_status"]
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          body?: string
          completed_at?: string | null
          contact_id?: string | null
          content_hash?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          ordered?: boolean
          owner_id: string
          sealed_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["esign_doc_status"]
          title: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          body?: string
          completed_at?: string | null
          contact_id?: string | null
          content_hash?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          ordered?: boolean
          owner_id?: string
          sealed_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["esign_doc_status"]
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "esign_documents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esign_documents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esign_documents_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esign_documents_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esign_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      esign_signers: {
        Row: {
          created_at: string
          decline_reason: string | null
          declined_at: string | null
          document_id: string
          email: string
          id: string
          ip_address: string | null
          name: string
          owner_id: string
          public_token: string
          sign_order: number
          signature_data: string | null
          signed_at: string | null
          signed_name: string | null
          status: Database["public"]["Enums"]["esign_signer_status"]
          user_agent: string | null
          viewed_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          document_id: string
          email: string
          id?: string
          ip_address?: string | null
          name: string
          owner_id: string
          public_token?: string
          sign_order?: number
          signature_data?: string | null
          signed_at?: string | null
          signed_name?: string | null
          status?: Database["public"]["Enums"]["esign_signer_status"]
          user_agent?: string | null
          viewed_at?: string | null
          workspace_id?: string
        }
        Update: {
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          document_id?: string
          email?: string
          id?: string
          ip_address?: string | null
          name?: string
          owner_id?: string
          public_token?: string
          sign_order?: number
          signature_data?: string | null
          signed_at?: string | null
          signed_name?: string | null
          status?: Database["public"]["Enums"]["esign_signer_status"]
          user_agent?: string | null
          viewed_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "esign_signers_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "esign_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esign_signers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          key: string
          metadata: Json
          owner_id: string
          rollout_percentage: number
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          metadata?: Json
          owner_id: string
          rollout_percentage?: number
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          metadata?: Json
          owner_id?: string
          rollout_percentage?: number
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      field_permission_rules: {
        Row: {
          created_at: string
          field: string
          id: string
          is_system: boolean
          mode: Database["public"]["Enums"]["field_mode"]
          owner_id: string | null
          resource: string
          role_id: string | null
          set_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          field: string
          id?: string
          is_system?: boolean
          mode: Database["public"]["Enums"]["field_mode"]
          owner_id?: string | null
          resource: string
          role_id?: string | null
          set_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          field?: string
          id?: string
          is_system?: boolean
          mode?: Database["public"]["Enums"]["field_mode"]
          owner_id?: string | null
          resource?: string
          role_id?: string | null
          set_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_permission_rules_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_permission_rules_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "permission_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_permission_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_dunning_attempts: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          result: Json | null
          run_id: string
          status: string
          step: number
          token: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          result?: Json | null
          run_id: string
          status?: string
          step: number
          token?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          result?: Json | null
          run_id?: string
          status?: string
          step?: number
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_dunning_attempts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "dunning_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_dunning_attempts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_invoice_sequences: {
        Row: {
          value: number
          workspace_id: string
          year: number
        }
        Insert: {
          value: number
          workspace_id: string
          year: number
        }
        Update: {
          value?: number
          workspace_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_invoice_sequences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_bank_accounts: {
        Row: {
          active: boolean
          bank_connection_id: string | null
          created_at: string
          currency: string
          external_account_id: string | null
          id: string
          initial_balance: number
          kind: string
          legal_entity_id: string | null
          metadata: Json
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          bank_connection_id?: string | null
          created_at?: string
          currency?: string
          external_account_id?: string | null
          id?: string
          initial_balance?: number
          kind?: string
          legal_entity_id?: string | null
          metadata?: Json
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          bank_connection_id?: string | null
          created_at?: string
          currency?: string
          external_account_id?: string | null
          id?: string
          initial_balance?: number
          kind?: string
          legal_entity_id?: string | null
          metadata?: Json
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_bank_accounts_bank_connection_id_fkey"
            columns: ["bank_connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_bank_accounts_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_bank_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          code: string | null
          created_at: string
          external_ids: Json
          id: string
          kind: Database["public"]["Enums"]["financial_category_kind"]
          legal_entity_id: string | null
          name: string
          parent_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          external_ids?: Json
          id?: string
          kind: Database["public"]["Enums"]["financial_category_kind"]
          legal_entity_id?: string | null
          name: string
          parent_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          code?: string | null
          created_at?: string
          external_ids?: Json
          id?: string
          kind?: Database["public"]["Enums"]["financial_category_kind"]
          legal_entity_id?: string | null
          name?: string
          parent_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_cost_centers: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          external_ids: Json
          id: string
          legal_entity_id: string | null
          metadata: Json
          name: string
          parent_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          external_ids?: Json
          id?: string
          legal_entity_id?: string | null
          metadata?: Json
          name: string
          parent_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          external_ids?: Json
          id?: string
          legal_entity_id?: string | null
          metadata?: Json
          name?: string
          parent_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_cost_centers_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "financial_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_cost_centers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entries: {
        Row: {
          amount: number
          assigned_to: string | null
          attachments: Json
          category_id: string | null
          competence_date: string
          contract_id: string | null
          counterparty_company_id: string | null
          counterparty_legal_entity_id: string | null
          created_at: string
          currency: string
          description: string
          direction: Database["public"]["Enums"]["financial_direction"]
          due_date: string
          external_ref: string | null
          id: string
          installment_number: number | null
          installment_total: number | null
          legal_entity_id: string | null
          metadata: Json
          notes: string | null
          origin_id: string | null
          origin_type: Database["public"]["Enums"]["financial_origin_type"]
          owner_id: string
          paid_amount: number
          parent_entry_id: string | null
          payment_method: string | null
          project_id: string | null
          service_id: string | null
          status: Database["public"]["Enums"]["financial_entry_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          assigned_to?: string | null
          attachments?: Json
          category_id?: string | null
          competence_date: string
          contract_id?: string | null
          counterparty_company_id?: string | null
          counterparty_legal_entity_id?: string | null
          created_at?: string
          currency?: string
          description: string
          direction: Database["public"]["Enums"]["financial_direction"]
          due_date: string
          external_ref?: string | null
          id?: string
          installment_number?: number | null
          installment_total?: number | null
          legal_entity_id?: string | null
          metadata?: Json
          notes?: string | null
          origin_id?: string | null
          origin_type?: Database["public"]["Enums"]["financial_origin_type"]
          owner_id: string
          paid_amount?: number
          parent_entry_id?: string | null
          payment_method?: string | null
          project_id?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["financial_entry_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          assigned_to?: string | null
          attachments?: Json
          category_id?: string | null
          competence_date?: string
          contract_id?: string | null
          counterparty_company_id?: string | null
          counterparty_legal_entity_id?: string | null
          created_at?: string
          currency?: string
          description?: string
          direction?: Database["public"]["Enums"]["financial_direction"]
          due_date?: string
          external_ref?: string | null
          id?: string
          installment_number?: number | null
          installment_total?: number | null
          legal_entity_id?: string | null
          metadata?: Json
          notes?: string | null
          origin_id?: string | null
          origin_type?: Database["public"]["Enums"]["financial_origin_type"]
          owner_id?: string
          paid_amount?: number
          parent_entry_id?: string | null
          payment_method?: string | null
          project_id?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["financial_entry_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_counterparty_company_id_fkey"
            columns: ["counterparty_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_counterparty_legal_entity_id_fkey"
            columns: ["counterparty_legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_parent_entry_id_fkey"
            columns: ["parent_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entry_allocations: {
        Row: {
          amount: number
          cost_center_id: string
          created_at: string
          entry_id: string
          id: string
        }
        Insert: {
          amount: number
          cost_center_id: string
          created_at?: string
          entry_id: string
          id?: string
        }
        Update: {
          amount?: number
          cost_center_id?: string
          created_at?: string
          entry_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_entry_allocations_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "financial_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entry_allocations_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          entry_id: string
          id: string
          method: string | null
          notes: string | null
          paid_at: string
          reference: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_id: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_at: string
          reference?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_id?: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string
          reference?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "financial_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_payments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_recurrences: {
        Row: {
          active: boolean
          assigned_to: string | null
          cadence: string
          created_at: string
          day_of_month: number | null
          direction: string
          end_date: string | null
          id: string
          interval_days: number | null
          last_generated_entry_id: string | null
          max_occurrences: number | null
          next_run_date: string
          occurrences_generated: number
          owner_id: string
          start_date: string
          template: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          assigned_to?: string | null
          cadence: string
          created_at?: string
          day_of_month?: number | null
          direction: string
          end_date?: string | null
          id?: string
          interval_days?: number | null
          last_generated_entry_id?: string | null
          max_occurrences?: number | null
          next_run_date: string
          occurrences_generated?: number
          owner_id: string
          start_date: string
          template?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          assigned_to?: string | null
          cadence?: string
          created_at?: string
          day_of_month?: number | null
          direction?: string
          end_date?: string | null
          id?: string
          interval_days?: number | null
          last_generated_entry_id?: string | null
          max_occurrences?: number | null
          next_run_date?: string
          occurrences_generated?: number
          owner_id?: string
          start_date?: string
          template?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_recurrences_last_generated_entry_id_fkey"
            columns: ["last_generated_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          created_at: string
          data: Json
          form_id: string
          id: string
          ip: string | null
          lead_id: string | null
          owner_id: string
          referer: string | null
          user_agent: string | null
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          data?: Json
          form_id: string
          id?: string
          ip?: string | null
          lead_id?: string | null
          owner_id: string
          referer?: string | null
          user_agent?: string | null
          workspace_id?: string
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          data?: Json
          form_id?: string
          id?: string
          ip?: string | null
          lead_id?: string | null
          owner_id?: string
          referer?: string | null
          user_agent?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          active: boolean
          assigned_to: string | null
          created_at: string
          display_mode: string
          fields: Json
          id: string
          name: string
          owner_id: string
          popup_config: Json
          redirect_url: string | null
          slug: string
          submit_count: number
          success_message: string
          target: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          assigned_to?: string | null
          created_at?: string
          display_mode?: string
          fields?: Json
          id?: string
          name: string
          owner_id: string
          popup_config?: Json
          redirect_url?: string | null
          slug: string
          submit_count?: number
          success_message?: string
          target?: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          active?: boolean
          assigned_to?: string | null
          created_at?: string
          display_mode?: string
          fields?: Json
          id?: string
          name?: string
          owner_id?: string
          popup_config?: Json
          redirect_url?: string | null
          slug?: string
          submit_count?: number
          success_message?: string
          target?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          id: string
          metric: Database["public"]["Enums"]["goal_metric"]
          name: string
          notes: string | null
          owner_id: string
          period: Database["public"]["Enums"]["goal_period"]
          period_end: string
          period_start: string
          pipeline_id: string | null
          target_user_id: string | null
          target_value: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metric: Database["public"]["Enums"]["goal_metric"]
          name: string
          notes?: string | null
          owner_id?: string
          period?: Database["public"]["Enums"]["goal_period"]
          period_end: string
          period_start: string
          pipeline_id?: string | null
          target_user_id?: string | null
          target_value?: number
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          metric?: Database["public"]["Enums"]["goal_metric"]
          name?: string
          notes?: string | null
          owner_id?: string
          period?: Database["public"]["Enums"]["goal_period"]
          period_end?: string
          period_start?: string
          pipeline_id?: string | null
          target_user_id?: string | null
          target_value?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      hubspot_owners: {
        Row: {
          archived: boolean
          created_at: string
          email: string | null
          first_name: string | null
          hs_raw: Json | null
          id: string
          last_name: string | null
          mapped_user_id: string | null
          status: string
          team_id: string | null
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          email?: string | null
          first_name?: string | null
          hs_raw?: Json | null
          id: string
          last_name?: string | null
          mapped_user_id?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          email?: string | null
          first_name?: string | null
          hs_raw?: Json | null
          id?: string
          last_name?: string | null
          mapped_user_id?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      hubspot_sync_state: {
        Row: {
          conflict_reason: string | null
          conflict_status: string
          direction: string
          entity: string
          hubspot_id: string
          id: string
          last_payload: Json | null
          last_pushed_at: string | null
          last_synced_at: string
          local_id: string
          local_updated_at: string | null
          owner_id: string
          remote_updated_at: string | null
          workspace_id: string
        }
        Insert: {
          conflict_reason?: string | null
          conflict_status?: string
          direction?: string
          entity: string
          hubspot_id: string
          id?: string
          last_payload?: Json | null
          last_pushed_at?: string | null
          last_synced_at?: string
          local_id: string
          local_updated_at?: string | null
          owner_id: string
          remote_updated_at?: string | null
          workspace_id?: string
        }
        Update: {
          conflict_reason?: string | null
          conflict_status?: string
          direction?: string
          entity?: string
          hubspot_id?: string
          id?: string
          last_payload?: Json | null
          last_pushed_at?: string | null
          last_synced_at?: string
          local_id?: string
          local_updated_at?: string | null
          owner_id?: string
          remote_updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hubspot_sync_state_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      icp_criteria: {
        Row: {
          created_at: string
          enabled: boolean
          entity: string
          field: string
          id: string
          name: string
          op: string
          owner_id: string
          points: number
          updated_at: string
          value: Json | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          entity?: string
          field: string
          id?: string
          name: string
          op?: string
          owner_id: string
          points?: number
          updated_at?: string
          value?: Json | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          entity?: string
          field?: string
          id?: string
          name?: string
          op?: string
          owner_id?: string
          points?: number
          updated_at?: string
          value?: Json | null
          workspace_id?: string
        }
        Relationships: []
      }
      inbox_ai_suggestions: {
        Row: {
          applied_company_id: string | null
          conversation_id: string
          created_at: string
          id: string
          kind: string
          matched_company_ids: string[]
          message_id: string
          new_company_name: string | null
          old_company_id: string | null
          old_company_name: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_entity: string
          target_id: string
          workspace_id: string
        }
        Insert: {
          applied_company_id?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          kind: string
          matched_company_ids?: string[]
          message_id: string
          new_company_name?: string | null
          old_company_id?: string | null
          old_company_name?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_entity: string
          target_id: string
          workspace_id: string
        }
        Update: {
          applied_company_id?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          kind?: string
          matched_company_ids?: string[]
          message_id?: string
          new_company_name?: string | null
          old_company_id?: string | null
          old_company_name?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_entity?: string
          target_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_ai_suggestions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_ai_suggestions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_ai_suggestions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
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
          workspace_id?: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_access_log: {
        Row: {
          blocked: boolean
          created_at: string
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          id?: string
          ip_address: unknown
          user_agent?: string | null
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          blocked?: boolean
          created_at?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      job_profiles: {
        Row: {
          active: boolean
          code: string | null
          competencies: string[]
          created_at: string
          created_by: string | null
          currency: string
          default_unit_price: number
          description: string | null
          id: string
          name: string
          owner_id: string
          seniority: string | null
          service_catalog_id: string | null
          tags: string[]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          competencies?: string[]
          created_at?: string
          created_by?: string | null
          currency?: string
          default_unit_price?: number
          description?: string | null
          id?: string
          name: string
          owner_id: string
          seniority?: string | null
          service_catalog_id?: string | null
          tags?: string[]
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          active?: boolean
          code?: string | null
          competencies?: string[]
          created_at?: string
          created_by?: string | null
          currency?: string
          default_unit_price?: number
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          seniority?: string | null
          service_catalog_id?: string | null
          tags?: string[]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_profiles_service_catalog_id_fkey"
            columns: ["service_catalog_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      job_role_default_permissions: {
        Row: {
          permission_key: string
          role_id: string
        }
        Insert: {
          permission_key: string
          role_id: string
        }
        Update: {
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_role_default_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "job_role_default_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_role_permission_overrides: {
        Row: {
          created_at: string
          created_by: string
          effect: string
          id: string
          permission_key: string
          role_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          effect: string
          id?: string
          permission_key: string
          role_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          effect?: string
          id?: string
          permission_key?: string
          role_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_role_permission_overrides_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "job_role_permission_overrides_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_role_permission_overrides_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      job_role_set_replacements: {
        Row: {
          created_at: string
          reason: string
          replacement_set_id: string
          role_id: string
          set_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          reason: string
          replacement_set_id: string
          role_id: string
          set_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          reason?: string
          replacement_set_id?: string
          role_id?: string
          set_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_role_set_replacements_replacement_set_id_fkey"
            columns: ["replacement_set_id"]
            isOneToOne: false
            referencedRelation: "permission_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_role_set_replacements_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_role_set_replacements_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "permission_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_role_set_replacements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      job_role_sets: {
        Row: {
          created_at: string
          role_id: string
          set_id: string
        }
        Insert: {
          created_at?: string
          role_id: string
          set_id: string
        }
        Update: {
          created_at?: string
          role_id?: string
          set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_role_sets_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_role_sets_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "permission_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      job_roles: {
        Row: {
          color: string | null
          created_at: string
          data_scope: Database["public"]["Enums"]["data_scope"]
          description: string | null
          icon: string | null
          id: string
          is_system: boolean
          name: string
          owner_id: string | null
          restricted_visibility: boolean
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          data_scope?: Database["public"]["Enums"]["data_scope"]
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean
          name: string
          owner_id?: string | null
          restricted_visibility?: boolean
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          data_scope?: Database["public"]["Enums"]["data_scope"]
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean
          name?: string
          owner_id?: string | null
          restricted_visibility?: boolean
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          assigned_to: string | null
          body: string
          category_id: string | null
          created_at: string
          excerpt: string | null
          id: string
          owner_id: string
          published: boolean
          published_at: string | null
          slug: string
          title: string
          updated_at: string
          views: number
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          body?: string
          category_id?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          owner_id: string
          published?: boolean
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
          views?: number
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          body?: string
          category_id?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          owner_id?: string
          published?: boolean
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
          views?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          position: number
          slug: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          position?: number
          slug: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          position?: number
          slug?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          landing_page_id: string
          metadata: Json
          owner_id: string
          utm: Json | null
          variant_id: string | null
          visitor_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          landing_page_id: string
          metadata?: Json
          owner_id: string
          utm?: Json | null
          variant_id?: string | null
          visitor_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          landing_page_id?: string
          metadata?: Json
          owner_id?: string
          utm?: Json | null
          variant_id?: string | null
          visitor_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_events_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_pages: {
        Row: {
          assigned_to: string | null
          blocks: Json
          conversions_count: number
          created_at: string
          description: string | null
          id: string
          owner_id: string
          published_at: string | null
          seo: Json
          slug: string
          status: string
          theme: Json
          title: string
          updated_at: string
          views_count: number
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          blocks?: Json
          conversions_count?: number
          created_at?: string
          description?: string | null
          id?: string
          owner_id: string
          published_at?: string | null
          seo?: Json
          slug: string
          status?: string
          theme?: Json
          title: string
          updated_at?: string
          views_count?: number
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          blocks?: Json
          conversions_count?: number
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string
          published_at?: string | null
          seo?: Json
          slug?: string
          status?: string
          theme?: Json
          title?: string
          updated_at?: string
          views_count?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          active: boolean
          created_at: string
          id: string
          label: string | null
          name: string
          owner_id: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string | null
          name: string
          owner_id: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string | null
          name?: string
          owner_id?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_sources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          area_atuacao: string | null
          assigned_to: string | null
          assigned_user_id: string | null
          cargo_catalog_version: number | null
          cargo_resumido: string | null
          company_id: string | null
          company_name: string | null
          converted_at: string | null
          converted_contact_id: string | null
          converted_deal_id: string | null
          created_at: string
          custom_fields: Json
          deleted_at: string | null
          email: string | null
          external_ids: Json
          first_name: string
          hs_createdate: string | null
          hs_lastmodifieddate: string | null
          hs_lead_source_detail: string | null
          hs_object_id: string | null
          hs_raw: Json | null
          hubspot_owner_id: string | null
          id: string
          job_title: string | null
          job_title_source: string | null
          label: string | null
          last_form_submission_at: string | null
          last_name: string | null
          linkedin_url: string | null
          mobile_phone: string | null
          mobile_phone_digits: string | null
          nivel_hierarquico: string | null
          notes: string | null
          nurture_started_at: string | null
          owner_id: string
          phone: string | null
          phone_digits: string | null
          phone_ext: string | null
          photo_source: string | null
          photo_updated_at: string | null
          photo_url: string | null
          pipeline_id: string | null
          score: number
          source: string | null
          stage_id: string | null
          stage_substatus_id: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          whatsapp_digits: string | null
          whatsapp_e164: string | null
          workspace_id: string
        }
        Insert: {
          area_atuacao?: string | null
          assigned_to?: string | null
          assigned_user_id?: string | null
          cargo_catalog_version?: number | null
          cargo_resumido?: string | null
          company_id?: string | null
          company_name?: string | null
          converted_at?: string | null
          converted_contact_id?: string | null
          converted_deal_id?: string | null
          created_at?: string
          custom_fields?: Json
          deleted_at?: string | null
          email?: string | null
          external_ids?: Json
          first_name: string
          hs_createdate?: string | null
          hs_lastmodifieddate?: string | null
          hs_lead_source_detail?: string | null
          hs_object_id?: string | null
          hs_raw?: Json | null
          hubspot_owner_id?: string | null
          id?: string
          job_title?: string | null
          job_title_source?: string | null
          label?: string | null
          last_form_submission_at?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          mobile_phone?: string | null
          mobile_phone_digits?: string | null
          nivel_hierarquico?: string | null
          notes?: string | null
          nurture_started_at?: string | null
          owner_id: string
          phone?: string | null
          phone_digits?: string | null
          phone_ext?: string | null
          photo_source?: string | null
          photo_updated_at?: string | null
          photo_url?: string | null
          pipeline_id?: string | null
          score?: number
          source?: string | null
          stage_id?: string | null
          stage_substatus_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          whatsapp_digits?: string | null
          whatsapp_e164?: string | null
          workspace_id?: string
        }
        Update: {
          area_atuacao?: string | null
          assigned_to?: string | null
          assigned_user_id?: string | null
          cargo_catalog_version?: number | null
          cargo_resumido?: string | null
          company_id?: string | null
          company_name?: string | null
          converted_at?: string | null
          converted_contact_id?: string | null
          converted_deal_id?: string | null
          created_at?: string
          custom_fields?: Json
          deleted_at?: string | null
          email?: string | null
          external_ids?: Json
          first_name?: string
          hs_createdate?: string | null
          hs_lastmodifieddate?: string | null
          hs_lead_source_detail?: string | null
          hs_object_id?: string | null
          hs_raw?: Json | null
          hubspot_owner_id?: string | null
          id?: string
          job_title?: string | null
          job_title_source?: string | null
          label?: string | null
          last_form_submission_at?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          mobile_phone?: string | null
          mobile_phone_digits?: string | null
          nivel_hierarquico?: string | null
          notes?: string | null
          nurture_started_at?: string | null
          owner_id?: string
          phone?: string | null
          phone_digits?: string | null
          phone_ext?: string | null
          photo_source?: string | null
          photo_updated_at?: string | null
          photo_url?: string | null
          pipeline_id?: string | null
          score?: number
          source?: string | null
          stage_id?: string | null
          stage_substatus_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          whatsapp_digits?: string | null
          whatsapp_e164?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_substatus_id_fkey"
            columns: ["stage_substatus_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stage_substatuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_entities: {
        Row: {
          active: boolean
          address_json: Json
          assigned_to: string | null
          cnpj: string | null
          code: string | null
          created_at: string
          created_by: string | null
          id: string
          ie: string | null
          im: string | null
          is_default: boolean
          logo_url: string | null
          metadata: Json
          name: string
          nfse_settings: Json
          payments_settings: Json
          trade_name: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          address_json?: Json
          assigned_to?: string | null
          cnpj?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          ie?: string | null
          im?: string | null
          is_default?: boolean
          logo_url?: string | null
          metadata?: Json
          name: string
          nfse_settings?: Json
          payments_settings?: Json
          trade_name?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          address_json?: Json
          assigned_to?: string | null
          cnpj?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          ie?: string | null
          im?: string | null
          is_default?: boolean
          logo_url?: string | null
          metadata?: Json
          name?: string
          nfse_settings?: Json
          payments_settings?: Json
          trade_name?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_entities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_entity_group_members: {
        Row: {
          created_at: string
          group_id: string
          legal_entity_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          legal_entity_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          legal_entity_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_entity_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "legal_entity_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_entity_group_members_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_entity_group_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_entity_groups: {
        Row: {
          active: boolean
          code: string | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_system: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          code?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_entity_groups_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      live_chat_messages: {
        Row: {
          agent_attachments: Json | null
          author_name: string | null
          author_user_id: string | null
          body: string
          created_at: string
          direction: string
          id: string
          owner_id: string
          session_id: string
          workspace_id: string
        }
        Insert: {
          agent_attachments?: Json | null
          author_name?: string | null
          author_user_id?: string | null
          body: string
          created_at?: string
          direction: string
          id?: string
          owner_id: string
          session_id: string
          workspace_id: string
        }
        Update: {
          agent_attachments?: Json | null
          author_name?: string | null
          author_user_id?: string | null
          body?: string
          created_at?: string
          direction?: string
          id?: string
          owner_id?: string
          session_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_chat_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      live_chat_sessions: {
        Row: {
          assignee_id: string | null
          contact_id: string | null
          created_at: string
          id: string
          identity_status: string
          last_message_at: string | null
          lead_id: string | null
          owner_id: string
          status: string
          ticket_id: string | null
          updated_at: string
          visitor_email: string | null
          visitor_id: string
          visitor_name: string | null
          visitor_url: string | null
          workspace_id: string
        }
        Insert: {
          assignee_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          identity_status?: string
          last_message_at?: string | null
          lead_id?: string | null
          owner_id: string
          status?: string
          ticket_id?: string | null
          updated_at?: string
          visitor_email?: string | null
          visitor_id: string
          visitor_name?: string | null
          visitor_url?: string | null
          workspace_id: string
        }
        Update: {
          assignee_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          identity_status?: string
          last_message_at?: string | null
          lead_id?: string | null
          owner_id?: string
          status?: string
          ticket_id?: string | null
          updated_at?: string
          visitor_email?: string | null
          visitor_id?: string
          visitor_name?: string | null
          visitor_url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_chat_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_chat_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_chat_sessions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_chat_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      macros: {
        Row: {
          assigned_to: string | null
          body: string
          category: string | null
          created_at: string
          enabled: boolean
          id: string
          name: string
          owner_id: string
          shortcut: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          body: string
          category?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          owner_id?: string
          shortcut?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          assigned_to?: string | null
          body?: string
          category?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          owner_id?: string
          shortcut?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "macros_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_apps: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string | null
          docs_url: string | null
          icon_url: string | null
          id: string
          install_kind: string
          name: string
          popular: boolean
          scopes: string[]
          short_description: string | null
          slug: string
          sort_order: number
          updated_at: string
          vendor: string | null
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          description?: string | null
          docs_url?: string | null
          icon_url?: string | null
          id?: string
          install_kind?: string
          name: string
          popular?: boolean
          scopes?: string[]
          short_description?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          docs_url?: string | null
          icon_url?: string | null
          id?: string
          install_kind?: string
          name?: string
          popular?: boolean
          scopes?: string[]
          short_description?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
          vendor?: string | null
        }
        Relationships: []
      }
      marketplace_installations: {
        Row: {
          app_slug: string
          config: Json
          created_at: string
          id: string
          installed_at: string
          installed_by: string | null
          last_test_at: string | null
          last_test_error: string | null
          last_test_ok: boolean | null
          owner_id: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          app_slug: string
          config?: Json
          created_at?: string
          id?: string
          installed_at?: string
          installed_by?: string | null
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_ok?: boolean | null
          owner_id: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          app_slug?: string
          config?: Json
          created_at?: string
          id?: string
          installed_at?: string
          installed_by?: string | null
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_ok?: boolean | null
          owner_id?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_installations_app_slug_fkey"
            columns: ["app_slug"]
            isOneToOne: false
            referencedRelation: "marketplace_apps"
            referencedColumns: ["slug"]
          },
        ]
      }
      media_assets: {
        Row: {
          assigned_to: string | null
          bucket: string
          created_at: string
          filename: string
          height: number | null
          id: string
          mime: string | null
          owner_user_id: string
          path: string
          size_bytes: number | null
          updated_at: string
          url: string
          url_expires_at: string | null
          width: number | null
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          bucket?: string
          created_at?: string
          filename: string
          height?: number | null
          id?: string
          mime?: string | null
          owner_user_id: string
          path: string
          size_bytes?: number | null
          updated_at?: string
          url: string
          url_expires_at?: string | null
          width?: number | null
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          bucket?: string
          created_at?: string
          filename?: string
          height?: number | null
          id?: string
          mime?: string | null
          owner_user_id?: string
          path?: string
          size_bytes?: number | null
          updated_at?: string
          url?: string
          url_expires_at?: string | null
          width?: number | null
          workspace_id?: string
        }
        Relationships: []
      }
      meet_recording_index: {
        Row: {
          created_at: string
          discovered_by: string | null
          drive_file_id: string
          drive_url: string
          file_created_at: string | null
          file_name: string | null
          id: string
          meet_code: string
          mime_type: string | null
          owner_id: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          discovered_by?: string | null
          drive_file_id: string
          drive_url: string
          file_created_at?: string | null
          file_name?: string | null
          id?: string
          meet_code: string
          mime_type?: string | null
          owner_id: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          discovered_by?: string | null
          drive_file_id?: string
          drive_url?: string
          file_created_at?: string | null
          file_name?: string | null
          id?: string
          meet_code?: string
          mime_type?: string | null
          owner_id?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meet_recording_index_discovered_by_fkey"
            columns: ["discovered_by"]
            isOneToOne: false
            referencedRelation: "calendar_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          created_at: string
          display_name: string
          email: string | null
          id: string
          joined_at: string
          left_at: string | null
          meeting_id: string
          owner_id: string
          updated_at: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          joined_at?: string
          left_at?: string | null
          meeting_id: string
          owner_id: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          joined_at?: string
          left_at?: string | null
          meeting_id?: string
          owner_id?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_summaries: {
        Row: {
          action_items: Json
          created_at: string
          decisions: Json
          error_message: string | null
          id: string
          meeting_id: string
          model: string | null
          owner_id: string
          sentiment: string | null
          status: string
          summary: string | null
          transcript: string | null
          transcript_search: unknown
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          action_items?: Json
          created_at?: string
          decisions?: Json
          error_message?: string | null
          id?: string
          meeting_id: string
          model?: string | null
          owner_id: string
          sentiment?: string | null
          status?: string
          summary?: string | null
          transcript?: string | null
          transcript_search?: unknown
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          action_items?: Json
          created_at?: string
          decisions?: Json
          error_message?: string | null
          id?: string
          meeting_id?: string
          model?: string | null
          owner_id?: string
          sentiment?: string | null
          status?: string
          summary?: string | null
          transcript?: string | null
          transcript_search?: unknown
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_summaries_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_summaries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_summaries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          assigned_to: string | null
          created_at: string
          ended_at: string | null
          expires_at: string
          host_user_id: string | null
          id: string
          owner_id: string
          provider: string
          public_token: string
          recording_consent: boolean
          recording_duration_seconds: number | null
          recording_mime_type: string | null
          recording_storage_path: string | null
          related_contact_id: string | null
          related_deal_id: string | null
          related_lead_id: string | null
          related_ticket_id: string | null
          room_name: string
          scheduled_at: string | null
          started_at: string | null
          status: string
          title: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          ended_at?: string | null
          expires_at?: string
          host_user_id?: string | null
          id?: string
          owner_id: string
          provider?: string
          public_token: string
          recording_consent?: boolean
          recording_duration_seconds?: number | null
          recording_mime_type?: string | null
          recording_storage_path?: string | null
          related_contact_id?: string | null
          related_deal_id?: string | null
          related_lead_id?: string | null
          related_ticket_id?: string | null
          room_name: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          ended_at?: string | null
          expires_at?: string
          host_user_id?: string | null
          id?: string
          owner_id?: string
          provider?: string
          public_token?: string
          recording_consent?: boolean
          recording_duration_seconds?: number | null
          recording_mime_type?: string | null
          recording_storage_path?: string | null
          related_contact_id?: string | null
          related_deal_id?: string | null
          related_lead_id?: string | null
          related_ticket_id?: string | null
          room_name?: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_related_contact_id_fkey"
            columns: ["related_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_related_contact_id_fkey"
            columns: ["related_contact_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_related_deal_id_fkey"
            columns: ["related_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_related_deal_id_fkey"
            columns: ["related_deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_related_ticket_id_fkey"
            columns: ["related_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_drafts: {
        Row: {
          attachments: Json
          body_html: string | null
          body_text: string | null
          cc: string | null
          channel: string
          context: Json
          created_at: string
          id: string
          owner_id: string
          scope_key: string
          subject: string | null
          to_addr: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          attachments?: Json
          body_html?: string | null
          body_text?: string | null
          cc?: string | null
          channel: string
          context?: Json
          created_at?: string
          id?: string
          owner_id: string
          scope_key: string
          subject?: string | null
          to_addr?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          attachments?: Json
          body_html?: string | null
          body_text?: string | null
          cc?: string | null
          channel?: string
          context?: Json
          created_at?: string
          id?: string
          owner_id?: string
          scope_key?: string
          subject?: string | null
          to_addr?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_drafts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_sentiments: {
        Row: {
          analyzed_at: string
          contact_id: string | null
          created_at: string
          emotion: string | null
          id: string
          keywords: Json
          label: Database["public"]["Enums"]["sentiment_label"]
          lead_id: string | null
          model: string
          owner_id: string
          score: number
          source: string
          source_id: string
          workspace_id: string
        }
        Insert: {
          analyzed_at?: string
          contact_id?: string | null
          created_at?: string
          emotion?: string | null
          id?: string
          keywords?: Json
          label: Database["public"]["Enums"]["sentiment_label"]
          lead_id?: string | null
          model: string
          owner_id: string
          score: number
          source: string
          source_id: string
          workspace_id?: string
        }
        Update: {
          analyzed_at?: string
          contact_id?: string | null
          created_at?: string
          emotion?: string | null
          id?: string
          keywords?: Json
          label?: Database["public"]["Enums"]["sentiment_label"]
          lead_id?: string | null
          model?: string
          owner_id?: string
          score?: number
          source?: string
          source_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_sentiments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_sentiments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_sentiments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_sentiments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_sentiments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ml_forecast_scores: {
        Row: {
          computed_at: string
          confidence_hi: number | null
          confidence_lo: number | null
          deal_id: string
          expected_value: number
          id: string
          model_version: string
          owner_id: string
          probability: number
          top_features: Json
          workspace_id: string | null
        }
        Insert: {
          computed_at?: string
          confidence_hi?: number | null
          confidence_lo?: number | null
          deal_id: string
          expected_value?: number
          id?: string
          model_version?: string
          owner_id: string
          probability: number
          top_features?: Json
          workspace_id?: string | null
        }
        Update: {
          computed_at?: string
          confidence_hi?: number | null
          confidence_lo?: number | null
          deal_id?: string
          expected_value?: number
          id?: string
          model_version?: string
          owner_id?: string
          probability?: number
          top_features?: Json
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ml_forecast_scores_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ml_forecast_scores_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      ml_scoring_models: {
        Row: {
          accuracy: number | null
          features: Json
          last_trained_at: string | null
          notes: string | null
          owner_id: string
          sample_size: number
          status: string
          updated_at: string
          weight_ml: number
          workspace_id: string | null
        }
        Insert: {
          accuracy?: number | null
          features?: Json
          last_trained_at?: string | null
          notes?: string | null
          owner_id: string
          sample_size?: number
          status?: string
          updated_at?: string
          weight_ml?: number
          workspace_id?: string | null
        }
        Update: {
          accuracy?: number | null
          features?: Json
          last_trained_at?: string | null
          notes?: string | null
          owner_id?: string
          sample_size?: number
          status?: string
          updated_at?: string
          weight_ml?: number
          workspace_id?: string | null
        }
        Relationships: []
      }
      module_branding: {
        Row: {
          created_at: string
          custom_domain: string | null
          favicon_url: string | null
          id: string
          logo_url: string | null
          module_id: string
          primary_color: string | null
          product_name: string | null
          secondary_color: string | null
          theme: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          custom_domain?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          module_id: string
          primary_color?: string | null
          product_name?: string | null
          secondary_color?: string | null
          theme?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          custom_domain?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          module_id?: string
          primary_color?: string | null
          product_name?: string | null
          secondary_color?: string | null
          theme?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_branding_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_branding_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string
          default_color: string
          default_product_name: string
          host_suffix: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_color?: string
          default_product_name: string
          host_suffix?: string | null
          icon?: string | null
          id: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_color?: string
          default_product_name?: string
          host_suffix?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      nfse_invoices: {
        Row: {
          amount: number | null
          assigned_to: string | null
          created_at: string
          error_message: string | null
          external_id: string | null
          id: string
          invoice_id: string | null
          issued_at: string | null
          legal_entity_id: string | null
          nf_number: string | null
          pdf_url: string | null
          raw: Json
          rps_number: string | null
          service_code: string | null
          status: string
          updated_at: string
          workspace_id: string
          xml_url: string | null
        }
        Insert: {
          amount?: number | null
          assigned_to?: string | null
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          invoice_id?: string | null
          issued_at?: string | null
          legal_entity_id?: string | null
          nf_number?: string | null
          pdf_url?: string | null
          raw?: Json
          rps_number?: string | null
          service_code?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
          xml_url?: string | null
        }
        Update: {
          amount?: number | null
          assigned_to?: string | null
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          invoice_id?: string | null
          issued_at?: string | null
          legal_entity_id?: string | null
          nf_number?: string | null
          pdf_url?: string | null
          raw?: Json
          rps_number?: string | null
          service_code?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfse_invoices_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfse_invoices_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfse_invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string | null
          entity: string | null
          entity_id: string | null
          id: string
          link: string | null
          owner_id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          link?: string | null
          owner_id: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          link?: string | null
          owner_id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      onboarding_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: number
          entity_id: string | null
          entity_type: string
          form_data: Json
          id: string
          owner_id: string
          status: string
          template_id: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          entity_id?: string | null
          entity_type: string
          form_data?: Json
          id?: string
          owner_id: string
          status?: string
          template_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          entity_id?: string | null
          entity_type?: string
          form_data?: Json
          id?: string
          owner_id?: string
          status?: string
          template_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_runs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_templates: {
        Row: {
          created_at: string
          description: string | null
          entity_type: string
          field_config: Json
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          owner_id: string
          segment_field: string | null
          segment_value: string | null
          step_order: Json
          tasks_template: Json
          updated_at: string
          workflow_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          entity_type: string
          field_config?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          owner_id: string
          segment_field?: string | null
          segment_value?: string | null
          step_order?: Json
          tasks_template?: Json
          updated_at?: string
          workflow_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          entity_type?: string
          field_config?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          owner_id?: string
          segment_field?: string | null
          segment_value?: string | null
          step_order?: Json
          tasks_template?: Json
          updated_at?: string
          workflow_id?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      outbound_webhooks: {
        Row: {
          active: boolean
          created_at: string
          events: string[]
          id: string
          name: string
          owner_id: string
          secret: string
          updated_at: string
          url: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          name: string
          owner_id: string
          secret?: string
          updated_at?: string
          url: string
          workspace_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          name?: string
          owner_id?: string
          secret?: string
          updated_at?: string
          url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_webhooks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string | null
          external_id: string | null
          gateway: string
          id: string
          payload: Json
          processed: boolean
          signature_valid: boolean
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          external_id?: string | null
          gateway: string
          id?: string
          payload?: Json
          processed?: boolean
          signature_valid?: boolean
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          external_id?: string | null
          gateway?: string
          id?: string
          payload?: Json
          processed?: boolean
          signature_valid?: boolean
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          address: string | null
          archived: boolean
          assigned_to: string | null
          bank: string | null
          bank_account: string | null
          bank_agency: string | null
          candidate_id: string | null
          cnpj: string | null
          cost_hour: number | null
          created_at: string
          created_by: string | null
          currency: string
          education: string | null
          email: string | null
          emergency_phone: string | null
          emergency_relationship: string | null
          employment_type: Database["public"]["Enums"]["people_employment_type"]
          full_name: string
          hire_date: string | null
          id: string
          legal_entity_name: string | null
          location: string | null
          manager_id: string | null
          marital_status: string | null
          monthly_cost: number | null
          notes: string | null
          owner_id: string
          personal_doc: Json
          phone: string | null
          photo_url: string | null
          pix_key: string | null
          preferred_name: string | null
          profile_id: string | null
          role_title: string | null
          seniority: string | null
          shirt_size: string | null
          simples_optante: boolean | null
          spouse_name: string | null
          status: Database["public"]["Enums"]["people_status"]
          tags: string[]
          termination_date: string | null
          timezone: string | null
          trade_name: string | null
          updated_at: string
          work_schedule: Json | null
          workspace_id: string
        }
        Insert: {
          address?: string | null
          archived?: boolean
          assigned_to?: string | null
          bank?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          candidate_id?: string | null
          cnpj?: string | null
          cost_hour?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          education?: string | null
          email?: string | null
          emergency_phone?: string | null
          emergency_relationship?: string | null
          employment_type?: Database["public"]["Enums"]["people_employment_type"]
          full_name: string
          hire_date?: string | null
          id?: string
          legal_entity_name?: string | null
          location?: string | null
          manager_id?: string | null
          marital_status?: string | null
          monthly_cost?: number | null
          notes?: string | null
          owner_id: string
          personal_doc?: Json
          phone?: string | null
          photo_url?: string | null
          pix_key?: string | null
          preferred_name?: string | null
          profile_id?: string | null
          role_title?: string | null
          seniority?: string | null
          shirt_size?: string | null
          simples_optante?: boolean | null
          spouse_name?: string | null
          status?: Database["public"]["Enums"]["people_status"]
          tags?: string[]
          termination_date?: string | null
          timezone?: string | null
          trade_name?: string | null
          updated_at?: string
          work_schedule?: Json | null
          workspace_id: string
        }
        Update: {
          address?: string | null
          archived?: boolean
          assigned_to?: string | null
          bank?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          candidate_id?: string | null
          cnpj?: string | null
          cost_hour?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          education?: string | null
          email?: string | null
          emergency_phone?: string | null
          emergency_relationship?: string | null
          employment_type?: Database["public"]["Enums"]["people_employment_type"]
          full_name?: string
          hire_date?: string | null
          id?: string
          legal_entity_name?: string | null
          location?: string | null
          manager_id?: string | null
          marital_status?: string | null
          monthly_cost?: number | null
          notes?: string | null
          owner_id?: string
          personal_doc?: Json
          phone?: string | null
          photo_url?: string | null
          pix_key?: string | null
          preferred_name?: string | null
          profile_id?: string | null
          role_title?: string | null
          seniority?: string | null
          shirt_size?: string | null
          simples_optante?: boolean | null
          spouse_name?: string | null
          status?: Database["public"]["Enums"]["people_status"]
          tags?: string[]
          termination_date?: string | null
          timezone?: string | null
          trade_name?: string | null
          updated_at?: string
          work_schedule?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      people_allocation_company_splits: {
        Row: {
          allocation_id: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          pct: number
          workspace_id: string
        }
        Insert: {
          allocation_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          pct: number
          workspace_id: string
        }
        Update: {
          allocation_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          pct?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_allocation_company_splits_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "people_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_allocation_company_splits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_allocation_company_splits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      people_allocations: {
        Row: {
          allocation_pct: number
          assigned_to: string | null
          billable_rate: number | null
          calendar: Json | null
          can_track_time: boolean
          competencies: string[]
          contract_id: string | null
          contracting_preset_id: string | null
          cost_rate: number | null
          created_at: string
          currency: string
          ends_at: string | null
          hours_per_month: number | null
          hours_per_week: number | null
          id: string
          manager_id: string | null
          notes: string | null
          overbook_justification: string | null
          owner_id: string
          person_id: string
          project_id: string | null
          purchase_contract_id: string | null
          role_title: string | null
          service_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["allocation_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          allocation_pct?: number
          assigned_to?: string | null
          billable_rate?: number | null
          calendar?: Json | null
          can_track_time?: boolean
          competencies?: string[]
          contract_id?: string | null
          contracting_preset_id?: string | null
          cost_rate?: number | null
          created_at?: string
          currency?: string
          ends_at?: string | null
          hours_per_month?: number | null
          hours_per_week?: number | null
          id?: string
          manager_id?: string | null
          notes?: string | null
          overbook_justification?: string | null
          owner_id?: string
          person_id: string
          project_id?: string | null
          purchase_contract_id?: string | null
          role_title?: string | null
          service_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["allocation_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          allocation_pct?: number
          assigned_to?: string | null
          billable_rate?: number | null
          calendar?: Json | null
          can_track_time?: boolean
          competencies?: string[]
          contract_id?: string | null
          contracting_preset_id?: string | null
          cost_rate?: number | null
          created_at?: string
          currency?: string
          ends_at?: string | null
          hours_per_month?: number | null
          hours_per_week?: number | null
          id?: string
          manager_id?: string | null
          notes?: string | null
          overbook_justification?: string | null
          owner_id?: string
          person_id?: string
          project_id?: string | null
          purchase_contract_id?: string | null
          role_title?: string | null
          service_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["allocation_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_allocations_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_allocations_contracting_preset_id_fkey"
            columns: ["contracting_preset_id"]
            isOneToOne: false
            referencedRelation: "contracting_presets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_allocations_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_allocations_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "people_total_cost"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "people_allocations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_allocations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_total_cost"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "people_allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_allocations_purchase_contract_id_fkey"
            columns: ["purchase_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_allocations_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      people_benefits: {
        Row: {
          active: boolean
          benefit_type: string
          created_at: string
          created_by: string | null
          currency: string
          employee_share: number
          ends_on: string | null
          id: string
          monthly_value: number
          notes: string | null
          owner_id: string
          person_id: string
          plan_name: string | null
          provider: string | null
          starts_on: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          active?: boolean
          benefit_type: string
          created_at?: string
          created_by?: string | null
          currency?: string
          employee_share?: number
          ends_on?: string | null
          id?: string
          monthly_value?: number
          notes?: string | null
          owner_id: string
          person_id: string
          plan_name?: string | null
          provider?: string | null
          starts_on?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          active?: boolean
          benefit_type?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          employee_share?: number
          ends_on?: string | null
          id?: string
          monthly_value?: number
          notes?: string | null
          owner_id?: string
          person_id?: string
          plan_name?: string | null
          provider?: string | null
          starts_on?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_benefits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_benefits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_total_cost"
            referencedColumns: ["person_id"]
          },
        ]
      }
      people_documents: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          doc_number: string | null
          doc_type: string
          expires_at: string | null
          file_name: string | null
          file_url: string | null
          id: string
          is_sensitive: boolean
          issued_at: string | null
          notes: string | null
          owner_id: string
          person_id: string
          status: Database["public"]["Enums"]["people_doc_status"]
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          doc_number?: string | null
          doc_type: string
          expires_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_sensitive?: boolean
          issued_at?: string | null
          notes?: string | null
          owner_id: string
          person_id: string
          status?: Database["public"]["Enums"]["people_doc_status"]
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          doc_number?: string | null
          doc_type?: string
          expires_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_sensitive?: boolean
          issued_at?: string | null
          notes?: string | null
          owner_id?: string
          person_id?: string
          status?: Database["public"]["Enums"]["people_doc_status"]
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_documents_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_documents_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_total_cost"
            referencedColumns: ["person_id"]
          },
        ]
      }
      people_events: {
        Row: {
          actor_id: string | null
          created_at: string
          description: string | null
          event_type: string
          id: string
          metadata: Json
          owner_id: string
          person_id: string
          title: string
          visible_to_person: boolean
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json
          owner_id: string
          person_id: string
          title: string
          visible_to_person?: boolean
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          owner_id?: string
          person_id?: string
          title?: string
          visible_to_person?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_events_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_events_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_total_cost"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "people_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      people_goals: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          current_value: number
          description: string | null
          id: string
          metric_type: string
          owner_id: string
          period_end: string | null
          period_start: string | null
          person_id: string
          progress_pct: number
          status: string
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
          weight: number
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          current_value?: number
          description?: string | null
          id?: string
          metric_type?: string
          owner_id: string
          period_end?: string | null
          period_start?: string | null
          person_id: string
          progress_pct?: number
          status?: string
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
          weight?: number
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          current_value?: number
          description?: string | null
          id?: string
          metric_type?: string
          owner_id?: string
          period_end?: string | null
          period_start?: string | null
          person_id?: string
          progress_pct?: number
          status?: string
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
          weight?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_goals_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_goals_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_total_cost"
            referencedColumns: ["person_id"]
          },
        ]
      }
      people_incidents: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_confidential: boolean
          location: string | null
          occurred_at: string
          owner_id: string
          person_id: string | null
          resolution: string | null
          resolved_at: string | null
          severity: string
          status: string
          title: string
          updated_at: string
          witnesses: string | null
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_confidential?: boolean
          location?: string | null
          occurred_at?: string
          owner_id: string
          person_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
          witnesses?: string | null
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_confidential?: boolean
          location?: string | null
          occurred_at?: string
          owner_id?: string
          person_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
          witnesses?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_incidents_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_incidents_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_total_cost"
            referencedColumns: ["person_id"]
          },
        ]
      }
      people_onboarding_plans: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          id: string
          kind: string
          notes: string | null
          owner_id: string
          person_id: string
          started_at: string | null
          status: string
          target_completion_date: string | null
          template_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          kind: string
          notes?: string | null
          owner_id: string
          person_id: string
          started_at?: string | null
          status?: string
          target_completion_date?: string | null
          template_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          notes?: string | null
          owner_id?: string
          person_id?: string
          started_at?: string | null
          status?: string
          target_completion_date?: string | null
          template_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_onboarding_plans_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_onboarding_plans_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_total_cost"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "people_onboarding_plans_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "people_onboarding_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      people_onboarding_tasks: {
        Row: {
          assignee_id: string | null
          category: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_critical: boolean
          order_index: number
          plan_id: string
          revocation_system: string | null
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assignee_id?: string | null
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_critical?: boolean
          order_index?: number
          plan_id: string
          revocation_system?: string | null
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assignee_id?: string | null
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_critical?: boolean
          order_index?: number
          plan_id?: string
          revocation_system?: string | null
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_onboarding_tasks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "people_onboarding_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      people_onboarding_templates: {
        Row: {
          created_at: string
          description: string | null
          employment_type: string | null
          id: string
          is_active: boolean
          items: Json
          kind: string
          name: string
          owner_id: string
          role_title: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          employment_type?: string | null
          id?: string
          is_active?: boolean
          items?: Json
          kind: string
          name: string
          owner_id: string
          role_title?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          employment_type?: string | null
          id?: string
          is_active?: boolean
          items?: Json
          kind?: string
          name?: string
          owner_id?: string
          role_title?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      people_one_on_ones: {
        Row: {
          action_items: Json
          agenda: string | null
          assigned_to: string | null
          created_at: string
          created_by: string | null
          duration_min: number | null
          held_at: string | null
          id: string
          manager_id: string | null
          mood: number | null
          notes: string | null
          owner_id: string
          person_id: string
          private_notes: string | null
          scheduled_at: string | null
          status: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          action_items?: Json
          agenda?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          duration_min?: number | null
          held_at?: string | null
          id?: string
          manager_id?: string | null
          mood?: number | null
          notes?: string | null
          owner_id: string
          person_id: string
          private_notes?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          action_items?: Json
          agenda?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          duration_min?: number | null
          held_at?: string | null
          id?: string
          manager_id?: string | null
          mood?: number | null
          notes?: string | null
          owner_id?: string
          person_id?: string
          private_notes?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_one_on_ones_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_one_on_ones_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_total_cost"
            referencedColumns: ["person_id"]
          },
        ]
      }
      people_psychosocial_assessments: {
        Row: {
          action_plan: string | null
          assessed_at: string
          burnout_signals: boolean
          created_at: string
          created_by: string | null
          dimensions: Json
          follow_up_at: string | null
          harassment_signals: boolean
          id: string
          method: string
          notes: string | null
          overall_score: number | null
          owner_id: string
          person_id: string
          risk_level: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          action_plan?: string | null
          assessed_at?: string
          burnout_signals?: boolean
          created_at?: string
          created_by?: string | null
          dimensions?: Json
          follow_up_at?: string | null
          harassment_signals?: boolean
          id?: string
          method?: string
          notes?: string | null
          overall_score?: number | null
          owner_id: string
          person_id: string
          risk_level?: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          action_plan?: string | null
          assessed_at?: string
          burnout_signals?: boolean
          created_at?: string
          created_by?: string | null
          dimensions?: Json
          follow_up_at?: string | null
          harassment_signals?: boolean
          id?: string
          method?: string
          notes?: string | null
          overall_score?: number | null
          owner_id?: string
          person_id?: string
          risk_level?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_psychosocial_assessments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_psychosocial_assessments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_total_cost"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "people_psychosocial_assessments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      people_reviews: {
        Row: {
          assigned_to: string | null
          cadence: string
          comments: string | null
          created_at: string
          created_by: string | null
          id: string
          improvements: string | null
          overall_score: number | null
          owner_id: string
          period_end: string
          period_start: string
          person_id: string
          ratings: Json
          reviewer_id: string | null
          reviewer_name: string | null
          reviewer_role: string | null
          status: string
          strengths: string | null
          submitted_at: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          cadence?: string
          comments?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          improvements?: string | null
          overall_score?: number | null
          owner_id: string
          period_end: string
          period_start: string
          person_id: string
          ratings?: Json
          reviewer_id?: string | null
          reviewer_name?: string | null
          reviewer_role?: string | null
          status?: string
          strengths?: string | null
          submitted_at?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          cadence?: string
          comments?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          improvements?: string | null
          overall_score?: number | null
          owner_id?: string
          period_end?: string
          period_start?: string
          person_id?: string
          ratings?: Json
          reviewer_id?: string | null
          reviewer_name?: string | null
          reviewer_role?: string | null
          status?: string
          strengths?: string | null
          submitted_at?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_reviews_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_reviews_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_total_cost"
            referencedColumns: ["person_id"]
          },
        ]
      }
      permission_set_items: {
        Row: {
          created_at: string
          permission_key: string
          set_id: string
        }
        Insert: {
          created_at?: string
          permission_key: string
          set_id: string
        }
        Update: {
          created_at?: string
          permission_key?: string
          set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_set_items_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "permission_set_items_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "permission_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_sets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          module: string
          name: string
          owner_id: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          module: string
          name: string
          owner_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          module?: string
          name?: string
          owner_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_sets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: Database["public"]["Enums"]["perm_action"]
          created_at: string
          description: string | null
          is_system: boolean
          key: string
          label_pt: string
          module: string
          resource: string
          scope: Database["public"]["Enums"]["perm_scope"]
        }
        Insert: {
          action: Database["public"]["Enums"]["perm_action"]
          created_at?: string
          description?: string | null
          is_system?: boolean
          key: string
          label_pt: string
          module: string
          resource: string
          scope: Database["public"]["Enums"]["perm_scope"]
        }
        Update: {
          action?: Database["public"]["Enums"]["perm_action"]
          created_at?: string
          description?: string | null
          is_system?: boolean
          key?: string
          label_pt?: string
          module?: string
          resource?: string
          scope?: Database["public"]["Enums"]["perm_scope"]
        }
        Relationships: []
      }
      phone_normalization_items: {
        Row: {
          applied_at: string | null
          classification: string
          column_name: string
          id: number
          original_value: string | null
          proposed_ext: string | null
          proposed_value: string | null
          reason: string | null
          resolution: string | null
          resolved_at: string | null
          resolved_run_id: string | null
          review_kind: string | null
          reviewed_by: string | null
          rolled_back_at: string | null
          row_id: string
          run_id: string
          table_name: string
          workspace_id: string
        }
        Insert: {
          applied_at?: string | null
          classification: string
          column_name: string
          id?: number
          original_value?: string | null
          proposed_ext?: string | null
          proposed_value?: string | null
          reason?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_run_id?: string | null
          review_kind?: string | null
          reviewed_by?: string | null
          rolled_back_at?: string | null
          row_id: string
          run_id: string
          table_name: string
          workspace_id: string
        }
        Update: {
          applied_at?: string | null
          classification?: string
          column_name?: string
          id?: number
          original_value?: string | null
          proposed_ext?: string | null
          proposed_value?: string | null
          reason?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_run_id?: string | null
          review_kind?: string | null
          reviewed_by?: string | null
          rolled_back_at?: string | null
          row_id?: string
          run_id?: string
          table_name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_normalization_items_resolved_run_id_fkey"
            columns: ["resolved_run_id"]
            isOneToOne: false
            referencedRelation: "phone_normalization_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_normalization_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "phone_normalization_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_normalization_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_normalization_runs: {
        Row: {
          counts: Json
          created_at: string
          criteria: string
          finished_at: string | null
          id: string
          mode: string
          normalizer_version: string
          notes: string | null
          parent_run_id: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          counts?: Json
          created_at?: string
          criteria: string
          finished_at?: string | null
          id?: string
          mode: string
          normalizer_version: string
          notes?: string | null
          parent_run_id?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          counts?: Json
          created_at?: string
          criteria?: string
          finished_at?: string | null
          id?: string
          mode?: string
          normalizer_version?: string
          notes?: string | null
          parent_run_id?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_normalization_runs_parent_run_id_fkey"
            columns: ["parent_run_id"]
            isOneToOne: false
            referencedRelation: "phone_normalization_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_normalization_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stage_substatuses: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          owner_id: string
          pipeline_id: string
          position: number
          stage_value: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          owner_id?: string
          pipeline_id: string
          position?: number
          stage_value: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          owner_id?: string
          pipeline_id?: string
          position?: number
          stage_value?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stage_substatuses_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stage_substatuses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          config: Json
          created_at: string
          default_view: string | null
          entity: string
          id: string
          is_default: boolean
          name: string
          owner_id: string
          stages: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          default_view?: string | null
          entity: string
          id?: string
          is_default?: boolean
          name: string
          owner_id?: string
          stages?: Json
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          config?: Json
          created_at?: string
          default_view?: string | null
          entity?: string
          id?: string
          is_default?: boolean
          name?: string
          owner_id?: string
          stages?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_entitlements: {
        Row: {
          created_at: string
          enabled: boolean
          key: string
          limit_int: number | null
          module_id: string | null
          plan_code: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          key: string
          limit_int?: number | null
          module_id?: string | null
          plan_code: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          key?: string
          limit_int?: number | null
          module_id?: string | null
          plan_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_entitlements_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_entitlements_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["code"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          name: string
          price_monthly: number
          price_yearly: number
          tier_rank: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          name: string
          price_monthly?: number
          price_yearly?: number
          tier_rank: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          name?: string
          price_monthly?: number
          price_yearly?: number
          tier_rank?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          created_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      platform_alert_events: {
        Row: {
          context: Json
          fired_at: string
          id: string
          message: string
          resolved_at: string | null
          rule_id: string | null
          severity: string
        }
        Insert: {
          context?: Json
          fired_at?: string
          id?: string
          message: string
          resolved_at?: string | null
          rule_id?: string | null
          severity?: string
        }
        Update: {
          context?: Json
          fired_at?: string
          id?: string
          message?: string
          resolved_at?: string | null
          rule_id?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_alert_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "platform_alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_alert_rules: {
        Row: {
          channels: Json
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          name: string
          rule_type: string
          target_key: string | null
          threshold_mins: number | null
          threshold_pct: number | null
          updated_at: string
        }
        Insert: {
          channels?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name: string
          rule_type: string
          target_key?: string | null
          threshold_mins?: number | null
          threshold_pct?: number | null
          updated_at?: string
        }
        Update: {
          channels?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name?: string
          rule_type?: string
          target_key?: string | null
          threshold_mins?: number | null
          threshold_pct?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_sandboxes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          last_synced_at: string | null
          name: string
          promoted_at: string | null
          sandbox_workspace_id: string
          source_workspace_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          last_synced_at?: string | null
          name: string
          promoted_at?: string | null
          sandbox_workspace_id: string
          source_workspace_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          last_synced_at?: string | null
          name?: string
          promoted_at?: string | null
          sandbox_workspace_id?: string
          source_workspace_id?: string
          status?: string
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
          workspace_id: string
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
          workspace_id?: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_responses_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbook_responses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      playbooks: {
        Row: {
          assigned_to: string | null
          content: Json
          created_at: string
          enabled: boolean
          entity: string
          id: string
          name: string
          owner_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          content?: Json
          created_at?: string
          enabled?: boolean
          entity: string
          id?: string
          name: string
          owner_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          assigned_to?: string | null
          content?: Json
          created_at?: string
          enabled?: boolean
          entity?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbooks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_workspace_id: string | null
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          notification_preferences: Json
          phone: string | null
          updated_at: string
        }
        Insert: {
          active_workspace_id?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          notification_preferences?: Json
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active_workspace_id?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          notification_preferences?: Json
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_workspace_id_fkey"
            columns: ["active_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_alert_events: {
        Row: {
          actor: string | null
          after: Json | null
          alert_id: string
          before: Json | null
          created_at: string
          id: string
          kind: string
          note: string | null
          run_id: string | null
          workspace_id: string
        }
        Insert: {
          actor?: string | null
          after?: Json | null
          alert_id: string
          before?: Json | null
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          run_id?: string | null
          workspace_id: string
        }
        Update: {
          actor?: string | null
          after?: Json | null
          alert_id?: string
          before?: Json | null
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          run_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_alert_events_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "project_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_alert_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_alert_runs: {
        Row: {
          actor: string | null
          counts: Json
          evaluated_on: string
          finished_at: string | null
          id: string
          started_at: string
          trigger: string
          tz: string
          workspace_id: string
        }
        Insert: {
          actor?: string | null
          counts?: Json
          evaluated_on: string
          finished_at?: string | null
          id?: string
          started_at?: string
          trigger?: string
          tz: string
          workspace_id: string
        }
        Update: {
          actor?: string | null
          counts?: Json
          evaluated_on?: string
          finished_at?: string | null
          id?: string
          started_at?: string
          trigger?: string
          tz?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_alert_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_alerts: {
        Row: {
          deal_id: string | null
          dedupe_key: string
          evidence: Json
          first_detected_at: string
          id: string
          last_detected_at: string
          owner_user_id: string | null
          period_from: string | null
          period_to: string | null
          person_id: string | null
          present: boolean
          project_id: string | null
          reopened_count: number
          resolution: string | null
          resolved_at: string | null
          rule_key: string
          rule_version: number | null
          severity: string
          snoozed_until: string | null
          status: string
          subject_user_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          deal_id?: string | null
          dedupe_key: string
          evidence?: Json
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          owner_user_id?: string | null
          period_from?: string | null
          period_to?: string | null
          person_id?: string | null
          present?: boolean
          project_id?: string | null
          reopened_count?: number
          resolution?: string | null
          resolved_at?: string | null
          rule_key: string
          rule_version?: number | null
          severity: string
          snoozed_until?: string | null
          status?: string
          subject_user_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          deal_id?: string | null
          dedupe_key?: string
          evidence?: Json
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          owner_user_id?: string | null
          period_from?: string | null
          period_to?: string | null
          person_id?: string | null
          present?: boolean
          project_id?: string | null
          reopened_count?: number
          resolution?: string | null
          resolved_at?: string | null
          rule_key?: string
          rule_version?: number | null
          severity?: string
          snoozed_until?: string | null
          status?: string
          subject_user_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_alerts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_alerts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_alerts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_alerts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_total_cost"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "project_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_alerts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_billing_configs: {
        Row: {
          contract_id: string
          created_at: string
          created_by: string
          currency: string
          id: string
          model: string
          params: Json
          reason: string
          service_id: string | null
          status: string
          supersedes_id: string | null
          valid_from: string
          valid_to: string | null
          version: number
          workspace_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          created_by: string
          currency: string
          id?: string
          model: string
          params?: Json
          reason: string
          service_id?: string | null
          status?: string
          supersedes_id?: string | null
          valid_from: string
          valid_to?: string | null
          version?: number
          workspace_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          model?: string
          params?: Json
          reason?: string
          service_id?: string | null
          status?: string
          supersedes_id?: string | null
          valid_from?: string
          valid_to?: string | null
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_billing_configs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_billing_configs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_billing_configs_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "project_billing_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_billing_configs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_billing_events: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          detail: Json
          entity_id: string | null
          entity_type: string
          id: string
          reason: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          reason?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          reason?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_billing_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_client_acceptances: {
        Row: {
          client_contact_id: string | null
          client_email: string | null
          client_name: string
          entries_snapshot: Json
          entry_count: number
          evidence: string
          evidence_reference: string | null
          id: string
          method: string
          period_from: string
          period_to: string
          project_id: string
          recorded_at: string
          recorded_by: string
          status: string
          total_seconds: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          workspace_id: string
        }
        Insert: {
          client_contact_id?: string | null
          client_email?: string | null
          client_name: string
          entries_snapshot?: Json
          entry_count?: number
          evidence: string
          evidence_reference?: string | null
          id?: string
          method?: string
          period_from: string
          period_to: string
          project_id: string
          recorded_at?: string
          recorded_by: string
          status: string
          total_seconds?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          workspace_id: string
        }
        Update: {
          client_contact_id?: string | null
          client_email?: string | null
          client_name?: string
          entries_snapshot?: Json
          entry_count?: number
          evidence?: string
          evidence_reference?: string | null
          id?: string
          method?: string
          period_from?: string
          period_to?: string
          project_id?: string
          recorded_at?: string
          recorded_by?: string
          status?: string
          total_seconds?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_client_acceptances_client_contact_id_fkey"
            columns: ["client_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_client_acceptances_client_contact_id_fkey"
            columns: ["client_contact_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_client_acceptances_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_client_acceptances_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_deal_links: {
        Row: {
          created_at: string
          created_by: string | null
          deal_id: string
          delivery_group_key: string
          id: string
          note: string | null
          project_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deal_id: string
          delivery_group_key?: string
          id?: string
          note?: string | null
          project_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deal_id?: string
          delivery_group_key?: string
          id?: string
          note?: string | null
          project_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_deal_links_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_deal_links_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_deal_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_deal_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_delivery_template_services: {
        Row: {
          created_at: string
          service_catalog_id: string
          template_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          service_catalog_id: string
          template_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          service_catalog_id?: string
          template_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_delivery_template_service_workspace_id_template_id_fkey"
            columns: ["workspace_id", "template_id"]
            isOneToOne: false
            referencedRelation: "project_delivery_templates"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "project_delivery_template_services_service_catalog_id_fkey"
            columns: ["service_catalog_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      project_delivery_template_versions: {
        Row: {
          created_at: string
          created_by: string | null
          definition: Json
          id: string
          template_id: string
          version: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          definition?: Json
          id?: string
          template_id: string
          version: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          definition?: Json
          id?: string
          template_id?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_delivery_template_version_workspace_id_template_id_fkey"
            columns: ["workspace_id", "template_id"]
            isOneToOne: false
            referencedRelation: "project_delivery_templates"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      project_delivery_templates: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          delivery_kind: string
          description: string | null
          id: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          delivery_kind: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          delivery_kind?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_delivery_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_folders: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          sort_order: number
          space_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          sort_order?: number
          space_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          sort_order?: number
          space_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_folders_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_folders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_link_batches: {
        Row: {
          actor: string | null
          counts: Json
          created_at: string
          id: string
          kind: string
          workspace_id: string
        }
        Insert: {
          actor?: string | null
          counts?: Json
          created_at?: string
          id?: string
          kind: string
          workspace_id: string
        }
        Update: {
          actor?: string | null
          counts?: Json
          created_at?: string
          id?: string
          kind?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_link_batches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_link_changes: {
        Row: {
          actor: string | null
          batch_id: string
          created_at: string
          criterion: string
          evidence: Json
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          provider: string | null
          revert_batch_id: string | null
          reverted_at: string | null
          reverted_by: string | null
          subject_id: string | null
          target_id: string
          target_table: string
          workspace_id: string
        }
        Insert: {
          actor?: string | null
          batch_id: string
          created_at?: string
          criterion: string
          evidence?: Json
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          provider?: string | null
          revert_batch_id?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
          subject_id?: string | null
          target_id: string
          target_table: string
          workspace_id: string
        }
        Update: {
          actor?: string | null
          batch_id?: string
          created_at?: string
          criterion?: string
          evidence?: Json
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          provider?: string | null
          revert_batch_id?: string | null
          reverted_at?: string | null
          reverted_by?: string | null
          subject_id?: string | null
          target_id?: string
          target_table?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_link_changes_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "project_link_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_link_changes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_link_suggestions: {
        Row: {
          candidate_id: string
          created_at: string
          criterion: string
          decided_at: string | null
          decided_by: string | null
          detail: Json
          id: string
          kind: string
          note: string | null
          provider: string
          status: string
          subject_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          criterion: string
          decided_at?: string | null
          decided_by?: string | null
          detail?: Json
          id?: string
          kind: string
          note?: string | null
          provider: string
          status?: string
          subject_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          criterion?: string
          decided_at?: string | null
          decided_by?: string | null
          detail?: Json
          id?: string
          kind?: string
          note?: string | null
          provider?: string
          status?: string
          subject_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_link_suggestions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_list_custom_fields: {
        Row: {
          created_at: string
          id: string
          key: string
          label: string
          list_id: string
          options: Json | null
          sort_order: number
          type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          label: string
          list_id: string
          options?: Json | null
          sort_order?: number
          type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          label?: string
          list_id?: string
          options?: Json | null
          sort_order?: number
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_list_custom_fields_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "project_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_list_custom_fields_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_list_templates: {
        Row: {
          created_at: string
          created_by: string | null
          custom_fields: Json
          description: string | null
          id: string
          name: string
          statuses: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          description?: string | null
          id?: string
          name: string
          statuses?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          description?: string | null
          id?: string
          name?: string
          statuses?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_list_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_lists: {
        Row: {
          archived_at: string | null
          assigned_to: string | null
          color: string | null
          created_at: string
          created_by: string | null
          folder_id: string | null
          icon: string | null
          id: string
          name: string
          project_id: string | null
          sort_order: number
          space_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          assigned_to?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          folder_id?: string | null
          icon?: string | null
          id?: string
          name: string
          project_id?: string | null
          sort_order?: number
          space_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          assigned_to?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          folder_id?: string | null
          icon?: string | null
          id?: string
          name?: string
          project_id?: string | null
          sort_order?: number
          space_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_lists_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "project_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_lists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_lists_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_lists_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_measurement_financial_links: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          financial_entry_id: string
          id: string
          kind: string
          measurement_id: string
          unlink_reason: string | null
          unlinked_at: string | null
          unlinked_by: string | null
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          financial_entry_id: string
          id?: string
          kind: string
          measurement_id: string
          unlink_reason?: string | null
          unlinked_at?: string | null
          unlinked_by?: string | null
          workspace_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          financial_entry_id?: string
          id?: string
          kind?: string
          measurement_id?: string
          unlink_reason?: string | null
          unlinked_at?: string | null
          unlinked_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_measurement_financial_links_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_measurement_financial_links_measurement_id_fkey"
            columns: ["measurement_id"]
            isOneToOne: false
            referencedRelation: "project_measurements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_measurement_financial_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_measurement_lines: {
        Row: {
          active: boolean
          amount: number | null
          billed_seconds: number | null
          created_at: string
          description: string | null
          detail: Json
          id: string
          included: boolean
          issue: string | null
          line_no: number
          measurement_id: string
          project_id: string | null
          quantity: number | null
          rate_amount: number | null
          rate_id: string | null
          seconds: number | null
          source_id: string | null
          source_revision: number | null
          source_type: string
          unit: string | null
          user_id: string | null
          work_date: string | null
          workspace_id: string
        }
        Insert: {
          active: boolean
          amount?: number | null
          billed_seconds?: number | null
          created_at?: string
          description?: string | null
          detail?: Json
          id?: string
          included: boolean
          issue?: string | null
          line_no: number
          measurement_id: string
          project_id?: string | null
          quantity?: number | null
          rate_amount?: number | null
          rate_id?: string | null
          seconds?: number | null
          source_id?: string | null
          source_revision?: number | null
          source_type: string
          unit?: string | null
          user_id?: string | null
          work_date?: string | null
          workspace_id: string
        }
        Update: {
          active?: boolean
          amount?: number | null
          billed_seconds?: number | null
          created_at?: string
          description?: string | null
          detail?: Json
          id?: string
          included?: boolean
          issue?: string | null
          line_no?: number
          measurement_id?: string
          project_id?: string | null
          quantity?: number | null
          rate_amount?: number | null
          rate_id?: string | null
          seconds?: number | null
          source_id?: string | null
          source_revision?: number | null
          source_type?: string
          unit?: string | null
          user_id?: string | null
          work_date?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_measurement_lines_measurement_id_fkey"
            columns: ["measurement_id"]
            isOneToOne: false
            referencedRelation: "project_measurements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_measurement_lines_rate_id_fkey"
            columns: ["rate_id"]
            isOneToOne: false
            referencedRelation: "project_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_measurement_lines_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_measurements: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attempts: number
          auto_hash: string | null
          blockers: Json
          closed_at: string | null
          closed_by: string | null
          closed_reason: string | null
          company_id: string | null
          config_id: string
          config_version: number
          contract_id: string
          created_at: string
          created_by: string
          currency: string
          failed_at: string | null
          failure_reason: string | null
          financial_entry_id: string | null
          gates: Json
          generated_at: string | null
          generated_by: string | null
          id: string
          kind: string
          lines_hash: string
          model: string
          period_from: string
          period_to: string
          revision: number
          rules_snapshot: Json
          service_id: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          timezone: string
          total_amount: number | null
          total_seconds: number
          updated_at: string
          warnings: Json
          workspace_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attempts?: number
          auto_hash?: string | null
          blockers?: Json
          closed_at?: string | null
          closed_by?: string | null
          closed_reason?: string | null
          company_id?: string | null
          config_id: string
          config_version: number
          contract_id: string
          created_at?: string
          created_by: string
          currency: string
          failed_at?: string | null
          failure_reason?: string | null
          financial_entry_id?: string | null
          gates?: Json
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          kind?: string
          lines_hash?: string
          model: string
          period_from: string
          period_to: string
          revision?: number
          rules_snapshot?: Json
          service_id?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          timezone: string
          total_amount?: number | null
          total_seconds?: number
          updated_at?: string
          warnings?: Json
          workspace_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attempts?: number
          auto_hash?: string | null
          blockers?: Json
          closed_at?: string | null
          closed_by?: string | null
          closed_reason?: string | null
          company_id?: string | null
          config_id?: string
          config_version?: number
          contract_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          failed_at?: string | null
          failure_reason?: string | null
          financial_entry_id?: string | null
          gates?: Json
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          kind?: string
          lines_hash?: string
          model?: string
          period_from?: string
          period_to?: string
          revision?: number
          rules_snapshot?: Json
          service_id?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          timezone?: string
          total_amount?: number | null
          total_seconds?: number
          updated_at?: string
          warnings?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_measurements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_measurements_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "project_billing_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_measurements_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_measurements_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_measurements_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_measurements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          bill_rate_hour: number | null
          can_track_time: boolean
          cost_rate_hour: number | null
          created_at: string
          id: string
          project_id: string
          role_in_project: Database["public"]["Enums"]["project_member_role"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          bill_rate_hour?: number | null
          can_track_time?: boolean
          cost_rate_hour?: number | null
          created_at?: string
          id?: string
          project_id: string
          role_in_project?: Database["public"]["Enums"]["project_member_role"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          bill_rate_hour?: number | null
          can_track_time?: boolean
          cost_rate_hour?: number | null
          created_at?: string
          id?: string
          project_id?: string
          role_in_project?: Database["public"]["Enums"]["project_member_role"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          assigned_to: string | null
          bill_amount: number | null
          billable: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          due_at: string | null
          financial_entry_id: string | null
          id: string
          name: string
          project_id: string
          sort_order: number
          status: Database["public"]["Enums"]["project_milestone_status"]
          template_item_key: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          bill_amount?: number | null
          billable?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          financial_entry_id?: string | null
          id?: string
          name: string
          project_id: string
          sort_order?: number
          status?: Database["public"]["Enums"]["project_milestone_status"]
          template_item_key?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          bill_amount?: number | null
          billable?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          financial_entry_id?: string | null
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["project_milestone_status"]
          template_item_key?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_entry_fk"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_milestones_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_package_balances: {
        Row: {
          active: boolean
          carry_in: Json
          carry_in_seconds: number
          carry_out: Json
          config_id: string
          consumed_seconds: number
          created_at: string
          id: string
          included_seconds: number
          measurement_id: string
          overage_seconds: number
          period_from: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          carry_in?: Json
          carry_in_seconds?: number
          carry_out?: Json
          config_id: string
          consumed_seconds: number
          created_at?: string
          id?: string
          included_seconds: number
          measurement_id: string
          overage_seconds: number
          period_from: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          carry_in?: Json
          carry_in_seconds?: number
          carry_out?: Json
          config_id?: string
          consumed_seconds?: number
          created_at?: string
          id?: string
          included_seconds?: number
          measurement_id?: string
          overage_seconds?: number
          period_from?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_package_balances_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "project_billing_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_package_balances_measurement_id_fkey"
            columns: ["measurement_id"]
            isOneToOne: false
            referencedRelation: "project_measurements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_package_balances_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_people_group_members: {
        Row: {
          group_id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          group_id: string
          user_id: string
          workspace_id: string
        }
        Update: {
          group_id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_people_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "project_people_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_people_group_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_people_groups: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          name: string
          source: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          name: string
          source?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          name?: string
          source?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_people_groups_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_period_closings: {
        Row: {
          closed_at: string
          closed_by: string
          entries_snapshot: Json
          entry_count: number
          excluded_import_count: number
          excluded_import_seconds: number
          id: string
          period_from: string
          period_to: string
          policy_version: number
          project_id: string | null
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          scope: string
          status: string
          timezone: string
          total_seconds: number
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          closed_at?: string
          closed_by: string
          entries_snapshot: Json
          entry_count: number
          excluded_import_count?: number
          excluded_import_seconds?: number
          id?: string
          period_from: string
          period_to: string
          policy_version?: number
          project_id?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          scope: string
          status: string
          timezone: string
          total_seconds: number
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          closed_at?: string
          closed_by?: string
          entries_snapshot?: Json
          entry_count?: number
          excluded_import_count?: number
          excluded_import_seconds?: number
          id?: string
          period_from?: string
          period_to?: string
          policy_version?: number
          project_id?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          scope?: string
          status?: string
          timezone?: string
          total_seconds?: number
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_period_closings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_period_closings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_rates: {
        Row: {
          allocation_id: string | null
          amount: number
          confirmed_by: string | null
          created_at: string
          created_by: string
          currency: string
          id: string
          kind: string
          person_id: string | null
          project_id: string | null
          proration: string | null
          reason: string
          scope: string
          service_catalog_id: string | null
          service_id: string | null
          status: string
          supersedes_id: string | null
          unit: string
          user_id: string | null
          valid_from: string
          valid_to: string | null
          version: number
          workspace_id: string
        }
        Insert: {
          allocation_id?: string | null
          amount: number
          confirmed_by?: string | null
          created_at?: string
          created_by: string
          currency: string
          id?: string
          kind: string
          person_id?: string | null
          project_id?: string | null
          proration?: string | null
          reason: string
          scope: string
          service_catalog_id?: string | null
          service_id?: string | null
          status?: string
          supersedes_id?: string | null
          unit: string
          user_id?: string | null
          valid_from: string
          valid_to?: string | null
          version?: number
          workspace_id: string
        }
        Update: {
          allocation_id?: string | null
          amount?: number
          confirmed_by?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          kind?: string
          person_id?: string | null
          project_id?: string | null
          proration?: string | null
          reason?: string
          scope?: string
          service_catalog_id?: string | null
          service_id?: string | null
          status?: string
          supersedes_id?: string | null
          unit?: string
          user_id?: string | null
          valid_from?: string
          valid_to?: string | null
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_rates_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "people_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_rates_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_rates_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_total_cost"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "project_rates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_rates_service_catalog_id_fkey"
            columns: ["service_catalog_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_rates_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_rates_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "project_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_rates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_reconciliation_issue_events: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          from_status: string | null
          id: string
          issue_id: string
          note: string | null
          to_status: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          issue_id: string
          note?: string | null
          to_status?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          issue_id?: string
          note?: string | null
          to_status?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_reconciliation_issue_events_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "project_reconciliation_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_reconciliation_issue_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_reconciliation_issues: {
        Row: {
          created_at: string
          dedupe_key: string
          detail: Json
          entry_date: string | null
          first_detected_at: string
          id: string
          issue_type: string
          last_detected_at: string
          present: boolean
          project_id: string | null
          provider: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          seconds_impact: number
          source_external_id: string | null
          staging_id: string | null
          staging_table: string | null
          status: string
          time_entry_id: string | null
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          dedupe_key: string
          detail?: Json
          entry_date?: string | null
          first_detected_at?: string
          id?: string
          issue_type: string
          last_detected_at?: string
          present?: boolean
          project_id?: string | null
          provider: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          seconds_impact?: number
          source_external_id?: string | null
          staging_id?: string | null
          staging_table?: string | null
          status?: string
          time_entry_id?: string | null
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          detail?: Json
          entry_date?: string | null
          first_detected_at?: string
          id?: string
          issue_type?: string
          last_detected_at?: string
          present?: boolean
          project_id?: string | null
          provider?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          seconds_impact?: number
          source_external_id?: string | null
          staging_id?: string | null
          staging_table?: string | null
          status?: string
          time_entry_id?: string | null
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_reconciliation_issues_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "project_time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_reconciliation_issues_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_reconciliation_refreshes: {
        Row: {
          actor: string | null
          counts: Json
          finished_at: string | null
          id: string
          started_at: string
          workspace_id: string
        }
        Insert: {
          actor?: string | null
          counts?: Json
          finished_at?: string | null
          id?: string
          started_at?: string
          workspace_id: string
        }
        Update: {
          actor?: string | null
          counts?: Json
          finished_at?: string | null
          id?: string
          started_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_reconciliation_refreshes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_risk_rule_versions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string
          project_id: string | null
          rules: Json
          version: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          note: string
          project_id?: string | null
          rules: Json
          version: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string
          project_id?: string | null
          rules?: Json
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_risk_rule_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_risk_rule_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_spaces: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_spaces_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_task_checklists: {
        Row: {
          created_at: string
          done_at: string | null
          done_by: string | null
          id: string
          is_done: boolean
          sort_order: number
          task_id: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          sort_order?: number
          task_id: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          sort_order?: number
          task_id?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_task_checklists_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_task_dependencies: {
        Row: {
          created_at: string
          dep_type: string
          depends_on_task_id: string
          id: string
          task_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          dep_type?: string
          depends_on_task_id: string
          id?: string
          task_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          dep_type?: string
          depends_on_task_id?: string
          id?: string
          task_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_task_statuses: {
        Row: {
          category: string
          color: string | null
          created_at: string
          id: string
          is_default: boolean
          list_id: string
          name: string
          sort_order: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category?: string
          color?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          list_id: string
          name: string
          sort_order?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          list_id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_task_statuses_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "project_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_task_statuses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          assignee_id: string | null
          assignee_ids: string[]
          created_at: string
          custom_field_values: Json
          custom_status_id: string | null
          description: string | null
          due_at: string | null
          estimated_hours: number | null
          id: string
          list_id: string | null
          milestone_id: string | null
          parent_task_id: string | null
          priority: Database["public"]["Enums"]["project_task_priority"]
          project_id: string
          sort_order: number
          start_at: string | null
          status: Database["public"]["Enums"]["project_task_status"]
          tags: string[]
          template_item_key: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assignee_id?: string | null
          assignee_ids?: string[]
          created_at?: string
          custom_field_values?: Json
          custom_status_id?: string | null
          description?: string | null
          due_at?: string | null
          estimated_hours?: number | null
          id?: string
          list_id?: string | null
          milestone_id?: string | null
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["project_task_priority"]
          project_id: string
          sort_order?: number
          start_at?: string | null
          status?: Database["public"]["Enums"]["project_task_status"]
          tags?: string[]
          template_item_key?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assignee_id?: string | null
          assignee_ids?: string[]
          created_at?: string
          custom_field_values?: Json
          custom_status_id?: string | null
          description?: string | null
          due_at?: string | null
          estimated_hours?: number | null
          id?: string
          list_id?: string | null
          milestone_id?: string | null
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["project_task_priority"]
          project_id?: string
          sort_order?: number
          start_at?: string | null
          status?: Database["public"]["Enums"]["project_task_status"]
          tags?: string[]
          template_item_key?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_custom_status_id_fkey"
            columns: ["custom_status_id"]
            isOneToOne: false
            referencedRelation: "project_task_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "project_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "project_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_time_approvers: {
        Row: {
          created_at: string
          created_by: string | null
          delegate_of: string | null
          id: string
          project_id: string
          reason: string | null
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          role: string
          subject_user_id: string | null
          user_id: string
          valid_from: string
          valid_to: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delegate_of?: string | null
          id?: string
          project_id: string
          reason?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role: string
          subject_user_id?: string | null
          user_id: string
          valid_from?: string
          valid_to?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delegate_of?: string | null
          id?: string
          project_id?: string
          reason?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role?: string
          subject_user_id?: string | null
          user_id?: string
          valid_from?: string
          valid_to?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_time_approvers_delegate_of_fkey"
            columns: ["delegate_of"]
            isOneToOne: false
            referencedRelation: "project_time_approvers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_approvers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_approvers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_time_client_requests: {
        Row: {
          client_request_id: string
          created_at: string
          device_recorded_at: string | null
          id: string
          request_hash: string
          time_entry_id: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          client_request_id: string
          created_at?: string
          device_recorded_at?: string | null
          id?: string
          request_hash: string
          time_entry_id?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          client_request_id?: string
          created_at?: string
          device_recorded_at?: string | null
          id?: string
          request_hash?: string
          time_entry_id?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      project_time_entries: {
        Row: {
          allocation_id: string | null
          approved_at: string | null
          approved_by: string | null
          billable: boolean
          client_acceptance_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          duration_seconds: number | null
          end_time: string | null
          entry_date: string | null
          entry_kind: string | null
          external_id: string | null
          financial_entry_id: string | null
          hourly_rate: number | null
          hours: number | null
          id: string
          invoice_id: string | null
          invoiced_at: string | null
          locked_at: string | null
          period_closing_id: string | null
          person_id: string | null
          project_id: string
          reject_reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          review_flags: string[] | null
          revision: number
          source: string
          start_time: string | null
          started_at: string | null
          status: string
          stopped_at: string | null
          submission_id: string | null
          submitted_at: string | null
          task_id: string | null
          timer_session_id: string | null
          timezone: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          allocation_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          billable?: boolean
          client_acceptance_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          duration_seconds?: number | null
          end_time?: string | null
          entry_date?: string | null
          entry_kind?: string | null
          external_id?: string | null
          financial_entry_id?: string | null
          hourly_rate?: number | null
          hours?: number | null
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          locked_at?: string | null
          period_closing_id?: string | null
          person_id?: string | null
          project_id: string
          reject_reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          review_flags?: string[] | null
          revision?: number
          source?: string
          start_time?: string | null
          started_at?: string | null
          status?: string
          stopped_at?: string | null
          submission_id?: string | null
          submitted_at?: string | null
          task_id?: string | null
          timer_session_id?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          allocation_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          billable?: boolean
          client_acceptance_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          duration_seconds?: number | null
          end_time?: string | null
          entry_date?: string | null
          entry_kind?: string | null
          external_id?: string | null
          financial_entry_id?: string | null
          hourly_rate?: number | null
          hours?: number | null
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          locked_at?: string | null
          period_closing_id?: string | null
          person_id?: string | null
          project_id?: string
          reject_reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          review_flags?: string[] | null
          revision?: number
          source?: string
          start_time?: string | null
          started_at?: string | null
          status?: string
          stopped_at?: string | null
          submission_id?: string | null
          submitted_at?: string | null
          task_id?: string | null
          timer_session_id?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_time_entries_acceptance_fk"
            columns: ["client_acceptance_id"]
            isOneToOne: false
            referencedRelation: "project_client_acceptances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_entries_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "people_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_entries_closing_fk"
            columns: ["period_closing_id"]
            isOneToOne: false
            referencedRelation: "project_period_closings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_entries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_entries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_total_cost"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "project_time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_entries_submission_fk"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "project_timesheet_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_entries_timer_session_id_fkey"
            columns: ["timer_session_id"]
            isOneToOne: false
            referencedRelation: "project_timer_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_time_entry_tags: {
        Row: {
          tag_id: string
          time_entry_id: string
          workspace_id: string
        }
        Insert: {
          tag_id: string
          time_entry_id: string
          workspace_id: string
        }
        Update: {
          tag_id?: string
          time_entry_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_time_entry_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "project_time_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_entry_tags_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "project_time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_entry_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_time_favorites: {
        Row: {
          created_at: string
          project_id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          project_id: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          project_id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_time_favorites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_time_favorites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_time_policies: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          rules: Json
          version: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          rules: Json
          version: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          rules?: Json
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_time_policies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_time_tags: {
        Row: {
          archived: boolean
          created_at: string
          external_id: string | null
          id: string
          name: string
          source: string
          workspace_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          external_id?: string | null
          id?: string
          name: string
          source?: string
          workspace_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          external_id?: string | null
          id?: string
          name?: string
          source?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_time_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_time_workflow_events: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          detail: Json
          entity_id: string | null
          entity_type: string
          id: string
          project_id: string | null
          reason: string | null
          subject_user_id: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          project_id?: string | null
          reason?: string | null
          subject_user_id?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          project_id?: string | null
          reason?: string | null
          subject_user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_time_workflow_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_timer_segments: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          kind: string
          session_id: string
          started_at: string
          task_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          kind: string
          session_id: string
          started_at: string
          task_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          kind?: string
          session_id?: string
          started_at?: string
          task_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_timer_segments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "project_timer_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_timer_segments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_timer_segments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_timer_sessions: {
        Row: {
          billable: boolean
          client_request_id: string | null
          created_at: string
          description: string | null
          id: string
          policy_version: number | null
          project_id: string
          started_at: string
          state: string
          stopped_at: string | null
          task_id: string | null
          timezone: string
          updated_at: string
          user_id: string
          version: number
          workspace_id: string
        }
        Insert: {
          billable?: boolean
          client_request_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          policy_version?: number | null
          project_id: string
          started_at?: string
          state: string
          stopped_at?: string | null
          task_id?: string | null
          timezone: string
          updated_at?: string
          user_id: string
          version?: number
          workspace_id: string
        }
        Update: {
          billable?: boolean
          client_request_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          policy_version?: number | null
          project_id?: string
          started_at?: string
          state?: string
          stopped_at?: string | null
          task_id?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_timer_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_timer_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_timer_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_timesheet_submission_items: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          decision: string
          duration_seconds: number
          entry_date: string
          entry_revision: number
          id: string
          project_id: string
          reason: string | null
          submission_id: string
          time_entry_id: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          duration_seconds: number
          entry_date: string
          entry_revision: number
          id?: string
          project_id: string
          reason?: string | null
          submission_id: string
          time_entry_id?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          duration_seconds?: number
          entry_date?: string
          entry_revision?: number
          id?: string
          project_id?: string
          reason?: string | null
          submission_id?: string
          time_entry_id?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_timesheet_submission_items_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "project_timesheet_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_timesheet_submission_items_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "project_time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_timesheet_submission_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_timesheet_submissions: {
        Row: {
          entries_hash: string
          entry_count: number
          id: string
          period_from: string
          period_to: string
          policy_version: number
          status: string
          submitted_at: string
          submitted_by: string | null
          timezone: string | null
          total_seconds: number
          updated_at: string
          user_id: string
          version: number
          workspace_id: string
        }
        Insert: {
          entries_hash: string
          entry_count: number
          id?: string
          period_from: string
          period_to: string
          policy_version?: number
          status: string
          submitted_at?: string
          submitted_by?: string | null
          timezone?: string | null
          total_seconds: number
          updated_at?: string
          user_id: string
          version: number
          workspace_id: string
        }
        Update: {
          entries_hash?: string
          entry_count?: number
          id?: string
          period_from?: string
          period_to?: string
          policy_version?: number
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          timezone?: string | null
          total_seconds?: number
          updated_at?: string
          user_id?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_timesheet_submissions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_updates: {
        Row: {
          assigned_to: string | null
          author_id: string | null
          created_at: string
          expected_delivery_date: string | null
          health: string | null
          id: string
          kind: string
          owner_id: string | null
          progress_pct: number | null
          project_id: string
          published_at: string
          summary: string | null
          title: string
          updated_at: string
          visibility: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          author_id?: string | null
          created_at?: string
          expected_delivery_date?: string | null
          health?: string | null
          id?: string
          kind?: string
          owner_id?: string | null
          progress_pct?: number | null
          project_id: string
          published_at?: string
          summary?: string | null
          title: string
          updated_at?: string
          visibility?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          author_id?: string | null
          created_at?: string
          expected_delivery_date?: string | null
          health?: string | null
          id?: string
          kind?: string
          owner_id?: string | null
          progress_pct?: number | null
          project_id?: string
          published_at?: string
          summary?: string | null
          title?: string
          updated_at?: string
          visibility?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          assigned_to: string | null
          client_acceptance_required: boolean
          client_contact_id: string | null
          company_id: string | null
          contract_id: string | null
          created_at: string
          deal_id: string | null
          delivery_group_key: string | null
          delivery_template_applied_at: string | null
          delivery_template_applied_by: string | null
          delivery_template_version_id: string | null
          description: string | null
          due_at: string | null
          id: string
          metadata: Json
          name: string
          origin: string | null
          owner_id: string
          planned_cost: number | null
          planned_hours: number | null
          progress: number
          role: Database["public"]["Enums"]["contract_role"]
          service_id: string | null
          source_line_item_id: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          client_acceptance_required?: boolean
          client_contact_id?: string | null
          company_id?: string | null
          contract_id?: string | null
          created_at?: string
          deal_id?: string | null
          delivery_group_key?: string | null
          delivery_template_applied_at?: string | null
          delivery_template_applied_by?: string | null
          delivery_template_version_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json
          name: string
          origin?: string | null
          owner_id: string
          planned_cost?: number | null
          planned_hours?: number | null
          progress?: number
          role?: Database["public"]["Enums"]["contract_role"]
          service_id?: string | null
          source_line_item_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          client_acceptance_required?: boolean
          client_contact_id?: string | null
          company_id?: string | null
          contract_id?: string | null
          created_at?: string
          deal_id?: string | null
          delivery_group_key?: string | null
          delivery_template_applied_at?: string | null
          delivery_template_applied_by?: string | null
          delivery_template_version_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json
          name?: string
          origin?: string | null
          owner_id?: string
          planned_cost?: number | null
          planned_hours?: number | null
          progress?: number
          role?: Database["public"]["Enums"]["contract_role"]
          service_id?: string | null
          source_line_item_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_contact_id_fkey"
            columns: ["client_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_contact_id_fkey"
            columns: ["client_contact_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_delivery_template_version_id_fkey"
            columns: ["delivery_template_version_id"]
            isOneToOne: false
            referencedRelation: "project_delivery_template_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_source_line_item_id_fkey"
            columns: ["source_line_item_id"]
            isOneToOne: false
            referencedRelation: "deal_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_source_line_item_id_fkey"
            columns: ["source_line_item_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deal_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          session_id: string | null
          workspace_id: string
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
          session_id?: string | null
          workspace_id?: string
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
          session_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_approvals: {
        Row: {
          comment: string | null
          created_at: string
          decided_at: string | null
          id: string
          proposal_id: string
          requested_by: string
          review_version: number | null
          reviewer_id: string | null
          status: Database["public"]["Enums"]["proposal_approval_status"]
          workspace_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          proposal_id: string
          requested_by: string
          review_version?: number | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["proposal_approval_status"]
          workspace_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          proposal_id?: string
          requested_by?: string
          review_version?: number | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["proposal_approval_status"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_approvals_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_approvals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_clauses: {
        Row: {
          body: string
          category: string | null
          created_at: string
          id: string
          is_default: boolean
          owner_id: string
          slug: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          owner_id: string
          slug: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          owner_id?: string
          slug?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_clauses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_template_services: {
        Row: {
          service_catalog_id: string
          template_id: string
          workspace_id: string
        }
        Insert: {
          service_catalog_id: string
          template_id: string
          workspace_id: string
        }
        Update: {
          service_catalog_id?: string
          template_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_template_services_service_catalog_id_fkey"
            columns: ["service_catalog_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_template_services_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "proposal_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_template_services_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_templates: {
        Row: {
          created_at: string
          description: string | null
          html: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          html?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          html?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          assigned_to: string | null
          body: string
          company_id: string | null
          contact_id: string | null
          created_at: string
          currency: string
          deal_id: string | null
          decided_at: string | null
          esign_document_id: string | null
          expires_at: string | null
          id: string
          locked: boolean
          owner_id: string
          proposal_template_id: string | null
          public_token: string | null
          quote_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          title: string
          total_amount: number | null
          updated_at: string
          variables: Json
          version: number
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          body?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          decided_at?: string | null
          esign_document_id?: string | null
          expires_at?: string | null
          id?: string
          locked?: boolean
          owner_id: string
          proposal_template_id?: string | null
          public_token?: string | null
          quote_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          title: string
          total_amount?: number | null
          updated_at?: string
          variables?: Json
          version?: number
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          body?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          decided_at?: string | null
          esign_document_id?: string | null
          expires_at?: string | null
          id?: string
          locked?: boolean
          owner_id?: string
          proposal_template_id?: string | null
          public_token?: string | null
          quote_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          title?: string
          total_amount?: number | null
          updated_at?: string
          variables?: Json
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_esign_document_id_fkey"
            columns: ["esign_document_id"]
            isOneToOne: false
            referencedRelation: "esign_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_proposal_template_id_fkey"
            columns: ["proposal_template_id"]
            isOneToOne: false
            referencedRelation: "proposal_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_cadence_steps: {
        Row: {
          body: string | null
          cadence_id: string
          channel: string
          created_at: string
          delay_days: number
          id: string
          max_wait_days: number | null
          on_timeout: string | null
          owner_id: string
          poll_interval_hours: number | null
          step_order: number
          subject: string | null
          task_instructions: string | null
          updated_at: string
          variant_label: string
          variant_weight: number
          workspace_id: string | null
        }
        Insert: {
          body?: string | null
          cadence_id: string
          channel: string
          created_at?: string
          delay_days?: number
          id?: string
          max_wait_days?: number | null
          on_timeout?: string | null
          owner_id: string
          poll_interval_hours?: number | null
          step_order: number
          subject?: string | null
          task_instructions?: string | null
          updated_at?: string
          variant_label?: string
          variant_weight?: number
          workspace_id?: string | null
        }
        Update: {
          body?: string | null
          cadence_id?: string
          channel?: string
          created_at?: string
          delay_days?: number
          id?: string
          max_wait_days?: number | null
          on_timeout?: string | null
          owner_id?: string
          poll_interval_hours?: number | null
          step_order?: number
          subject?: string | null
          task_instructions?: string | null
          updated_at?: string
          variant_label?: string
          variant_weight?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospecting_cadence_steps_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "prospecting_cadences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospecting_cadence_steps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_cadences: {
        Row: {
          assigned_to: string | null
          created_at: string
          daily_send_limit: number | null
          description: string | null
          enabled: boolean
          id: string
          name: string
          owner_id: string
          queue_id: string | null
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          scope: string
          send_days: number[]
          timezone: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          daily_send_limit?: number | null
          description?: string | null
          enabled?: boolean
          id?: string
          name: string
          owner_id: string
          queue_id?: string | null
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          scope?: string
          send_days?: number[]
          timezone?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          daily_send_limit?: number | null
          description?: string | null
          enabled?: boolean
          id?: string
          name?: string
          owner_id?: string
          queue_id?: string | null
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          scope?: string
          send_days?: number[]
          timezone?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospecting_cadences_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "prospecting_queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospecting_cadences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_call_attempts: {
        Row: {
          attempt_number: number
          campaign_id: string | null
          cost_usd: number | null
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          ended_reason: string | null
          id: string
          lead_id: string | null
          owner_id: string
          recording_url: string | null
          scheduled_at: string | null
          script_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["prospecting_call_status"]
          success_evaluation: string | null
          summary: string | null
          transcript: string | null
          updated_at: string
          vapi_call_id: string | null
          vapi_request: Json | null
          vapi_response: Json | null
          variant_id: string | null
          workspace_id: string
        }
        Insert: {
          attempt_number?: number
          campaign_id?: string | null
          cost_usd?: number | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          ended_reason?: string | null
          id?: string
          lead_id?: string | null
          owner_id: string
          recording_url?: string | null
          scheduled_at?: string | null
          script_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["prospecting_call_status"]
          success_evaluation?: string | null
          summary?: string | null
          transcript?: string | null
          updated_at?: string
          vapi_call_id?: string | null
          vapi_request?: Json | null
          vapi_response?: Json | null
          variant_id?: string | null
          workspace_id: string
        }
        Update: {
          attempt_number?: number
          campaign_id?: string | null
          cost_usd?: number | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          ended_reason?: string | null
          id?: string
          lead_id?: string | null
          owner_id?: string
          recording_url?: string | null
          scheduled_at?: string | null
          script_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["prospecting_call_status"]
          success_evaluation?: string | null
          summary?: string | null
          transcript?: string | null
          updated_at?: string
          vapi_call_id?: string | null
          vapi_request?: Json | null
          vapi_response?: Json | null
          variant_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospecting_call_attempts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "prospecting_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospecting_call_attempts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospecting_call_attempts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospecting_call_attempts_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "prospecting_scripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospecting_call_attempts_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "prospecting_campaign_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospecting_call_attempts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_campaign_variants: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          owner_id: string
          position: number
          script_id: string
          segment_id: string | null
          weight: number
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          owner_id: string
          position?: number
          script_id: string
          segment_id?: string | null
          weight?: number
          workspace_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          owner_id?: string
          position?: number
          script_id?: string
          segment_id?: string | null
          weight?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospecting_campaign_variants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "prospecting_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospecting_campaign_variants_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "prospecting_scripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospecting_campaign_variants_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_campaigns: {
        Row: {
          assigned_to: string | null
          assignment_mode: Database["public"]["Enums"]["prospecting_assignment_mode"]
          audience_mode: string
          audience_rules: Json
          created_at: string
          dialing_window: Json
          execution_user_id: string | null
          id: string
          lead_ids: string[]
          max_attempts: number
          name: string
          owner_id: string
          retry_interval_minutes: number
          source_ref: string | null
          source_type: Database["public"]["Enums"]["prospecting_source_type"]
          status: Database["public"]["Enums"]["prospecting_campaign_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          assignment_mode?: Database["public"]["Enums"]["prospecting_assignment_mode"]
          audience_mode?: string
          audience_rules?: Json
          created_at?: string
          dialing_window?: Json
          execution_user_id?: string | null
          id?: string
          lead_ids?: string[]
          max_attempts?: number
          name: string
          owner_id: string
          retry_interval_minutes?: number
          source_ref?: string | null
          source_type?: Database["public"]["Enums"]["prospecting_source_type"]
          status?: Database["public"]["Enums"]["prospecting_campaign_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          assignment_mode?: Database["public"]["Enums"]["prospecting_assignment_mode"]
          audience_mode?: string
          audience_rules?: Json
          created_at?: string
          dialing_window?: Json
          execution_user_id?: string | null
          id?: string
          lead_ids?: string[]
          max_attempts?: number
          name?: string
          owner_id?: string
          retry_interval_minutes?: number
          source_ref?: string | null
          source_type?: Database["public"]["Enums"]["prospecting_source_type"]
          status?: Database["public"]["Enums"]["prospecting_campaign_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospecting_campaigns_execution_user_id_fkey"
            columns: ["execution_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospecting_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_enrollments: {
        Row: {
          assigned_to: string | null
          cadence_id: string
          created_at: string
          current_step: number
          entity: string
          entity_id: string
          finished_at: string | null
          id: string
          last_error: string | null
          next_run_at: string | null
          owner_id: string
          started_at: string
          started_by: string | null
          status: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          cadence_id: string
          created_at?: string
          current_step?: number
          entity: string
          entity_id: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          next_run_at?: string | null
          owner_id: string
          started_at?: string
          started_by?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          cadence_id?: string
          created_at?: string
          current_step?: number
          entity?: string
          entity_id?: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          next_run_at?: string | null
          owner_id?: string
          started_at?: string
          started_by?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospecting_enrollments_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "prospecting_cadences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospecting_enrollments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_qualifications: {
        Row: {
          answers: Json
          created_at: string
          decision: string
          decision_reason: string | null
          entity: string
          entity_id: string
          icp_points: number | null
          id: string
          owner_id: string
          qualified_at: string | null
          qualified_by: string | null
          questionnaire_id: string
          questionnaire_points: number | null
          score: number | null
          total_score: number | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          answers?: Json
          created_at?: string
          decision?: string
          decision_reason?: string | null
          entity: string
          entity_id: string
          icp_points?: number | null
          id?: string
          owner_id: string
          qualified_at?: string | null
          qualified_by?: string | null
          questionnaire_id: string
          questionnaire_points?: number | null
          score?: number | null
          total_score?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          answers?: Json
          created_at?: string
          decision?: string
          decision_reason?: string | null
          entity?: string
          entity_id?: string
          icp_points?: number | null
          id?: string
          owner_id?: string
          qualified_at?: string | null
          qualified_by?: string | null
          questionnaire_id?: string
          questionnaire_points?: number | null
          score?: number | null
          total_score?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospecting_qualifications_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "prospecting_questionnaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospecting_qualifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_questionnaires: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          enabled: boolean
          field_layout: Json
          framework: string
          id: string
          is_template: boolean
          name: string
          owner_id: string
          pass_threshold: number
          pipeline_id: string | null
          scoring_enabled: boolean
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          field_layout?: Json
          framework?: string
          id?: string
          is_template?: boolean
          name: string
          owner_id: string
          pass_threshold?: number
          pipeline_id?: string | null
          scoring_enabled?: boolean
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          field_layout?: Json
          framework?: string
          id?: string
          is_template?: boolean
          name?: string
          owner_id?: string
          pass_threshold?: number
          pipeline_id?: string | null
          scoring_enabled?: boolean
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospecting_questionnaires_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_questions: {
        Row: {
          created_at: string
          help_text: string | null
          id: string
          label: string
          options: Json
          owner_id: string
          position: number
          questionnaire_id: string
          required: boolean
          scored: boolean
          text_min_chars: number
          text_points: number
          type: string
          updated_at: string
          weight: number
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          help_text?: string | null
          id?: string
          label: string
          options?: Json
          owner_id: string
          position?: number
          questionnaire_id: string
          required?: boolean
          scored?: boolean
          text_min_chars?: number
          text_points?: number
          type: string
          updated_at?: string
          weight?: number
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          help_text?: string | null
          id?: string
          label?: string
          options?: Json
          owner_id?: string
          position?: number
          questionnaire_id?: string
          required?: boolean
          scored?: boolean
          text_min_chars?: number
          text_points?: number
          type?: string
          updated_at?: string
          weight?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospecting_questions_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "prospecting_questionnaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospecting_questions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_queues: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          entity: string
          filters: Json
          id: string
          is_shared: boolean
          item_ids: string[]
          kind: string
          name: string
          nurture_cadence_id: string | null
          owner_id: string
          sort: Json
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          entity: string
          filters?: Json
          id?: string
          is_shared?: boolean
          item_ids?: string[]
          kind?: string
          name: string
          nurture_cadence_id?: string | null
          owner_id: string
          sort?: Json
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          entity?: string
          filters?: Json
          id?: string
          is_shared?: boolean
          item_ids?: string[]
          kind?: string
          name?: string
          nurture_cadence_id?: string | null
          owner_id?: string
          sort?: Json
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospecting_queues_nurture_cadence_id_fkey"
            columns: ["nurture_cadence_id"]
            isOneToOne: false
            referencedRelation: "prospecting_cadences"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_results: {
        Row: {
          apollo_score: number | null
          company_city: string | null
          company_country: string | null
          company_description: string | null
          company_domain: string | null
          company_employee_range: string | null
          company_employees: number | null
          company_linkedin_url: string | null
          company_name: string | null
          company_phone: string | null
          company_revenue: number | null
          company_size: string | null
          company_state: string | null
          company_technologies: string[] | null
          company_website: string | null
          contact_name: string | null
          created_at: string
          domain_hint: string | null
          email: string | null
          email_hint: string | null
          external_id: string | null
          id: string
          imported_at: string | null
          imported_lead_id: string | null
          industry: string | null
          linkedin_url: string | null
          location: string | null
          owner_id: string
          phone: string | null
          raw_payload: Json | null
          reason: string | null
          role_title: string | null
          search_id: string
          source: string
          workspace_id: string
        }
        Insert: {
          apollo_score?: number | null
          company_city?: string | null
          company_country?: string | null
          company_description?: string | null
          company_domain?: string | null
          company_employee_range?: string | null
          company_employees?: number | null
          company_linkedin_url?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_revenue?: number | null
          company_size?: string | null
          company_state?: string | null
          company_technologies?: string[] | null
          company_website?: string | null
          contact_name?: string | null
          created_at?: string
          domain_hint?: string | null
          email?: string | null
          email_hint?: string | null
          external_id?: string | null
          id?: string
          imported_at?: string | null
          imported_lead_id?: string | null
          industry?: string | null
          linkedin_url?: string | null
          location?: string | null
          owner_id: string
          phone?: string | null
          raw_payload?: Json | null
          reason?: string | null
          role_title?: string | null
          search_id: string
          source?: string
          workspace_id?: string
        }
        Update: {
          apollo_score?: number | null
          company_city?: string | null
          company_country?: string | null
          company_description?: string | null
          company_domain?: string | null
          company_employee_range?: string | null
          company_employees?: number | null
          company_linkedin_url?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_revenue?: number | null
          company_size?: string | null
          company_state?: string | null
          company_technologies?: string[] | null
          company_website?: string | null
          contact_name?: string | null
          created_at?: string
          domain_hint?: string | null
          email?: string | null
          email_hint?: string | null
          external_id?: string | null
          id?: string
          imported_at?: string | null
          imported_lead_id?: string | null
          industry?: string | null
          linkedin_url?: string | null
          location?: string | null
          owner_id?: string
          phone?: string | null
          raw_payload?: Json | null
          reason?: string | null
          role_title?: string | null
          search_id?: string
          source?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospecting_results_imported_lead_id_fkey"
            columns: ["imported_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospecting_results_imported_lead_id_fkey"
            columns: ["imported_lead_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospecting_results_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "prospecting_searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospecting_results_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_scripts: {
        Row: {
          assigned_to: string | null
          created_at: string
          first_message: string
          id: string
          name: string
          objective: string | null
          owner_id: string
          system_prompt: string
          updated_at: string
          variables: Json
          voice_id: string | null
          voice_provider: Database["public"]["Enums"]["voice_provider"]
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          first_message?: string
          id?: string
          name: string
          objective?: string | null
          owner_id: string
          system_prompt?: string
          updated_at?: string
          variables?: Json
          voice_id?: string | null
          voice_provider?: Database["public"]["Enums"]["voice_provider"]
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          first_message?: string
          id?: string
          name?: string
          objective?: string | null
          owner_id?: string
          system_prompt?: string
          updated_at?: string
          variables?: Json
          voice_id?: string | null
          voice_provider?: Database["public"]["Enums"]["voice_provider"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospecting_scripts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_searches: {
        Row: {
          apollo_query: Json | null
          assigned_to: string | null
          company_size: string | null
          created_at: string
          error: string | null
          filters: Json
          id: string
          industry: string | null
          instructions: string | null
          keywords: string | null
          location: string | null
          max_results: number
          name: string
          owner_id: string
          ran_at: string | null
          result_count: number
          role_title: string | null
          source: string
          status: Database["public"]["Enums"]["prospecting_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          apollo_query?: Json | null
          assigned_to?: string | null
          company_size?: string | null
          created_at?: string
          error?: string | null
          filters?: Json
          id?: string
          industry?: string | null
          instructions?: string | null
          keywords?: string | null
          location?: string | null
          max_results?: number
          name: string
          owner_id: string
          ran_at?: string | null
          result_count?: number
          role_title?: string | null
          source?: string
          status?: Database["public"]["Enums"]["prospecting_status"]
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          apollo_query?: Json | null
          assigned_to?: string | null
          company_size?: string | null
          created_at?: string
          error?: string | null
          filters?: Json
          id?: string
          industry?: string | null
          instructions?: string | null
          keywords?: string | null
          location?: string | null
          max_results?: number
          name?: string
          owner_id?: string
          ran_at?: string | null
          result_count?: number
          role_title?: string | null
          source?: string
          status?: Database["public"]["Enums"]["prospecting_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospecting_searches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          enabled: boolean
          endpoint: string
          id: string
          last_used_at: string | null
          owner_id: string
          p256dh: string
          preferences: Json
          user_agent: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          enabled?: boolean
          endpoint: string
          id?: string
          last_used_at?: string | null
          owner_id: string
          p256dh: string
          preferences?: Json
          user_agent?: string | null
          user_id: string
          workspace_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          enabled?: boolean
          endpoint?: string
          id?: string
          last_used_at?: string | null
          owner_id?: string
          p256dh?: string
          preferences?: Json
          user_agent?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_line_items: {
        Row: {
          billing_model: Database["public"]["Enums"]["billing_model"] | null
          cadence: string | null
          contracting_preset_id: string | null
          created_at: string
          description: string | null
          discount_amount: number
          discount_pct: number
          discount_type: string
          id: string
          job_profile_id: string | null
          name: string
          owner_id: string
          percent: number | null
          percent_base_amount: number | null
          position: number
          quantity: number
          quote_id: string
          seniority: string | null
          service_catalog_id: string | null
          tax_rate: number
          unit: string | null
          unit_price: number
          workspace_id: string
        }
        Insert: {
          billing_model?: Database["public"]["Enums"]["billing_model"] | null
          cadence?: string | null
          contracting_preset_id?: string | null
          created_at?: string
          description?: string | null
          discount_amount?: number
          discount_pct?: number
          discount_type?: string
          id?: string
          job_profile_id?: string | null
          name: string
          owner_id: string
          percent?: number | null
          percent_base_amount?: number | null
          position?: number
          quantity?: number
          quote_id: string
          seniority?: string | null
          service_catalog_id?: string | null
          tax_rate?: number
          unit?: string | null
          unit_price?: number
          workspace_id?: string
        }
        Update: {
          billing_model?: Database["public"]["Enums"]["billing_model"] | null
          cadence?: string | null
          contracting_preset_id?: string | null
          created_at?: string
          description?: string | null
          discount_amount?: number
          discount_pct?: number
          discount_type?: string
          id?: string
          job_profile_id?: string | null
          name?: string
          owner_id?: string
          percent?: number | null
          percent_base_amount?: number | null
          position?: number
          quantity?: number
          quote_id?: string
          seniority?: string | null
          service_catalog_id?: string | null
          tax_rate?: number
          unit?: string | null
          unit_price?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_items_contracting_preset_id_fkey"
            columns: ["contracting_preset_id"]
            isOneToOne: false
            referencedRelation: "contracting_presets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_job_profile_id_fkey"
            columns: ["job_profile_id"]
            isOneToOne: false
            referencedRelation: "job_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_service_catalog_id_fkey"
            columns: ["service_catalog_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_templates: {
        Row: {
          blocks: Json | null
          created_at: string
          description: string | null
          html: string
          id: string
          is_default: boolean
          is_system: boolean
          name: string
          owner_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          blocks?: Json | null
          created_at?: string
          description?: string | null
          html?: string
          id?: string
          is_default?: boolean
          is_system?: boolean
          name: string
          owner_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          blocks?: Json | null
          created_at?: string
          description?: string | null
          html?: string
          id?: string
          is_default?: boolean
          is_system?: boolean
          name?: string
          owner_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          assigned_to: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          currency: string
          deal_id: string | null
          declined_at: string | null
          discount_total: number
          id: string
          notes: string | null
          number: string
          owner_id: string
          paid_at: string | null
          payment_link_url: string | null
          payment_session_id: string | null
          public_token: string
          sent_at: string | null
          service_line: string | null
          signature_name: string | null
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          tax_total: number
          template_id: string | null
          terms: string | null
          title: string | null
          total: number
          updated_at: string
          valid_until: string | null
          view_count: number
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_to?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          declined_at?: string | null
          discount_total?: number
          id?: string
          notes?: string | null
          number: string
          owner_id: string
          paid_at?: string | null
          payment_link_url?: string | null
          payment_session_id?: string | null
          public_token?: string
          sent_at?: string | null
          service_line?: string | null
          signature_name?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          tax_total?: number
          template_id?: string | null
          terms?: string | null
          title?: string | null
          total?: number
          updated_at?: string
          valid_until?: string | null
          view_count?: number
          workspace_id?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_to?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          declined_at?: string | null
          discount_total?: number
          id?: string
          notes?: string | null
          number?: string
          owner_id?: string
          paid_at?: string | null
          payment_link_url?: string | null
          payment_session_id?: string | null
          public_token?: string
          sent_at?: string | null
          service_line?: string | null
          signature_name?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          tax_total?: number
          template_id?: string | null
          terms?: string | null
          title?: string | null
          total?: number
          updated_at?: string
          valid_until?: string | null
          view_count?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "quote_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rbac_policy_backup_2026_10: {
        Row: {
          cmd: string | null
          id: number
          permissive: string | null
          policy_name: string
          qual: string | null
          roles: string | null
          table_name: string
          taken_at: string
          with_check: string | null
        }
        Insert: {
          cmd?: string | null
          id?: number
          permissive?: string | null
          policy_name: string
          qual?: string | null
          roles?: string | null
          table_name: string
          taken_at?: string
          with_check?: string | null
        }
        Update: {
          cmd?: string | null
          id?: number
          permissive?: string | null
          policy_name?: string
          qual?: string | null
          roles?: string | null
          table_name?: string
          taken_at?: string
          with_check?: string | null
        }
        Relationships: []
      }
      rbac_wk_backup_2026_10: {
        Row: {
          id: number
          row_data: Json
          source: string
          taken_at: string
          workspace_id: string
        }
        Insert: {
          id?: number
          row_data: Json
          source: string
          taken_at?: string
          workspace_id: string
        }
        Update: {
          id?: number
          row_data?: Json
          source?: string
          taken_at?: string
          workspace_id?: string
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
          workspace_id: string
        }
        Insert: {
          created_at?: string
          entity: string
          id?: string
          owner_id?: string
          sections?: Json
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          entity?: string
          id?: string
          owner_id?: string
          sections?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_layouts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_plans: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          description: string | null
          id: string
          interval: Database["public"]["Enums"]["billing_interval"]
          interval_count: number
          name: string
          owner_id: string
          price: number
          trial_days: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          interval?: Database["public"]["Enums"]["billing_interval"]
          interval_count?: number
          name: string
          owner_id: string
          price?: number
          trial_days?: number
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          interval?: Database["public"]["Enums"]["billing_interval"]
          interval_count?: number
          name?: string
          owner_id?: string
          price?: number
          trial_days?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      report_schedules: {
        Row: {
          created_at: string
          day_of_month: number | null
          day_of_week: number | null
          email_account_id: string | null
          enabled: boolean
          execution_user_id: string | null
          format: Database["public"]["Enums"]["export_format"]
          frequency: Database["public"]["Enums"]["export_frequency"]
          hour_of_day: number
          id: string
          last_error: string | null
          last_run_at: string | null
          last_status: string | null
          name: string
          next_run_at: string | null
          owner_id: string
          recipients: string[]
          report_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          email_account_id?: string | null
          enabled?: boolean
          execution_user_id?: string | null
          format?: Database["public"]["Enums"]["export_format"]
          frequency?: Database["public"]["Enums"]["export_frequency"]
          hour_of_day?: number
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          name: string
          next_run_at?: string | null
          owner_id?: string
          recipients?: string[]
          report_id: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          email_account_id?: string | null
          enabled?: boolean
          execution_user_id?: string | null
          format?: Database["public"]["Enums"]["export_format"]
          frequency?: Database["public"]["Enums"]["export_frequency"]
          hour_of_day?: number
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          name?: string
          next_run_at?: string | null
          owner_id?: string
          recipients?: string[]
          report_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_schedules_execution_user_id_fkey"
            columns: ["execution_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_schedules_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "custom_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_schedules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      role_profile_approval_deliveries: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          id: string
          last_error: string | null
          next_attempt_at: string
          recipient_id: string
          request_id: string
          sent_at: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          recipient_id: string
          request_id: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          recipient_id?: string
          request_id?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_profile_approval_deliveries_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "role_profile_approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      role_profile_approval_items: {
        Row: {
          comment: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          profile_id: string
          profile_revision: number
          request_id: string
          status: string
          version: number | null
          workspace_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          profile_id: string
          profile_revision: number
          request_id: string
          status?: string
          version?: number | null
          workspace_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          profile_id?: string
          profile_revision?: number
          request_id?: string
          status?: string
          version?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_profile_approval_items_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "deal_role_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_profile_approval_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "role_profile_approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      role_profile_approval_requests: {
        Row: {
          approver_id: string
          created_at: string
          deal_id: string
          decided_at: string | null
          id: string
          idempotency_key: string
          requested_by: string
          status: string
          team_ids: string[]
          workspace_id: string
        }
        Insert: {
          approver_id: string
          created_at?: string
          deal_id: string
          decided_at?: string | null
          id?: string
          idempotency_key: string
          requested_by: string
          status?: string
          team_ids?: string[]
          workspace_id: string
        }
        Update: {
          approver_id?: string
          created_at?: string
          deal_id?: string
          decided_at?: string | null
          id?: string
          idempotency_key?: string
          requested_by?: string
          status?: string
          team_ids?: string[]
          workspace_id?: string
        }
        Relationships: []
      }
      rotation_rules: {
        Row: {
          assignees: Json
          created_at: string
          enabled: boolean
          entity: string
          filters: Json
          id: string
          last_assigned_at: string | null
          last_assigned_user_id: string | null
          last_index: number
          name: string
          owner_id: string
          strategy: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assignees?: Json
          created_at?: string
          enabled?: boolean
          entity: string
          filters?: Json
          id?: string
          last_assigned_at?: string | null
          last_assigned_user_id?: string | null
          last_index?: number
          name: string
          owner_id?: string
          strategy?: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          assignees?: Json
          created_at?: string
          enabled?: boolean
          entity?: string
          filters?: Json
          id?: string
          last_assigned_at?: string | null
          last_assigned_user_id?: string | null
          last_index?: number
          name?: string
          owner_id?: string
          strategy?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rotation_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_resource_catalog: {
        Row: {
          id_column: unknown
          parent_column: unknown
          parent_table: unknown
          resource: string
          responsibles: string[]
          shared: boolean
          table_name: unknown
        }
        Insert: {
          id_column?: unknown
          parent_column?: unknown
          parent_table?: unknown
          resource: string
          responsibles: string[]
          shared: boolean
          table_name: unknown
        }
        Update: {
          id_column?: unknown
          parent_column?: unknown
          parent_table?: unknown
          resource?: string
          responsibles?: string[]
          shared?: boolean
          table_name?: unknown
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
          workspace_id: string
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
          workspace_id?: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_views_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      scim_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          last_used_at: string | null
          name: string
          owner_id: string
          revoked_at: string | null
          token_hash: string
          token_prefix: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          owner_id: string
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          owner_id?: string
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scim_tokens_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      score_contributions: {
        Row: {
          created_at: string
          entity: string
          entity_id: string
          id: string
          owner_id: string
          points: number
          reason: string | null
          source: string
          source_key: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          entity: string
          entity_id: string
          id?: string
          owner_id: string
          points?: number
          reason?: string | null
          source: string
          source_key?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          entity?: string
          entity_id?: string
          id?: string
          owner_id?: string
          points?: number
          reason?: string | null
          source?: string
          source_key?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      score_events: {
        Row: {
          created_at: string
          entity: string
          entity_id: string
          id: string
          owner_id: string
          points: number
          reason: string | null
          rule_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          entity: string
          entity_id: string
          id?: string
          owner_id: string
          points: number
          reason?: string | null
          rule_id: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          entity?: string
          entity_id?: string
          id?: string
          owner_id?: string
          points?: number
          reason?: string | null
          rule_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "scoring_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_cursors: {
        Row: {
          last_event_at: string
          owner_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          last_event_at?: string
          owner_id: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          last_event_at?: string
          owner_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoring_cursors_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_rules: {
        Row: {
          assigned_to: string | null
          condition: Json
          created_at: string
          enabled: boolean
          entity: string
          id: string
          name: string
          owner_id: string
          points: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          condition?: Json
          created_at?: string
          enabled?: boolean
          entity: string
          id?: string
          name: string
          owner_id?: string
          points?: number
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          assigned_to?: string | null
          condition?: Json
          created_at?: string
          enabled?: boolean
          entity?: string
          id?: string
          name?: string
          owner_id?: string
          points?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoring_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_actions: {
        Row: {
          created_at: string
          created_by: string | null
          enrollment_id: string | null
          error: string | null
          id: string
          job_id: string | null
          kind: string
          payload: Json
          provider_ref: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enrollment_id?: string | null
          error?: string | null
          id?: string
          job_id?: string | null
          kind: string
          payload?: Json
          provider_ref?: string | null
          status: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enrollment_id?: string | null
          error?: string | null
          id?: string
          job_id?: string | null
          kind?: string
          payload?: Json
          provider_ref?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdr_actions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "sdr_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_actions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "sdr_turn_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_actions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_agent_identities: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string
          mirrored_from: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name?: string
          mirrored_from?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string
          mirrored_from?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdr_agent_identities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_agent_reassign_backup: {
        Row: {
          column_name: string
          created_at: string
          id: number
          old_value: string | null
          row_id: string
          run_id: string
          table_name: string
          undone_at: string | null
          workspace_id: string
        }
        Insert: {
          column_name: string
          created_at?: string
          id?: number
          old_value?: string | null
          row_id: string
          run_id: string
          table_name: string
          undone_at?: string | null
          workspace_id: string
        }
        Update: {
          column_name?: string
          created_at?: string
          id?: number
          old_value?: string | null
          row_id?: string
          run_id?: string
          table_name?: string
          undone_at?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      sdr_agent_versions: {
        Row: {
          created_at: string
          created_by: string | null
          flow: Json
          id: string
          notes: string | null
          persona: Json
          playbook_id: string
          published_at: string | null
          published_by: string | null
          status: string
          tool_config: Json | null
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          flow?: Json
          id?: string
          notes?: string | null
          persona?: Json
          playbook_id: string
          published_at?: string | null
          published_by?: string | null
          status?: string
          tool_config?: Json | null
          updated_at?: string
          version: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          flow?: Json
          id?: string
          notes?: string | null
          persona?: Json
          playbook_id?: string
          published_at?: string | null
          published_by?: string | null
          status?: string
          tool_config?: Json | null
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdr_agent_versions_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "sdr_playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_agent_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_enrollments: {
        Row: {
          booking_id: string | null
          campaign_id: string | null
          cancel_reason: string | null
          channel_identity: Json | null
          commercial_stage: string
          company_id: string | null
          contact_id: string | null
          contact_phone: string | null
          conversation_id: string | null
          conversation_state: Json
          conversation_state_version: number
          created_at: string
          deal_id: string | null
          follow_up_at: string | null
          follow_up_count: number
          handoff_at: string | null
          handoff_reason: string | null
          id: string
          last_action_at: string | null
          last_inbound_at: string | null
          lead_id: string | null
          meeting_status: string
          messages_sent: number
          notes: string | null
          offers: Json
          opted_out_at: string | null
          owner_id: string
          playbook_id: string
          qualification_id: string | null
          qualification_score: number | null
          status: string
          tags: string[]
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          booking_id?: string | null
          campaign_id?: string | null
          cancel_reason?: string | null
          channel_identity?: Json | null
          commercial_stage?: string
          company_id?: string | null
          contact_id?: string | null
          contact_phone?: string | null
          conversation_id?: string | null
          conversation_state?: Json
          conversation_state_version?: number
          created_at?: string
          deal_id?: string | null
          follow_up_at?: string | null
          follow_up_count?: number
          handoff_at?: string | null
          handoff_reason?: string | null
          id?: string
          last_action_at?: string | null
          last_inbound_at?: string | null
          lead_id?: string | null
          meeting_status?: string
          messages_sent?: number
          notes?: string | null
          offers?: Json
          opted_out_at?: string | null
          owner_id: string
          playbook_id: string
          qualification_id?: string | null
          qualification_score?: number | null
          status?: string
          tags?: string[]
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          booking_id?: string | null
          campaign_id?: string | null
          cancel_reason?: string | null
          channel_identity?: Json | null
          commercial_stage?: string
          company_id?: string | null
          contact_id?: string | null
          contact_phone?: string | null
          conversation_id?: string | null
          conversation_state?: Json
          conversation_state_version?: number
          created_at?: string
          deal_id?: string | null
          follow_up_at?: string | null
          follow_up_count?: number
          handoff_at?: string | null
          handoff_reason?: string | null
          id?: string
          last_action_at?: string | null
          last_inbound_at?: string | null
          lead_id?: string | null
          meeting_status?: string
          messages_sent?: number
          notes?: string | null
          offers?: Json
          opted_out_at?: string | null
          owner_id?: string
          playbook_id?: string
          qualification_id?: string | null
          qualification_score?: number | null
          status?: string
          tags?: string[]
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sdr_enrollments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_enrollments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_enrollments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_enrollments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_enrollments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_enrollments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_enrollments_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "sdr_playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_enrollments_qualification_id_fkey"
            columns: ["qualification_id"]
            isOneToOne: false
            referencedRelation: "prospecting_qualifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_enrollments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_material_offers: {
        Row: {
          material_id: string
          offer_id: string
          workspace_id: string
        }
        Insert: {
          material_id: string
          offer_id: string
          workspace_id: string
        }
        Update: {
          material_id?: string
          offer_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdr_material_offers_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "sdr_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_material_offers_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "sdr_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_material_offers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_materials: {
        Row: {
          active: boolean
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          description: string
          file_name: string | null
          file_size: number | null
          id: string
          kind: string
          media_asset_id: string | null
          mime: string | null
          storage_path: string | null
          title: string
          updated_at: string
          url: string | null
          workspace_id: string
        }
        Insert: {
          active?: boolean
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          file_name?: string | null
          file_size?: number | null
          id?: string
          kind?: string
          media_asset_id?: string | null
          mime?: string | null
          storage_path?: string | null
          title: string
          updated_at?: string
          url?: string | null
          workspace_id: string
        }
        Update: {
          active?: boolean
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          file_name?: string | null
          file_size?: number | null
          id?: string
          kind?: string
          media_asset_id?: string | null
          mime?: string | null
          storage_path?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdr_materials_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_materials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_meetings: {
        Row: {
          activity_id: string | null
          attendee_email: string | null
          buffer_after_minutes: number
          buffer_before_minutes: number
          calendar_account_id: string
          campaign_id: string | null
          company_id: string | null
          contact_id: string | null
          conversation_id: string
          created_at: string
          deal_id: string | null
          end_at: string
          enrollment_id: string | null
          error: string | null
          host_user_id: string
          id: string
          idem_key: string
          lead_id: string | null
          meet_link: string | null
          playbook_id: string
          provider: string
          provider_event_id: string
          start_at: string
          status: string
          timezone: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          activity_id?: string | null
          attendee_email?: string | null
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          calendar_account_id: string
          campaign_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          conversation_id: string
          created_at?: string
          deal_id?: string | null
          end_at: string
          enrollment_id?: string | null
          error?: string | null
          host_user_id: string
          id?: string
          idem_key: string
          lead_id?: string | null
          meet_link?: string | null
          playbook_id: string
          provider: string
          provider_event_id: string
          start_at: string
          status: string
          timezone: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          activity_id?: string | null
          attendee_email?: string | null
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          calendar_account_id?: string
          campaign_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          conversation_id?: string
          created_at?: string
          deal_id?: string | null
          end_at?: string
          enrollment_id?: string | null
          error?: string | null
          host_user_id?: string
          id?: string
          idem_key?: string
          lead_id?: string | null
          meet_link?: string | null
          playbook_id?: string
          provider?: string
          provider_event_id?: string
          start_at?: string
          status?: string
          timezone?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      sdr_offers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          commercial_notes: string
          created_at: string
          discovery_questions: string[]
          fit_signals: string[]
          id: string
          name: string
          offer_key: string
          parent_key: string | null
          position: number
          pricing_policy: string
          service_catalog_id: string | null
          source_excerpt: string | null
          source_url: string | null
          status: string
          summary: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          commercial_notes?: string
          created_at?: string
          discovery_questions?: string[]
          fit_signals?: string[]
          id?: string
          name: string
          offer_key: string
          parent_key?: string | null
          position?: number
          pricing_policy?: string
          service_catalog_id?: string | null
          source_excerpt?: string | null
          source_url?: string | null
          status?: string
          summary?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          commercial_notes?: string
          created_at?: string
          discovery_questions?: string[]
          fit_signals?: string[]
          id?: string
          name?: string
          offer_key?: string
          parent_key?: string | null
          position?: number
          pricing_policy?: string
          service_catalog_id?: string | null
          source_excerpt?: string | null
          source_url?: string | null
          status?: string
          summary?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdr_offers_service_catalog_id_fkey"
            columns: ["service_catalog_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_offers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_playbooks: {
        Row: {
          allowed_tools: string[]
          assigned_to: string | null
          booking_page_id: string | null
          business_hours: Json
          channel: string
          channels: string[]
          created_at: string
          enabled: boolean
          follow_up_hours: number
          guardrails: Json
          handoff_score: number
          id: string
          kb_sources: Json
          material_ids: string[]
          max_follow_ups: number
          max_messages: number
          mode: string
          name: string
          offer_keys: string[]
          opportunity_min_score: number
          opt_out_phrases: string[]
          owner_id: string
          qualification_prompt: string | null
          questionnaire_id: string | null
          steps: Json
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          allowed_tools?: string[]
          assigned_to?: string | null
          booking_page_id?: string | null
          business_hours?: Json
          channel?: string
          channels?: string[]
          created_at?: string
          enabled?: boolean
          follow_up_hours?: number
          guardrails?: Json
          handoff_score?: number
          id?: string
          kb_sources?: Json
          material_ids?: string[]
          max_follow_ups?: number
          max_messages?: number
          mode?: string
          name: string
          offer_keys?: string[]
          opportunity_min_score?: number
          opt_out_phrases?: string[]
          owner_id: string
          qualification_prompt?: string | null
          questionnaire_id?: string | null
          steps?: Json
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          allowed_tools?: string[]
          assigned_to?: string | null
          booking_page_id?: string | null
          business_hours?: Json
          channel?: string
          channels?: string[]
          created_at?: string
          enabled?: boolean
          follow_up_hours?: number
          guardrails?: Json
          handoff_score?: number
          id?: string
          kb_sources?: Json
          material_ids?: string[]
          max_follow_ups?: number
          max_messages?: number
          mode?: string
          name?: string
          offer_keys?: string[]
          opportunity_min_score?: number
          opt_out_phrases?: string[]
          owner_id?: string
          qualification_prompt?: string | null
          questionnaire_id?: string | null
          steps?: Json
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sdr_playbooks_booking_page_id_fkey"
            columns: ["booking_page_id"]
            isOneToOne: false
            referencedRelation: "booking_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_playbooks_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "prospecting_questionnaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_playbooks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_qualification_evidence: {
        Row: {
          created_at: string
          enrollment_id: string
          excerpt: string
          field: string
          id: string
          question_id: string | null
          source_message_id: string
          value: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          enrollment_id: string
          excerpt: string
          field: string
          id?: string
          question_id?: string | null
          source_message_id: string
          value: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          enrollment_id?: string
          excerpt?: string
          field?: string
          id?: string
          question_id?: string | null
          source_message_id?: string
          value?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdr_qualification_evidence_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "sdr_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_qualification_evidence_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "prospecting_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_qualification_evidence_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_qualification_evidence_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_slot_offers: {
        Row: {
          conversation_id: string
          created_at: string
          end_at: string
          id: string
          offer_set: number
          playbook_id: string
          position: number
          start_at: string
          status: string
          workspace_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          end_at: string
          id?: string
          offer_set: number
          playbook_id: string
          position: number
          start_at: string
          status?: string
          workspace_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          end_at?: string
          id?: string
          offer_set?: number
          playbook_id?: string
          position?: number
          start_at?: string
          status?: string
          workspace_id?: string
        }
        Relationships: []
      }
      sdr_tool_calls: {
        Row: {
          agent_version_id: string | null
          conversation_id: string | null
          created_at: string
          duration_ms: number | null
          enrollment_id: string | null
          error: string | null
          id: string
          idem_key: string
          input: Json
          job_id: string | null
          output: Json | null
          playbook_id: string
          status: string
          tool: string
          tool_call_id: string
          workspace_id: string
        }
        Insert: {
          agent_version_id?: string | null
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          enrollment_id?: string | null
          error?: string | null
          id?: string
          idem_key: string
          input?: Json
          job_id?: string | null
          output?: Json | null
          playbook_id: string
          status: string
          tool: string
          tool_call_id: string
          workspace_id: string
        }
        Update: {
          agent_version_id?: string | null
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          enrollment_id?: string | null
          error?: string | null
          id?: string
          idem_key?: string
          input?: Json
          job_id?: string | null
          output?: Json | null
          playbook_id?: string
          status?: string
          tool?: string
          tool_call_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      sdr_turn_jobs: {
        Row: {
          agent_version_id: string | null
          ai_finished_at: string | null
          ai_started_at: string | null
          attempts: number
          block_category: string | null
          conversation_id: string
          conversation_version: number | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          draft_payload: Json
          draft_text: string | null
          enrollment_id: string
          error: string | null
          id: string
          idem_key: string
          inbound_message_id: string | null
          kind: string
          lease_token: string | null
          lease_until: string | null
          provider_message_id: string | null
          send_reserved_until: string | null
          send_started_at: string | null
          sent_at: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_version_id?: string | null
          ai_finished_at?: string | null
          ai_started_at?: string | null
          attempts?: number
          block_category?: string | null
          conversation_id: string
          conversation_version?: number | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          draft_payload?: Json
          draft_text?: string | null
          enrollment_id: string
          error?: string | null
          id?: string
          idem_key: string
          inbound_message_id?: string | null
          kind?: string
          lease_token?: string | null
          lease_until?: string | null
          provider_message_id?: string | null
          send_reserved_until?: string | null
          send_started_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_version_id?: string | null
          ai_finished_at?: string | null
          ai_started_at?: string | null
          attempts?: number
          block_category?: string | null
          conversation_id?: string
          conversation_version?: number | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          draft_payload?: Json
          draft_text?: string | null
          enrollment_id?: string
          error?: string | null
          id?: string
          idem_key?: string
          inbound_message_id?: string | null
          kind?: string
          lease_token?: string | null
          lease_until?: string | null
          provider_message_id?: string | null
          send_reserved_until?: string | null
          send_started_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdr_turn_jobs_agent_version_id_fkey"
            columns: ["agent_version_id"]
            isOneToOne: false
            referencedRelation: "sdr_agent_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_turn_jobs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_turn_jobs_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "sdr_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_turn_jobs_inbound_message_id_fkey"
            columns: ["inbound_message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_turn_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_workspace_settings: {
        Row: {
          auto_send_enabled: boolean
          daily_send_limit: number
          default_playbook_id: string | null
          enabled: boolean
          followup_daily_limit: number | null
          pilot_allowlist: string[]
          quiet_hours_end: number
          quiet_hours_start: number
          tech_breaker_open_at: string | null
          tech_breaker_reason: string | null
          tech_conv_turns_per_hour: number
          tech_failure_threshold: number
          template_daily_limit: number | null
          template_interval_max_s: number
          template_interval_min_s: number
          template_respect_hours: boolean
          timezone: string
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          auto_send_enabled?: boolean
          daily_send_limit?: number
          default_playbook_id?: string | null
          enabled?: boolean
          followup_daily_limit?: number | null
          pilot_allowlist?: string[]
          quiet_hours_end?: number
          quiet_hours_start?: number
          tech_breaker_open_at?: string | null
          tech_breaker_reason?: string | null
          tech_conv_turns_per_hour?: number
          tech_failure_threshold?: number
          template_daily_limit?: number | null
          template_interval_max_s?: number
          template_interval_min_s?: number
          template_respect_hours?: boolean
          timezone?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          auto_send_enabled?: boolean
          daily_send_limit?: number
          default_playbook_id?: string | null
          enabled?: boolean
          followup_daily_limit?: number | null
          pilot_allowlist?: string[]
          quiet_hours_end?: number
          quiet_hours_start?: number
          tech_breaker_open_at?: string | null
          tech_breaker_reason?: string | null
          tech_conv_turns_per_hour?: number
          tech_failure_threshold?: number
          template_daily_limit?: number | null
          template_interval_max_s?: number
          template_interval_min_s?: number
          template_respect_hours?: boolean
          timezone?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdr_workspace_settings_default_playbook_id_fkey"
            columns: ["default_playbook_id"]
            isOneToOne: false
            referencedRelation: "sdr_playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_workspace_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      search_pinned: {
        Row: {
          entity_id: string
          entity_type: string
          id: string
          pinned_at: string
          title: string
          url: string
          user_id: string
        }
        Insert: {
          entity_id: string
          entity_type: string
          id?: string
          pinned_at?: string
          title: string
          url: string
          user_id: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
          id?: string
          pinned_at?: string
          title?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      search_recent: {
        Row: {
          entity_id: string
          entity_type: string
          id: string
          opened_at: string
          title: string
          url: string
          user_id: string
        }
        Insert: {
          entity_id: string
          entity_type: string
          id?: string
          opened_at?: string
          title: string
          url: string
          user_id: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
          id?: string
          opened_at?: string
          title?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      security_scan_findings: {
        Row: {
          category: string
          code: string
          created_at: string
          detail: string | null
          fingerprint: string
          id: string
          ref: Json
          run_id: string
          scanner: string
          severity: string
          title: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          detail?: string | null
          fingerprint: string
          id?: string
          ref?: Json
          run_id: string
          scanner: string
          severity: string
          title: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          detail?: string | null
          fingerprint?: string
          id?: string
          ref?: Json
          run_id?: string
          scanner?: string
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_scan_findings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "security_scan_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      security_scan_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error: string | null
          finished_at: string | null
          id: string
          started_at: string
          status: string
          totals: Json
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          totals?: Json
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          totals?: Json
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
          enabled: boolean
          entity: string
          filters: Json
          id: string
          kind: string
          last_refreshed_at: string | null
          member_count: number
          name: string
          owner_id: string
          refresh_interval_minutes: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          entity: string
          filters?: Json
          id?: string
          kind?: string
          last_refreshed_at?: string | null
          member_count?: number
          name: string
          owner_id?: string
          refresh_interval_minutes?: number
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          entity?: string
          filters?: Json
          id?: string
          kind?: string
          last_refreshed_at?: string | null
          member_count?: number
          name?: string
          owner_id?: string
          refresh_interval_minutes?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "segments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string
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
          workspace_id?: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences: {
        Row: {
          assigned_to: string | null
          created_at: string
          enabled: boolean
          entity: string
          id: string
          name: string
          owner_id: string
          steps: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          enabled?: boolean
          entity: string
          id?: string
          name: string
          owner_id?: string
          steps?: Json
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          enabled?: boolean
          entity?: string
          id?: string
          name?: string
          owner_id?: string
          steps?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      service_agent_evidence: {
        Row: {
          created_at: string
          enrollment_id: string
          excerpt: string
          field: string
          id: string
          question_id: string | null
          session_id: string
          source_message_id: string
          value: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          enrollment_id: string
          excerpt: string
          field: string
          id?: string
          question_id?: string | null
          session_id: string
          source_message_id: string
          value: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          enrollment_id?: string
          excerpt?: string
          field?: string
          id?: string
          question_id?: string | null
          session_id?: string
          source_message_id?: string
          value?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_agent_evidence_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "sdr_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_agent_evidence_session_id_workspace_id_fkey"
            columns: ["session_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "service_agent_sessions"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "service_agent_evidence_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      service_agent_inbound_events: {
        Row: {
          channel: string
          message_id: string
          session_id: string
        }
        Insert: {
          channel: string
          message_id: string
          session_id: string
        }
        Update: {
          channel?: string
          message_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_agent_inbound_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "service_agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      service_agent_ingest_errors: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          error: string
          message_id: string
          resolved_at: string | null
          workspace_id: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          error: string
          message_id: string
          resolved_at?: string | null
          workspace_id: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          error?: string
          message_id?: string
          resolved_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_agent_ingest_errors_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      service_agent_jobs: {
        Row: {
          agent_version_id: string | null
          attempts: number
          available_at: string
          conversation_version: number
          created_at: string
          draft_payload: Json | null
          draft_text: string | null
          error: string | null
          id: string
          inbound_message_id: string
          lease_token: string | null
          lease_until: string | null
          outbound_message_id: string
          provider_message_id: string | null
          send_started_at: string | null
          send_token: string | null
          sent_at: string | null
          session_id: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_version_id?: string | null
          attempts?: number
          available_at?: string
          conversation_version: number
          created_at?: string
          draft_payload?: Json | null
          draft_text?: string | null
          error?: string | null
          id?: string
          inbound_message_id: string
          lease_token?: string | null
          lease_until?: string | null
          outbound_message_id?: string
          provider_message_id?: string | null
          send_started_at?: string | null
          send_token?: string | null
          sent_at?: string | null
          session_id: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_version_id?: string | null
          attempts?: number
          available_at?: string
          conversation_version?: number
          created_at?: string
          draft_payload?: Json | null
          draft_text?: string | null
          error?: string | null
          id?: string
          inbound_message_id?: string
          lease_token?: string | null
          lease_until?: string | null
          outbound_message_id?: string
          provider_message_id?: string | null
          send_started_at?: string | null
          send_token?: string | null
          sent_at?: string | null
          session_id?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_agent_jobs_agent_version_id_fkey"
            columns: ["agent_version_id"]
            isOneToOne: false
            referencedRelation: "sdr_agent_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_agent_jobs_session_id_workspace_id_fkey"
            columns: ["session_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "service_agent_sessions"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "service_agent_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      service_agent_sessions: {
        Row: {
          account_id: string
          ai_owner: string
          ai_version: number
          channel: string
          context_approved: boolean
          created_at: string
          enrollment_id: string
          id: string
          identity_verified: boolean
          last_inbound_at: string | null
          origin: string
          source_id: string
          workspace_id: string
        }
        Insert: {
          account_id: string
          ai_owner?: string
          ai_version?: number
          channel: string
          context_approved?: boolean
          created_at?: string
          enrollment_id: string
          id?: string
          identity_verified?: boolean
          last_inbound_at?: string | null
          origin?: string
          source_id: string
          workspace_id: string
        }
        Update: {
          account_id?: string
          ai_owner?: string
          ai_version?: number
          channel?: string
          context_approved?: boolean
          created_at?: string
          enrollment_id?: string
          id?: string
          identity_verified?: boolean
          last_inbound_at?: string | null
          origin?: string
          source_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_agent_sessions_account_id_workspace_id_fkey"
            columns: ["account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "service_channel_accounts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "service_agent_sessions_enrollment_id_workspace_id_fkey"
            columns: ["enrollment_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "sdr_enrollments"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "service_agent_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      service_catalog: {
        Row: {
          active: boolean
          allowed_units: string[]
          base_price: number
          billing_model: Database["public"]["Enums"]["billing_model"] | null
          category: string | null
          code: string | null
          competencies: string[]
          cost: number
          created_at: string
          created_by: string | null
          currency: string
          default_cadence: string | null
          default_percent: number | null
          default_sla_hours: number | null
          description: string | null
          id: string
          name: string
          owner_id: string
          percent_base_label: string | null
          service_type: string
          tags: string[]
          tax_rate: number
          unit: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          allowed_units?: string[]
          base_price?: number
          billing_model?: Database["public"]["Enums"]["billing_model"] | null
          category?: string | null
          code?: string | null
          competencies?: string[]
          cost?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          default_cadence?: string | null
          default_percent?: number | null
          default_sla_hours?: number | null
          description?: string | null
          id?: string
          name: string
          owner_id: string
          percent_base_label?: string | null
          service_type?: string
          tags?: string[]
          tax_rate?: number
          unit?: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          active?: boolean
          allowed_units?: string[]
          base_price?: number
          billing_model?: Database["public"]["Enums"]["billing_model"] | null
          category?: string | null
          code?: string | null
          competencies?: string[]
          cost?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          default_cadence?: string | null
          default_percent?: number | null
          default_sla_hours?: number | null
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          percent_base_label?: string | null
          service_type?: string
          tags?: string[]
          tax_rate?: number
          unit?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      service_channel_accounts: {
        Row: {
          channel: string
          created_at: string
          display_name: string
          enabled: boolean
          id: string
          label: string
          routing_configured: boolean
          source_key: string
          workspace_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          display_name?: string
          enabled?: boolean
          id?: string
          label: string
          routing_configured?: boolean
          source_key: string
          workspace_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          display_name?: string
          enabled?: boolean
          id?: string
          label?: string
          routing_configured?: boolean
          source_key?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_channel_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      service_channel_bindings: {
        Row: {
          account_id: string
          agent_id: string
          campaigns: boolean
          display_name: string
          enabled: boolean
          inbound: boolean
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id: string
          agent_id: string
          campaigns?: boolean
          display_name?: string
          enabled?: boolean
          inbound?: boolean
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string
          agent_id?: string
          campaigns?: boolean
          display_name?: string
          enabled?: boolean
          inbound?: boolean
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_channel_bindings_account_id_workspace_id_fkey"
            columns: ["account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "service_channel_accounts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "service_channel_bindings_agent_id_workspace_id_fkey"
            columns: ["agent_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "sdr_playbooks"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "service_channel_bindings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          assigned_to: string | null
          billing_model: Database["public"]["Enums"]["billing_model"] | null
          cadence: Database["public"]["Enums"]["service_cadence"] | null
          competencies: string[]
          contract_id: string
          created_at: string
          currency: string
          delivery_owner_id: string | null
          description: string | null
          ends_at: string | null
          id: string
          job_profile_id: string | null
          metadata: Json
          name: string
          next_billing_at: string | null
          owner_id: string
          percent: number | null
          percent_base_amount: number | null
          quantity: number
          role: Database["public"]["Enums"]["contract_role"]
          seniority: string | null
          source_deal_line_item_id: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["service_status"]
          type: Database["public"]["Enums"]["service_type"]
          unit: string | null
          unit_price: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          billing_model?: Database["public"]["Enums"]["billing_model"] | null
          cadence?: Database["public"]["Enums"]["service_cadence"] | null
          competencies?: string[]
          contract_id: string
          created_at?: string
          currency?: string
          delivery_owner_id?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          job_profile_id?: string | null
          metadata?: Json
          name: string
          next_billing_at?: string | null
          owner_id: string
          percent?: number | null
          percent_base_amount?: number | null
          quantity?: number
          role: Database["public"]["Enums"]["contract_role"]
          seniority?: string | null
          source_deal_line_item_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["service_status"]
          type?: Database["public"]["Enums"]["service_type"]
          unit?: string | null
          unit_price?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          billing_model?: Database["public"]["Enums"]["billing_model"] | null
          cadence?: Database["public"]["Enums"]["service_cadence"] | null
          competencies?: string[]
          contract_id?: string
          created_at?: string
          currency?: string
          delivery_owner_id?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          job_profile_id?: string | null
          metadata?: Json
          name?: string
          next_billing_at?: string | null
          owner_id?: string
          percent?: number | null
          percent_base_amount?: number | null
          quantity?: number
          role?: Database["public"]["Enums"]["contract_role"]
          seniority?: string | null
          source_deal_line_item_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["service_status"]
          type?: Database["public"]["Enums"]["service_type"]
          unit?: string | null
          unit_price?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_job_profile_id_fkey"
            columns: ["job_profile_id"]
            isOneToOne: false
            referencedRelation: "job_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_field_catalog: {
        Row: {
          configurable: boolean
          field: unknown
          guard_fields: string[] | null
          resource: string
          table_name: unknown
        }
        Insert: {
          configurable?: boolean
          field: unknown
          guard_fields?: string[] | null
          resource: string
          table_name: unknown
        }
        Update: {
          configurable?: boolean
          field?: unknown
          guard_fields?: string[] | null
          resource?: string
          table_name?: unknown
        }
        Relationships: []
      }
      shared_upload_receipts: {
        Row: {
          actor_id: string
          consumed_at: string | null
          created_at: string
          id: string
          path: string
          workspace_id: string
        }
        Insert: {
          actor_id: string
          consumed_at?: string | null
          created_at?: string
          id?: string
          path: string
          workspace_id: string
        }
        Update: {
          actor_id?: string
          consumed_at?: string | null
          created_at?: string
          id?: string
          path?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_upload_receipts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_policies: {
        Row: {
          active: boolean
          created_at: string
          first_response_mins: number
          id: string
          name: string
          owner_id: string
          pipeline_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"] | null
          resolution_mins: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          first_response_mins?: number
          id?: string
          name: string
          owner_id: string
          pipeline_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          resolution_mins?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          first_response_mins?: number
          id?: string
          name?: string
          owner_id?: string
          pipeline_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          resolution_mins?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_policies_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_policies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_event_routes: {
        Row: {
          channel_id: string
          channel_name: string | null
          created_at: string
          enabled: boolean
          event_type: string
          id: string
          owner_id: string
          per_user_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          channel_id: string
          channel_name?: string | null
          created_at?: string
          enabled?: boolean
          event_type: string
          id?: string
          owner_id: string
          per_user_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          channel_id?: string
          channel_name?: string | null
          created_at?: string
          enabled?: boolean
          event_type?: string
          id?: string
          owner_id?: string
          per_user_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      slack_integrations: {
        Row: {
          access_token: string
          bot_user_id: string | null
          created_at: string
          default_channel_id: string | null
          default_channel_name: string | null
          id: string
          installed_by: string | null
          owner_id: string
          scope: string | null
          team_id: string | null
          team_name: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          access_token: string
          bot_user_id?: string | null
          created_at?: string
          default_channel_id?: string | null
          default_channel_name?: string | null
          id?: string
          installed_by?: string | null
          owner_id: string
          scope?: string | null
          team_id?: string | null
          team_name?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          access_token?: string
          bot_user_id?: string | null
          created_at?: string
          default_channel_id?: string | null
          default_channel_name?: string | null
          id?: string
          installed_by?: string | null
          owner_id?: string
          scope?: string | null
          team_id?: string | null
          team_name?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      snippets: {
        Row: {
          body_html: string
          body_text: string
          created_at: string
          folder: string | null
          id: string
          name: string
          owner_id: string
          shortcut: string
          updated_at: string
          usage_count: number
          visibility: string
          workspace_id: string | null
        }
        Insert: {
          body_html?: string
          body_text?: string
          created_at?: string
          folder?: string | null
          id?: string
          name: string
          owner_id: string
          shortcut: string
          updated_at?: string
          usage_count?: number
          visibility?: string
          workspace_id?: string | null
        }
        Update: {
          body_html?: string
          body_text?: string
          created_at?: string
          folder?: string | null
          id?: string
          name?: string
          owner_id?: string
          shortcut?: string
          updated_at?: string
          usage_count?: number
          visibility?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      stage_entries: {
        Row: {
          created_at: string
          entered_at: string
          entity: string
          entity_id: string
          exited_at: string | null
          id: string
          owner_id: string
          pipeline_id: string | null
          sla_hours: number | null
          stage_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          entered_at?: string
          entity: string
          entity_id: string
          exited_at?: string | null
          id?: string
          owner_id: string
          pipeline_id?: string | null
          sla_hours?: number | null
          stage_id: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          entered_at?: string
          entity?: string
          entity_id?: string
          exited_at?: string | null
          id?: string
          owner_id?: string
          pipeline_id?: string | null
          sla_hours?: number | null
          stage_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_invoices: {
        Row: {
          amount: number
          created_at: string
          currency: string
          due_date: string
          id: string
          invoice_number: string
          notes: string | null
          owner_id: string
          paid_at: string | null
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["sub_invoice_status"]
          subscription_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          due_date: string
          id?: string
          invoice_number: string
          notes?: string | null
          owner_id: string
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["sub_invoice_status"]
          subscription_id: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          due_date?: string
          id?: string
          invoice_number?: string
          notes?: string | null
          owner_id?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["sub_invoice_status"]
          subscription_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id?: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_types_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          contact_id: string
          created_at: string
          currency: string
          cycles_completed: number
          deal_id: string | null
          ended_at: string | null
          id: string
          interval: Database["public"]["Enums"]["billing_interval"]
          interval_count: number
          name: string
          next_billing_at: string | null
          notes: string | null
          owner_id: string
          plan_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"]
          total_cycles: number | null
          trial_ends_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount?: number
          contact_id: string
          created_at?: string
          currency?: string
          cycles_completed?: number
          deal_id?: string | null
          ended_at?: string | null
          id?: string
          interval?: Database["public"]["Enums"]["billing_interval"]
          interval_count?: number
          name: string
          next_billing_at?: string | null
          notes?: string | null
          owner_id: string
          plan_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          total_cycles?: number | null
          trial_ends_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          amount?: number
          contact_id?: string
          created_at?: string
          currency?: string
          cycles_completed?: number
          deal_id?: string | null
          ended_at?: string | null
          id?: string
          interval?: Database["public"]["Enums"]["billing_interval"]
          interval_count?: number
          name?: string
          next_billing_at?: string | null
          notes?: string | null
          owner_id?: string
          plan_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          total_cycles?: number | null
          trial_ends_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "recurring_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      survey_imports: {
        Row: {
          content_hash: string
          created_at: string
          created_by: string
          error: string | null
          id: string
          result: Json | null
          source_kind: string
          source_name: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          created_by: string
          error?: string | null
          id?: string
          result?: Json | null
          source_kind: string
          source_name: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          created_by?: string
          error?: string | null
          id?: string
          result?: Json | null
          source_kind?: string
          source_name?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      survey_responses: {
        Row: {
          assigned_to: string | null
          comment: string | null
          contact_id: string | null
          created_at: string
          id: string
          kind: string
          owner_id: string
          responded_at: string | null
          score: number | null
          sent_at: string
          ticket_id: string
          token: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          comment?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          owner_id: string
          responded_at?: string | null
          score?: number | null
          sent_at?: string
          ticket_id: string
          token?: string
          workspace_id?: string
        }
        Update: {
          assigned_to?: string | null
          comment?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          owner_id?: string
          responded_at?: string | null
          score?: number | null
          sent_at?: string
          ticket_id?: string
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_template_questions: {
        Row: {
          conditions: Json | null
          created_at: string
          field_key: string | null
          help_text: string | null
          id: string
          label: string
          options: Json
          owner_id: string
          page: number
          position: number
          required: boolean
          scored: boolean
          settings: Json
          survey_template_id: string
          type: string
          updated_at: string
          weight: number
          workspace_id: string | null
        }
        Insert: {
          conditions?: Json | null
          created_at?: string
          field_key?: string | null
          help_text?: string | null
          id?: string
          label: string
          options?: Json
          owner_id: string
          page?: number
          position?: number
          required?: boolean
          scored?: boolean
          settings?: Json
          survey_template_id: string
          type?: string
          updated_at?: string
          weight?: number
          workspace_id?: string | null
        }
        Update: {
          conditions?: Json | null
          created_at?: string
          field_key?: string | null
          help_text?: string | null
          id?: string
          label?: string
          options?: Json
          owner_id?: string
          page?: number
          position?: number
          required?: boolean
          scored?: boolean
          settings?: Json
          survey_template_id?: string
          type?: string
          updated_at?: string
          weight?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_template_questions_survey_template_id_fkey"
            columns: ["survey_template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_template_versions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          schema: Json
          template_id: string
          version: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          schema: Json
          template_id: string
          version: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          schema?: Json
          template_id?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_templates: {
        Row: {
          channel: string
          created_at: string
          delay_minutes: number
          description: string | null
          draft_revision: number
          draft_schema: Json | null
          id: string
          invite_body: string | null
          invite_subject: string | null
          is_active: boolean
          is_default: boolean
          kind: string
          name: string
          owner_id: string
          published_version: number | null
          question: string | null
          scope: string
          scoring_enabled: boolean
          trigger_event: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          delay_minutes?: number
          description?: string | null
          draft_revision?: number
          draft_schema?: Json | null
          id?: string
          invite_body?: string | null
          invite_subject?: string | null
          is_active?: boolean
          is_default?: boolean
          kind?: string
          name: string
          owner_id: string
          published_version?: number | null
          question?: string | null
          scope?: string
          scoring_enabled?: boolean
          trigger_event?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          delay_minutes?: number
          description?: string | null
          draft_revision?: number
          draft_schema?: Json | null
          id?: string
          invite_body?: string | null
          invite_subject?: string | null
          is_active?: boolean
          is_default?: boolean
          kind?: string
          name?: string
          owner_id?: string
          published_version?: number | null
          question?: string | null
          scope?: string
          scoring_enabled?: boolean
          trigger_event?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      task_queue_items: {
        Row: {
          activity_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          id: string
          lead_id: string | null
          notes: string | null
          owner_id: string
          position: number
          queue_id: string
          skipped_at: string | null
          workspace_id: string
        }
        Insert: {
          activity_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          owner_id?: string
          position?: number
          queue_id: string
          skipped_at?: string | null
          workspace_id?: string
        }
        Update: {
          activity_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          owner_id?: string
          position?: number
          queue_id?: string
          skipped_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_queue_items_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "task_queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_queue_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      task_queues: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_queues_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          access_profile_id: string | null
          created_at: string
          id: string
          invited_at: string
          member_user_id: string
          role: Database["public"]["Enums"]["team_role"]
          workspace_owner_id: string
        }
        Insert: {
          access_profile_id?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          member_user_id: string
          role?: Database["public"]["Enums"]["team_role"]
          workspace_owner_id: string
        }
        Update: {
          access_profile_id?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          member_user_id?: string
          role?: Database["public"]["Enums"]["team_role"]
          workspace_owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_access_profile_id_fkey"
            columns: ["access_profile_id"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assignee_id: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          custom_fields: Json
          deal_id: string | null
          deleted_at: string | null
          description: string | null
          due_at: string | null
          external_ids: Json
          hs_createdate: string | null
          hs_lastmodifieddate: string | null
          hs_object_id: string | null
          hs_raw: Json | null
          hubspot_owner_id: string | null
          id: string
          owner_id: string
          pipeline_id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          sla_first_response_at: string | null
          sla_first_response_breached: boolean
          sla_first_response_due_at: string | null
          sla_policy_id: string | null
          sla_resolution_breached: boolean
          sla_resolution_due_at: string | null
          source: string | null
          stage: string
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assignee_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          custom_fields?: Json
          deal_id?: string | null
          deleted_at?: string | null
          description?: string | null
          due_at?: string | null
          external_ids?: Json
          hs_createdate?: string | null
          hs_lastmodifieddate?: string | null
          hs_object_id?: string | null
          hs_raw?: Json | null
          hubspot_owner_id?: string | null
          id?: string
          owner_id: string
          pipeline_id: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          sla_first_response_at?: string | null
          sla_first_response_breached?: boolean
          sla_first_response_due_at?: string | null
          sla_policy_id?: string | null
          sla_resolution_breached?: boolean
          sla_resolution_due_at?: string | null
          source?: string | null
          stage?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          assignee_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          custom_fields?: Json
          deal_id?: string | null
          deleted_at?: string | null
          description?: string | null
          due_at?: string | null
          external_ids?: Json
          hs_createdate?: string | null
          hs_lastmodifieddate?: string | null
          hs_object_id?: string | null
          hs_raw?: Json | null
          hubspot_owner_id?: string | null
          id?: string
          owner_id?: string
          pipeline_id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          sla_first_response_at?: string | null
          sla_first_response_breached?: boolean
          sla_first_response_due_at?: string | null
          sla_policy_id?: string | null
          sla_resolution_breached?: boolean
          sla_resolution_due_at?: string | null
          source?: string | null
          stage?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_sla_policy_id_fkey"
            columns: ["sla_policy_id"]
            isOneToOne: false
            referencedRelation: "sla_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      time_import_connections: {
        Row: {
          client_id_hint: string | null
          created_at: string
          created_by: string | null
          credentials_ciphertext: string | null
          id: string
          last_error: string | null
          last_tested_at: string | null
          provider: string
          secret_last4: string | null
          source_access: string | null
          source_org_id: string | null
          source_org_name: string | null
          source_person_id: string | null
          source_role: string | null
          source_verified_at: string | null
          status: string
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          client_id_hint?: string | null
          created_at?: string
          created_by?: string | null
          credentials_ciphertext?: string | null
          id?: string
          last_error?: string | null
          last_tested_at?: string | null
          provider: string
          secret_last4?: string | null
          source_access?: string | null
          source_org_id?: string | null
          source_org_name?: string | null
          source_person_id?: string | null
          source_role?: string | null
          source_verified_at?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          client_id_hint?: string | null
          created_at?: string
          created_by?: string | null
          credentials_ciphertext?: string | null
          id?: string
          last_error?: string | null
          last_tested_at?: string | null
          provider?: string
          secret_last4?: string | null
          source_access?: string | null
          source_org_id?: string | null
          source_org_name?: string | null
          source_person_id?: string | null
          source_role?: string | null
          source_verified_at?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_import_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      time_import_duplicates: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: string
          existing_entry_id: string
          existing_external_id: string | null
          existing_source: string | null
          external_id: string
          id: string
          kind: string
          overlap_seconds: number
          provider: string
          segment: number
          source_org_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          existing_entry_id: string
          existing_external_id?: string | null
          existing_source?: string | null
          external_id: string
          id?: string
          kind: string
          overlap_seconds: number
          provider: string
          segment?: number
          source_org_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          existing_entry_id?: string
          existing_external_id?: string | null
          existing_source?: string | null
          external_id?: string
          id?: string
          kind?: string
          overlap_seconds?: number
          provider?: string
          segment?: number
          source_org_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_import_duplicates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      time_import_links: {
        Row: {
          created_at: string
          created_run_id: string | null
          entity_type: string
          external_id: string
          id: string
          imported_snapshot: Json
          last_run_id: string | null
          link_kind: string
          local_date: string | null
          meta: Json
          provider: string
          segment: number
          source_end_utc: string | null
          source_hash: string
          source_offset: string | null
          source_org_id: string
          source_seconds: number | null
          source_start_utc: string | null
          target_id: string
          target_table: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_run_id?: string | null
          entity_type: string
          external_id: string
          id?: string
          imported_snapshot?: Json
          last_run_id?: string | null
          link_kind?: string
          local_date?: string | null
          meta?: Json
          provider: string
          segment?: number
          source_end_utc?: string | null
          source_hash: string
          source_offset?: string | null
          source_org_id: string
          source_seconds?: number | null
          source_start_utc?: string | null
          target_id: string
          target_table: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_run_id?: string | null
          entity_type?: string
          external_id?: string
          id?: string
          imported_snapshot?: Json
          last_run_id?: string | null
          link_kind?: string
          local_date?: string | null
          meta?: Json
          provider?: string
          segment?: number
          source_end_utc?: string | null
          source_hash?: string
          source_offset?: string | null
          source_org_id?: string
          source_seconds?: number | null
          source_start_utc?: string | null
          target_id?: string
          target_table?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_import_links_created_run_id_fkey"
            columns: ["created_run_id"]
            isOneToOne: false
            referencedRelation: "time_import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_import_links_last_run_id_fkey"
            columns: ["last_run_id"]
            isOneToOne: false
            referencedRelation: "time_import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_import_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      time_import_mappings: {
        Row: {
          candidates: Json
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: string
          entity_type: string
          external_id: string
          id: string
          label: string | null
          method: string
          note: string | null
          provider: string
          source_org_id: string
          target_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          candidates?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          entity_type: string
          external_id: string
          id?: string
          label?: string | null
          method?: string
          note?: string | null
          provider: string
          source_org_id: string
          target_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          candidates?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          entity_type?: string
          external_id?: string
          id?: string
          label?: string | null
          method?: string
          note?: string | null
          provider?: string
          source_org_id?: string
          target_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_import_mappings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      time_import_runs: {
        Row: {
          checkpoint: Json
          counts: Json
          created_at: string
          delegation_authorized_at: string | null
          delegation_authorized_by: string | null
          error: string | null
          finished_at: string | null
          heartbeat_at: string | null
          id: string
          kind: string
          lease_until: string | null
          options: Json
          phase: string
          preview_confirmed_at: string | null
          preview_confirmed_by: string | null
          preview_run_id: string | null
          provider: string
          report: Json | null
          requested_by: string
          source_org_id: string
          started_at: string | null
          status: string
          target_run_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          checkpoint?: Json
          counts?: Json
          created_at?: string
          delegation_authorized_at?: string | null
          delegation_authorized_by?: string | null
          error?: string | null
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          kind: string
          lease_until?: string | null
          options?: Json
          phase?: string
          preview_confirmed_at?: string | null
          preview_confirmed_by?: string | null
          preview_run_id?: string | null
          provider: string
          report?: Json | null
          requested_by: string
          source_org_id: string
          started_at?: string | null
          status?: string
          target_run_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          checkpoint?: Json
          counts?: Json
          created_at?: string
          delegation_authorized_at?: string | null
          delegation_authorized_by?: string | null
          error?: string | null
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          kind?: string
          lease_until?: string | null
          options?: Json
          phase?: string
          preview_confirmed_at?: string | null
          preview_confirmed_by?: string | null
          preview_run_id?: string | null
          provider?: string
          report?: Json | null
          requested_by?: string
          source_org_id?: string
          started_at?: string | null
          status?: string
          target_run_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_import_runs_preview_run_id_fkey"
            columns: ["preview_run_id"]
            isOneToOne: false
            referencedRelation: "time_import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_import_runs_target_run_id_fkey"
            columns: ["target_run_id"]
            isOneToOne: false
            referencedRelation: "time_import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_import_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      time_import_staging: {
        Row: {
          entity_type: string
          external_id: string
          first_seen_at: string
          id: string
          last_run_id: string | null
          last_seen_at: string
          payload: Json
          payload_hash: string
          period: string | null
          person_external_id: string | null
          provider: string
          reason_code: string | null
          reason_detail: string | null
          source_org_id: string
          status: string
          workspace_id: string
        }
        Insert: {
          entity_type: string
          external_id: string
          first_seen_at?: string
          id?: string
          last_run_id?: string | null
          last_seen_at?: string
          payload: Json
          payload_hash: string
          period?: string | null
          person_external_id?: string | null
          provider: string
          reason_code?: string | null
          reason_detail?: string | null
          source_org_id: string
          status?: string
          workspace_id: string
        }
        Update: {
          entity_type?: string
          external_id?: string
          first_seen_at?: string
          id?: string
          last_run_id?: string | null
          last_seen_at?: string
          payload?: Json
          payload_hash?: string
          period?: string | null
          person_external_id?: string | null
          provider?: string
          reason_code?: string | null
          reason_detail?: string | null
          source_org_id?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_import_staging_last_run_id_fkey"
            columns: ["last_run_id"]
            isOneToOne: false
            referencedRelation: "time_import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_import_staging_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_pins: {
        Row: {
          entity_id: string
          entity_kind: string
          id: string
          pinned_at: string
          pinned_by: string | null
          source: string
          source_id: string
          workspace_id: string
        }
        Insert: {
          entity_id: string
          entity_kind: string
          id?: string
          pinned_at?: string
          pinned_by?: string | null
          source: string
          source_id: string
          workspace_id: string
        }
        Update: {
          entity_id?: string
          entity_kind?: string
          id?: string
          pinned_at?: string
          pinned_by?: string | null
          source?: string
          source_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_pins_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      unipile_accounts: {
        Row: {
          connect_token: string | null
          connected_at: string | null
          created_at: string
          daily_window: Json
          display_name: string | null
          id: string
          last_error: string | null
          last_seen_at: string | null
          owner_id: string
          provider: string
          status: string
          unipile_account_id: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          connect_token?: string | null
          connected_at?: string | null
          created_at?: string
          daily_window?: Json
          display_name?: string | null
          id?: string
          last_error?: string | null
          last_seen_at?: string | null
          owner_id: string
          provider?: string
          status?: string
          unipile_account_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          connect_token?: string | null
          connected_at?: string | null
          created_at?: string
          daily_window?: Json
          display_name?: string | null
          id?: string
          last_error?: string | null
          last_seen_at?: string | null
          owner_id?: string
          provider?: string
          status?: string
          unipile_account_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      unipile_message_log: {
        Row: {
          accepted_at: string | null
          account_id: string
          body: string | null
          candidate_id: string | null
          created_at: string
          error: string | null
          id: string
          idempotency_key: string | null
          kind: string
          owner_id: string
          provider_invite_id: string | null
          provider_message_id: string | null
          sent_at: string | null
          status: string
          target_identifier: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          account_id: string
          body?: string | null
          candidate_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key?: string | null
          kind: string
          owner_id: string
          provider_invite_id?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          target_identifier: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          account_id?: string
          body?: string | null
          candidate_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key?: string | null
          kind?: string
          owner_id?: string
          provider_invite_id?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          target_identifier?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unipile_message_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "unipile_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      unipile_rate_buckets: {
        Row: {
          account_id: string
          count: number
          created_at: string
          day_utc: string
          endpoint: string
          id: string
          last_request_at: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          count?: number
          created_at?: string
          day_utc?: string
          endpoint: string
          id?: string
          last_request_at?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          count?: number
          created_at?: string
          day_utc?: string
          endpoint?: string
          id?: string
          last_request_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unipile_rate_buckets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "unipile_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      unipile_request_log: {
        Row: {
          account_id: string | null
          created_at: string
          endpoint: string
          error: string | null
          id: number
          latency_ms: number | null
          method: string
          owner_id: string | null
          payload_hash: string | null
          status: number | null
          workspace_id: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          endpoint: string
          error?: string | null
          id?: number
          latency_ms?: number | null
          method?: string
          owner_id?: string | null
          payload_hash?: string | null
          status?: number | null
          workspace_id?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string
          endpoint?: string
          error?: string | null
          id?: number
          latency_ms?: number | null
          method?: string
          owner_id?: string | null
          payload_hash?: string | null
          status?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unipile_request_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "unipile_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          key: string
          period_month: string
          updated_at: string
          used: number
          workspace_owner_id: string
        }
        Insert: {
          key: string
          period_month: string
          updated_at?: string
          used?: number
          workspace_owner_id: string
        }
        Update: {
          key?: string
          period_month?: string
          updated_at?: string
          used?: number
          workspace_owner_id?: string
        }
        Relationships: []
      }
      user_file_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          parent_id: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          parent_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          parent_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_file_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "user_file_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_file_folders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_files: {
        Row: {
          created_at: string
          folder_id: string | null
          id: string
          is_public: boolean
          mime_type: string | null
          name: string
          owner_id: string
          public_token: string | null
          size_bytes: number
          storage_path: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          folder_id?: string | null
          id?: string
          is_public?: boolean
          mime_type?: string | null
          name: string
          owner_id: string
          public_token?: string | null
          size_bytes: number
          storage_path: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          folder_id?: string | null
          id?: string
          is_public?: boolean
          mime_type?: string | null
          name?: string
          owner_id?: string
          public_token?: string | null
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "user_file_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_files_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_grid_preferences: {
        Row: {
          created_at: string
          grid_key: string
          id: string
          sort_dir: string | null
          sort_key: string | null
          updated_at: string
          user_id: string
          visible_columns: string[]
        }
        Insert: {
          created_at?: string
          grid_key: string
          id?: string
          sort_dir?: string | null
          sort_key?: string | null
          updated_at?: string
          user_id: string
          visible_columns?: string[]
        }
        Update: {
          created_at?: string
          grid_key?: string
          id?: string
          sort_dir?: string | null
          sort_key?: string | null
          updated_at?: string
          user_id?: string
          visible_columns?: string[]
        }
        Relationships: []
      }
      user_group_members: {
        Row: {
          created_at: string
          group_id: string
          is_leader: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          is_leader?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          is_leader?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_groups: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      user_job_roles: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          owner_id: string
          role_id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          owner_id: string
          role_id: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          owner_id?: string
          role_id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_job_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_job_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_sets: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          set_id: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          set_id: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          set_id?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_sets_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "permission_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_owner_id?: string
        }
        Relationships: []
      }
      view_as_sessions: {
        Row: {
          admin_id: string
          created_at: string
          ended_at: string | null
          expires_at: string
          id: string
          mode: string
          nonce: string
          read_only: boolean
          role_id: string | null
          session_id: string | null
          target_user_id: string
          workspace_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          mode: string
          nonce: string
          read_only?: boolean
          role_id?: string | null
          session_id?: string | null
          target_user_id: string
          workspace_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          mode?: string
          nonce?: string
          read_only?: boolean
          role_id?: string | null
          session_id?: string | null
          target_user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "view_as_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      view_as_test_records: {
        Row: {
          created_at: string
          id: string
          record_id: string
          session_id: string
          table_name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          record_id: string
          session_id: string
          table_name: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          record_id?: string
          session_id?: string
          table_name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "view_as_test_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "view_as_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_agent_settings: {
        Row: {
          allowed_hours: Json
          created_at: string
          custom_voices: Json
          default_voice_id: string | null
          default_voice_provider: Database["public"]["Enums"]["voice_provider"]
          first_message: string | null
          language: string
          llm_model: string
          max_duration_seconds: number
          owner_id: string
          similarity_boost: number
          speed: number
          stability: number
          updated_at: string
          vapi_phone_number_id: string | null
          workspace_id: string
        }
        Insert: {
          allowed_hours?: Json
          created_at?: string
          custom_voices?: Json
          default_voice_id?: string | null
          default_voice_provider?: Database["public"]["Enums"]["voice_provider"]
          first_message?: string | null
          language?: string
          llm_model?: string
          max_duration_seconds?: number
          owner_id: string
          similarity_boost?: number
          speed?: number
          stability?: number
          updated_at?: string
          vapi_phone_number_id?: string | null
          workspace_id: string
        }
        Update: {
          allowed_hours?: Json
          created_at?: string
          custom_voices?: Json
          default_voice_id?: string | null
          default_voice_provider?: Database["public"]["Enums"]["voice_provider"]
          first_message?: string | null
          language?: string
          llm_model?: string
          max_duration_seconds?: number
          owner_id?: string
          similarity_boost?: number
          speed?: number
          stability?: number
          updated_at?: string
          vapi_phone_number_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_agent_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_ad_referrals: {
        Row: {
          body: string | null
          conversation_id: string | null
          created_at: string
          ctwa_clid: string | null
          headline: string | null
          id: string
          media_type: string | null
          media_url: string | null
          message_id: string | null
          owner_id: string
          raw: Json | null
          source_id: string | null
          source_type: string | null
          source_url: string | null
          workspace_id: string
        }
        Insert: {
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          ctwa_clid?: string | null
          headline?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_id?: string | null
          owner_id: string
          raw?: Json | null
          source_id?: string | null
          source_type?: string | null
          source_url?: string | null
          workspace_id: string
        }
        Update: {
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          ctwa_clid?: string | null
          headline?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_id?: string | null
          owner_id?: string
          raw?: Json | null
          source_id?: string | null
          source_type?: string | null
          source_url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_ad_referrals_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_ad_referrals_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_ad_referrals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_ad_slugs: {
        Row: {
          click_count: number
          created_at: string
          display_phone_number: string
          id: string
          is_active: boolean
          owner_id: string
          phone_number_id: string | null
          prefill_message: string | null
          slug: string
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          workspace_id: string
        }
        Insert: {
          click_count?: number
          created_at?: string
          display_phone_number: string
          id?: string
          is_active?: boolean
          owner_id: string
          phone_number_id?: string | null
          prefill_message?: string | null
          slug: string
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          workspace_id: string
        }
        Update: {
          click_count?: number
          created_at?: string
          display_phone_number?: string
          id?: string
          is_active?: boolean
          owner_id?: string
          phone_number_id?: string | null
          prefill_message?: string | null
          slug?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_ad_slugs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_business_accounts: {
        Row: {
          access_token: string
          business_id: string | null
          business_name: string | null
          created_at: string
          id: string
          owner_id: string
          raw: Json | null
          status: string
          updated_at: string
          waba_id: string
          webhook_verified_at: string | null
          workspace_id: string
        }
        Insert: {
          access_token: string
          business_id?: string | null
          business_name?: string | null
          created_at?: string
          id?: string
          owner_id: string
          raw?: Json | null
          status?: string
          updated_at?: string
          waba_id: string
          webhook_verified_at?: string | null
          workspace_id: string
        }
        Update: {
          access_token?: string
          business_id?: string | null
          business_name?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          raw?: Json | null
          status?: string
          updated_at?: string
          waba_id?: string
          webhook_verified_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_business_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_catalog_products: {
        Row: {
          availability: string | null
          catalog_id: string
          created_at: string
          currency: string | null
          id: string
          image_url: string | null
          name: string | null
          owner_id: string
          price: string | null
          raw: Json | null
          retailer_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          availability?: string | null
          catalog_id: string
          created_at?: string
          currency?: string | null
          id?: string
          image_url?: string | null
          name?: string | null
          owner_id: string
          price?: string | null
          raw?: Json | null
          retailer_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          availability?: string | null
          catalog_id?: string
          created_at?: string
          currency?: string | null
          id?: string
          image_url?: string | null
          name?: string | null
          owner_id?: string
          price?: string | null
          raw?: Json | null
          retailer_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_catalog_products_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "wa_catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_catalog_products_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_catalogs: {
        Row: {
          catalog_id: string
          created_at: string
          id: string
          name: string | null
          owner_id: string
          raw: Json | null
          updated_at: string
          vertical: string | null
          waba_id: string | null
          workspace_id: string
        }
        Insert: {
          catalog_id: string
          created_at?: string
          id?: string
          name?: string | null
          owner_id: string
          raw?: Json | null
          updated_at?: string
          vertical?: string | null
          waba_id?: string | null
          workspace_id: string
        }
        Update: {
          catalog_id?: string
          created_at?: string
          id?: string
          name?: string | null
          owner_id?: string
          raw?: Json | null
          updated_at?: string
          vertical?: string | null
          waba_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_catalogs_waba_id_fkey"
            columns: ["waba_id"]
            isOneToOne: false
            referencedRelation: "wa_business_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_catalogs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_cloud_connections: {
        Row: {
          api_version: string
          created_at: string
          created_by: string
          credentials_ciphertext: string
          enabled: boolean
          id: string
          label: string
          synced_at: string | null
          waba_id: string
          webhook_received_at: string | null
          webhook_verified_at: string | null
          workspace_id: string
        }
        Insert: {
          api_version: string
          created_at?: string
          created_by: string
          credentials_ciphertext: string
          enabled?: boolean
          id?: string
          label: string
          synced_at?: string | null
          waba_id: string
          webhook_received_at?: string | null
          webhook_verified_at?: string | null
          workspace_id: string
        }
        Update: {
          api_version?: string
          created_at?: string
          created_by?: string
          credentials_ciphertext?: string
          enabled?: boolean
          id?: string
          label?: string
          synced_at?: string | null
          waba_id?: string
          webhook_received_at?: string | null
          webhook_verified_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_cloud_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_cloud_numbers: {
        Row: {
          available: boolean
          connection_id: string
          display_phone_number: string
          phone_number_id: string
          quality_rating: string | null
          status: string | null
          synced_at: string
          verified_name: string | null
          workspace_id: string
        }
        Insert: {
          available?: boolean
          connection_id: string
          display_phone_number: string
          phone_number_id: string
          quality_rating?: string | null
          status?: string | null
          synced_at?: string
          verified_name?: string | null
          workspace_id: string
        }
        Update: {
          available?: boolean
          connection_id?: string
          display_phone_number?: string
          phone_number_id?: string
          quality_rating?: string | null
          status?: string | null
          synced_at?: string
          verified_name?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_cloud_numbers_connection_id_workspace_id_fkey"
            columns: ["connection_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "wa_cloud_connections"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "wa_cloud_numbers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_phone_numbers: {
        Row: {
          created_at: string
          display_phone_number: string
          id: string
          is_default: boolean
          messaging_limit_tier: string | null
          owner_id: string
          phone_number_id: string
          quality_rating: string | null
          raw: Json | null
          routing_rules: Json
          updated_at: string
          verified_name: string | null
          waba_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          display_phone_number: string
          id?: string
          is_default?: boolean
          messaging_limit_tier?: string | null
          owner_id: string
          phone_number_id: string
          quality_rating?: string | null
          raw?: Json | null
          routing_rules?: Json
          updated_at?: string
          verified_name?: string | null
          waba_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          display_phone_number?: string
          id?: string
          is_default?: boolean
          messaging_limit_tier?: string | null
          owner_id?: string
          phone_number_id?: string
          quality_rating?: string | null
          raw?: Json | null
          routing_rules?: Json
          updated_at?: string
          verified_name?: string | null
          waba_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_phone_numbers_waba_id_fkey"
            columns: ["waba_id"]
            isOneToOne: false
            referencedRelation: "wa_business_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_phone_numbers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_templates: {
        Row: {
          category: string
          components: Json
          created_at: string
          id: string
          language: string
          meta_template_id: string | null
          name: string
          owner_id: string
          raw: Json | null
          rejection_reason: string | null
          status: string
          updated_at: string
          waba_id: string
          workspace_id: string
        }
        Insert: {
          category: string
          components?: Json
          created_at?: string
          id?: string
          language: string
          meta_template_id?: string | null
          name: string
          owner_id: string
          raw?: Json | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          waba_id: string
          workspace_id: string
        }
        Update: {
          category?: string
          components?: Json
          created_at?: string
          id?: string
          language?: string
          meta_template_id?: string | null
          name?: string
          owner_id?: string
          raw?: Json | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          waba_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_templates_waba_id_fkey"
            columns: ["waba_id"]
            isOneToOne: false
            referencedRelation: "wa_business_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempt: number
          created_at: string
          delivered_at: string | null
          event_id: string | null
          event_type: string
          id: string
          next_retry_at: string | null
          owner_id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          status: Database["public"]["Enums"]["delivery_status"]
          webhook_id: string
          workspace_id: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          delivered_at?: string | null
          event_id?: string | null
          event_type: string
          id?: string
          next_retry_at?: string | null
          owner_id: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          status?: Database["public"]["Enums"]["delivery_status"]
          webhook_id: string
          workspace_id?: string
        }
        Update: {
          attempt?: number
          created_at?: string
          delivered_at?: string | null
          event_id?: string | null
          event_type?: string
          id?: string
          next_retry_at?: string | null
          owner_id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          status?: Database["public"]["Enums"]["delivery_status"]
          webhook_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "outbound_webhooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaign_recipients: {
        Row: {
          campaign_id: string
          contact_id: string | null
          created_at: string
          error: string | null
          id: string
          override_commercial: boolean
          override_recent: boolean
          owner_id: string
          phone: string
          quota_reserved_until: string | null
          sent_at: string | null
          status: string
          twilio_sid: string | null
          variables: Json
          wa_message_id: string | null
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          contact_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          override_commercial?: boolean
          override_recent?: boolean
          owner_id: string
          phone: string
          quota_reserved_until?: string | null
          sent_at?: string | null
          status?: string
          twilio_sid?: string | null
          variables?: Json
          wa_message_id?: string | null
          workspace_id?: string
        }
        Update: {
          campaign_id?: string
          contact_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          override_commercial?: boolean
          override_recent?: boolean
          owner_id?: string
          phone?: string
          quota_reserved_until?: string | null
          sent_at?: string | null
          status?: string
          twilio_sid?: string | null
          variables?: Json
          wa_message_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campaign_recipients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaigns: {
        Row: {
          audience_config: Json | null
          body_template: string | null
          consent_evidence: string | null
          content_sid: string | null
          content_variables_template: Json
          created_at: string
          dispatch_lease_until: string | null
          exclude_customers: boolean
          exclude_open_deals: boolean
          failed: number
          finished_at: string | null
          id: string
          last_tick_at: string | null
          media_content_type: string | null
          media_url: string | null
          name: string
          next_send_at: string | null
          owner_id: string
          rate_per_minute: number
          recent_contact_days: number
          scheduled_at: string | null
          sdr_enabled: boolean
          sdr_playbook_id: string | null
          send_interval_max_s: number | null
          send_interval_min_s: number | null
          sender_phone_number_id: string | null
          sent: number
          started_at: string | null
          status: string
          template_language: string | null
          template_name: string | null
          total: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          audience_config?: Json | null
          body_template?: string | null
          consent_evidence?: string | null
          content_sid?: string | null
          content_variables_template?: Json
          created_at?: string
          dispatch_lease_until?: string | null
          exclude_customers?: boolean
          exclude_open_deals?: boolean
          failed?: number
          finished_at?: string | null
          id?: string
          last_tick_at?: string | null
          media_content_type?: string | null
          media_url?: string | null
          name: string
          next_send_at?: string | null
          owner_id: string
          rate_per_minute?: number
          recent_contact_days?: number
          scheduled_at?: string | null
          sdr_enabled?: boolean
          sdr_playbook_id?: string | null
          send_interval_max_s?: number | null
          send_interval_min_s?: number | null
          sender_phone_number_id?: string | null
          sent?: number
          started_at?: string | null
          status?: string
          template_language?: string | null
          template_name?: string | null
          total?: number
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          audience_config?: Json | null
          body_template?: string | null
          consent_evidence?: string | null
          content_sid?: string | null
          content_variables_template?: Json
          created_at?: string
          dispatch_lease_until?: string | null
          exclude_customers?: boolean
          exclude_open_deals?: boolean
          failed?: number
          finished_at?: string | null
          id?: string
          last_tick_at?: string | null
          media_content_type?: string | null
          media_url?: string | null
          name?: string
          next_send_at?: string | null
          owner_id?: string
          rate_per_minute?: number
          recent_contact_days?: number
          scheduled_at?: string | null
          sdr_enabled?: boolean
          sdr_playbook_id?: string | null
          send_interval_max_s?: number | null
          send_interval_min_s?: number | null
          sender_phone_number_id?: string | null
          sent?: number
          started_at?: string | null
          status?: string
          template_language?: string | null
          template_name?: string | null
          total?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaigns_sdr_playbook_id_fkey"
            columns: ["sdr_playbook_id"]
            isOneToOne: false
            referencedRelation: "sdr_playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          ai_owner: string | null
          ai_version: number
          assigned_to: string | null
          contact_id: string | null
          contact_phone: string
          conversation_origin: string | null
          created_at: string
          id: string
          identity_status: string
          last_inbound_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          lead_id: string | null
          origin_campaign_id: string | null
          origin_template_name: string | null
          origin_wa_message_id: string | null
          owner_id: string
          provider: string
          sdr_enrollment_id: string | null
          status: string
          twilio_number: string
          unread_count: number
          updated_at: string
          wa_phone_number_id: string | null
          workspace_id: string
        }
        Insert: {
          ai_owner?: string | null
          ai_version?: number
          assigned_to?: string | null
          contact_id?: string | null
          contact_phone: string
          conversation_origin?: string | null
          created_at?: string
          id?: string
          identity_status?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          origin_campaign_id?: string | null
          origin_template_name?: string | null
          origin_wa_message_id?: string | null
          owner_id: string
          provider?: string
          sdr_enrollment_id?: string | null
          status?: string
          twilio_number: string
          unread_count?: number
          updated_at?: string
          wa_phone_number_id?: string | null
          workspace_id?: string
        }
        Update: {
          ai_owner?: string | null
          ai_version?: number
          assigned_to?: string | null
          contact_id?: string | null
          contact_phone?: string
          conversation_origin?: string | null
          created_at?: string
          id?: string
          identity_status?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          origin_campaign_id?: string | null
          origin_template_name?: string | null
          origin_wa_message_id?: string | null
          owner_id?: string
          provider?: string
          sdr_enrollment_id?: string | null
          status?: string
          twilio_number?: string
          unread_count?: number
          updated_at?: string
          wa_phone_number_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_origin_campaign_id_fkey"
            columns: ["origin_campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_sdr_enrollment_id_fkey"
            columns: ["sdr_enrollment_id"]
            isOneToOne: false
            referencedRelation: "sdr_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          context_message_id: string | null
          conversation_id: string
          created_at: string
          delivered_at: string | null
          direction: string
          error_code: string | null
          error_message: string | null
          from_number: string
          id: string
          interactive_type: string | null
          is_template: boolean
          media_content_type: string | null
          media_url: string | null
          owner_id: string
          pricing_category: string | null
          provider: string
          raw: Json | null
          read_at: string | null
          referral_id: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          template_name: string | null
          to_number: string
          twilio_sid: string | null
          wa_message_id: string | null
          workspace_id: string
        }
        Insert: {
          body?: string | null
          context_message_id?: string | null
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          direction: string
          error_code?: string | null
          error_message?: string | null
          from_number: string
          id?: string
          interactive_type?: string | null
          is_template?: boolean
          media_content_type?: string | null
          media_url?: string | null
          owner_id: string
          pricing_category?: string | null
          provider?: string
          raw?: Json | null
          read_at?: string | null
          referral_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          template_name?: string | null
          to_number: string
          twilio_sid?: string | null
          wa_message_id?: string | null
          workspace_id?: string
        }
        Update: {
          body?: string | null
          context_message_id?: string | null
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          direction?: string
          error_code?: string | null
          error_message?: string | null
          from_number?: string
          id?: string
          interactive_type?: string | null
          is_template?: boolean
          media_content_type?: string | null
          media_url?: string | null
          owner_id?: string
          pricing_category?: string | null
          provider?: string
          raw?: Json | null
          read_at?: string | null
          referral_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          template_name?: string | null
          to_number?: string
          twilio_sid?: string | null
          wa_message_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "wa_ad_referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_events: {
        Row: {
          attempts: number
          delivery_id: string
          event: string
          id: string
          next_attempt_at: string
          payload: Json
          processed_at: string | null
          processing_error: string | null
          received_at: string
          workspace_id: string | null
        }
        Insert: {
          attempts?: number
          delivery_id: string
          event: string
          id?: string
          next_attempt_at?: string
          payload: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          workspace_id?: string | null
        }
        Update: {
          attempts?: number
          delivery_id?: string
          event?: string
          id?: string
          next_attempt_at?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_webhook_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      work_resource_catalog: {
        Row: {
          parent_column: unknown
          parent_resource: string | null
          resource: string
          responsible_columns: string[]
          shared: boolean
          table_name: unknown
        }
        Insert: {
          parent_column?: unknown
          parent_resource?: string | null
          resource: string
          responsible_columns?: string[]
          shared?: boolean
          table_name: unknown
        }
        Update: {
          parent_column?: unknown
          parent_resource?: string | null
          resource?: string
          responsible_columns?: string[]
          shared?: boolean
          table_name?: unknown
        }
        Relationships: []
      }
      workflow_action_templates: {
        Row: {
          action_json: Json
          action_type: string
          created_at: string
          description: string | null
          entity: string | null
          id: string
          name: string
          owner_id: string
          table_name: string | null
          updated_at: string
          usage_count: number
          visibility: string
          workspace_id: string | null
        }
        Insert: {
          action_json: Json
          action_type: string
          created_at?: string
          description?: string | null
          entity?: string | null
          id?: string
          name: string
          owner_id: string
          table_name?: string | null
          updated_at?: string
          usage_count?: number
          visibility?: string
          workspace_id?: string | null
        }
        Update: {
          action_json?: Json
          action_type?: string
          created_at?: string
          description?: string | null
          entity?: string | null
          id?: string
          name?: string
          owner_id?: string
          table_name?: string | null
          updated_at?: string
          usage_count?: number
          visibility?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      workflow_approvals: {
        Row: {
          approver_user_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_comment: string | null
          entity: string
          entity_id: string
          event_snapshot: Json | null
          id: string
          note: string | null
          owner_id: string
          requested_by: string | null
          resume_cursor: number
          run_id: string | null
          status: string
          title: string
          updated_at: string
          workflow_id: string
          workflow_version: number | null
          workspace_id: string | null
        }
        Insert: {
          approver_user_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_comment?: string | null
          entity: string
          entity_id: string
          event_snapshot?: Json | null
          id?: string
          note?: string | null
          owner_id: string
          requested_by?: string | null
          resume_cursor?: number
          run_id?: string | null
          status?: string
          title: string
          updated_at?: string
          workflow_id: string
          workflow_version?: number | null
          workspace_id?: string | null
        }
        Update: {
          approver_user_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_comment?: string | null
          entity?: string
          entity_id?: string
          event_snapshot?: Json | null
          id?: string
          note?: string | null
          owner_id?: string
          requested_by?: string | null
          resume_cursor?: number
          run_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          workflow_id?: string
          workflow_version?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_approvals_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_approvals_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_deliveries: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          lease_until: string | null
          next_attempt_at: string | null
          provider: string | null
          provider_id: string | null
          recipient: string | null
          status: string
          step_path: string | null
          updated_at: string
          workflow_id: string | null
          workspace_id: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          lease_until?: string | null
          next_attempt_at?: string | null
          provider?: string | null
          provider_id?: string | null
          recipient?: string | null
          status: string
          step_path?: string | null
          updated_at?: string
          workflow_id?: string | null
          workspace_id: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          lease_until?: string | null
          next_attempt_at?: string | null
          provider?: string | null
          provider_id?: string | null
          recipient?: string | null
          status?: string
          step_path?: string | null
          updated_at?: string
          workflow_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_deliveries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_events: {
        Row: {
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string
          event_type: string
          id: string
          owner_id: string
          processed_at: string | null
          resume_cursor: number | null
          resume_workflow_id: string | null
          run_at: string
          workflow_version: number | null
          workspace_id: string
        }
        Insert: {
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id: string
          event_type: string
          id?: string
          owner_id: string
          processed_at?: string | null
          resume_cursor?: number | null
          resume_workflow_id?: string | null
          run_at?: string
          workflow_version?: number | null
          workspace_id?: string
        }
        Update: {
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string
          event_type?: string
          id?: string
          owner_id?: string
          processed_at?: string | null
          resume_cursor?: number | null
          resume_workflow_id?: string | null
          run_at?: string
          workflow_version?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          created_at: string
          entity: string | null
          entity_id: string | null
          error: string | null
          event_id: string
          finished_at: string | null
          id: string
          is_test: boolean
          log: Json
          owner_id: string
          started_at: string | null
          status: string
          workflow_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          error?: string | null
          event_id: string
          finished_at?: string | null
          id?: string
          is_test?: boolean
          log?: Json
          owner_id: string
          started_at?: string | null
          status?: string
          workflow_id: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          error?: string | null
          event_id?: string
          finished_at?: string | null
          id?: string
          is_test?: boolean
          log?: Json
          owner_id?: string
          started_at?: string | null
          status?: string
          workflow_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "workflow_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_send_policies: {
        Row: {
          dedupe_hours: number
          default_booking_page_id: string | null
          email_account_id: string | null
          email_daily_limit: number | null
          email_provider: string
          timezone: string
          updated_at: string
          updated_by: string | null
          weekdays: number[]
          whatsapp_daily_limit: number | null
          window_end: number | null
          window_start: number | null
          workspace_id: string
        }
        Insert: {
          dedupe_hours?: number
          default_booking_page_id?: string | null
          email_account_id?: string | null
          email_daily_limit?: number | null
          email_provider?: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
          weekdays?: number[]
          whatsapp_daily_limit?: number | null
          window_end?: number | null
          window_start?: number | null
          workspace_id: string
        }
        Update: {
          dedupe_hours?: number
          default_booking_page_id?: string | null
          email_account_id?: string | null
          email_daily_limit?: number | null
          email_provider?: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
          weekdays?: number[]
          whatsapp_daily_limit?: number | null
          window_end?: number | null
          window_start?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_send_policies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_subscriptions: {
        Row: {
          action: Json
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          event_pattern: string
          execution_user_id: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          action: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          event_pattern: string
          execution_user_id?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          action?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          event_pattern?: string
          execution_user_id?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_subscriptions_execution_user_id_fkey"
            columns: ["execution_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_time_cursors: {
        Row: {
          entity_id: string
          last_fired_at: string
          owner_id: string
          workflow_id: string
          workspace_id: string | null
        }
        Insert: {
          entity_id: string
          last_fired_at?: string
          owner_id: string
          workflow_id: string
          workspace_id?: string | null
        }
        Update: {
          entity_id?: string
          last_fired_at?: string
          owner_id?: string
          workflow_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_time_cursors_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          actions: Json
          created_at: string
          draft_actions: Json | null
          draft_goal_filters: Json | null
          draft_trigger: Json | null
          enabled: boolean
          entity: string
          execution_user_id: string | null
          goal_filters: Json | null
          id: string
          last_published_at: string | null
          name: string
          owner_id: string
          published_version: number
          status: string
          trigger: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          actions?: Json
          created_at?: string
          draft_actions?: Json | null
          draft_goal_filters?: Json | null
          draft_trigger?: Json | null
          enabled?: boolean
          entity: string
          execution_user_id?: string | null
          goal_filters?: Json | null
          id?: string
          last_published_at?: string | null
          name: string
          owner_id?: string
          published_version?: number
          status?: string
          trigger?: Json
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          actions?: Json
          created_at?: string
          draft_actions?: Json | null
          draft_goal_filters?: Json | null
          draft_trigger?: Json | null
          enabled?: boolean
          entity?: string
          execution_user_id?: string | null
          goal_filters?: Json | null
          id?: string
          last_published_at?: string | null
          name?: string
          owner_id?: string
          published_version?: number
          status?: string
          trigger?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_execution_user_id_fkey"
            columns: ["execution_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_ai_credentials: {
        Row: {
          key_ciphertext: string
          key_last4: string | null
          model: string | null
          provider: string
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          key_ciphertext: string
          key_last4?: string | null
          model?: string | null
          provider: string
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          key_ciphertext?: string
          key_last4?: string | null
          model?: string | null
          provider?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_ai_credentials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_ai_settings: {
        Row: {
          last_error: string | null
          last_tested_at: string | null
          model: string | null
          provider: string
          status: string
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          last_error?: string | null
          last_tested_at?: string | null
          model?: string | null
          provider?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          last_error?: string | null
          last_tested_at?: string | null
          model?: string | null
          provider?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_ai_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_branding: {
        Row: {
          accent_color: string | null
          body_font: string | null
          brand_name: string | null
          created_at: string
          custom_domain: string | null
          density: string | null
          favicon_url: string | null
          footer_text: string | null
          heading_font: string | null
          logo_url: string | null
          owner_id: string
          primary_color: string | null
          radius: string | null
          support_email: string | null
          theme: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          accent_color?: string | null
          body_font?: string | null
          brand_name?: string | null
          created_at?: string
          custom_domain?: string | null
          density?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          heading_font?: string | null
          logo_url?: string | null
          owner_id: string
          primary_color?: string | null
          radius?: string | null
          support_email?: string | null
          theme?: Json
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          accent_color?: string | null
          body_font?: string | null
          brand_name?: string | null
          created_at?: string
          custom_domain?: string | null
          density?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          heading_font?: string | null
          logo_url?: string | null
          owner_id?: string
          primary_color?: string | null
          radius?: string | null
          support_email?: string | null
          theme?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_branding_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invite_settings: {
        Row: {
          body_intro: string | null
          cta_label: string | null
          expires_note: string | null
          footer_note: string | null
          greeting: string | null
          product_name: string | null
          subject: string | null
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          body_intro?: string | null
          cta_label?: string | null
          expires_note?: string | null
          footer_note?: string | null
          greeting?: string | null
          product_name?: string | null
          subject?: string | null
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          body_intro?: string | null
          cta_label?: string | null
          expires_note?: string | null
          footer_note?: string | null
          greeting?: string | null
          product_name?: string | null
          subject?: string | null
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invite_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          permission_set_id: string | null
          role: string
          token: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          permission_set_id?: string | null
          role?: string
          token: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          permission_set_id?: string | null
          role?: string
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_permission_set_id_fkey"
            columns: ["permission_set_id"]
            isOneToOne: false
            referencedRelation: "permission_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          invited_by: string | null
          is_test_user: boolean
          joined_at: string
          role: string
          status: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          invited_by?: string | null
          is_test_user?: boolean
          joined_at?: string
          role?: string
          status?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          invited_by?: string | null
          is_test_user?: boolean
          joined_at?: string
          role?: string
          status?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_modules: {
        Row: {
          activated_at: string
          created_at: string
          enabled: boolean
          id: string
          module_id: string
          plan_code: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          activated_at?: string
          created_at?: string
          enabled?: boolean
          id?: string
          module_id: string
          plan_code?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          activated_at?: string
          created_at?: string
          enabled?: boolean
          id?: string
          module_id?: string
          plan_code?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_modules_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "workspace_modules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_realtime_signals: {
        Row: {
          nonce: string
          table_name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          nonce?: string
          table_name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          nonce?: string
          table_name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_realtime_signals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string
          plan_code: string
          status: string
          trial_ends_at: string | null
          updated_at: string
          workspace_owner_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          plan_code?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          workspace_owner_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          plan_code?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          workspace_owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["code"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          custom_domain: string | null
          data_region: string
          default_phone_country: string
          deleted_at: string | null
          id: string
          logo_url: string | null
          meeting_settings: Json
          name: string
          nfse_settings: Json
          payments_settings: Json
          phone_strict_e164: boolean
          primary_color: string | null
          security_settings: Json
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          custom_domain?: string | null
          data_region?: string
          default_phone_country?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          meeting_settings?: Json
          name: string
          nfse_settings?: Json
          payments_settings?: Json
          phone_strict_e164?: boolean
          primary_color?: string | null
          security_settings?: Json
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          custom_domain?: string | null
          data_region?: string
          default_phone_country?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          meeting_settings?: Json
          name?: string
          nfse_settings?: Json
          payments_settings?: Json
          phone_strict_e164?: boolean
          primary_color?: string | null
          security_settings?: Json
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      zapier_subscriptions: {
        Row: {
          active: boolean
          api_key_id: string | null
          created_at: string
          event: string
          id: string
          last_delivery_at: string | null
          last_delivery_status: number | null
          owner_id: string
          target_url: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          api_key_id?: string | null
          created_at?: string
          event: string
          id?: string
          last_delivery_at?: string | null
          last_delivery_status?: number | null
          owner_id: string
          target_url: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          api_key_id?: string | null
          created_at?: string
          event?: string
          id?: string
          last_delivery_at?: string | null
          last_delivery_status?: number | null
          owner_id?: string
          target_url?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapier_subscriptions_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ats_referral_programs_public: {
        Row: {
          id: string | null
          landing_body: string | null
          landing_headline: string | null
          name: string | null
          public_slug: string | null
          terms_url: string | null
        }
        Insert: {
          id?: string | null
          landing_body?: string | null
          landing_headline?: string | null
          name?: string | null
          public_slug?: string | null
          terms_url?: string | null
        }
        Update: {
          id?: string | null
          landing_body?: string | null
          landing_headline?: string | null
          name?: string | null
          public_slug?: string | null
          terms_url?: string | null
        }
        Relationships: []
      }
      people_documents_expiring: {
        Row: {
          days_left: number | null
          doc_number: string | null
          doc_type: string | null
          expires_at: string | null
          file_name: string | null
          file_url: string | null
          id: string | null
          owner_id: string | null
          person_id: string | null
          person_name: string | null
          person_photo_url: string | null
          status: Database["public"]["Enums"]["people_doc_status"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_documents_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_documents_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_total_cost"
            referencedColumns: ["person_id"]
          },
        ]
      }
      people_total_cost: {
        Row: {
          benefits_total: number | null
          employment_type:
            | Database["public"]["Enums"]["people_employment_type"]
            | null
          full_name: string | null
          monthly_cost: number | null
          owner_id: string | null
          person_id: string | null
          status: Database["public"]["Enums"]["people_status"] | null
          total_cost_monthly: number | null
        }
        Relationships: []
      }
      shared_audit_logs: {
        Row: {
          action: string | null
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string | null
          entity: string | null
          entity_id: string | null
          id: string | null
          metadata: Json | null
          module_id: string | null
        }
        Relationships: []
      }
      shared_fields_ats_candidates: {
        Row: {
          about: string | null
          archived: boolean | null
          assigned_to: string | null
          available_actions: Json | null
          capture_version: string | null
          captured_at: string | null
          certifications: Json | null
          connection_degree: string | null
          created_at: string | null
          created_by: string | null
          current_company: string | null
          current_company_data: Json | null
          current_position: string | null
          cv_parsed: Json | null
          cv_url: string | null
          dei_disability: string | null
          dei_gender: string | null
          dei_lgbtqia: string | null
          dei_race: string | null
          education: Json | null
          email: string | null
          experiences: Json | null
          external_links: Json | null
          full_name: string | null
          headline: string | null
          id: string | null
          languages: Json | null
          last_touch_at: string | null
          lgpd_redacted_at: string | null
          linkedin_url: string | null
          location: string | null
          next_action_at: string | null
          notes: string | null
          open_to_work: boolean | null
          owner_id: string | null
          phone: string | null
          photo_url: string | null
          projects: Json | null
          publications: Json | null
          recent_activity: Json | null
          recommendations: Json | null
          relationship_owner_id: string | null
          relationship_status: string | null
          retention_until: string | null
          score: number | null
          skills: string[] | null
          skills_detailed: Json | null
          source: string | null
          tags: string[] | null
          updated_at: string | null
          volunteering: Json | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ats_candidates_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_fields_ats_interviews: {
        Row: {
          ai_concerns: Json | null
          ai_followups: Json | null
          ai_generated_at: string | null
          ai_model: string | null
          ai_recommendation: string | null
          ai_score: number | null
          ai_strengths: Json | null
          ai_summary: string | null
          application_id: string | null
          assigned_to: string | null
          async_questions_snapshot: Json | null
          auto_rescheduled_from: string | null
          candidate_id: string | null
          created_at: string | null
          duration_min: number | null
          id: string | null
          interview_kit_id: string | null
          interviewer_id: string | null
          job_id: string | null
          kind: string | null
          location: string | null
          meet_url: string | null
          meeting_id: string | null
          notes: string | null
          offered_slots: Json | null
          owner_id: string | null
          panel_interviewer_ids: string[] | null
          pool_id: string | null
          reminder_1h_sent_at: string | null
          reminder_d1_sent_at: string | null
          scheduled_at: string | null
          self_schedule_expires_at: string | null
          self_schedule_token: string | null
          self_scheduled_at: string | null
          slots: Json | null
          stage_value: string | null
          status: string | null
          transcript: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "ats_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_interviews_auto_rescheduled_from_fkey"
            columns: ["auto_rescheduled_from"]
            isOneToOne: false
            referencedRelation: "ats_interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_interviews_auto_rescheduled_from_fkey"
            columns: ["auto_rescheduled_from"]
            isOneToOne: false
            referencedRelation: "shared_fields_ats_interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_interviews_interview_kit_id_fkey"
            columns: ["interview_kit_id"]
            isOneToOne: false
            referencedRelation: "ats_interview_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_interviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ats_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_interviews_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_interviews_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "ats_interviewer_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_interviews_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_fields_ats_offers: {
        Row: {
          application_id: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          approved_revision: number | null
          assigned_to: string | null
          candidate_id: string | null
          created_at: string | null
          decline_reason: string | null
          declined_at: string | null
          esign_document_id: string | null
          id: string | null
          job_id: string | null
          owner_id: string | null
          promote_to_stage: string | null
          revision: number | null
          sent_at: string | null
          signed_at: string | null
          start_date: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          viewed_at: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_offers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "ats_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_offers_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_offers_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_ats_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_offers_esign_document_id_fkey"
            columns: ["esign_document_id"]
            isOneToOne: false
            referencedRelation: "esign_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_offers_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ats_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_offers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_fields_contacts: {
        Row: {
          address: string | null
          area_atuacao: string | null
          assigned_to: string | null
          assigned_user_id: string | null
          cargo_catalog_version: number | null
          cargo_resumido: string | null
          cep: string | null
          city: string | null
          company_id: string | null
          company_name: string | null
          consent_date: string | null
          country: string | null
          created_at: string | null
          custom_fields: Json | null
          deleted_at: string | null
          email: string | null
          external_ids: Json | null
          first_name: string | null
          hs_createdate: string | null
          hs_lastmodifieddate: string | null
          hs_lead_status: string | null
          hs_object_id: string | null
          hs_raw: Json | null
          hubspot_owner_id: string | null
          id: string | null
          job_title: string | null
          label: string | null
          last_name: string | null
          legal_basis: string | null
          lifecyclestage: string | null
          linkedin_url: string | null
          marketing_status: string | null
          mobile_phone: string | null
          mobile_phone_digits: string | null
          nivel_hierarquico: string | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          phone_digits: string | null
          phone_ext: string | null
          photo_source: string | null
          photo_updated_at: string | null
          photo_url: string | null
          portal_enabled: boolean | null
          score: number | null
          state: string | null
          twitter_handle: string | null
          updated_at: string | null
          website: string | null
          whatsapp_digits: string | null
          whatsapp_e164: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_fields_deal_line_items: {
        Row: {
          billing_model: Database["public"]["Enums"]["billing_model"] | null
          cadence: string | null
          contracting_preset_id: string | null
          created_at: string | null
          deal_id: string | null
          description: string | null
          discount_amount: number | null
          discount_pct: number | null
          discount_type: string | null
          id: string | null
          job_profile_id: string | null
          name: string | null
          owner_id: string | null
          percent: number | null
          percent_base_amount: number | null
          position: number | null
          quantity: number | null
          seniority: string | null
          service_catalog_id: string | null
          tax_rate: number | null
          unit: string | null
          unit_price: number | null
          updated_at: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_line_items_contracting_preset_id_fkey"
            columns: ["contracting_preset_id"]
            isOneToOne: false
            referencedRelation: "contracting_presets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_line_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_line_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_line_items_job_profile_id_fkey"
            columns: ["job_profile_id"]
            isOneToOne: false
            referencedRelation: "job_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_line_items_service_catalog_id_fkey"
            columns: ["service_catalog_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_line_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_fields_deals: {
        Row: {
          assigned_to: string | null
          assigned_user_id: string | null
          closed_at: string | null
          closed_lost_reason: string | null
          closed_won_reason: string | null
          company_id: string | null
          created_at: string | null
          currency: string | null
          custom_fields: Json | null
          dealtype: string | null
          deleted_at: string | null
          description: string | null
          expected_close_date: string | null
          external_ids: Json | null
          hs_createdate: string | null
          hs_deal_stage_probability: number | null
          hs_lastmodifieddate: string | null
          hs_object_id: string | null
          hs_priority: string | null
          hs_raw: Json | null
          hubspot_owner_id: string | null
          id: string | null
          lead_id: string | null
          lost_at: string | null
          name: string | null
          notes: string | null
          num_associated_contacts: number | null
          owner_id: string | null
          pipeline_id: string | null
          primary_contact_id: string | null
          service_line: string | null
          source: string | null
          stage: Database["public"]["Enums"]["deal_stage"] | null
          stage_id: string | null
          stage_substatus_id: string | null
          updated_at: string | null
          value: number | null
          workspace_id: string | null
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
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "shared_fields_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_substatus_id_fkey"
            columns: ["stage_substatus_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stage_substatuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_fields_leads: {
        Row: {
          area_atuacao: string | null
          assigned_to: string | null
          assigned_user_id: string | null
          cargo_catalog_version: number | null
          cargo_resumido: string | null
          company_id: string | null
          company_name: string | null
          converted_at: string | null
          converted_contact_id: string | null
          converted_deal_id: string | null
          created_at: string | null
          custom_fields: Json | null
          deleted_at: string | null
          email: string | null
          external_ids: Json | null
          first_name: string | null
          hs_createdate: string | null
          hs_lastmodifieddate: string | null
          hs_lead_source_detail: string | null
          hs_object_id: string | null
          hs_raw: Json | null
          hubspot_owner_id: string | null
          id: string | null
          job_title: string | null
          job_title_source: string | null
          label: string | null
          last_form_submission_at: string | null
          last_name: string | null
          linkedin_url: string | null
          mobile_phone: string | null
          mobile_phone_digits: string | null
          nivel_hierarquico: string | null
          notes: string | null
          nurture_started_at: string | null
          owner_id: string | null
          phone: string | null
          phone_digits: string | null
          phone_ext: string | null
          photo_source: string | null
          photo_updated_at: string | null
          photo_url: string | null
          pipeline_id: string | null
          score: number | null
          source: string | null
          stage_id: string | null
          stage_substatus_id: string | null
          status: Database["public"]["Enums"]["lead_status"] | null
          updated_at: string | null
          whatsapp_digits: string | null
          whatsapp_e164: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_substatus_id_fkey"
            columns: ["stage_substatus_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stage_substatuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_branding_public: {
        Row: {
          accent_color: string | null
          brand_name: string | null
          custom_domain: string | null
          favicon_url: string | null
          footer_text: string | null
          logo_url: string | null
          primary_color: string | null
          support_email: string | null
        }
        Insert: {
          accent_color?: string | null
          brand_name?: string | null
          custom_domain?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          logo_url?: string | null
          primary_color?: string | null
          support_email?: string | null
        }
        Update: {
          accent_color?: string | null
          brand_name?: string | null
          custom_domain?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          logo_url?: string | null
          primary_color?: string | null
          support_email?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _add_billing_interval: {
        Args: {
          p_count: number
          p_date: string
          p_interval: Database["public"]["Enums"]["billing_interval"]
        }
        Returns: string
      }
      _calendar_event_is_long_series: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      activity_body_plain: { Args: { _body: string }; Returns: string }
      activity_body_search_doc: { Args: { _body: string }; Returns: unknown }
      admin_setting_access: {
        Args: { a: string; c: Json; r: string; w: string }
        Returns: boolean
      }
      admin_setting_authorize: {
        Args: { a?: string; r: string }
        Returns: Json
      }
      anonymize_ats_candidate: {
        Args: { _candidate_id: string }
        Returns: undefined
      }
      api_rate_hit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: Json
      }
      ats_api_confirm_hire: {
        Args: { _id: string; _key: string; _stage: string }
        Returns: Json
      }
      ats_application_action_access: {
        Args: {
          _action: string
          _candidate: string
          _job: string
          _workspace: string
        }
        Returns: boolean
      }
      ats_application_event_insert_access: {
        Args: { _application: string; _event: string; _workspace: string }
        Returns: boolean
      }
      ats_assign_interviewer_pool: { Args: { _pool: string }; Returns: string }
      ats_availability_create_targets: { Args: never; Returns: string[] }
      ats_busy_intervals: {
        Args: { _from: string; _interviewers: string[]; _to: string }
        Returns: {
          ends_at: string
          interviewer_id: string
          starts_at: string
        }[]
      }
      ats_compliance_access: {
        Args: { _action: string; _candidate: string }
        Returns: boolean
      }
      ats_compliance_capabilities: {
        Args: { _candidates: string[] }
        Returns: {
          can_erase: boolean
          can_export: boolean
          can_update: boolean
          candidate_id: string
        }[]
      }
      ats_compliance_export: {
        Args: { _candidate: string; _request?: string }
        Returns: Json
      }
      ats_compliance_write: {
        Args: {
          _action: string
          _candidate?: string
          _payload?: Json
          _request?: string
        }
        Returns: Json
      }
      ats_config_action_access: {
        Args: {
          _action: string
          _resource: string
          _subject: string
          _workspace: string
        }
        Returns: boolean
      }
      ats_config_catalog_access: {
        Args: { _resource: string; _subject: string; _workspace: string }
        Returns: boolean
      }
      ats_hiring_terms: {
        Args: { _ids: string[] }
        Returns: {
          can_update: boolean
          can_view: boolean
          fields: Json
          id: string
        }[]
      }
      ats_hiring_terms_access: {
        Args: { _action: string; _row: Json }
        Returns: boolean
      }
      ats_interview_action_access: {
        Args: { _action: string; _application: string; _workspace: string }
        Returns: boolean
      }
      ats_is_hiring_stage: {
        Args: { _job: string; _stage: string }
        Returns: boolean
      }
      ats_job_action_access: {
        Args: {
          _action: string
          _assigned: string
          _manager: string
          _owner: string
          _recruiter: string
          _workspace: string
        }
        Returns: boolean
      }
      ats_offer_action_access: {
        Args: { _action: string; _row: Json }
        Returns: boolean
      }
      ats_offer_document_access: {
        Args: { _action: string; _doc: string }
        Returns: boolean
      }
      ats_offer_link: { Args: { _id: string }; Returns: string }
      ats_offer_projection: {
        Args: { _candidate?: string; _offer?: string }
        Returns: Json[]
      }
      ats_offer_public: { Args: { _token: string }; Returns: Json }
      ats_offer_sign: {
        Args: {
          _action: string
          _ip?: string
          _name?: string
          _reason?: string
          _signature?: string
          _token: string
          _ua?: string
        }
        Returns: Json
      }
      ats_offer_transition: {
        Args: {
          _action: string
          _id: string
          _note?: string
          _revision: number
        }
        Returns: Json
      }
      ats_pipeline_action_access: {
        Args: { _action: string; _owner: string; _workspace: string }
        Returns: boolean
      }
      ats_pipeline_catalog_access: {
        Args: { _owner: string; _workspace: string }
        Returns: boolean
      }
      ats_pool_rotation_only: {
        Args: { _new: Json; _old: Json }
        Returns: boolean
      }
      ats_response_action_access: {
        Args: {
          _action: string
          _application: string
          _scorecard: string
          _workspace: string
        }
        Returns: boolean
      }
      ats_save_interview_kit: {
        Args: { _id: string; _payload: Json }
        Returns: string
      }
      ats_schedule_metadata_access: {
        Args: { _workspace: string }
        Returns: boolean
      }
      backfill_activities_assigned_to_batch: { Args: never; Returns: number }
      banking_access: {
        Args: { _action: string; _workspace: string }
        Returns: boolean
      }
      banking_apply_event: {
        Args: {
          _actor?: string
          _external?: string
          _id: string
          _kind: string
          _paid_at?: string
          _reason?: string
          _status: string
        }
        Returns: Json
      }
      banking_authorize: { Args: { _action: string }; Returns: string }
      banking_claim_refresh: {
        Args: { _connection: string; _expected: string }
        Returns: boolean
      }
      banking_create_payment: { Args: { _data: Json }; Returns: string }
      banking_disconnect: {
        Args: { _actor: string; _id: string; _workspace: string }
        Returns: undefined
      }
      banking_payment_transition: {
        Args: { _action: string; _id: string }
        Returns: Json
      }
      banking_store_tokens: {
        Args: {
          _actor?: string
          _connection: string
          _expected?: string
          _state?: string
          _tokens: Json
          _workspace: string
        }
        Returns: boolean
      }
      can_access_ats_job: { Args: { _job_id: string }; Returns: boolean }
      can_manage_access_scope: { Args: { _owner: string }; Returns: boolean }
      can_manage_person: { Args: { _person_id: string }; Returns: boolean }
      can_view_person: { Args: { _person_id: string }; Returns: boolean }
      can_view_person_sensitive: {
        Args: { _person_id: string }
        Returns: boolean
      }
      can_write_owner: {
        Args: { _owner: string; _user: string }
        Returns: boolean
      }
      clockify_import_apply: {
        Args: {
          p_op: string
          p_rows: Json
          p_table: string
          p_workspace: string
        }
        Returns: Json
      }
      clockify_import_catalogs: {
        Args: { p_owner: string; p_source: string; p_workspace: string }
        Returns: Json
      }
      clockify_import_force_pending: {
        Args: { p_run: string; p_workspace: string }
        Returns: Json
      }
      clockify_target_in_workspace: {
        Args: { p_id: string; p_table: string; p_ws: string }
        Returns: boolean
      }
      companies_facets: {
        Args: { p_limit?: number }
        Returns: {
          count: number
          facet: string
          value: string
        }[]
      }
      company_portfolio_owner: {
        Args: { _company_id: string }
        Returns: {
          owner_id: string
          owner_name: string
        }[]
      }
      contract_approval_decide: {
        Args: { p_approval: string; p_comment?: string; p_decision: string }
        Returns: Json
      }
      contract_approval_start: {
        Args: { p_contract: string; p_reset?: boolean; p_stages?: string[] }
        Returns: Json
      }
      contract_audit_annotate: {
        Args: { p_contract: string; p_evidence: Json }
        Returns: undefined
      }
      contract_change_checked: {
        Args: { p_contract: string; p_evidence?: Json; p_patch: Json }
        Returns: Json
      }
      contract_create_batch: {
        Args: { p_contract: Json; p_services?: Json; p_skip_existing?: boolean }
        Returns: Json
      }
      contract_defaults_resolve: { Args: { p_ws: string }; Returns: Json }
      contract_esign_attachment: {
        Args: {
          p_action: string
          p_data?: Json
          p_document?: string
          p_id?: string
        }
        Returns: Json
      }
      contract_esign_manage: {
        Args: { p_action: string; p_data?: Json; p_id?: string }
        Returns: Json
      }
      contract_esign_public: {
        Args: {
          p_action: string
          p_ip?: string
          p_name?: string
          p_reason?: string
          p_signature?: string
          p_token: string
          p_ua?: string
        }
        Returns: Json
      }
      contract_mutate: {
        Args: { p_contract: string; p_patch: Json }
        Returns: Json
      }
      contract_template_save_checked: {
        Args: {
          p_copy?: string
          p_id?: string
          p_patch?: Json
          p_services?: string[]
        }
        Returns: Json
      }
      contract_transition: {
        Args: { p_contract: string; p_status: string }
        Returns: undefined
      }
      contract_workflow_terminate: {
        Args: {
          p_actor: string
          p_date: string
          p_person: string
          p_workflow?: string
        }
        Returns: Json
      }
      crm_classify_title: { Args: { rules: Json; v: string }; Returns: Json }
      crm_employee_band: { Args: { n: number }; Returns: string }
      crm_employee_integer: { Args: { v: string }; Returns: number }
      crm_is_derivation_backfill: {
        Args: { new_row: Json; old_row: Json }
        Returns: boolean
      }
      crm_normalize_title: { Args: { v: string }; Returns: string }
      crm_size_description: { Args: { v: string }; Returns: string }
      current_role_test_session: { Args: never; Returns: string }
      current_user_permissions: {
        Args: { _workspace_id: string }
        Returns: string[]
      }
      current_user_permissions_json: {
        Args: { _workspace_id: string }
        Returns: Json
      }
      current_user_workspaces: { Args: never; Returns: string[] }
      dashboard_metrics: { Args: never; Returns: Json }
      deal_delivery_assert_user: {
        Args: { p_write: boolean; p_ws: string }
        Returns: undefined
      }
      deal_delivery_attempt: { Args: { p_job: string }; Returns: Json }
      deal_delivery_can_create_project: {
        Args: { _ws: string }
        Returns: boolean
      }
      deal_delivery_can_edit_deal: { Args: { _deal: string }; Returns: boolean }
      deal_delivery_create_project: {
        Args: { p_deal: string; p_operational_owner?: string }
        Returns: Json
      }
      deal_delivery_ensure_internal: {
        Args: {
          p_audit_actor: string
          p_creator: string
          p_deal: string
          p_job: string
          p_operational_owner?: string
          p_origin: string
        }
        Returns: Json
      }
      deal_delivery_history_apply: {
        Args: { p_note: string; p_pairs: Json; p_ws: string }
        Returns: Json
      }
      deal_delivery_history_apply_exact: {
        Args: { p_ws: string }
        Returns: Json
      }
      deal_delivery_history_create: {
        Args: { p_deals: string[]; p_note: string; p_ws: string }
        Returns: Json
      }
      deal_delivery_history_list: {
        Args: {
          p_filter?: string
          p_from?: string
          p_page?: number
          p_q?: string
          p_size?: number
          p_to?: string
          p_ws: string
        }
        Returns: Json
      }
      deal_delivery_history_preview: {
        Args: { p_pairs: Json; p_ws: string }
        Returns: Json
      }
      deal_delivery_history_revert: {
        Args: { p_events: string[]; p_note: string; p_ws: string }
        Returns: Json
      }
      deal_delivery_is_active_member: {
        Args: { p_user: string; p_ws: string }
        Returns: boolean
      }
      deal_delivery_link_core: {
        Args: {
          p_actor: string
          p_batch: string
          p_deal: string
          p_evidence: Json
          p_group: string
          p_kind: string
          p_note: string
          p_project: string
        }
        Returns: Json
      }
      deal_delivery_link_project: {
        Args: {
          p_deal: string
          p_group?: string
          p_note?: string
          p_project: string
        }
        Returns: Json
      }
      deal_delivery_overview: { Args: { p_deal: string }; Returns: Json }
      deal_delivery_pair_check: {
        Args: { p_deal: string; p_project: string; p_ws: string }
        Returns: Json
      }
      deal_delivery_pair_snapshot: {
        Args: { p_deal: string; p_project: string }
        Returns: string
      }
      deal_delivery_policy_get: { Args: { p_ws: string }; Returns: Json }
      deal_delivery_policy_save: {
        Args: {
          p_allow_groups: boolean
          p_creator: string
          p_default_owner: string
          p_enabled: boolean
          p_origins: Json
          p_reset_activation?: boolean
          p_ws: string
        }
        Returns: Json
      }
      deal_delivery_process_job: { Args: { p_job: string }; Returns: Json }
      deal_delivery_resolve_review: {
        Args: { p_event: string; p_note: string }
        Returns: Json
      }
      deal_delivery_retry: { Args: { p_deal: string }; Returns: Json }
      deal_delivery_run_jobs: { Args: { p_limit?: number }; Returns: Json }
      deal_delivery_set_groups: {
        Args: { p_deal: string; p_items: Json }
        Returns: Json
      }
      deal_delivery_set_operational_owner: {
        Args: { p_project: string; p_user: string }
        Returns: Json
      }
      deal_delivery_unlink_project: {
        Args: { p_deal: string; p_note: string; p_project: string }
        Returns: Json
      }
      deal_delivery_workflow_ensure: {
        Args: { p_deal: string; p_workspace: string }
        Returns: Json
      }
      deal_delivery_write_origin: {
        Args: { p_import_hint: boolean }
        Returns: string
      }
      deal_delivery_ws_of_deal: { Args: { p_deal: string }; Returns: string }
      deal_stage_type: {
        Args: { p_pipeline: string; p_stage: string; p_stage_id: string }
        Returns: string
      }
      deal_visible_to_current_user: {
        Args: { _deal: string }
        Returns: boolean
      }
      deals_hs_close_date: { Args: { _hs_raw: Json }; Returns: string }
      default_workspace_for_user: { Args: { _user: string }; Returns: string }
      effective_permissions_array: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: string[]
      }
      ensure_silver_medalist_pool: { Args: { _owner: string }; Returns: string }
      esign_verify_hash: {
        Args: { _hash: string }
        Returns: {
          document_id: string
          sealed_at: string
          signed_count: number
          signers_count: number
          status: Database["public"]["Enums"]["esign_doc_status"]
          title: string
        }[]
      }
      finance_access_context: { Args: never; Returns: Json }
      finance_advance_recurrence: {
        Args: { _id: string; _today?: string }
        Returns: Json
      }
      finance_business_access: {
        Args: {
          _action: string
          _ctx: Json
          _resource: string
          _responsible?: string
          _workspace: string
        }
        Returns: boolean
      }
      finance_business_authorize: {
        Args: { _action: string; _id?: string; _resource: string }
        Returns: string
      }
      finance_business_capabilities: {
        Args: { _ids: string[]; _resource: string }
        Returns: {
          can_cancel: boolean
          can_delete: boolean
          can_issue: boolean
          can_settle: boolean
          can_update: boolean
          id: string
        }[]
      }
      finance_context_access: {
        Args: {
          _action: string
          _ctx: Json
          _resource: string
          _responsible?: string
          _workspace: string
        }
        Returns: boolean
      }
      finance_context_entry_access: {
        Args: {
          _action: string
          _ctx: Json
          _responsible: string
          _workspace: string
        }
        Returns: boolean
      }
      finance_context_payment_access: {
        Args: {
          _action: string
          _ctx: Json
          _entry: string
          _workspace: string
        }
        Returns: boolean
      }
      finance_create_installments: { Args: { _rows: Json }; Returns: Json }
      finance_delete_installments: {
        Args: { _only_open?: boolean; _parent: string }
        Returns: Json
      }
      finance_dunning_allowed: {
        Args: { _channel?: string; _invoice: string; _policy: string }
        Returns: boolean
      }
      finance_dunning_claim: { Args: { _run: string }; Returns: Json }
      finance_dunning_enroll: { Args: never; Returns: number }
      finance_dunning_finish: {
        Args: { _attempt: string; _result: Json; _token: string }
        Returns: boolean
      }
      finance_entry_access: {
        Args: { _action: string; _entry: string }
        Returns: boolean
      }
      finance_entry_capabilities: {
        Args: { _ids: string[] }
        Returns: {
          can_cancel: boolean
          can_delete: boolean
          can_pay: boolean
          can_reverse: boolean
          can_update: boolean
          id: string
        }[]
      }
      finance_invoice_from_timesheet: {
        Args: {
          _allocation: string
          _description?: string
          _due: string
          _end: string
          _start: string
        }
        Returns: Json
      }
      finance_invoice_visible: {
        Args: { _id: string; _workspace: string }
        Returns: boolean
      }
      finance_lock_payment_entry: {
        Args: { _action: string; _entry: string }
        Returns: {
          amount: number
          assigned_to: string | null
          attachments: Json
          category_id: string | null
          competence_date: string
          contract_id: string | null
          counterparty_company_id: string | null
          counterparty_legal_entity_id: string | null
          created_at: string
          currency: string
          description: string
          direction: Database["public"]["Enums"]["financial_direction"]
          due_date: string
          external_ref: string | null
          id: string
          installment_number: number | null
          installment_total: number | null
          legal_entity_id: string | null
          metadata: Json
          notes: string | null
          origin_id: string | null
          origin_type: Database["public"]["Enums"]["financial_origin_type"]
          owner_id: string
          paid_amount: number
          parent_entry_id: string | null
          payment_method: string | null
          project_id: string | null
          service_id: string | null
          status: Database["public"]["Enums"]["financial_entry_status"]
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "financial_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finance_nfse_visible: {
        Args: { _invoice: string; _responsible: string; _workspace: string }
        Returns: boolean
      }
      finance_payment_access: {
        Args: { _action: string; _entry: string }
        Returns: boolean
      }
      finance_reconcile_transaction: {
        Args: { _bank?: string; _category?: string; _transaction: string }
        Returns: Json
      }
      finance_recurrence_access: {
        Args: { _action: string; _id: string }
        Returns: boolean
      }
      finance_recurrence_capabilities: {
        Args: { _ids: string[] }
        Returns: {
          can_delete: boolean
          can_generate: boolean
          can_update: boolean
          id: string
        }[]
      }
      finance_reference_list: { Args: { _resource: string }; Returns: Json }
      finance_scope_access: {
        Args: {
          _action: string
          _resource: string
          _responsible?: string
          _workspace: string
        }
        Returns: boolean
      }
      finance_set_default_entity: { Args: { _id: string }; Returns: undefined }
      finance_set_group_members: {
        Args: { _id: string; _members: string[] }
        Returns: undefined
      }
      finance_upsert_dunning: { Args: { _data: Json }; Returns: Json }
      finance_verify_cron_token: {
        Args: { _job: string; _token: string }
        Returns: boolean
      }
      find_sla_policy: {
        Args: {
          _owner: string
          _pipeline: string
          _priority: Database["public"]["Enums"]["ticket_priority"]
        }
        Returns: string
      }
      gcal_base_event_id: {
        Args: { provider_event_id: string }
        Returns: string
      }
      generate_referral_slug: { Args: never; Returns: string }
      get_entitlement_limit: {
        Args: { _key: string; _workspace: string }
        Returns: number
      }
      get_entity_field_catalog: {
        Args: { p_owner_id: string; p_table: string }
        Returns: {
          column_name: string
          data_type: string
          distinct_count: number
          distinct_values: string[]
          has_default: boolean
          is_nullable: string
        }[]
      }
      get_entity_timeline: {
        Args: {
          p_entity_id: string
          p_entity_kind: string
          p_limit?: number
          p_since?: string
          p_until?: string
        }
        Returns: {
          actor_id: string
          body_excerpt: string
          direct_link: boolean
          extra: Json
          id: string
          is_pinned: boolean
          mirrored_from_id: string
          mirrored_from_kind: string
          occurred_at: string
          related_company_id: string
          related_contact_id: string
          related_deal_id: string
          related_lead_id: string
          related_ticket_id: string
          source: string
          subject: string
          type: string
        }[]
      }
      get_inbox_channel_page: {
        Args: {
          p_assignee?: string
          p_channel: string
          p_cursor_at?: string
          p_cursor_id?: string
          p_page_size?: number
          p_search?: string
          p_state?: string
          p_workspace_id?: string
        }
        Returns: Json
      }
      get_inbox_unified_page: {
        Args: {
          p_channel?: string
          p_cursor_at?: string
          p_cursor_id?: string
          p_cursor_src?: number
          p_page_size?: number
          p_search?: string
        }
        Returns: Json
      }
      get_my_phone: { Args: never; Returns: string }
      get_sales_dashboard_deal_aggregates: {
        Args: {
          p_lost_stage_ids: string[]
          p_month_end: string
          p_month_start: string
          p_open_stage_ids: string[]
          p_owner_id: string
          p_owner_mode: string
          p_period_end: string
          p_period_start: string
          p_pipeline_id: string
          p_prev_end: string
          p_prev_start: string
          p_stage_probabilities: Json
          p_won_stage_ids: string[]
          p_workspace_id: string
        }
        Returns: Json
      }
      get_sales_dashboard_secondary: {
        Args: {
          p_advanced_stage_ids: string[]
          p_contacts_since: string
          p_lead_pipeline_id: string
          p_now: string
          p_open_stage_ids: string[]
          p_owner_id: string
          p_owner_mode: string
          p_period_end: string
          p_period_start: string
          p_pipeline_id: string
          p_today: string
          p_utc_offset_minutes: number
          p_workspace_id: string
        }
        Returns: Json
      }
      get_sales_dashboard_secondary_v2: {
        Args: {
          p_advanced_limit?: number
          p_advanced_stage_ids: string[]
          p_contacts_since: string
          p_lead_pipeline_id: string
          p_now: string
          p_open_stage_ids: string[]
          p_owner_id: string
          p_owner_mode: string
          p_period_end: string
          p_period_start: string
          p_pipeline_id: string
          p_stage_probabilities: Json
          p_today: string
          p_utc_offset_minutes: number
          p_workspace_id: string
        }
        Returns: Json
      }
      get_timeline_activity_page: {
        Args: {
          p_assignees?: string[]
          p_categories?: string[]
          p_cursor_at?: string
          p_cursor_id?: string
          p_entity_id: string
          p_entity_kind: string
          p_include_unassigned?: boolean
          p_page_size?: number
          p_search?: string
          p_since?: string
          p_until?: string
        }
        Returns: Json
      }
      get_timeline_calendar_page: {
        Args: {
          p_cursor_at?: string
          p_cursor_id?: string
          p_entity_id: string
          p_entity_kind: string
          p_page_size?: number
          p_search?: string
          p_since?: string
          p_until?: string
        }
        Returns: Json
      }
      get_timeline_history_page: {
        Args: {
          p_actors?: string[]
          p_categories?: string[]
          p_cursor_at?: string
          p_cursor_id?: string
          p_entity: string
          p_entity_id: string
          p_include_unassigned?: boolean
          p_page_size?: number
          p_search?: string
          p_since?: string
          p_until?: string
        }
        Returns: Json
      }
      get_workspace_plan: { Args: { _workspace: string }; Returns: string }
      get_workspace_sensitive_settings: {
        Args: { _section: string; _workspace: string }
        Returns: Json
      }
      global_search_activity_body_ids: {
        Args: { _limit?: number; _q: string }
        Returns: {
          id: string
          snippet: string
        }[]
      }
      global_search_candidate_ids: {
        Args: { _entity: string; _limit?: number; _q: string }
        Returns: string[]
      }
      has_entitlement: {
        Args: { _key: string; _workspace: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user: string
          _workspace: string
        }
        Returns: boolean
      }
      hr_child_record_access: {
        Args: { _action: string; _id: string; _resource: string }
        Returns: boolean
      }
      hr_create_onboarding_plan: {
        Args: {
          _automatic?: boolean
          _kind: string
          _notes?: string
          _person: string
          _started?: string
          _status?: string
          _target?: string
          _template?: string
        }
        Returns: Json
      }
      hr_onboarding_access: {
        Args: {
          _action: string
          _assignee?: string
          _kind: string
          _owner: string
          _person: string
          _template: string
          _workspace: string
        }
        Returns: boolean
      }
      hr_people_access: {
        Args: {
          _action: string
          _manager: string
          _profile: string
          _responsible: string
          _workspace: string
        }
        Returns: boolean
      }
      hr_person_resource_access: {
        Args: {
          _action: string
          _assigned?: string
          _creator?: string
          _person: string
          _resource: string
          _workspace: string
        }
        Returns: boolean
      }
      hr_private_fields: {
        Args: { _ids: string[]; _parent?: boolean; _resource: string }
        Returns: {
          can_update: boolean
          can_view: boolean
          fields: Json
          id: string
        }[]
      }
      hr_private_row_allowed: {
        Args: { _action: string; _new?: boolean; _resource: string; _row: Json }
        Returns: boolean
      }
      hr_record_access: {
        Args: { _action: string; _id: string; _resource: string }
        Returns: boolean
      }
      hr_record_capabilities: {
        Args: { _ids: string[]; _resource: string }
        Returns: {
          can_create_child: boolean
          can_delete: boolean
          can_edit_settings: boolean
          can_update: boolean
          can_view: boolean
          id: string
        }[]
      }
      hr_scope_permission: {
        Args: {
          _action: string
          _own: boolean
          _resource: string
          _team: boolean
          _workspace: string
        }
        Returns: boolean
      }
      hr_task_access: {
        Args: {
          _action: string
          _assignee: string
          _plan: string
          _workspace: string
        }
        Returns: boolean
      }
      hr_team_contains: {
        Args: { _users: string[]; _workspace: string }
        Returns: boolean
      }
      inbox_assign_conversation: {
        Args: { p_assignee: string; p_channel: string; p_id: string }
        Returns: boolean
      }
      inbox_phone_digits: { Args: { _value: string }; Returns: string }
      increment_snippet_usage: { Args: { _id: string }; Returns: undefined }
      increment_wat_usage: { Args: { _id: string }; Returns: undefined }
      is_active_workspace_admin: {
        Args: { _user: string; _workspace: string }
        Returns: boolean
      }
      is_active_workspace_member_of: {
        Args: { _user: string; _workspace: string }
        Returns: boolean
      }
      is_chat_member: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      is_own_record: {
        Args: { _assigned_to: string; _owner_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user: string }; Returns: boolean }
      is_read_only_view: { Args: never; Returns: boolean }
      is_test_record: { Args: { _record_id: string }; Returns: boolean }
      is_workspace_admin: {
        Args: { _user: string; _workspace: string }
        Returns: boolean
      }
      is_workspace_admin_of: {
        Args: { _owner: string; _user: string }
        Returns: boolean
      }
      is_workspace_admin_v2: {
        Args: { _user: string; _workspace: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user: string; _workspace: string }
        Returns: boolean
      }
      iso8601_duration_seconds: { Args: { p: string }; Returns: number }
      job_role_usable_in_workspace: {
        Args: { _role: string; _workspace: string }
        Returns: boolean
      }
      leads_source_facets: {
        Args: { p_limit?: number }
        Returns: {
          count: number
          value: string
        }[]
      }
      link_contacts_by_email_domain: {
        Args: { p_workspace: string }
        Returns: number
      }
      lookup_stage_sla: {
        Args: {
          p_entity: string
          p_owner: string
          p_pipeline_id: string
          p_stage: string
        }
        Returns: number
      }
      my_perm_workspaces: { Args: { _key: string }; Returns: string[] }
      my_team_member_ids: { Args: never; Returns: string[] }
      my_team_member_pairs: {
        Args: never
        Returns: {
          user_id: string
          workspace_id: string
        }[]
      }
      people_allocation_capacity: {
        Args: {
          p_exclude: string
          p_from: string
          p_person: string
          p_to: string
        }
        Returns: Json
      }
      people_document_derive_status: {
        Args: { _expires: string }
        Returns: Database["public"]["Enums"]["people_doc_status"]
      }
      people_timesheet_email_user: {
        Args: { _person_id: string }
        Returns: string
      }
      permission_field_context: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: Json
      }
      permission_metadata_access: {
        Args: { _target: string; _workspace: string }
        Returns: boolean
      }
      permission_set_usable_in_workspace: {
        Args: { _set: string; _workspace: string }
        Returns: boolean
      }
      phone_review_resolve: {
        Args: { _action: string; _item: number; _new_value?: string }
        Returns: Json
      }
      platform_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          jobname: string
          target_url: string
        }[]
      }
      platform_cron_status: {
        Args: never
        Returns: {
          duration_ms: number
          jobname: string
          last_end: string
          last_start: string
          schedule: string
          status: string
        }[]
      }
      project_alert_act: {
        Args: {
          p_action: string
          p_alert: string
          p_note: string
          p_until?: string
        }
        Returns: Json
      }
      project_alert_can_act: { Args: { p_alert: string }; Returns: boolean }
      project_alert_default_rules: { Args: never; Returns: Json }
      project_alert_evaluate: {
        Args: { p_actor: string; p_trigger: string; p_tz: string; p_ws: string }
        Returns: Json
      }
      project_alert_refresh: { Args: { p_tz: string }; Returns: Json }
      project_alert_rules_effective: {
        Args: { p_project: string; p_ws: string }
        Returns: Json
      }
      project_alert_scheduled_tick: {
        Args: { p_limit?: number }
        Returns: Json
      }
      project_alert_visible_ids: { Args: never; Returns: string[] }
      project_api_create_time_entry: {
        Args: {
          p_hash: string
          p_idem: string
          p_key: string
          p_payload: Json
          p_user: string
          p_ws: string
        }
        Returns: Json
      }
      project_api_list_projects: {
        Args: {
          p_key: string
          p_limit: number
          p_offset: number
          p_search: string
          p_status: string
          p_user: string
          p_ws: string
        }
        Returns: Json
      }
      project_api_list_tasks: {
        Args: {
          p_key: string
          p_limit: number
          p_offset: number
          p_project: string
          p_search: string
          p_status: string
          p_user: string
          p_ws: string
        }
        Returns: Json
      }
      project_api_list_time_entries: {
        Args: {
          p_ascending: boolean
          p_from: string
          p_key: string
          p_limit: number
          p_offset: number
          p_project: string
          p_status: string
          p_subject: string
          p_to: string
          p_user: string
          p_ws: string
        }
        Returns: Json
      }
      project_bill_assert: {
        Args: { p_key: string; p_write: boolean; p_ws: string }
        Returns: undefined
      }
      project_bill_log: {
        Args: {
          p_action: string
          p_detail: Json
          p_id: string
          p_reason: string
          p_type: string
          p_ws: string
        }
        Returns: undefined
      }
      project_billing_config_end: {
        Args: { p_end: string; p_id: string; p_reason: string }
        Returns: undefined
      }
      project_billing_config_save: {
        Args: {
          p_contract: string
          p_model: string
          p_params: Json
          p_reason: string
          p_service: string
          p_valid_from: string
          p_ws: string
        }
        Returns: Json
      }
      project_billing_params_check: {
        Args: { p: Json; p_model: string }
        Returns: string
      }
      project_billing_service_owned: {
        Args: { p_date: string; p_service: string }
        Returns: boolean
      }
      project_client_acceptance_record: {
        Args: {
          p_client_email: string
          p_client_name: string
          p_contact: string
          p_evidence: string
          p_from: string
          p_project: string
          p_reference: string
          p_status: string
          p_to: string
        }
        Returns: Json
      }
      project_client_acceptance_void: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      project_dash_capacity_base: {
        Args: { f: Json; p_view: string }
        Returns: {
          allocated_scope: number
          allocated_total: number
          allocations_scope: number
          contracted: number
          expected_scope_to_date: number
          max_load_pct: number
          name: string
          overbooked_days: number
          person_id: string
          person_status: string
          schedule_known: boolean
          unquantified: number
          user_id: string
        }[]
      }
      project_dash_drill: {
        Args: {
          p_dataset: string
          p_filters: Json
          p_limit?: number
          p_metric: string
          p_offset?: number
          p_view: string
        }
        Returns: Json
      }
      project_dash_ds_alerts: {
        Args: { f: Json; p_view: string }
        Returns: {
          deal_id: string
          evidence: Json
          first_detected_at: string
          id: string
          last_detected_at: string
          m: string[]
          owner_user_id: string
          period_from: string
          period_to: string
          person_id: string
          project_id: string
          reopened_count: number
          rule_key: string
          severity: string
          snoozed_until: string
          status: string
          subject_user_id: string
        }[]
      }
      project_dash_ds_cost: {
        Args: { f: Json }
        Returns: {
          cost_status: string
          entry_date: string
          m: string[]
          n: number
          project_id: string
          secs: number
          user_id: string
        }[]
      }
      project_dash_ds_deals: {
        Args: { f: Json }
        Returns: {
          after_policy: boolean
          closed_at: string
          company_id: string
          contract_status: string
          id: string
          job_status: string
          m: string[]
          name: string
          owner_id: string
          project_count: number
          project_status: string
          transition_seconds: number
          visible_project_id: string
          visible_project_name: string
        }[]
      }
      project_dash_ds_entries: {
        Args: { f: Json; p_prev?: boolean; p_view: string }
        Returns: {
          billable: boolean
          entry_date: string
          id: string
          k: string
          m: string[]
          origin: string
          project_id: string
          secs: number
          user_id: string
        }[]
      }
      project_dash_ds_forecast: {
        Args: { f: Json; p_view: string }
        Returns: {
          alloc_week_secs: number
          consumed_secs: number
          cut_date: string
          due_at: string
          est_tasks: number
          eta_high: string
          eta_low: string
          eta_mid: string
          id: string
          kind: string
          m: string[]
          method: string
          ms_done: number
          ms_total: number
          name: string
          open_tasks: number
          planned_hours: number
          reason: string
          remaining_secs: number
          status: string
          tasks_done: number
          tasks_total: number
          w_p25: number
          w_p50: number
          w_p75: number
          weeks_with_hours: number
        }[]
      }
      project_dash_ds_measurements: {
        Args: { f: Json }
        Returns: {
          company_id: string
          contract_id: string
          currency: string
          id: string
          kind: string
          m: string[]
          period_from: string
          received: number
          service_id: string
          status: string
          total_amount: number
        }[]
      }
      project_dash_ds_milestones: {
        Args: { f: Json; p_view: string }
        Returns: {
          assigned_to: string
          due_at: string
          id: string
          m: string[]
          name: string
          project_id: string
          status: string
        }[]
      }
      project_dash_ds_people: {
        Args: { f: Json; p_view: string }
        Returns: {
          allocated_scope: number
          allocated_total: number
          available: number
          contracted: number
          gap: number
          m: string[]
          max_load_pct: number
          name: string
          other_allocated: number
          overbooked_days: number
          person_id: string
          person_status: string
          registered: number
          schedule_known: boolean
          secs: number
          submitted: number
          user_id: string
        }[]
      }
      project_dash_ds_projects: {
        Args: { f: Json; p_view: string }
        Returns: {
          assigned_to: string
          company_id: string
          created_at: string
          deal_id: string
          due_at: string
          id: string
          kind: string
          m: string[]
          name: string
          planned_hours: number
          status: string
        }[]
      }
      project_dash_ds_tasks: {
        Args: { f: Json; p_view: string }
        Returns: {
          assignee_id: string
          due_at: string
          estimated_hours: number
          id: string
          m: string[]
          project_id: string
          status: string
          title: string
        }[]
      }
      project_dash_f: { Args: { p: Json }; Returns: Json }
      project_dash_filter_options: {
        Args: { p_kind: string; p_q: string }
        Returns: Json
      }
      project_dash_full: { Args: { p_ws: string }; Returns: boolean }
      project_dash_leader_projects: {
        Args: { p_user: string; p_ws: string }
        Returns: string[]
      }
      project_dash_my_allocations: {
        Args: { f: Json }
        Returns: {
          allocation_pct: number
          can_track_time: boolean
          ends_at: string
          hours_per_week: number
          id: string
          project_id: string
          project_name: string
          role_title: string
          starts_at: string
        }[]
      }
      project_dash_my_projects: { Args: { p_ws: string }; Returns: string[] }
      project_dash_pending_approvals: {
        Args: { p_ws: string }
        Returns: number
      }
      project_dash_person_in_led: {
        Args: { p_person: string; p_ws: string }
        Returns: boolean
      }
      project_dash_person_projects: {
        Args: { p_from: string; p_to: string; p_user: string; p_ws: string }
        Returns: string[]
      }
      project_dash_project_week_alloc: {
        Args: { p_from: string; p_project: string; p_ws: string }
        Returns: number
      }
      project_dash_scope: { Args: never; Returns: Json }
      project_dash_summary: {
        Args: { p_filters: Json; p_view: string }
        Returns: Json
      }
      project_dash_team_projects: { Args: { p_ws: string }; Returns: string[] }
      project_dash_vis: {
        Args: never
        Returns: {
          dl_own: boolean
          dl_restricted: boolean
          dl_team: boolean
          dl_team_ids: string[]
          dl_ws: boolean
          mine: string[]
          ms_all: boolean
          pr_all: boolean
          recon: boolean
          te_full: boolean
          te_led: string[]
          te_pairs: string[]
          te_perm: boolean
          team: string[]
          tk_all: boolean
          uid: string
          ws: string
        }[]
      }
      project_dash_ws: { Args: never; Returns: string }
      project_dashboard_summary: {
        Args: { p_from: string; p_to: string; p_tz: string }
        Returns: Json
      }
      project_delivery_origin: { Args: { p_project: string }; Returns: Json }
      project_delivery_template_apply: {
        Args: {
          p_confirm_imported: boolean
          p_project: string
          p_version: string
        }
        Returns: Json
      }
      project_delivery_template_save: {
        Args: {
          p_active: boolean
          p_definition: Json
          p_description: string
          p_kind: string
          p_name: string
          p_service_ids: string[]
          p_template: string
          p_ws: string
        }
        Returns: Json
      }
      project_delivery_template_suggest: {
        Args: { p_project: string }
        Returns: Json
      }
      project_delivery_template_validate_definition: {
        Args: { p_def: Json }
        Returns: undefined
      }
      project_editable_by_current_user: {
        Args: { _project: string }
        Returns: boolean
      }
      project_entry_seconds: {
        Args: {
          p_hours: number
          p_minutes: number
          p_started: string
          p_stopped: string
        }
        Returns: number
      }
      project_is_link_backfill: {
        Args: { new_row: Json; old_row: Json; p_fields: string[] }
        Returns: boolean
      }
      project_jibble_hour_classify: {
        Args: { p_ws: string }
        Returns: {
          classification: string
          day_erp_seconds: number
          day_hour_seconds: number
          day_interval_seconds: number
          entry_date: string
          external_id: string
          note: string
          person_external_id: string
          project_external_id: string
          project_id: string
          seconds: number
          staging_id: string
          user_id: string
        }[]
      }
      project_jibble_hour_materialize: {
        Args: { p_note: string; p_staging_ids: string[]; p_ws: string }
        Returns: Json
      }
      project_jibble_hour_preview: {
        Args: {
          p_classification: string
          p_limit: number
          p_offset: number
          p_ws: string
        }
        Returns: Json
      }
      project_link_people_overview: {
        Args: { p_ws: string }
        Returns: {
          entries: number
          entries_with_person: number
          linked_by_trace: number
          member_status: string
          person_ids: string[]
          suggestions: number
          user_id: string
          user_name: string
        }[]
      }
      project_link_people_overview_body: {
        Args: { p_ws: string }
        Returns: {
          entries: number
          entries_with_person: number
          linked_by_trace: number
          member_status: string
          person_ids: string[]
          suggestions: number
          user_id: string
          user_name: string
        }[]
      }
      project_link_suggestions_decide: {
        Args: {
          p_action: string
          p_ids: string[]
          p_note: string
          p_ws: string
        }
        Returns: Json
      }
      project_links_apply_exact: { Args: { p_ws: string }; Returns: Json }
      project_links_revert: {
        Args: {
          p_batch?: string
          p_kind: string
          p_subject_ids: string[]
          p_ws: string
        }
        Returns: Json
      }
      project_list_create_checked: {
        Args: { p_data: Json; p_template?: string }
        Returns: Json
      }
      project_list_runtime_references: {
        Args: { p_list?: string; p_task?: string }
        Returns: Json
      }
      project_measurement_add_adjustment: {
        Args: {
          p_amount: number
          p_description: string
          p_id: string
          p_reason: string
        }
        Returns: undefined
      }
      project_measurement_add_success_event: {
        Args: {
          p_base: number
          p_id: string
          p_reason: string
          p_ref: string
          p_ref_type: string
        }
        Returns: undefined
      }
      project_measurement_approve: {
        Args: { p_hash: string; p_id: string }
        Returns: string
      }
      project_measurement_assert_chain: {
        Args: { m: Database["public"]["Tables"]["project_measurements"]["Row"] }
        Returns: undefined
      }
      project_measurement_assert_fresh: {
        Args: {
          m: Database["public"]["Tables"]["project_measurements"]["Row"]
          p_hash: string
        }
        Returns: undefined
      }
      project_measurement_build: {
        Args: { p_cfg: string; p_kind: string; p_month: string; p_tz: string }
        Returns: string
      }
      project_measurement_cancel: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      project_measurement_compute: {
        Args: {
          p_cfg: string
          p_from: string
          p_kind: string
          p_self: string
          p_to: string
          p_tz: string
        }
        Returns: {
          amount: number
          billed_seconds: number
          description: string
          detail: Json
          included: boolean
          issue: string
          project_id: string
          quantity: number
          rate_amount: number
          rate_id: string
          seconds: number
          source_id: string
          source_revision: number
          source_type: string
          unit: string
          user_id: string
          work_date: string
        }[]
      }
      project_measurement_fill: { Args: { p_id: string }; Returns: undefined }
      project_measurement_generate: {
        Args: { p_due: string; p_hash: string; p_id: string }
        Returns: Json
      }
      project_measurement_issues: { Args: { p_id: string }; Returns: Json }
      project_measurement_link_legacy: {
        Args: {
          p_entry: string
          p_hash: string
          p_id: string
          p_reason: string
        }
        Returns: undefined
      }
      project_measurement_live_hash: { Args: { p_id: string }; Returns: string }
      project_measurement_lock: {
        Args: { p_id: string; p_key: string; p_statuses: string[] }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          attempts: number
          auto_hash: string | null
          blockers: Json
          closed_at: string | null
          closed_by: string | null
          closed_reason: string | null
          company_id: string | null
          config_id: string
          config_version: number
          contract_id: string
          created_at: string
          created_by: string
          currency: string
          failed_at: string | null
          failure_reason: string | null
          financial_entry_id: string | null
          gates: Json
          generated_at: string | null
          generated_by: string | null
          id: string
          kind: string
          lines_hash: string
          model: string
          period_from: string
          period_to: string
          revision: number
          rules_snapshot: Json
          service_id: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          timezone: string
          total_amount: number | null
          total_seconds: number
          updated_at: string
          warnings: Json
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "project_measurements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      project_measurement_recalc: { Args: { p_id: string }; Returns: undefined }
      project_measurement_recheck: { Args: { p_id: string }; Returns: string }
      project_measurement_refresh: { Args: { p_id: string }; Returns: Json }
      project_measurement_release: {
        Args: { p_id: string }
        Returns: undefined
      }
      project_measurement_remove_line: {
        Args: { p_line: string; p_reason: string }
        Returns: undefined
      }
      project_measurement_return: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      project_measurement_reverse: {
        Args: { p_id: string; p_reason: string }
        Returns: Json
      }
      project_measurement_set: {
        Args: { p_id: string; p_patch: Json }
        Returns: undefined
      }
      project_measurement_sig: {
        Args: {
          p_amount: number
          p_billed: number
          p_included: boolean
          p_issue: string
          p_rate: string
          p_rate_amount: number
          p_rev: number
          p_secs: number
          p_source: string
          p_type: string
        }
        Returns: string
      }
      project_measurement_submit: {
        Args: { p_hash: string; p_id: string }
        Returns: undefined
      }
      project_measurements_list: {
        Args: {
          p_contract: string
          p_limit: number
          p_offset: number
          p_project: string
          p_ws: string
        }
        Returns: Json
      }
      project_milestone_complete_checked: {
        Args: { p_id: string }
        Returns: Json
      }
      project_ops_status: { Args: { p_ws: string }; Returns: Json }
      project_package_carry_in: {
        Args: { p_cfg: string; p_from: string }
        Returns: Json
      }
      project_period_close: {
        Args: {
          p_from: string
          p_project: string
          p_scope: string
          p_to: string
          p_tz: string
          p_user: string
          p_ws: string
        }
        Returns: Json
      }
      project_period_close_assert: {
        Args: {
          p_project: string
          p_scope: string
          p_user: string
          p_ws: string
        }
        Returns: undefined
      }
      project_period_close_check: {
        Args: {
          p_from: string
          p_project: string
          p_scope: string
          p_to: string
          p_user: string
          p_ws: string
        }
        Returns: Json
      }
      project_period_close_preview: {
        Args: {
          p_from: string
          p_project: string
          p_scope: string
          p_to: string
          p_user: string
          p_ws: string
        }
        Returns: Json
      }
      project_period_reopen: {
        Args: { p_closing: string; p_reason: string }
        Returns: Json
      }
      project_period_scope_entries: {
        Args: {
          p_from: string
          p_project: string
          p_scope: string
          p_to: string
          p_user: string
          p_ws: string
        }
        Returns: {
          allocation_id: string | null
          approved_at: string | null
          approved_by: string | null
          billable: boolean
          client_acceptance_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          duration_seconds: number | null
          end_time: string | null
          entry_date: string | null
          entry_kind: string | null
          external_id: string | null
          financial_entry_id: string | null
          hourly_rate: number | null
          hours: number | null
          id: string
          invoice_id: string | null
          invoiced_at: string | null
          locked_at: string | null
          period_closing_id: string | null
          person_id: string | null
          project_id: string
          reject_reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          review_flags: string[] | null
          revision: number
          source: string
          start_time: string | null
          started_at: string | null
          status: string
          stopped_at: string | null
          submission_id: string | null
          submitted_at: string | null
          task_id: string | null
          timer_session_id: string | null
          timezone: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "project_time_entries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      project_profitability: {
        Args: {
          p_contract: string
          p_currency: string
          p_from: string
          p_project: string
          p_to: string
          p_ws: string
        }
        Returns: Json
      }
      project_rate_assert_free: {
        Args: {
          p_currency: string
          p_from: string
          p_ignore: string
          p_key: string
          p_kind: string
          p_scope: string
          p_to: string
          p_unit: string
          p_ws: string
        }
        Returns: undefined
      }
      project_rate_create: {
        Args: {
          p_amount: number
          p_confirm_retroactive: boolean
          p_currency: string
          p_from: string
          p_kind: string
          p_proration: string
          p_reason: string
          p_scope: string
          p_target: Json
          p_to: string
          p_unit: string
          p_ws: string
        }
        Returns: string
      }
      project_rate_end: {
        Args: {
          p_confirm_retroactive: boolean
          p_end: string
          p_rate: string
          p_reason: string
        }
        Returns: undefined
      }
      project_rate_impact: {
        Args: {
          p_from: string
          p_scope: string
          p_target: Json
          p_to: string
          p_ws: string
        }
        Returns: Json
      }
      project_rate_key_of: {
        Args: { r: Database["public"]["Tables"]["project_rates"]["Row"] }
        Returns: string
      }
      project_rate_legacy_candidates: { Args: { p_ws: string }; Returns: Json }
      project_rate_pick: {
        Args: {
          p_currency: string
          p_date: string
          p_kind: string
          p_project: string
          p_user: string
          p_ws: string
        }
        Returns: Record<string, unknown>
      }
      project_rate_split: {
        Args: {
          p_amount: number
          p_confirm_retroactive: boolean
          p_effective: string
          p_rate: string
          p_reason: string
        }
        Returns: string
      }
      project_rate_target_key: {
        Args: { p_scope: string; p_target: Json; p_ws: string }
        Returns: string
      }
      project_recon_assert_admin: {
        Args: { p_write: boolean; p_ws: string }
        Returns: undefined
      }
      project_reconciliation_breakdown: {
        Args: {
          p_from: string
          p_group: string
          p_limit?: number
          p_offset?: number
          p_project?: string
          p_provider: string
          p_to: string
          p_user?: string
          p_ws: string
        }
        Returns: {
          diff_seconds: number
          erp_rows: number
          erp_seconds: number
          group_key: string
          label: string
          linked_erp_seconds: number
          linked_rows: number
          rows_with_open_issues: number
          source_seconds: number
          total_groups: number
        }[]
      }
      project_reconciliation_breakdown_body: {
        Args: {
          p_from: string
          p_group: string
          p_limit?: number
          p_offset?: number
          p_project?: string
          p_provider: string
          p_to: string
          p_user?: string
          p_ws: string
        }
        Returns: {
          diff_seconds: number
          erp_rows: number
          erp_seconds: number
          group_key: string
          label: string
          linked_erp_seconds: number
          linked_rows: number
          rows_with_open_issues: number
          source_seconds: number
          total_groups: number
        }[]
      }
      project_reconciliation_decide: {
        Args: {
          p_action: string
          p_ids: string[]
          p_note: string
          p_ws: string
        }
        Returns: Json
      }
      project_reconciliation_overview: { Args: { p_ws: string }; Returns: Json }
      project_reconciliation_overview_body: {
        Args: { p_ws: string }
        Returns: Json
      }
      project_reconciliation_refresh: { Args: { p_ws: string }; Returns: Json }
      project_risk_rules_get: { Args: { p_project?: string }; Returns: Json }
      project_risk_rules_save: {
        Args: { p_note: string; p_project: string; p_rules: Json }
        Returns: Json
      }
      project_time_approver_revoke: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      project_time_approver_row_active: {
        Args: {
          a: Database["public"]["Tables"]["project_time_approvers"]["Row"]
          p_day: string
        }
        Returns: boolean
      }
      project_time_approver_set: {
        Args: {
          p_delegate_of: string
          p_from: string
          p_project: string
          p_reason: string
          p_role: string
          p_subject: string
          p_to: string
          p_user: string
        }
        Returns: string
      }
      project_time_assert_actor: {
        Args: { p_write: boolean; p_ws: string }
        Returns: undefined
      }
      project_time_can_approve: {
        Args: { p_actor: string; p_project: string; p_subject: string }
        Returns: boolean
      }
      project_time_can_track: {
        Args: { p_day: string; p_project: string; p_user: string }
        Returns: boolean
      }
      project_time_capabilities: { Args: { p_ids: string[] }; Returns: Json }
      project_time_closed_period_for: {
        Args: {
          p_date: string
          p_project: string
          p_user: string
          p_ws: string
        }
        Returns: string
      }
      project_time_denied: {
        Args: { p_key: string; p_user: string; p_ws: string }
        Returns: boolean
      }
      project_time_entry_insert_checked: {
        Args: { p_payload: Json; p_source: string; p_ws: string }
        Returns: {
          allocation_id: string | null
          approved_at: string | null
          approved_by: string | null
          billable: boolean
          client_acceptance_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          duration_seconds: number | null
          end_time: string | null
          entry_date: string | null
          entry_kind: string | null
          external_id: string | null
          financial_entry_id: string | null
          hourly_rate: number | null
          hours: number | null
          id: string
          invoice_id: string | null
          invoiced_at: string | null
          locked_at: string | null
          period_closing_id: string | null
          person_id: string | null
          project_id: string
          reject_reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          review_flags: string[] | null
          revision: number
          source: string
          start_time: string | null
          started_at: string | null
          status: string
          stopped_at: string | null
          submission_id: string | null
          submitted_at: string | null
          task_id: string | null
          timer_session_id: string | null
          timezone: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "project_time_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      project_time_entry_labels: {
        Args: { p_ids: string[] }
        Returns: {
          id: string
          project_id: string
          project_name: string
          task_id: string
          task_title: string
        }[]
      }
      project_time_entry_public_json: {
        Args: { e: Database["public"]["Tables"]["project_time_entries"]["Row"] }
        Returns: Json
      }
      project_time_entry_sync: {
        Args: {
          p_client_request_id: string
          p_device_recorded_at?: string
          p_payload: Json
          p_request_hash: string
          p_ws: string
        }
        Returns: Json
      }
      project_time_full_scope_workspaces: { Args: never; Returns: string[] }
      project_time_has_approver: {
        Args: { p_project: string; p_subject: string }
        Returns: boolean
      }
      project_time_is_config_admin: { Args: { p_ws: string }; Returns: boolean }
      project_time_led_scope: {
        Args: never
        Returns: {
          project_id: string
          subject_user_id: string
        }[]
      }
      project_time_log: {
        Args: {
          p_action: string
          p_detail: Json
          p_id: string
          p_project: string
          p_reason: string
          p_subject: string
          p_type: string
          p_ws: string
        }
        Returns: undefined
      }
      project_time_pending_for_me: {
        Args: {
          p_limit: number
          p_offset: number
          p_project: string
          p_user: string
          p_ws: string
        }
        Returns: Json
      }
      project_time_perm_workspaces: {
        Args: { p_keys: string[] }
        Returns: string[]
      }
      project_time_policy_defaults: { Args: never; Returns: Json }
      project_time_policy_get: { Args: { p_ws: string }; Returns: Json }
      project_time_policy_resolve: { Args: { p_ws: string }; Returns: Json }
      project_time_policy_save: {
        Args: { p_note: string; p_rules: Json; p_ws: string }
        Returns: Json
      }
      project_time_reopen_approval: {
        Args: { p_ids: string[]; p_reason: string; p_ws: string }
        Returns: Json
      }
      project_time_schedule_valid: { Args: { p: Json }; Returns: boolean }
      project_time_task_in_project: {
        Args: { p_project: string; p_task: string; p_ws: string }
        Returns: boolean
      }
      project_time_task_references: {
        Args: { p_project: string; p_search?: string }
        Returns: {
          id: string
          status: string
          title: string
        }[]
      }
      project_time_trackable_projects: { Args: { p_ws: string }; Returns: Json }
      project_time_tz_valid: { Args: { p: string }; Returns: boolean }
      project_timer_authorize_continue: {
        Args: { p_session: string }
        Returns: undefined
      }
      project_timer_get: { Args: { p_ws: string }; Returns: Json }
      project_timer_json: { Args: { p_session: string }; Returns: Json }
      project_timer_lock: {
        Args: { p_session: string }
        Returns: {
          billable: boolean
          client_request_id: string | null
          created_at: string
          description: string | null
          id: string
          policy_version: number | null
          project_id: string
          started_at: string
          state: string
          stopped_at: string | null
          task_id: string | null
          timezone: string
          updated_at: string
          user_id: string
          version: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "project_timer_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      project_timer_pause: {
        Args: { p_paid: boolean; p_session: string; p_version: number }
        Returns: Json
      }
      project_timer_resume: {
        Args: { p_session: string; p_version: number }
        Returns: Json
      }
      project_timer_start: {
        Args: {
          p_billable: boolean
          p_description: string
          p_project: string
          p_request_id: string
          p_task: string
          p_tz: string
          p_ws: string
        }
        Returns: Json
      }
      project_timer_stop: {
        Args: { p_discard: boolean; p_session: string; p_version: number }
        Returns: Json
      }
      project_timer_switch: {
        Args: { p_session: string; p_task: string; p_version: number }
        Returns: Json
      }
      project_timesheet_decide: {
        Args: {
          p_action: string
          p_items: Json
          p_reason: string
          p_ws: string
        }
        Returns: Json
      }
      project_timesheet_overview: {
        Args: {
          p_from: string
          p_project: string
          p_to: string
          p_user: string
        }
        Returns: Json
      }
      project_timesheet_preview: {
        Args: { p_from: string; p_to: string; p_ws: string }
        Returns: Json
      }
      project_timesheet_refresh_submission: {
        Args: { p_sub: string }
        Returns: undefined
      }
      project_timesheet_scan: {
        Args: { p_from: string; p_to: string; p_user: string; p_ws: string }
        Returns: Json
      }
      project_timesheet_submit: {
        Args: {
          p_expected_hash: string
          p_from: string
          p_to: string
          p_tz: string
          p_ws: string
        }
        Returns: Json
      }
      project_timesheet_withdraw: {
        Args: { p_submission: string }
        Returns: Json
      }
      project_visible_to_current_user: {
        Args: { _project: string }
        Returns: boolean
      }
      projects_delivery_validate: {
        Args: {
          p_chk_contact: boolean
          p_chk_contract: boolean
          p_chk_deal: boolean
          p_chk_line: boolean
          p_chk_service: boolean
          p_company: string
          p_contact: string
          p_contract: string
          p_deal: string
          p_group: string
          p_line: string
          p_service: string
          p_ws: string
        }
        Returns: undefined
      }
      propagate_activity_assoc: {
        Args: {
          p_batch?: number
          p_filter_col: string
          p_filter_id: string
          p_set_col: string
          p_set_id: string
          p_since?: string
        }
        Returns: number
      }
      proposal_publish_with_esign: {
        Args: { p_hash: string; p_id: string; p_sent_at: string }
        Returns: Json
      }
      purge_workspace: {
        Args: { _actor: string; _confirm_name: string; _workspace: string }
        Returns: undefined
      }
      rbac_apply_vis_replacement: {
        Args: { _spec: Json; _vis: string; _ws: string }
        Returns: Json
      }
      rbac_vis_key_excluded: {
        Args: { _cats: string[]; _key: string }
        Returns: boolean
      }
      rbac_wk_apply_baseline_2026_10: { Args: never; Returns: Json }
      rbac_wk_restore_overrides_2026_10: { Args: never; Returns: number }
      recalc_deal_value: { Args: { _deal_id: string }; Returns: undefined }
      recalc_financial_entry: {
        Args: { _entry_id: string }
        Returns: undefined
      }
      recompute_deal_value: { Args: { _deal_id: string }; Returns: undefined }
      recurring_area_authorize: {
        Args: { a?: string; r: string }
        Returns: Json
      }
      recurring_context_access: {
        Args: { a: string; c: Json; o: string; r: string; w: string }
        Returns: boolean
      }
      recurring_invoice_access: {
        Args: { a: string; c: Json; o: string; p: string; w: string }
        Returns: boolean
      }
      reorder_pipeline_substatuses: {
        Args: { _ids: string[] }
        Returns: number
      }
      rep_find_companies: {
        Args: { _q: string }
        Returns: {
          id: string
          name: string
          other_owner: boolean
        }[]
      }
      rep_is_restricted: { Args: never; Returns: boolean }
      rep_my_company_ids: { Args: never; Returns: string[] }
      rep_my_contact_ids: { Args: never; Returns: string[] }
      rep_my_deal_ids: { Args: never; Returns: string[] }
      rep_my_lead_ids: { Args: never; Returns: string[] }
      rep_owns_entity: {
        Args: { p_entity: string; p_id: string }
        Returns: boolean
      }
      rep_restricted_workspaces: { Args: never; Returns: string[] }
      rep_restricted_workspaces_for: {
        Args: { _act: string; _res: string }
        Returns: string[]
      }
      rep_visible_company_ids: { Args: never; Returns: string[] }
      rep_visible_contact_ids: { Args: never; Returns: string[] }
      request_audit_session_id: { Args: never; Returns: string }
      reschedule_lovable_cron: { Args: { p_secret: string }; Returns: Json }
      resolve_workspace_id: { Args: { _owner: string }; Returns: string }
      restore_workspace: {
        Args: { _actor: string; _workspace: string }
        Returns: undefined
      }
      role_profile_admin_override_approve: {
        Args: { _expected_revision: number; _profile: string; _reason: string }
        Returns: Json
      }
      role_profile_approve: {
        Args: {
          _commercial: Json
          _expected_revision: number
          _profile: string
          _snapshot: Json
        }
        Returns: Json
      }
      role_profile_can: {
        Args: { _key: string; _workspace: string }
        Returns: boolean
      }
      role_profile_forward: {
        Args: {
          _early: boolean
          _early_reason: string
          _job: Json
          _profile: string
        }
        Returns: Json
      }
      role_profile_leader_decide: {
        Args: { _comment: string; _decision: string; _item: string }
        Returns: Json
      }
      role_profile_link_consume: {
        Args: { _hash: string; _write: boolean }
        Returns: {
          allowed_fields: string[]
          base_revision: number
          expires_at: string
          link_id: string
          profile_id: string
          reason: string
          workspace_id: string
        }[]
      }
      role_profile_request_validation: {
        Args: { _deal: string; _expected: Json; _key: string }
        Returns: Json
      }
      role_profile_resolve_leader: { Args: { _deal: string }; Returns: Json }
      role_profile_sync_ats: {
        Args: { _job: Json; _profile: string }
        Returns: Json
      }
      role_profile_version_commercial: {
        Args: { _version: string }
        Returns: Json
      }
      sales_access_context: { Args: never; Returns: Json }
      sales_account_job_authorize: {
        Args: { p_id: string; p_table: string }
        Returns: boolean
      }
      sales_api_query: {
        Args: {
          p_key: string
          p_query: Json
          p_table: string
          p_user: string
          p_ws: string
        }
        Returns: Json
      }
      sales_approval_access: {
        Args: { a: string; c: Json; e: string; i: string; u: string; w: string }
        Returns: boolean
      }
      sales_area_authorize: {
        Args: { a: string; i?: string; r: string; t?: string }
        Returns: boolean
      }
      sales_capabilities: {
        Args: { ids: string[]; t: string }
        Returns: {
          can_approve: boolean
          can_assign: boolean
          can_delete: boolean
          can_export: boolean
          can_manage: boolean
          can_update: boolean
          can_view: boolean
          id: string
        }[]
      }
      sales_configure_integration: {
        Args: {
          p_config: Json
          p_credential_ref?: string
          p_provider: string
          p_status: string
        }
        Returns: string
      }
      sales_configure_slack: {
        Args: { p_channel?: string; p_team?: string; p_url: string }
        Returns: string
      }
      sales_contaazul_authorize: {
        Args: { p_entity: string; p_user: string; p_ws: string }
        Returns: boolean
      }
      sales_context_access: {
        Args: {
          a: string
          c: Json
          r: string
          responsibles: string[]
          w: string
        }
        Returns: boolean
      }
      sales_dashboard_hot_score: {
        Args: {
          p_created_at: string
          p_expected_close_date: string
          p_now: string
          p_probability: number
          p_updated_at: string
        }
        Returns: number
      }
      sales_event_reference_access: {
        Args: { e: string; i: string }
        Returns: boolean
      }
      sales_inbox_rotate: {
        Args: { p_record: string; p_rule: string; p_table: string }
        Returns: Json
      }
      sales_notification_allowed: {
        Args: {
          p_actor: string
          p_id: string
          p_recipient: string
          p_table: string
        }
        Returns: boolean
      }
      sales_pipeline_references: {
        Args: never
        Returns: {
          created_at: string
          default_view: string
          entity: string
          id: string
          is_default: boolean
          name: string
          owner_id: string
          stages: Json
          updated_at: string
          workspace_id: string
        }[]
      }
      sales_policy_context: { Args: { resources: string[] }; Returns: Json }
      sales_portal_contacts: {
        Args: never
        Returns: {
          email: string
          first_name: string
          id: string
          last_name: string
          portal_enabled: boolean
          portal_token: string
        }[]
      }
      sales_proposal_decide: {
        Args: { p_approval: string; p_comment?: string; p_decision: string }
        Returns: Json
      }
      sales_proposal_request: {
        Args: { p_comment?: string; p_id: string; p_reviewer: string }
        Returns: Json
      }
      sales_public_decision: {
        Args: {
          p_action: string
          p_kind: string
          p_signature?: string
          p_token: string
        }
        Returns: Json
      }
      sales_public_token: {
        Args: {
          p_id: string
          p_purpose?: string
          p_rotate?: boolean
          p_table: string
        }
        Returns: string
      }
      sales_record_access: {
        Args: { a: string; i: string; t: string }
        Returns: boolean
      }
      sales_record_context_access: {
        Args: { a: string; c: Json; depth?: number; i: string; t: string }
        Returns: boolean
      }
      sales_save_google_account: {
        Args: { p_actor: string; p_kind: string; p_payload: Json; p_ws: string }
        Returns: string
      }
      sales_scoring_apply: {
        Args: {
          p_expected: Json
          p_record: string
          p_rule: string
          p_table: string
        }
        Returns: boolean
      }
      sales_segment_refresh: { Args: { p_id: string }; Returns: Json }
      sales_source_authorize: {
        Args: {
          p_actions: string[]
          p_actor: string
          p_resource: string
          p_ws: string
        }
        Returns: boolean
      }
      sales_source_query: {
        Args: { p_id: string; p_query: Json; p_source: string; p_table: string }
        Returns: Json
      }
      sales_special_capabilities: {
        Args: { ids: string[]; t: string }
        Returns: {
          can_send: boolean
          can_share: boolean
          id: string
        }[]
      }
      sales_summary_context_access: {
        Args: {
          a: string
          c: Json
          e: string
          i: string
          refs: Json
          u: string
          w: string
        }
        Returns: boolean
      }
      sales_touchpoint_access: {
        Args: {
          a: string
          c: Json
          contact: string
          deal: string
          lead: string
          w: string
        }
        Returns: boolean
      }
      sales_worker_authorize: {
        Args: { p_id: string; p_refs?: Json; p_source: string }
        Returns: boolean
      }
      sales_workflow_approval_decide: {
        Args: {
          p_actor: string
          p_comment?: string
          p_decision: string
          p_id: string
        }
        Returns: Json
      }
      sales_workflow_approval_recipient: {
        Args: {
          p_entity: string
          p_id: string
          p_user: string
          p_version?: number
          p_workflow: string
        }
        Returns: boolean
      }
      sales_workflow_record: {
        Args: {
          p_action: string
          p_id?: string
          p_payload?: Json
          p_table: string
          p_version?: number
          p_workflow: string
        }
        Returns: Json
      }
      save_workspace_sensitive_settings: {
        Args: { _section: string; _value: Json; _workspace: string }
        Returns: boolean
      }
      schedule_platform_alerts_cron: { Args: never; Returns: Json }
      sdr_agent_reassign_history: {
        Args: { p_apply: boolean; p_workspace: string }
        Returns: Json
      }
      sdr_agent_reassign_undo: {
        Args: { p_run: string; p_workspace: string }
        Returns: Json
      }
      sdr_bind_inbound_channel: {
        Args: {
          p_conversation: string
          p_phone_id: string
          p_workspace: string
        }
        Returns: string
      }
      sdr_claim_jobs: {
        Args: { p_lease_seconds: number; p_limit: number }
        Returns: {
          agent_version_id: string | null
          ai_finished_at: string | null
          ai_started_at: string | null
          attempts: number
          block_category: string | null
          conversation_id: string
          conversation_version: number | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          draft_payload: Json
          draft_text: string | null
          enrollment_id: string
          error: string | null
          id: string
          idem_key: string
          inbound_message_id: string | null
          kind: string
          lease_token: string | null
          lease_until: string | null
          provider_message_id: string | null
          send_reserved_until: string | null
          send_started_at: string | null
          sent_at: string | null
          status: string
          updated_at: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "sdr_turn_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      sdr_commit_turn: {
        Args: {
          p_enrollment: Json
          p_evidence: Json
          p_job: string
          p_job_patch: Json
          p_lease: string
          p_qualification: Json
        }
        Returns: string
      }
      sdr_guard: { Args: { p_job: string; p_lease: string }; Returns: string }
      sdr_link_opportunity: {
        Args: { p_contact?: string; p_deal: string; p_enrollment: string }
        Returns: undefined
      }
      sdr_publish_agent_version: {
        Args: { p_user: string; p_version: string }
        Returns: string
      }
      sdr_reserve_followup_quota: {
        Args: { p_job: string; p_lease: string; p_limit: number }
        Returns: Json
      }
      sdr_reserve_meeting: { Args: { p: Json }; Returns: Json }
      sdr_reserve_send_quota: {
        Args: { p_job: string; p_lease: string; p_limit: number }
        Returns: Json
      }
      sdr_set_conversation_owner: {
        Args: { p_conversation: string; p_owner: string }
        Returns: number
      }
      search_fold: { Args: { _t: string }; Returns: string }
      security_scan_collect: { Args: never; Returns: Json }
      seed_access_profiles: { Args: { _workspace: string }; Returns: undefined }
      seed_quote_templates: {
        Args: { _owner: string; _workspace: string }
        Returns: undefined
      }
      service_agent_begin_send: {
        Args: { p_job: string }
        Returns: {
          agent_version_id: string | null
          attempts: number
          available_at: string
          conversation_version: number
          created_at: string
          draft_payload: Json | null
          draft_text: string | null
          error: string | null
          id: string
          inbound_message_id: string
          lease_token: string | null
          lease_until: string | null
          outbound_message_id: string
          provider_message_id: string | null
          send_started_at: string | null
          send_token: string | null
          sent_at: string | null
          session_id: string
          status: string
          updated_at: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "service_agent_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      service_agent_claim: {
        Args: { p_limit?: number }
        Returns: {
          agent_version_id: string | null
          attempts: number
          available_at: string
          conversation_version: number
          created_at: string
          draft_payload: Json | null
          draft_text: string | null
          error: string | null
          id: string
          inbound_message_id: string
          lease_token: string | null
          lease_until: string | null
          outbound_message_id: string
          provider_message_id: string | null
          send_started_at: string | null
          send_token: string | null
          sent_at: string | null
          session_id: string
          status: string
          updated_at: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "service_agent_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      service_agent_commit_turn: {
        Args: {
          p_enrollment: Json
          p_evidence: Json
          p_job: string
          p_job_patch: Json
          p_lease: string
          p_qualification: Json
        }
        Returns: string
      }
      service_agent_complete_email: {
        Args: {
          p_header: string
          p_job: string
          p_provider_id: string
          p_send_token: string
        }
        Returns: string
      }
      service_agent_email_is_automatic: {
        Args: { p_from: string; p_headers: Json; p_mailbox: string }
        Returns: boolean
      }
      service_agent_enqueue: {
        Args: { p_channel: string; p_message: string }
        Returns: string
      }
      service_agent_enrollment_exists: {
        Args: { p_enrollment: string }
        Returns: boolean
      }
      service_agent_finish_decision: {
        Args: { p_job: string; p_lease: string; p_status: string }
        Returns: string
      }
      service_agent_guard: {
        Args: { p_job: string; p_lease: string }
        Returns: string
      }
      service_agent_inbox_state: {
        Args: { p_channel: string; p_source: string }
        Returns: Json
      }
      service_agent_send_chat: {
        Args: { p_attachments?: Json; p_job: string; p_lease: string }
        Returns: string
      }
      service_agent_set_owner: {
        Args: { p_channel: string; p_owner: string; p_source: string }
        Returns: undefined
      }
      service_agent_source_context: {
        Args: { p_enrollment: string }
        Returns: Json
      }
      service_agent_technical_limit: {
        Args: { p_job: string; p_lease: string }
        Returns: boolean
      }
      service_agent_verify_identity: {
        Args: { p_channel: string; p_source: string }
        Returns: undefined
      }
      service_bill_checked: {
        Args: { p_mode: string; p_service: string; p_starts?: string }
        Returns: Json
      }
      service_channel_access: {
        Args: { a: string; c: Json; w: string }
        Returns: boolean
      }
      service_channel_authorize: { Args: { p_action: string }; Returns: Json }
      service_channel_save: {
        Args: {
          p_account: string
          p_agent: string
          p_agent_enabled: boolean
          p_agent_name: string
          p_campaigns: boolean
          p_enabled: boolean
          p_inbound: boolean
          p_label: string
          p_name: string
        }
        Returns: undefined
      }
      services_next_billing: {
        Args: {
          _cadence: Database["public"]["Enums"]["service_cadence"]
          _current: string
        }
        Returns: string
      }
      shared_api_key_access: {
        Args: { a: string; c: Json; o: string; w: string }
        Returns: boolean
      }
      shared_api_key_authorize: { Args: { a: string }; Returns: Json }
      shared_api_subject_key_read: {
        Args: { k: string; o: string; w: string }
        Returns: boolean
      }
      shared_area_authorize: { Args: { a?: string; r: string }; Returns: Json }
      shared_audit_authorize: { Args: never; Returns: Json }
      shared_audit_export_access: {
        Args: { a: string; c: Json; w: string }
        Returns: boolean
      }
      shared_audit_export_authorize: { Args: { a: string }; Returns: Json }
      shared_audit_export_rows: {
        Args: {
          p_after?: string
          p_id: string
          p_since: string
          p_until?: string
          p_workspace: string
        }
        Returns: Json
      }
      shared_audit_list: {
        Args: {
          _action?: string
          _actor?: string
          _entity?: string
          _entity_id?: string
          _limit?: number
          _module?: string
          _since?: string
        }
        Returns: {
          action: string | null
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string | null
          entity: string | null
          entity_id: string | null
          id: string | null
          metadata: Json | null
          module_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "shared_audit_logs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      shared_audit_mask_row: {
        Args: { c: Json; j: Json; t: string }
        Returns: Json
      }
      shared_audit_page_read_access: {
        Args: { a: Json; b: Json; c: Json; i: string; t: string; u: string }
        Returns: boolean
      }
      shared_audit_read_access: {
        Args: { a: Json; b: Json; c: Json; i: string; t: string; u: string }
        Returns: boolean
      }
      shared_audit_workspace: { Args: { a: Json; b: Json }; Returns: string }
      shared_chat_access: { Args: { a?: string; i: string }; Returns: boolean }
      shared_chat_write: { Args: { a: string; p: Json }; Returns: Json }
      shared_configuration_access: {
        Args: { a: string; c: Json; o: string; r: string; w: string }
        Returns: boolean
      }
      shared_configuration_context: { Args: never; Returns: Json }
      shared_configuration_permission_keys: {
        Args: { p_workspace: string }
        Returns: Json
      }
      shared_context_access: {
        Args: { a: string; c: Json; owners: string[]; r: string; w: string }
        Returns: boolean
      }
      shared_document_workspace_read: { Args: never; Returns: string }
      shared_field_context: { Args: never; Returns: Json }
      shared_field_mask_row: { Args: { j: Json; t: string }; Returns: Json }
      shared_field_mask_rows: { Args: { rows: Json; t: string }; Returns: Json }
      shared_field_mode_for: {
        Args: { f: string; rules: Json; t: string }
        Returns: string
      }
      shared_file_authorize: {
        Args: { a?: string; i: string; t: string }
        Returns: boolean
      }
      shared_file_capabilities: {
        Args: { ids: string[]; t: string }
        Returns: {
          can_delete: boolean
          can_export: boolean
          can_share: boolean
          can_update: boolean
          id: string
          public_token: string
        }[]
      }
      shared_file_share: {
        Args: { enabled: boolean; i: string }
        Returns: Json
      }
      shared_home_expiring_documents: { Args: never; Returns: number }
      shared_home_financial_totals: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      shared_home_project_totals: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      shared_media_authorize: {
        Args: { a?: string; i: string }
        Returns: boolean
      }
      shared_media_begin: {
        Args: { filename: string; folder?: string }
        Returns: string
      }
      shared_media_register: { Args: { p: Json }; Returns: Json }
      shared_public_file_available: { Args: { i: string }; Returns: boolean }
      shared_search_item_access: {
        Args: { e: string; i: string }
        Returns: boolean
      }
      shared_security_settings: { Args: { p?: Json }; Returns: Json }
      shared_storage_access: {
        Args: { a: string; b: string; p: string }
        Returns: boolean
      }
      shared_storage_object_access: {
        Args: { a: string; b: string; p: string }
        Returns: boolean
      }
      shared_storage_reference_path: {
        Args: { b: string; u: string }
        Returns: string
      }
      shared_storage_session_access: { Args: { a: string }; Returns: boolean }
      shared_storage_upload_path: {
        Args: { b: string; file_name: string }
        Returns: string
      }
      shared_whatsapp_storage_path: { Args: { u: string }; Returns: string }
      shares_team_with: {
        Args: { _owner: string; _user: string }
        Returns: boolean
      }
      shares_workspace_with: { Args: { _other: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      soft_delete_workspace: {
        Args: { _actor: string; _workspace: string }
        Returns: undefined
      }
      techhire_rbac_gate:
        | {
            Args: { _owner: string; _perm: string; _user: string }
            Returns: boolean
          }
        | { Args: { _perm: string; _user: string }; Returns: boolean }
      time_import_rollback: {
        Args: {
          p_entries: string[]
          p_members: string[]
          p_projects: string[]
          p_tasks: string[]
          p_workspace: string
        }
        Returns: Json
      }
      try_iso_date: { Args: { p: string }; Returns: string }
      user_can_act: {
        Args: {
          _action: string
          _object: string
          _row_assignee: string
          _row_owner: string
        }
        Returns: boolean
      }
      user_can_view_deal_delivery: {
        Args: { _project_id: string; _user: string }
        Returns: boolean
      }
      user_can_view_owner: {
        Args: { _owner_id: string; _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      user_data_scope: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: Database["public"]["Enums"]["data_scope"]
      }
      user_effective_permissions: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: string[]
      }
      user_field_visibility: {
        Args: { _field: string; _resource: string; _user: string }
        Returns: Database["public"]["Enums"]["field_mode"]
      }
      user_files_used_bytes: { Args: { uid: string }; Returns: number }
      user_has_permission:
        | { Args: { _perm: string; _user: string }; Returns: boolean }
        | {
            Args: {
              _permission_key: string
              _user_id: string
              _workspace_id: string
            }
            Returns: boolean
          }
      user_scope_for: {
        Args: {
          _action: string
          _object: string
          _user: string
          _workspace: string
        }
        Returns: string
      }
      view_as_test_record_ids: { Args: never; Returns: string[] }
      wa_ad_slug_increment: {
        Args: { p_slug: string }
        Returns: {
          display_phone_number: string
          prefill_message: string
        }[]
      }
      wa_campaign_claim_dispatch: {
        Args: { p_campaign: string; p_seconds: number }
        Returns: boolean
      }
      wa_classify_phone: { Args: { _raw: string }; Returns: string[] }
      wa_cloud_sync_numbers: {
        Args: {
          p_connection: string
          p_numbers: Json
          p_synced_at: string
          p_workspace: string
        }
        Returns: undefined
      }
      wa_pick_mobile: { Args: { _fields: string[] }; Returns: string }
      wa_reserve_template_quota: {
        Args: { p_limit: number; p_recipient: string }
        Returns: Json
      }
      wk_head_rh_permission: {
        Args: { _key: string; _workspace: string }
        Returns: boolean
      }
      work_access_context: { Args: never; Returns: Json }
      work_action_prefix: { Args: { a: string; r: string }; Returns: string }
      work_area_authorize: {
        Args: { a: string; i?: string; r: string }
        Returns: string
      }
      work_area_capabilities: {
        Args: { ids: string[]; r: string }
        Returns: {
          can_assign: boolean
          can_cancel: boolean
          can_delete: boolean
          can_manage: boolean
          can_send: boolean
          can_share: boolean
          can_update: boolean
          can_view: boolean
          id: string
        }[]
      }
      work_catalog_service_access: { Args: { p_id: string }; Returns: boolean }
      work_commercial_reference_allowed: {
        Args: { i: string; t: string }
        Returns: boolean
      }
      work_context_access: {
        Args: {
          a: string
          c: Json
          r: string
          responsibles: string[]
          w: string
        }
        Returns: boolean
      }
      work_contract_source_in_use: {
        Args: { p_path: string }
        Returns: boolean
      }
      work_contract_source_owned: { Args: { p_path: string }; Returns: boolean }
      work_contract_storage_allowed: {
        Args: { p_write: boolean }
        Returns: boolean
      }
      work_core_capabilities: {
        Args: { ids: string[]; r: string }
        Returns: {
          can_assign: boolean
          can_delete: boolean
          can_update: boolean
          can_view: boolean
          id: string
        }[]
      }
      work_cost_projection: {
        Args: { ids: string[]; r: string }
        Returns: Json
      }
      work_deal_context_access: {
        Args: { c: Json; p_action: string; p_id: string }
        Returns: boolean
      }
      work_delegated_authorize: {
        Args: {
          p_actor: string
          p_copy?: boolean
          p_kind: string
          p_record: string
          p_status?: string
          p_template?: string
          p_ws: string
        }
        Returns: boolean
      }
      work_import_delegate_allowed: {
        Args: { p_actor: string; p_provider: string; p_ws: string }
        Returns: boolean
      }
      work_person_context_access: {
        Args: { c: Json; p_person: string }
        Returns: boolean
      }
      work_project_delivery_delegate: {
        Args: {
          p_creator: string
          p_deal: string
          p_owner: string
          p_ws: string
        }
        Returns: boolean
      }
      work_reconciliation_admin_workspace: { Args: never; Returns: string }
      work_reconciliation_reference_workspace: { Args: never; Returns: string }
      work_record_access: {
        Args: { a: string; i: string; r: string }
        Returns: boolean
      }
      work_record_context_access: {
        Args: { a: string; c: Json; depth?: number; i: string; r: string }
        Returns: boolean
      }
      work_record_json: { Args: { i: string; r: string }; Returns: Json }
      work_row_access: {
        Args: { a: string; j: Json; r: string }
        Returns: boolean
      }
      work_subject_context: {
        Args: { p_actor: string; p_ws: string }
        Returns: Json
      }
      work_time_context: { Args: never; Returns: Json }
      work_time_context_access: {
        Args: { a: string; c: Json; p: string; u: string; w: string }
        Returns: boolean
      }
      work_time_context_from: { Args: { c: Json }; Returns: Json }
      work_time_project_reference_allowed: {
        Args: { p_project: string }
        Returns: boolean
      }
      work_time_reference_allowed: {
        Args: { c: Json; w: string }
        Returns: boolean
      }
      workflow_delivery_claim: {
        Args: {
          p_channel: string
          p_key: string
          p_lease_seconds?: number
          p_max_attempts?: number
          p_recipient: string
          p_step_path: string
          p_workflow: string
          p_workspace: string
        }
        Returns: Json
      }
      workflow_delivery_finish: {
        Args: {
          p_error: string
          p_key: string
          p_next_attempt: string
          p_provider: string
          p_provider_id: string
          p_status: string
        }
        Returns: undefined
      }
      workspace_for_user: { Args: { _user: string }; Returns: string }
      workspace_member_by_email: {
        Args: { _email: string; _workspace_id: string }
        Returns: string
      }
      workspace_phone_country: { Args: { _workspace: string }; Returns: string }
      workspace_settings_assert: {
        Args: { _section: string; _workspace: string; _write: boolean }
        Returns: undefined
      }
    }
    Enums: {
      access_scope: "none" | "own" | "team" | "all"
      activity_type:
        | "note"
        | "task"
        | "call"
        | "email"
        | "meeting"
        | "whatsapp"
        | "sms"
        | "postal_mail"
        | "linkedin_message"
        | "survey"
      allocation_status: "active" | "paused" | "ended"
      app_role: "admin" | "manager" | "member"
      billing_interval: "week" | "month" | "quarter" | "year"
      billing_model:
        | "per_unit"
        | "per_hour"
        | "per_headcount_month"
        | "percent_of_base"
        | "fixed"
      booking_status: "confirmed" | "canceled"
      contract_approval_stage: "legal" | "finance" | "purchasing"
      contract_approval_status: "pending" | "approved" | "rejected" | "skipped"
      contract_role: "provider" | "client"
      contract_status:
        | "draft"
        | "in_review"
        | "in_negotiation"
        | "awaiting_signature"
        | "active"
        | "renewing"
        | "ended"
        | "terminated"
      data_scope: "own" | "team" | "workspace" | "custom"
      deal_stage:
        | "new"
        | "qualified"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
      delivery_status: "pending" | "success" | "failed" | "dead"
      email_broadcast_recipient_status:
        | "pending"
        | "sent"
        | "failed"
        | "skipped"
        | "unsubscribed"
      email_broadcast_status:
        | "draft"
        | "scheduled"
        | "running"
        | "paused"
        | "completed"
        | "canceled"
        | "failed"
      esign_doc_status:
        | "draft"
        | "sent"
        | "partially_signed"
        | "completed"
        | "declined"
        | "expired"
        | "canceled"
      esign_signer_status: "pending" | "viewed" | "signed" | "declined"
      export_format: "csv"
      export_frequency: "daily" | "weekly" | "monthly"
      field_mode: "hidden" | "masked" | "readonly"
      financial_category_kind: "revenue" | "expense"
      financial_direction: "receivable" | "payable"
      financial_entry_status:
        | "open"
        | "partial"
        | "paid"
        | "overdue"
        | "cancelled"
      financial_origin_type:
        | "contract"
        | "service"
        | "project_milestone"
        | "manual"
        | "expense"
        | "project_measurement"
      goal_metric:
        | "deals_won_count"
        | "deals_won_value"
        | "deals_created"
        | "activities_count"
        | "calls_count"
        | "emails_sent"
        | "tasks_completed"
      goal_period: "month" | "quarter" | "year" | "custom"
      integration_status: "connected" | "pending" | "error" | "disconnected"
      job_entity: "lead" | "contact" | "company" | "deal"
      job_kind: "import" | "enrich" | "export" | "sync"
      job_status: "queued" | "running" | "done" | "failed" | "partial"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "disqualified"
        | "nurturing"
      people_doc_status: "valid" | "expiring" | "expired" | "missing"
      people_employment_type: "pj" | "clt" | "contractor" | "intern" | "other"
      people_status:
        | "active"
        | "bench"
        | "on_leave"
        | "offboarding"
        | "terminated"
      perm_action:
        | "view"
        | "create"
        | "update"
        | "delete"
        | "export"
        | "approve"
        | "assign"
        | "manage"
      perm_scope: "own" | "team" | "workspace" | "org"
      project_member_role: "manager" | "contributor" | "viewer"
      project_milestone_status: "pending" | "in_progress" | "done" | "cancelled"
      project_status: "planning" | "active" | "on_hold" | "done" | "cancelled"
      project_task_priority: "low" | "normal" | "high" | "urgent"
      project_task_status: "todo" | "doing" | "review" | "done"
      proposal_approval_status: "pending" | "approved" | "rejected"
      proposal_status:
        | "draft"
        | "in_review"
        | "approved"
        | "sent"
        | "accepted"
        | "rejected"
        | "expired"
        | "canceled"
      prospecting_assignment_mode: "weighted" | "segment"
      prospecting_call_status:
        | "queued"
        | "ringing"
        | "in_progress"
        | "completed"
        | "failed"
        | "no_answer"
        | "busy"
        | "canceled"
      prospecting_campaign_status: "draft" | "running" | "paused" | "done"
      prospecting_source_type: "segment" | "saved_view" | "manual"
      prospecting_status: "pending" | "running" | "completed" | "failed"
      quote_status:
        | "draft"
        | "published"
        | "sent"
        | "accepted"
        | "declined"
        | "expired"
      sentiment_label: "positive" | "neutral" | "negative"
      service_cadence: "monthly" | "quarterly" | "yearly" | "on_delivery"
      service_status:
        | "pending"
        | "active"
        | "paused"
        | "cancelled"
        | "completed"
      service_type: "one_time" | "recurring" | "usage_based" | "milestone"
      sub_invoice_status: "pending" | "paid" | "failed" | "void"
      subscription_status:
        | "trialing"
        | "active"
        | "paused"
        | "canceled"
        | "past_due"
        | "completed"
      team_role: "owner" | "admin" | "member" | "manager"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status: "new" | "open" | "waiting" | "resolved" | "closed"
      voice_provider: "elevenlabs" | "vapi_default"
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
    Enums: {
      access_scope: ["none", "own", "team", "all"],
      activity_type: [
        "note",
        "task",
        "call",
        "email",
        "meeting",
        "whatsapp",
        "sms",
        "postal_mail",
        "linkedin_message",
        "survey",
      ],
      allocation_status: ["active", "paused", "ended"],
      app_role: ["admin", "manager", "member"],
      billing_interval: ["week", "month", "quarter", "year"],
      billing_model: [
        "per_unit",
        "per_hour",
        "per_headcount_month",
        "percent_of_base",
        "fixed",
      ],
      booking_status: ["confirmed", "canceled"],
      contract_approval_stage: ["legal", "finance", "purchasing"],
      contract_approval_status: ["pending", "approved", "rejected", "skipped"],
      contract_role: ["provider", "client"],
      contract_status: [
        "draft",
        "in_review",
        "in_negotiation",
        "awaiting_signature",
        "active",
        "renewing",
        "ended",
        "terminated",
      ],
      data_scope: ["own", "team", "workspace", "custom"],
      deal_stage: [
        "new",
        "qualified",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ],
      delivery_status: ["pending", "success", "failed", "dead"],
      email_broadcast_recipient_status: [
        "pending",
        "sent",
        "failed",
        "skipped",
        "unsubscribed",
      ],
      email_broadcast_status: [
        "draft",
        "scheduled",
        "running",
        "paused",
        "completed",
        "canceled",
        "failed",
      ],
      esign_doc_status: [
        "draft",
        "sent",
        "partially_signed",
        "completed",
        "declined",
        "expired",
        "canceled",
      ],
      esign_signer_status: ["pending", "viewed", "signed", "declined"],
      export_format: ["csv"],
      export_frequency: ["daily", "weekly", "monthly"],
      field_mode: ["hidden", "masked", "readonly"],
      financial_category_kind: ["revenue", "expense"],
      financial_direction: ["receivable", "payable"],
      financial_entry_status: [
        "open",
        "partial",
        "paid",
        "overdue",
        "cancelled",
      ],
      financial_origin_type: [
        "contract",
        "service",
        "project_milestone",
        "manual",
        "expense",
        "project_measurement",
      ],
      goal_metric: [
        "deals_won_count",
        "deals_won_value",
        "deals_created",
        "activities_count",
        "calls_count",
        "emails_sent",
        "tasks_completed",
      ],
      goal_period: ["month", "quarter", "year", "custom"],
      integration_status: ["connected", "pending", "error", "disconnected"],
      job_entity: ["lead", "contact", "company", "deal"],
      job_kind: ["import", "enrich", "export", "sync"],
      job_status: ["queued", "running", "done", "failed", "partial"],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "disqualified",
        "nurturing",
      ],
      people_doc_status: ["valid", "expiring", "expired", "missing"],
      people_employment_type: ["pj", "clt", "contractor", "intern", "other"],
      people_status: [
        "active",
        "bench",
        "on_leave",
        "offboarding",
        "terminated",
      ],
      perm_action: [
        "view",
        "create",
        "update",
        "delete",
        "export",
        "approve",
        "assign",
        "manage",
      ],
      perm_scope: ["own", "team", "workspace", "org"],
      project_member_role: ["manager", "contributor", "viewer"],
      project_milestone_status: ["pending", "in_progress", "done", "cancelled"],
      project_status: ["planning", "active", "on_hold", "done", "cancelled"],
      project_task_priority: ["low", "normal", "high", "urgent"],
      project_task_status: ["todo", "doing", "review", "done"],
      proposal_approval_status: ["pending", "approved", "rejected"],
      proposal_status: [
        "draft",
        "in_review",
        "approved",
        "sent",
        "accepted",
        "rejected",
        "expired",
        "canceled",
      ],
      prospecting_assignment_mode: ["weighted", "segment"],
      prospecting_call_status: [
        "queued",
        "ringing",
        "in_progress",
        "completed",
        "failed",
        "no_answer",
        "busy",
        "canceled",
      ],
      prospecting_campaign_status: ["draft", "running", "paused", "done"],
      prospecting_source_type: ["segment", "saved_view", "manual"],
      prospecting_status: ["pending", "running", "completed", "failed"],
      quote_status: [
        "draft",
        "published",
        "sent",
        "accepted",
        "declined",
        "expired",
      ],
      sentiment_label: ["positive", "neutral", "negative"],
      service_cadence: ["monthly", "quarterly", "yearly", "on_delivery"],
      service_status: ["pending", "active", "paused", "cancelled", "completed"],
      service_type: ["one_time", "recurring", "usage_based", "milestone"],
      sub_invoice_status: ["pending", "paid", "failed", "void"],
      subscription_status: [
        "trialing",
        "active",
        "paused",
        "canceled",
        "past_due",
        "completed",
      ],
      team_role: ["owner", "admin", "member", "manager"],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: ["new", "open", "waiting", "resolved", "closed"],
      voice_provider: ["elevenlabs", "vapi_default"],
    },
  },
} as const
