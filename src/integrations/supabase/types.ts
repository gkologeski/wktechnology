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
          assigned_to: string | null
          attachments: Json
          body: string | null
          completed: boolean
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
          recording_channels: number | null
          recording_duration_seconds: number | null
          recording_sid: string | null
          recording_url: string | null
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
          transcription: string | null
          transcription_model: string | null
          transcription_status: string | null
          type: Database["public"]["Enums"]["activity_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          attachments?: Json
          body?: string | null
          completed?: boolean
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
          recording_channels?: number | null
          recording_duration_seconds?: number | null
          recording_sid?: string | null
          recording_url?: string | null
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
          transcription?: string | null
          transcription_model?: string | null
          transcription_status?: string | null
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          assigned_to?: string | null
          attachments?: Json
          body?: string | null
          completed?: boolean
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
          recording_channels?: number | null
          recording_duration_seconds?: number | null
          recording_sid?: string | null
          recording_url?: string | null
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
          max_score: number | null
          owner_id: string
          responded_at: string
          responded_by: string | null
          score: number | null
          source: string
          source_id: string
          source_name: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          activity_id: string
          answers?: Json
          created_at?: string
          id?: string
          max_score?: number | null
          owner_id: string
          responded_at?: string
          responded_by?: string | null
          score?: number | null
          source: string
          source_id: string
          source_name?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          activity_id?: string
          answers?: Json
          created_at?: string
          id?: string
          max_score?: number | null
          owner_id?: string
          responded_at?: string
          responded_by?: string | null
          score?: number | null
          source?: string
          source_id?: string
          source_name?: string | null
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
            foreignKeyName: "ats_dsar_requests_workspace_id_fkey"
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
            foreignKeyName: "ats_interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "ats_candidates"
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
      ats_offers: {
        Row: {
          application_id: string | null
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
            foreignKeyName: "bookings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
            foreignKeyName: "calendar_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          name: string
          notes: string | null
          owner_id: string
          parent_company_id: string | null
          phone: string | null
          score: number
          size: string | null
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
          name: string
          notes?: string | null
          owner_id: string
          parent_company_id?: string | null
          phone?: string | null
          score?: number
          size?: string | null
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
          name?: string
          notes?: string | null
          owner_id?: string
          parent_company_id?: string | null
          phone?: string | null
          score?: number
          size?: string | null
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
          assigned_to: string | null
          assigned_user_id: string | null
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
          notes: string | null
          owner_id: string
          phone: string | null
          portal_enabled: boolean
          portal_token: string | null
          score: number
          state: string | null
          twitter_handle: string | null
          updated_at: string
          website: string | null
          workspace_id: string
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          assigned_user_id?: string | null
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
          notes?: string | null
          owner_id: string
          phone?: string | null
          portal_enabled?: boolean
          portal_token?: string | null
          score?: number
          state?: string | null
          twitter_handle?: string | null
          updated_at?: string
          website?: string | null
          workspace_id?: string
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          assigned_user_id?: string | null
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
          notes?: string | null
          owner_id?: string
          phone?: string | null
          portal_enabled?: boolean
          portal_token?: string | null
          score?: number
          state?: string | null
          twitter_handle?: string | null
          updated_at?: string
          website?: string | null
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
          id: string
          owner_id: string
          sort_order: number
          stage: Database["public"]["Enums"]["contract_approval_stage"]
          status: Database["public"]["Enums"]["contract_approval_status"]
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
          id?: string
          owner_id: string
          sort_order?: number
          stage: Database["public"]["Enums"]["contract_approval_stage"]
          status?: Database["public"]["Enums"]["contract_approval_status"]
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
          id?: string
          owner_id?: string
          sort_order?: number
          stage?: Database["public"]["Enums"]["contract_approval_stage"]
          status?: Database["public"]["Enums"]["contract_approval_status"]
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
      contract_events: {
        Row: {
          actor_id: string | null
          contract_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          contract_id: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          contract_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
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
          seniority: string | null
          service_catalog_id: string | null
          unit: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
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
          seniority?: string | null
          service_catalog_id?: string | null
          unit?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
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
          public_token: string | null
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
          public_token?: string | null
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
          public_token?: string | null
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
            foreignKeyName: "contracts_parent_contract_id_fkey"
            columns: ["parent_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
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
            foreignKeyName: "customer_invoices_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
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
            foreignKeyName: "deal_contacts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_line_items: {
        Row: {
          created_at: string
          deal_id: string
          description: string | null
          discount_amount: number
          discount_pct: number
          discount_type: string
          id: string
          name: string
          owner_id: string
          position: number
          product_id: string | null
          quantity: number
          service_catalog_id: string | null
          tax_rate: number
          unit_price: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          description?: string | null
          discount_amount?: number
          discount_pct?: number
          discount_type?: string
          id?: string
          name: string
          owner_id: string
          position?: number
          product_id?: string | null
          quantity?: number
          service_catalog_id?: string | null
          tax_rate?: number
          unit_price?: number
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          description?: string | null
          discount_amount?: number
          discount_pct?: number
          discount_type?: string
          id?: string
          name?: string
          owner_id?: string
          position?: number
          product_id?: string | null
          quantity?: number
          service_catalog_id?: string | null
          tax_rate?: number
          unit_price?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_line_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_line_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          lost_at: string | null
          name: string
          notes: string | null
          num_associated_contacts: number | null
          owner_id: string
          pipeline_id: string | null
          primary_contact_id: string | null
          stage: Database["public"]["Enums"]["deal_stage"]
          stage_id: string | null
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
          lost_at?: string | null
          name: string
          notes?: string | null
          num_associated_contacts?: number | null
          owner_id: string
          pipeline_id?: string | null
          primary_contact_id?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          stage_id?: string | null
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
          lost_at?: string | null
          name?: string
          notes?: string | null
          num_associated_contacts?: number | null
          owner_id?: string
          pipeline_id?: string | null
          primary_contact_id?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          stage_id?: string | null
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
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
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
            foreignKeyName: "email_broadcast_recipients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
          company_id: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          id: string
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
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
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
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
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
            foreignKeyName: "email_threads_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
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
            foreignKeyName: "esign_documents_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
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
          name: string
          owner_id: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
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
          assigned_to: string | null
          assigned_user_id: string | null
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
          label: string | null
          last_name: string | null
          mobile_phone: string | null
          notes: string | null
          nurture_started_at: string | null
          owner_id: string
          phone: string | null
          pipeline_id: string | null
          score: number
          source: string | null
          stage_id: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          assigned_user_id?: string | null
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
          label?: string | null
          last_name?: string | null
          mobile_phone?: string | null
          notes?: string | null
          nurture_started_at?: string | null
          owner_id: string
          phone?: string | null
          pipeline_id?: string | null
          score?: number
          source?: string | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          assigned_to?: string | null
          assigned_user_id?: string | null
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
          label?: string | null
          last_name?: string | null
          mobile_phone?: string | null
          notes?: string | null
          nurture_started_at?: string | null
          owner_id?: string
          phone?: string | null
          pipeline_id?: string | null
          score?: number
          source?: string | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
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
          last_message_at: string | null
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
          last_message_at?: string | null
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
          last_message_at?: string | null
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
            foreignKeyName: "meetings_related_deal_id_fkey"
            columns: ["related_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
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
            foreignKeyName: "message_sentiments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
          secret: string
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
      people_allocations: {
        Row: {
          allocation_pct: number
          assigned_to: string | null
          billable_rate: number | null
          contract_id: string | null
          cost_rate: number | null
          created_at: string
          currency: string
          ends_at: string | null
          id: string
          manager_id: string | null
          notes: string | null
          owner_id: string
          person_id: string
          project_id: string | null
          purchase_contract_id: string | null
          role_title: string | null
          starts_at: string
          status: Database["public"]["Enums"]["allocation_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          allocation_pct?: number
          assigned_to?: string | null
          billable_rate?: number | null
          contract_id?: string | null
          cost_rate?: number | null
          created_at?: string
          currency?: string
          ends_at?: string | null
          id?: string
          manager_id?: string | null
          notes?: string | null
          owner_id?: string
          person_id: string
          project_id?: string | null
          purchase_contract_id?: string | null
          role_title?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["allocation_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          allocation_pct?: number
          assigned_to?: string | null
          billable_rate?: number | null
          contract_id?: string | null
          cost_rate?: number | null
          created_at?: string
          currency?: string
          ends_at?: string | null
          id?: string
          manager_id?: string | null
          notes?: string | null
          owner_id?: string
          person_id?: string
          project_id?: string | null
          purchase_contract_id?: string | null
          role_title?: string | null
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
      products: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          description: string | null
          id: string
          name: string
          owner_id: string
          sku: string | null
          tax_rate: number
          unit: string | null
          unit_price: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          sku?: string | null
          tax_rate?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          sku?: string | null
          tax_rate?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_workspace_id_fkey"
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
      project_members: {
        Row: {
          bill_rate_hour: number | null
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
      project_time_entries: {
        Row: {
          allocation_id: string | null
          approved_at: string | null
          approved_by: string | null
          billable: boolean
          created_at: string
          description: string | null
          entry_date: string | null
          financial_entry_id: string | null
          hourly_rate: number | null
          hours: number | null
          id: string
          invoice_id: string | null
          invoiced_at: string | null
          person_id: string | null
          project_id: string
          started_at: string | null
          stopped_at: string | null
          task_id: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          allocation_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          billable?: boolean
          created_at?: string
          description?: string | null
          entry_date?: string | null
          financial_entry_id?: string | null
          hourly_rate?: number | null
          hours?: number | null
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          person_id?: string | null
          project_id: string
          started_at?: string | null
          stopped_at?: string | null
          task_id?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          allocation_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          billable?: boolean
          created_at?: string
          description?: string | null
          entry_date?: string | null
          financial_entry_id?: string | null
          hourly_rate?: number | null
          hours?: number | null
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          person_id?: string | null
          project_id?: string
          started_at?: string | null
          stopped_at?: string | null
          task_id?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_time_entries_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "people_allocations"
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
            foreignKeyName: "project_time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
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
          contract_id: string | null
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          metadata: Json
          name: string
          owner_id: string
          planned_cost: number | null
          planned_hours: number | null
          progress: number
          role: Database["public"]["Enums"]["contract_role"]
          service_id: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          contract_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json
          name: string
          owner_id: string
          planned_cost?: number | null
          planned_hours?: number | null
          progress?: number
          role?: Database["public"]["Enums"]["contract_role"]
          service_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          contract_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json
          name?: string
          owner_id?: string
          planned_cost?: number | null
          planned_hours?: number | null
          progress?: number
          role?: Database["public"]["Enums"]["contract_role"]
          service_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
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
            foreignKeyName: "proposals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
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
          score: number
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
          score?: number
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
          score?: number
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
          product_id: string | null
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
          product_id?: string | null
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
          product_id?: string | null
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
          created_at: string
          description: string | null
          discount_amount: number
          discount_pct: number
          discount_type: string
          id: string
          name: string
          owner_id: string
          position: number
          quantity: number
          quote_id: string
          tax_rate: number
          unit_price: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_amount?: number
          discount_pct?: number
          discount_type?: string
          id?: string
          name: string
          owner_id: string
          position?: number
          quantity?: number
          quote_id: string
          tax_rate?: number
          unit_price?: number
          workspace_id?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_amount?: number
          discount_pct?: number
          discount_type?: string
          id?: string
          name?: string
          owner_id?: string
          position?: number
          quantity?: number
          quote_id?: string
          tax_rate?: number
          unit_price?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
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
          public_token: string
          sent_at?: string | null
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
            foreignKeyName: "quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
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
      sdr_enrollments: {
        Row: {
          contact_id: string | null
          created_at: string
          handoff_at: string | null
          handoff_reason: string | null
          id: string
          last_action_at: string | null
          lead_id: string | null
          messages_sent: number
          notes: string | null
          owner_id: string
          playbook_id: string
          qualification_score: number | null
          status: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          handoff_at?: string | null
          handoff_reason?: string | null
          id?: string
          last_action_at?: string | null
          lead_id?: string | null
          messages_sent?: number
          notes?: string | null
          owner_id: string
          playbook_id: string
          qualification_score?: number | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          handoff_at?: string | null
          handoff_reason?: string | null
          id?: string
          last_action_at?: string | null
          lead_id?: string | null
          messages_sent?: number
          notes?: string | null
          owner_id?: string
          playbook_id?: string
          qualification_score?: number | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sdr_enrollments_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "sdr_playbooks"
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
      sdr_playbooks: {
        Row: {
          business_hours: Json
          channel: string
          created_at: string
          enabled: boolean
          handoff_score: number
          id: string
          max_messages: number
          name: string
          opt_out_phrases: string[]
          owner_id: string
          qualification_prompt: string | null
          steps: Json
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          business_hours?: Json
          channel?: string
          created_at?: string
          enabled?: boolean
          handoff_score?: number
          id?: string
          max_messages?: number
          name: string
          opt_out_phrases?: string[]
          owner_id: string
          qualification_prompt?: string | null
          steps?: Json
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          business_hours?: Json
          channel?: string
          created_at?: string
          enabled?: boolean
          handoff_score?: number
          id?: string
          max_messages?: number
          name?: string
          opt_out_phrases?: string[]
          owner_id?: string
          qualification_prompt?: string | null
          steps?: Json
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sdr_playbooks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
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
      service_catalog: {
        Row: {
          active: boolean
          base_price: number
          category: string | null
          code: string | null
          competencies: string[]
          cost: number
          created_at: string
          created_by: string | null
          currency: string
          default_sla_hours: number | null
          description: string | null
          id: string
          name: string
          owner_id: string
          service_type: string
          tags: string[]
          tax_rate: number
          unit: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          base_price?: number
          category?: string | null
          code?: string | null
          competencies?: string[]
          cost?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          default_sla_hours?: number | null
          description?: string | null
          id?: string
          name: string
          owner_id: string
          service_type?: string
          tags?: string[]
          tax_rate?: number
          unit?: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          active?: boolean
          base_price?: number
          category?: string | null
          code?: string | null
          competencies?: string[]
          cost?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          default_sla_hours?: number | null
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          service_type?: string
          tags?: string[]
          tax_rate?: number
          unit?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          assigned_to: string | null
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
          product_id: string | null
          quantity: number
          role: Database["public"]["Enums"]["contract_role"]
          seniority: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["service_status"]
          type: Database["public"]["Enums"]["service_type"]
          unit_price: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
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
          product_id?: string | null
          quantity?: number
          role: Database["public"]["Enums"]["contract_role"]
          seniority?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["service_status"]
          type?: Database["public"]["Enums"]["service_type"]
          unit_price?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
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
          product_id?: string | null
          quantity?: number
          role?: Database["public"]["Enums"]["contract_role"]
          seniority?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["service_status"]
          type?: Database["public"]["Enums"]["service_type"]
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
            foreignKeyName: "services_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
            foreignKeyName: "subscriptions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
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
          created_at: string
          help_text: string | null
          id: string
          label: string
          options: Json
          owner_id: string
          position: number
          required: boolean
          settings: Json
          survey_template_id: string
          type: string
          updated_at: string
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
          required?: boolean
          settings?: Json
          survey_template_id: string
          type?: string
          updated_at?: string
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
          required?: boolean
          settings?: Json
          survey_template_id?: string
          type?: string
          updated_at?: string
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
      survey_templates: {
        Row: {
          channel: string
          created_at: string
          delay_minutes: number
          description: string | null
          id: string
          invite_body: string | null
          invite_subject: string | null
          is_active: boolean
          is_default: boolean
          kind: string
          name: string
          owner_id: string
          question: string | null
          scope: string
          trigger_event: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          delay_minutes?: number
          description?: string | null
          id?: string
          invite_body?: string | null
          invite_subject?: string | null
          is_active?: boolean
          is_default?: boolean
          kind?: string
          name: string
          owner_id: string
          question?: string | null
          scope?: string
          trigger_event?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          delay_minutes?: number
          description?: string | null
          id?: string
          invite_body?: string | null
          invite_subject?: string | null
          is_active?: boolean
          is_default?: boolean
          kind?: string
          name?: string
          owner_id?: string
          question?: string | null
          scope?: string
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
            foreignKeyName: "tickets_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
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
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
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
          owner_id: string
          phone: string
          sent_at: string | null
          status: string
          twilio_sid: string | null
          variables: Json
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          contact_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          owner_id: string
          phone: string
          sent_at?: string | null
          status?: string
          twilio_sid?: string | null
          variables?: Json
          workspace_id?: string
        }
        Update: {
          campaign_id?: string
          contact_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          owner_id?: string
          phone?: string
          sent_at?: string | null
          status?: string
          twilio_sid?: string | null
          variables?: Json
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
          body_template: string | null
          content_sid: string | null
          content_variables_template: Json
          created_at: string
          failed: number
          finished_at: string | null
          id: string
          last_tick_at: string | null
          media_content_type: string | null
          media_url: string | null
          name: string
          owner_id: string
          rate_per_minute: number
          scheduled_at: string | null
          sent: number
          started_at: string | null
          status: string
          template_name: string | null
          total: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          body_template?: string | null
          content_sid?: string | null
          content_variables_template?: Json
          created_at?: string
          failed?: number
          finished_at?: string | null
          id?: string
          last_tick_at?: string | null
          media_content_type?: string | null
          media_url?: string | null
          name: string
          owner_id: string
          rate_per_minute?: number
          scheduled_at?: string | null
          sent?: number
          started_at?: string | null
          status?: string
          template_name?: string | null
          total?: number
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          body_template?: string | null
          content_sid?: string | null
          content_variables_template?: Json
          created_at?: string
          failed?: number
          finished_at?: string | null
          id?: string
          last_tick_at?: string | null
          media_content_type?: string | null
          media_url?: string | null
          name?: string
          owner_id?: string
          rate_per_minute?: number
          scheduled_at?: string | null
          sent?: number
          started_at?: string | null
          status?: string
          template_name?: string | null
          total?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
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
          assigned_to: string | null
          contact_id: string | null
          contact_phone: string
          conversation_origin: string | null
          created_at: string
          id: string
          last_inbound_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          owner_id: string
          provider: string
          status: string
          twilio_number: string
          unread_count: number
          updated_at: string
          wa_phone_number_id: string | null
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          contact_phone: string
          conversation_origin?: string | null
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          owner_id: string
          provider?: string
          status?: string
          twilio_number: string
          unread_count?: number
          updated_at?: string
          wa_phone_number_id?: string | null
          workspace_id?: string
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          contact_phone?: string
          conversation_origin?: string | null
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          owner_id?: string
          provider?: string
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
      workflow_subscriptions: {
        Row: {
          action: Json
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          event_pattern: string
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
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
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
            foreignKeyName: "workflows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
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
          joined_at: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          invited_by?: string | null
          joined_at?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          invited_by?: string | null
          joined_at?: string
          role?: string
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
          deleted_at: string | null
          id: string
          logo_url: string | null
          meeting_settings: Json
          name: string
          nfse_settings: Json
          payments_settings: Json
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
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          meeting_settings?: Json
          name: string
          nfse_settings?: Json
          payments_settings?: Json
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
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          meeting_settings?: Json
          name?: string
          nfse_settings?: Json
          payments_settings?: Json
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
      catalog_items: {
        Row: {
          active: boolean | null
          base_price: number | null
          category: string | null
          code: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          id: string | null
          kind: string | null
          name: string | null
          owner_id: string | null
          tax_rate: number | null
          type: string | null
          unit: string | null
          updated_at: string | null
          workspace_id: string | null
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
      anonymize_ats_candidate: {
        Args: { _candidate_id: string }
        Returns: undefined
      }
      backfill_activities_assigned_to_batch: { Args: never; Returns: number }
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
      companies_facets: {
        Args: { p_limit?: number }
        Returns: {
          count: number
          facet: string
          value: string
        }[]
      }
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
      default_workspace_for_user: { Args: { _user: string }; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
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
      get_my_phone: { Args: never; Returns: string }
      get_workspace_plan: { Args: { _workspace: string }; Returns: string }
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
      increment_snippet_usage: { Args: { _id: string }; Returns: undefined }
      increment_wat_usage: { Args: { _id: string }; Returns: undefined }
      is_chat_member: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user: string }; Returns: boolean }
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
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      people_document_derive_status: {
        Args: { _expires: string }
        Returns: Database["public"]["Enums"]["people_doc_status"]
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
      purge_workspace: {
        Args: { _actor: string; _confirm_name: string; _workspace: string }
        Returns: undefined
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recalc_deal_value: { Args: { _deal_id: string }; Returns: undefined }
      recalc_financial_entry: {
        Args: { _entry_id: string }
        Returns: undefined
      }
      recompute_deal_value: { Args: { _deal_id: string }; Returns: undefined }
      reschedule_lovable_cron: { Args: { p_secret: string }; Returns: Json }
      resolve_workspace_id: { Args: { _owner: string }; Returns: string }
      restore_workspace: {
        Args: { _actor: string; _workspace: string }
        Returns: undefined
      }
      schedule_platform_alerts_cron: { Args: never; Returns: Json }
      security_scan_collect: { Args: never; Returns: Json }
      seed_access_profiles: { Args: { _workspace: string }; Returns: undefined }
      seed_quote_templates: {
        Args: { _owner: string; _workspace: string }
        Returns: undefined
      }
      services_next_billing: {
        Args: {
          _cadence: Database["public"]["Enums"]["service_cadence"]
          _current: string
        }
        Returns: string
      }
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
      wa_ad_slug_increment: {
        Args: { p_slug: string }
        Returns: {
          display_phone_number: string
          prefill_message: string
        }[]
      }
      workspace_for_user: { Args: { _user: string }; Returns: string }
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
