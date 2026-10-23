-- Synthetic settings schema and ACLs matching the audited production shape.
\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'wk_head_rh_permission_test' THEN RAISE EXCEPTION 'isolated fixture required'; END IF; END $$;
RESET ROLE;
ALTER TABLE permissions ADD resource text, ADD action text, ADD scope text, ADD label_pt text, ADD description text, ADD is_system boolean;
ALTER TABLE workspaces ADD payments_settings jsonb NOT NULL DEFAULT '{"gateway":"manual","mode":"sandbox","default_method":"pix"}',
 ADD nfse_settings jsonb NOT NULL DEFAULT '{"provider":"nfe_io","enabled":false,"service_code":null}',
 ADD meeting_settings jsonb NOT NULL DEFAULT '{"provider":"jitsi","require_consent":true,"retention_days":90,"transcription_model":"google/gemini-2.5-flash"}';
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_select_members ON workspaces FOR SELECT USING (is_workspace_member(id,auth.uid()));
CREATE POLICY ws_update_admin ON workspaces FOR UPDATE USING (is_workspace_admin_v2(id,auth.uid()));
CREATE POLICY ws_insert_platform ON workspaces FOR INSERT WITH CHECK (is_platform_admin(auth.uid()));
GRANT ALL ON workspaces TO authenticated,anon,service_role;
ALTER ROLE service_role BYPASSRLS;
CREATE TABLE settings_test_before AS SELECT id, payments_settings,nfse_settings,meeting_settings FROM workspaces;
