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
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          owner_id: string
          subject_id?: string | null
          test_id: string
          variant_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          owner_id?: string
          subject_id?: string | null
          test_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_events_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ab_tests"
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
        }
        Relationships: []
      }
      access_profile_permissions: {
        Row: {
          create_enabled: boolean
          delete_scope: Database["public"]["Enums"]["access_scope"]
          edit_scope: Database["public"]["Enums"]["access_scope"]
          id: string
          object_key: string
          profile_id: string
          view_scope: Database["public"]["Enums"]["access_scope"]
        }
        Insert: {
          create_enabled?: boolean
          delete_scope?: Database["public"]["Enums"]["access_scope"]
          edit_scope?: Database["public"]["Enums"]["access_scope"]
          id?: string
          object_key: string
          profile_id: string
          view_scope?: Database["public"]["Enums"]["access_scope"]
        }
        Update: {
          create_enabled?: boolean
          delete_scope?: Database["public"]["Enums"]["access_scope"]
          edit_scope?: Database["public"]["Enums"]["access_scope"]
          id?: string
          object_key?: string
          profile_id?: string
          view_scope?: Database["public"]["Enums"]["access_scope"]
        }
        Relationships: [
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
        }
        Relationships: []
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
        }
        Relationships: [
          {
            foreignKeyName: "ads_audiences_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ads_accounts"
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
        }
        Relationships: [
          {
            foreignKeyName: "ads_lead_forms_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ads_accounts"
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
        }
        Relationships: []
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
          workspace_owner_id?: string
        }
        Relationships: []
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
        }
        Relationships: []
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
          owner_id: string
          primary_calendar_id: string | null
          provider: string
          refresh_token: string | null
          scopes: string[] | null
          sync_enabled: boolean
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
          owner_id: string
          primary_calendar_id?: string | null
          provider: string
          refresh_token?: string | null
          scopes?: string[] | null
          sync_enabled?: boolean
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
          owner_id?: string
          primary_calendar_id?: string | null
          provider?: string
          refresh_token?: string | null
          scopes?: string[] | null
          sync_enabled?: boolean
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
          calendar_account_id: string
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
          recording_mime_type: string | null
          recording_status: string | null
          recording_synced_at: string | null
          recording_url: string | null
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
          calendar_account_id: string
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
          recording_mime_type?: string | null
          recording_status?: string | null
          recording_synced_at?: string | null
          recording_url?: string | null
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
          calendar_account_id?: string
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
          recording_mime_type?: string | null
          recording_status?: string | null
          recording_synced_at?: string | null
          recording_url?: string | null
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
          assigned_user_id: string | null
          cep: string | null
          city: string | null
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
          assigned_user_id?: string | null
          cep?: string | null
          city?: string | null
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
          assigned_user_id?: string | null
          cep?: string | null
          city?: string | null
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
      copilot_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          sources: Json
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          sources?: Json
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
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
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          title?: string | null
          user_id?: string
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
      custom_object_records: {
        Row: {
          created_at: string
          data: Json
          id: string
          object_id: string
          owner_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          object_id: string
          owner_id: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
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
          discount_pct: number
          id: string
          name: string
          owner_id: string
          position: number
          product_id: string | null
          quantity: number
          tax_rate: number
          unit_price: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          description?: string | null
          discount_pct?: number
          id?: string
          name: string
          owner_id: string
          position?: number
          product_id?: string | null
          quantity?: number
          tax_rate?: number
          unit_price?: number
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          description?: string | null
          discount_pct?: number
          id?: string
          name?: string
          owner_id?: string
          position?: number
          product_id?: string | null
          quantity?: number
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
            foreignKeyName: "deal_line_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          assigned_user_id: string | null
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
          assigned_user_id?: string | null
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
          assigned_user_id?: string | null
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
      form_submissions: {
        Row: {
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
      kb_articles: {
        Row: {
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
        }
        Insert: {
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
        }
        Update: {
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
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          position?: number
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          position?: number
          slug?: string
        }
        Relationships: []
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
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_events_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_pages: {
        Row: {
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
        }
        Insert: {
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
        }
        Update: {
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
        }
        Relationships: []
      }
      lead_sources: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_user_id: string | null
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
          notes: string | null
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
          assigned_user_id?: string | null
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
          notes?: string | null
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
          assigned_user_id?: string | null
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
          notes?: string | null
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
            foreignKeyName: "leads_workspace_id_fkey"
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
        }
        Insert: {
          author_user_id?: string | null
          body: string
          created_at?: string
          direction: string
          id?: string
          owner_id: string
          session_id: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          created_at?: string
          direction?: string
          id?: string
          owner_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_chat_sessions"
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
        }
        Relationships: [
          {
            foreignKeyName: "live_chat_sessions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      macros: {
        Row: {
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
        }
        Relationships: []
      }
      nfse_invoices: {
        Row: {
          amount: number | null
          created_at: string
          error_message: string | null
          external_id: string | null
          id: string
          invoice_id: string | null
          issued_at: string | null
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
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          invoice_id?: string | null
          issued_at?: string | null
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
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          invoice_id?: string | null
          issued_at?: string | null
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
          plan_code: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          key: string
          limit_int?: number | null
          plan_code: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          key?: string
          limit_int?: number | null
          plan_code?: string
        }
        Relationships: [
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
          phone: string | null
          updated_at: string
        }
        Insert: {
          active_workspace_id?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active_workspace_id?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
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
      prospecting_results: {
        Row: {
          company_name: string | null
          contact_name: string | null
          created_at: string
          domain_hint: string | null
          email_hint: string | null
          id: string
          imported_at: string | null
          imported_lead_id: string | null
          location: string | null
          owner_id: string
          reason: string | null
          role_title: string | null
          search_id: string
          workspace_id: string
        }
        Insert: {
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
          domain_hint?: string | null
          email_hint?: string | null
          id?: string
          imported_at?: string | null
          imported_lead_id?: string | null
          location?: string | null
          owner_id: string
          reason?: string | null
          role_title?: string | null
          search_id: string
          workspace_id?: string
        }
        Update: {
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
          domain_hint?: string | null
          email_hint?: string | null
          id?: string
          imported_at?: string | null
          imported_lead_id?: string | null
          location?: string | null
          owner_id?: string
          reason?: string | null
          role_title?: string | null
          search_id?: string
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
          company_size: string | null
          created_at: string
          error: string | null
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
          status: Database["public"]["Enums"]["prospecting_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          company_size?: string | null
          created_at?: string
          error?: string | null
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
          status?: Database["public"]["Enums"]["prospecting_status"]
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          company_size?: string | null
          created_at?: string
          error?: string | null
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
          discount_pct: number
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
          discount_pct?: number
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
          discount_pct?: number
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
        }
        Relationships: [
          {
            foreignKeyName: "sdr_enrollments_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "sdr_playbooks"
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
          pipeline_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          sla_first_response_at: string | null
          sla_first_response_breached: boolean
          sla_first_response_due_at: string | null
          sla_policy_id: string | null
          sla_resolution_breached: boolean
          sla_resolution_due_at: string | null
          source: string | null
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
          pipeline_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          sla_first_response_at?: string | null
          sla_first_response_breached?: boolean
          sla_first_response_due_at?: string | null
          sla_policy_id?: string | null
          sla_resolution_breached?: boolean
          sla_resolution_due_at?: string | null
          source?: string | null
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
          pipeline_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          sla_first_response_at?: string | null
          sla_first_response_breached?: boolean
          sla_first_response_due_at?: string | null
          sla_policy_id?: string | null
          sla_resolution_breached?: boolean
          sla_resolution_due_at?: string | null
          source?: string | null
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
      user_grid_preferences: {
        Row: {
          created_at: string
          grid_key: string
          id: string
          updated_at: string
          user_id: string
          visible_columns: string[]
        }
        Insert: {
          created_at?: string
          grid_key: string
          id?: string
          updated_at?: string
          user_id: string
          visible_columns?: string[]
        }
        Update: {
          created_at?: string
          grid_key?: string
          id?: string
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
          error: string | null
          event_id: string
          finished_at: string | null
          id: string
          log: Json
          owner_id: string
          started_at: string | null
          status: string
          workflow_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_id: string
          finished_at?: string | null
          id?: string
          log?: Json
          owner_id: string
          started_at?: string | null
          status?: string
          workflow_id: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_id?: string
          finished_at?: string | null
          id?: string
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
          workspace_id: string
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
          workspace_id?: string
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
      workspace_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
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
          role?: string
          token?: string
          workspace_id?: string
        }
        Relationships: [
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
      companies_facets: {
        Args: { p_limit?: number }
        Returns: {
          count: number
          facet: string
          value: string
        }[]
      }
      current_user_workspaces: { Args: never; Returns: string[] }
      dashboard_metrics: { Args: never; Returns: Json }
      default_workspace_for_user: { Args: { _user: string }; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
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
        }[]
      }
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
      is_chat_member: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user: string }; Returns: boolean }
      is_workspace_admin: {
        Args: { _user: string; _workspace: string }
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
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      reschedule_lovable_cron: { Args: { p_secret: string }; Returns: Json }
      schedule_platform_alerts_cron: { Args: never; Returns: Json }
      security_scan_collect: { Args: never; Returns: Json }
      seed_access_profiles: { Args: { _workspace: string }; Returns: undefined }
      seed_quote_templates: {
        Args: { _owner: string; _workspace: string }
        Returns: undefined
      }
      shares_workspace_with: { Args: { _other: string }; Returns: boolean }
      user_can_act: {
        Args: {
          _action: string
          _object: string
          _row_assignee: string
          _row_owner: string
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
      app_role: "admin" | "manager" | "member"
      billing_interval: "week" | "month" | "quarter" | "year"
      booking_status: "confirmed" | "canceled"
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
      lead_status: "new" | "contacted" | "qualified" | "disqualified"
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
      quote_status: "draft" | "sent" | "accepted" | "declined" | "expired"
      sentiment_label: "positive" | "neutral" | "negative"
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
      ],
      app_role: ["admin", "manager", "member"],
      billing_interval: ["week", "month", "quarter", "year"],
      booking_status: ["confirmed", "canceled"],
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
      lead_status: ["new", "contacted", "qualified", "disqualified"],
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
      quote_status: ["draft", "sent", "accepted", "declined", "expired"],
      sentiment_label: ["positive", "neutral", "negative"],
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
