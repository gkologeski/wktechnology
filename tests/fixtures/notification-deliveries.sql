-- Only missing physical tables/columns for the disposable P4 fixture. Canonical
-- permission functions, source RLS and the old delivery ledger load verbatim.
ALTER TABLE profiles ADD COLUMN phone text,ADD COLUMN full_name text;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
REVOKE ALL ON auth.users FROM PUBLIC,anon,authenticated,service_role;
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT(id,active_workspace_id,notification_preferences,full_name) ON public.profiles TO authenticated;
CREATE TABLE public.wa_cloud_connections(id uuid PRIMARY KEY,workspace_id uuid,enabled boolean,webhook_verified_at timestamptz);
CREATE TABLE public.wa_cloud_numbers(phone_number_id text PRIMARY KEY,connection_id uuid,workspace_id uuid,display_phone_number text,verified_name text,quality_rating text,status text,available boolean,synced_at timestamptz DEFAULT now());
CREATE TABLE public.whatsapp_number_suppressions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,phone_key text,released_at timestamptz,expires_at timestamptz);
ALTER TABLE public.whatsapp_conversations ADD COLUMN wa_phone_number_id text,ADD COLUMN twilio_number text;
CREATE TABLE public.whatsapp_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,conversation_id uuid,direction text,provider text,
 from_number text,to_number text,wa_message_id text,status text,raw jsonb);
ALTER TABLE public.workflows ADD COLUMN name text DEFAULT 'Fixture notification rule',ADD COLUMN trigger jsonb DEFAULT '{}',ADD COLUMN draft_trigger jsonb,
 ADD COLUMN draft_actions jsonb,ADD COLUMN goal_filters jsonb,ADD COLUMN draft_goal_filters jsonb,ADD COLUMN updated_at timestamptz DEFAULT now();
GRANT ALL ON public.wa_cloud_connections,public.wa_cloud_numbers,public.whatsapp_number_suppressions,public.whatsapp_messages TO service_role;
GRANT SELECT ON public.workflow_deliveries TO service_role;
