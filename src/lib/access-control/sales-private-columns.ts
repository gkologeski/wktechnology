// Explicit public projections. Database column ACLs are authoritative.
export const SALES_PRIVATE_COLUMNS = {
  deal_line_items: [],
  ats_interviews: [],
  ats_offers: [],
  ats_candidates: [],
  deals: [],
  leads: [],
  workspaces: [
    "payments_settings",
    "nfse_settings",
    "meeting_settings",
    "security_settings",
    "data_region",
  ],
  user_files: ["public_token"],
  contacts: ["portal_token"],
  quotes: ["public_token"],
  proposals: ["public_token"],
  email_accounts: ["access_token", "refresh_token"],
  calendar_accounts: ["access_token", "refresh_token"],
  integrations: ["oauth_tokens", "credentials_secret_ref"],
  slack_integrations: ["access_token"],
  outbound_webhooks: ["secret"],
} as const;
export const SALES_PUBLIC_COLUMNS = {
  deal_line_items:
    "id,owner_id,deal_id,name,description,quantity,unit_price,discount_pct,tax_rate,position,created_at,updated_at,workspace_id,discount_amount,discount_type,service_catalog_id,contracting_preset_id,job_profile_id,seniority,unit,billing_model,percent,percent_base_amount,cadence",
  ats_interviews:
    "id,owner_id,application_id,job_id,candidate_id,interviewer_id,stage_value,kind,status,scheduled_at,duration_min,meet_url,location,notes,self_schedule_token,self_schedule_expires_at,slots,reminder_d1_sent_at,reminder_1h_sent_at,created_at,updated_at,interview_kit_id,async_questions_snapshot,offered_slots,self_scheduled_at,transcript,ai_summary,ai_strengths,ai_concerns,ai_followups,ai_recommendation,ai_score,ai_generated_at,ai_model,pool_id,panel_interviewer_ids,auto_rescheduled_from,meeting_id,assigned_to,workspace_id",
  ats_offers:
    "id,owner_id,application_id,candidate_id,job_id,title,start_date,status,esign_document_id,promote_to_stage,sent_at,signed_at,declined_at,decline_reason,created_at,updated_at,viewed_at,assigned_to,workspace_id,approval_status,revision,approved_revision,approved_by,approved_at",
  ats_candidates:
    "id,owner_id,full_name,email,phone,linkedin_url,location,current_position,current_company,cv_url,cv_parsed,skills,tags,source,score,notes,created_by,created_at,updated_at,dei_gender,dei_race,dei_disability,dei_lgbtqia,relationship_status,last_touch_at,next_action_at,relationship_owner_id,retention_until,lgpd_redacted_at,archived,headline,about,photo_url,experiences,education,certifications,languages,skills_detailed,projects,publications,volunteering,open_to_work,connection_degree,available_actions,external_links,current_company_data,recent_activity,recommendations,captured_at,capture_version,assigned_to,workspace_id",
  deals:
    "id,owner_id,name,value,currency,stage,company_id,primary_contact_id,expected_close_date,notes,created_at,updated_at,pipeline_id,external_ids,stage_id,hs_raw,description,dealtype,hs_priority,hs_deal_stage_probability,hubspot_owner_id,hs_object_id,hs_createdate,hs_lastmodifieddate,closed_lost_reason,closed_won_reason,num_associated_contacts,custom_fields,workspace_id,deleted_at,assigned_user_id,assigned_to,closed_at,lost_at,stage_substatus_id,lead_id,source,service_line",
  leads:
    "id,owner_id,first_name,last_name,email,phone,company_name,source,status,notes,converted_at,converted_contact_id,converted_deal_id,created_at,updated_at,pipeline_id,score,label,external_ids,stage_id,hs_raw,hubspot_owner_id,hs_object_id,hs_createdate,hs_lastmodifieddate,hs_lead_source_detail,custom_fields,workspace_id,deleted_at,assigned_user_id,company_id,nurture_started_at,assigned_to,mobile_phone,stage_substatus_id,linkedin_url,last_form_submission_at,whatsapp_e164,job_title,job_title_source,cargo_resumido,area_atuacao,nivel_hierarquico,cargo_catalog_version,photo_url,photo_source,photo_updated_at,phone_ext,phone_digits,mobile_phone_digits,whatsapp_digits",
  workspaces:
    "id,name,slug,logo_url,primary_color,custom_domain,status,created_by,created_at,updated_at,deleted_at,default_phone_country,phone_strict_e164",
  user_files:
    "id,owner_id,folder_id,name,storage_path,size_bytes,mime_type,is_public,created_at,updated_at,workspace_id",
  contacts:
    "id,owner_id,company_id,first_name,last_name,email,phone,job_title,notes,created_at,updated_at,score,label,marketing_status,legal_basis,consent_date,external_ids,hs_raw,mobile_phone,country,address,cep,city,state,website,company_name,lifecyclestage,hs_lead_status,hubspot_owner_id,hs_object_id,hs_createdate,hs_lastmodifieddate,linkedin_url,twitter_handle,custom_fields,portal_enabled,workspace_id,deleted_at,assigned_user_id,assigned_to,phone_digits,mobile_phone_digits,whatsapp_e164,whatsapp_digits,cargo_resumido,area_atuacao,nivel_hierarquico,cargo_catalog_version,photo_url,photo_source,photo_updated_at,phone_ext",
  quotes:
    "id,owner_id,deal_id,contact_id,company_id,number,title,status,valid_until,currency,subtotal,discount_total,tax_total,total,notes,terms,view_count,sent_at,accepted_at,declined_at,signature_name,created_at,updated_at,workspace_id,payment_link_url,payment_session_id,paid_at,template_id,assigned_to,service_line",
  proposals:
    "id,workspace_id,owner_id,title,body,status,version,locked,deal_id,contact_id,company_id,esign_document_id,variables,total_amount,currency,expires_at,sent_at,decided_at,created_at,updated_at,assigned_to,quote_id,proposal_template_id",
  email_accounts:
    "id,owner_id,provider,email,expires_at,scopes,history_id,status,last_sync_at,last_error,created_at,updated_at,workspace_id,signature_html",
  calendar_accounts:
    "id,owner_id,provider,email,primary_calendar_id,expires_at,scopes,sync_enabled,sync_token,last_synced_at,last_status,last_error,created_at,updated_at,workspace_id,auto_create_meet_link,sync_page_token,sync_in_progress,meet_index_cursor",
  integrations:
    "id,owner_id,provider,status,config,last_used_at,created_at,updated_at,workspace_id",
  slack_integrations:
    "id,workspace_id,owner_id,team_id,team_name,bot_user_id,default_channel_id,default_channel_name,scope,installed_by,created_at,updated_at",
  outbound_webhooks: "id,owner_id,name,url,events,active,created_at,updated_at,workspace_id",
} as const;
