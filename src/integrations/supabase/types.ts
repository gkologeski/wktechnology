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
          attachments: Json
          body: string | null
          completed: boolean
          created_at: string
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
          recording_url: string | null
          related_company_id: string | null
          related_contact_id: string | null
          related_deal_id: string | null
          related_lead_id: string | null
          relink_checked_at: string | null
          subject: string | null
          task_priority: string | null
          task_status: string | null
          type: Database["public"]["Enums"]["activity_type"]
          updated_at: string
        }
        Insert: {
          attachments?: Json
          body?: string | null
          completed?: boolean
          created_at?: string
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
          recording_url?: string | null
          related_company_id?: string | null
          related_contact_id?: string | null
          related_deal_id?: string | null
          related_lead_id?: string | null
          relink_checked_at?: string | null
          subject?: string | null
          task_priority?: string | null
          task_status?: string | null
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
        }
        Update: {
          attachments?: Json
          body?: string | null
          completed?: boolean
          created_at?: string
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
          recording_url?: string | null
          related_company_id?: string | null
          related_contact_id?: string | null
          related_deal_id?: string | null
          related_lead_id?: string | null
          relink_checked_at?: string | null
          subject?: string | null
          task_priority?: string | null
          task_status?: string | null
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
        }
        Relationships: []
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
        }
        Relationships: [
          {
            foreignKeyName: "booking_pages_calendar_account_id_fkey"
            columns: ["calendar_account_id"]
            isOneToOne: false
            referencedRelation: "calendar_accounts"
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
        ]
      }
      calendar_accounts: {
        Row: {
          access_token: string | null
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
        }
        Insert: {
          access_token?: string | null
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
        }
        Update: {
          access_token?: string | null
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
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean
          attendees: Json
          calendar_account_id: string
          created_at: string
          description: string | null
          end_at: string | null
          html_link: string | null
          id: string
          last_synced_at: string
          location: string | null
          owner_id: string
          provider_event_id: string
          related_activity_id: string | null
          start_at: string | null
          status: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          attendees?: Json
          calendar_account_id: string
          created_at?: string
          description?: string | null
          end_at?: string | null
          html_link?: string | null
          id?: string
          last_synced_at?: string
          location?: string | null
          owner_id: string
          provider_event_id: string
          related_activity_id?: string | null
          start_at?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          attendees?: Json
          calendar_account_id?: string
          created_at?: string
          description?: string | null
          end_at?: string | null
          html_link?: string | null
          id?: string
          last_synced_at?: string
          location?: string | null
          owner_id?: string
          provider_event_id?: string
          related_activity_id?: string | null
          start_at?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_calendar_account_id_fkey"
            columns: ["calendar_account_id"]
            isOneToOne: false
            referencedRelation: "calendar_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          annualrevenue: number | null
          cep: string | null
          city: string | null
          country: string | null
          created_at: string
          custom_fields: Json
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
        }
        Insert: {
          address?: string | null
          annualrevenue?: number | null
          cep?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          custom_fields?: Json
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
        }
        Update: {
          address?: string | null
          annualrevenue?: number | null
          cep?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          custom_fields?: Json
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
          address: string | null
          cep: string | null
          city: string | null
          company_id: string | null
          company_name: string | null
          consent_date: string | null
          country: string | null
          created_at: string
          custom_fields: Json
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
        }
        Insert: {
          address?: string | null
          cep?: string | null
          city?: string | null
          company_id?: string | null
          company_name?: string | null
          consent_date?: string | null
          country?: string | null
          created_at?: string
          custom_fields?: Json
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
        }
        Update: {
          address?: string | null
          cep?: string | null
          city?: string | null
          company_id?: string | null
          company_name?: string | null
          consent_date?: string | null
          country?: string | null
          created_at?: string
          custom_fields?: Json
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
      custom_object_records: {
        Row: {
          created_at: string
          data: Json
          id: string
          object_id: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          object_id: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          object_id?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_object_records_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "custom_objects"
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
        }
        Relationships: []
      }
      custom_properties: {
        Row: {
          ai_prompt: string | null
          created_at: string
          enabled: boolean
          entity: string
          id: string
          key: string
          label: string
          options: Json
          owner_id: string
          position: number
          required: boolean
          type: string
          updated_at: string
        }
        Insert: {
          ai_prompt?: string | null
          created_at?: string
          enabled?: boolean
          entity: string
          id?: string
          key: string
          label: string
          options?: Json
          owner_id?: string
          position?: number
          required?: boolean
          type?: string
          updated_at?: string
        }
        Update: {
          ai_prompt?: string | null
          created_at?: string
          enabled?: boolean
          entity?: string
          id?: string
          key?: string
          label?: string
          options?: Json
          owner_id?: string
          position?: number
          required?: boolean
          type?: string
          updated_at?: string
        }
        Relationships: []
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
        }
        Relationships: []
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
        }
        Relationships: []
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
        ]
      }
      deals: {
        Row: {
          closed_lost_reason: string | null
          closed_won_reason: string | null
          company_id: string | null
          created_at: string
          currency: string
          custom_fields: Json
          dealtype: string | null
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
        }
        Insert: {
          closed_lost_reason?: string | null
          closed_won_reason?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          custom_fields?: Json
          dealtype?: string | null
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
        }
        Update: {
          closed_lost_reason?: string | null
          closed_won_reason?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          custom_fields?: Json
          dealtype?: string | null
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
        }
        Relationships: []
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
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          owner_id?: string
          shortcut: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          owner_id?: string
          shortcut?: string
          updated_at?: string
        }
        Relationships: []
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
        }
        Relationships: []
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
        }
        Relationships: [
          {
            foreignKeyName: "email_tracking_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "email_messages"
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
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          owner_id: string
          reason?: string | null
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          owner_id?: string
          reason?: string | null
          token?: string
        }
        Relationships: []
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
        ]
      }
      esign_documents: {
        Row: {
          body: string
          completed_at: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          expires_at: string | null
          id: string
          ordered: boolean
          owner_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["esign_doc_status"]
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          ordered?: boolean
          owner_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["esign_doc_status"]
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          ordered?: boolean
          owner_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["esign_doc_status"]
          title?: string
          updated_at?: string
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
        }
        Relationships: [
          {
            foreignKeyName: "esign_signers_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "esign_documents"
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
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
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
        }
        Relationships: []
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
        }
        Relationships: []
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
          team_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          archived?: boolean
          created_at?: string
          email?: string | null
          first_name?: string | null
          hs_raw?: Json | null
          id: string
          last_name?: string | null
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          archived?: boolean
          created_at?: string
          email?: string | null
          first_name?: string | null
          hs_raw?: Json | null
          id?: string
          last_name?: string | null
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      hubspot_sync_state: {
        Row: {
          direction: string
          entity: string
          hubspot_id: string
          id: string
          last_payload: Json | null
          last_synced_at: string
          local_id: string
          owner_id: string
        }
        Insert: {
          direction?: string
          entity: string
          hubspot_id: string
          id?: string
          last_payload?: Json | null
          last_synced_at?: string
          local_id: string
          owner_id: string
        }
        Update: {
          direction?: string
          entity?: string
          hubspot_id?: string
          id?: string
          last_payload?: Json | null
          last_synced_at?: string
          local_id?: string
          owner_id?: string
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
          custom_fields: Json
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
        }
        Insert: {
          company_name?: string | null
          converted_at?: string | null
          converted_contact_id?: string | null
          converted_deal_id?: string | null
          created_at?: string
          custom_fields?: Json
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
        }
        Update: {
          company_name?: string | null
          converted_at?: string | null
          converted_contact_id?: string | null
          converted_deal_id?: string | null
          created_at?: string
          custom_fields?: Json
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
        }
        Relationships: []
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
        }
        Relationships: []
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
        ]
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
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
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
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          owner_id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          owner_id: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          owner_id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
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
          public_token: string
          sent_at: string | null
          signature_name: string | null
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          tax_total: number
          terms: string | null
          title: string | null
          total: number
          updated_at: string
          valid_until: string | null
          view_count: number
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
          public_token: string
          sent_at?: string | null
          signature_name?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          title?: string | null
          total?: number
          updated_at?: string
          valid_until?: string | null
          view_count?: number
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
          public_token?: string
          sent_at?: string | null
          signature_name?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          title?: string | null
          total?: number
          updated_at?: string
          valid_until?: string | null
          view_count?: number
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
        }
        Relationships: []
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
        }
        Relationships: [
          {
            foreignKeyName: "report_schedules_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "custom_reports"
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
        }
        Relationships: [
          {
            foreignKeyName: "score_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "scoring_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_cursors: {
        Row: {
          last_event_at: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          last_event_at?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          last_event_at?: string
          owner_id?: string
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
        }
        Relationships: []
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
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
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
        }
        Relationships: [
          {
            foreignKeyName: "task_queue_items_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "task_queues"
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
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
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
      tickets: {
        Row: {
          assignee_id: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          custom_fields: Json
          deal_id: string | null
          description: string | null
          due_at: string | null
          id: string
          owner_id: string
          pipeline_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          source: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          custom_fields?: Json
          deal_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          owner_id: string
          pipeline_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          custom_fields?: Json
          deal_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          owner_id?: string
          pipeline_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
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
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "outbound_webhooks"
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
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campaigns"
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
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          contact_phone: string
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          owner_id: string
          status: string
          twilio_number: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          contact_phone: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          owner_id: string
          status?: string
          twilio_number: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          contact_phone?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          owner_id?: string
          status?: string
          twilio_number?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          delivered_at: string | null
          direction: string
          error_code: string | null
          error_message: string | null
          from_number: string
          id: string
          is_template: boolean
          media_content_type: string | null
          media_url: string | null
          owner_id: string
          raw: Json | null
          read_at: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          template_name: string | null
          to_number: string
          twilio_sid: string | null
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          direction: string
          error_code?: string | null
          error_message?: string | null
          from_number: string
          id?: string
          is_template?: boolean
          media_content_type?: string | null
          media_url?: string | null
          owner_id: string
          raw?: Json | null
          read_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          template_name?: string | null
          to_number: string
          twilio_sid?: string | null
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          direction?: string
          error_code?: string | null
          error_message?: string | null
          from_number?: string
          id?: string
          is_template?: boolean
          media_content_type?: string | null
          media_url?: string | null
          owner_id?: string
          raw?: Json | null
          read_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          template_name?: string | null
          to_number?: string
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
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
        }
        Relationships: []
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
      workspace_branding: {
        Row: {
          accent_color: string | null
          brand_name: string | null
          created_at: string
          custom_domain: string | null
          favicon_url: string | null
          footer_text: string | null
          logo_url: string | null
          owner_id: string
          primary_color: string | null
          support_email: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          brand_name?: string | null
          created_at?: string
          custom_domain?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          logo_url?: string | null
          owner_id: string
          primary_color?: string | null
          support_email?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          brand_name?: string | null
          created_at?: string
          custom_domain?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          logo_url?: string | null
          owner_id?: string
          primary_color?: string | null
          support_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user: string
          _workspace: string
        }
        Returns: boolean
      }
      is_workspace_admin: {
        Args: { _user: string; _workspace: string }
        Returns: boolean
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
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      activity_type: "note" | "task" | "call" | "email" | "meeting" | "whatsapp"
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
      team_role: "owner" | "admin" | "member"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status: "new" | "open" | "waiting" | "resolved" | "closed"
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
      activity_type: ["note", "task", "call", "email", "meeting", "whatsapp"],
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
      team_role: ["owner", "admin", "member"],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: ["new", "open", "waiting", "resolved", "closed"],
    },
  },
} as const
