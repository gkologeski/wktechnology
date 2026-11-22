-- Ownership transfer requires CREATE only during this atomic migration.
GRANT CREATE ON SCHEMA techerp_api TO authenticated;
ALTER FUNCTION techerp_api.inbox_email_thread_rls(uuid,uuid,uuid) OWNER TO authenticated;
REVOKE CREATE ON SCHEMA techerp_api FROM authenticated;
REVOKE ALL ON FUNCTION techerp_api.inbox_email_thread_rls(uuid,uuid,uuid) FROM PUBLIC,anon,service_role,techerp_api_subject;
GRANT EXECUTE ON FUNCTION techerp_api.inbox_email_thread_rls(uuid,uuid,uuid) TO postgres;
COMMENT ON FUNCTION techerp_api.inbox_email_thread_rls(uuid,uuid,uuid) IS 'Private evaluator using the authenticated-targeted thread RLS. Its body contains no private-schema calls. No schema access or business permissions granted.';
NOTIFY pgrst,'reload schema';
