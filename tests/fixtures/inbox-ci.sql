-- Schema-only scaffold for production Inbox RPCs/views/policies in disposable CI.
CREATE ROLE techerp_shared_fields NOLOGIN NOBYPASSRLS;
GRANT authenticated TO techerp_shared_fields;
GRANT USAGE,CREATE ON SCHEMA public TO techerp_shared_fields;
INSERT INTO shared_field_catalog VALUES('techsales.contacts','contacts','email',true,ARRAY['email']);
ALTER TABLE contacts ADD COLUMN first_name text,ADD COLUMN last_name text,ADD COLUMN email text;
INSERT INTO contacts(id,workspace_id,owner_id,assigned_to,first_name,last_name,email)
 SELECT id,workspace_id,owner_id,assigned_to,'CI','Contact','private-identity@example.invalid' FROM leads;
CREATE TABLE email_threads(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,assigned_to uuid,contact_id uuid,lead_id uuid,last_message_at timestamptz,created_at timestamptz,subject text,snippet text,message_count int,identity_status text,account_id uuid);
CREATE TABLE whatsapp_conversations(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,assigned_to uuid,contact_id uuid,lead_id uuid,last_message_at timestamptz,created_at timestamptz,contact_phone text,last_message_preview text,status text,twilio_number text,provider text,wa_phone_number_id text,last_inbound_at timestamptz,unread_count int,identity_status text);
CREATE TABLE live_chat_sessions(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,assignee_id uuid,contact_id uuid,lead_id uuid,last_message_at timestamptz,created_at timestamptz,visitor_id uuid,visitor_name text,visitor_email text,visitor_url text,status text,identity_status text);
INSERT INTO email_threads(id,workspace_id,owner_id,assigned_to,contact_id,last_message_at,created_at,subject,snippet)
 SELECT id,workspace_id,owner_id,assigned_to,CASE WHEN owner_id='10000000-0000-4000-8000-000000000002' THEN id END,'2026-01-01','2026-01-01','Inbox CI','CI snippet' FROM leads;
INSERT INTO whatsapp_conversations(id,workspace_id,owner_id,assigned_to,contact_id,last_message_at,created_at,contact_phone,last_message_preview,status)
 SELECT id,workspace_id,owner_id,assigned_to,contact_id,last_message_at,created_at,'+12025550123','CI snippet','open' FROM email_threads;
INSERT INTO live_chat_sessions(id,workspace_id,owner_id,assignee_id,contact_id,last_message_at,created_at,visitor_name,status)
 SELECT id,workspace_id,owner_id,assigned_to,contact_id,last_message_at,created_at,'CI Visitor','open' FROM email_threads;
GRANT SELECT ON email_threads,whatsapp_conversations,live_chat_sessions TO authenticated;
