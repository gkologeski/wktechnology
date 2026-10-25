// Explicit public projections. Database column ACLs are authoritative.
export const SALES_PRIVATE_COLUMNS = {
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
