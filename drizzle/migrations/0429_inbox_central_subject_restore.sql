GRANT EXECUTE ON FUNCTION techerp_api.leave() TO techerp_api_subject;
COMMENT ON FUNCTION techerp_api.inbox_conversation_rls(uuid,text,uuid,uuid) IS 'Private authenticated-role RLS evaluation used by the existing subject bridge; subject claims and workspace are restored by leave(). No business permissions or account configuration access granted.';
NOTIFY pgrst,'reload schema';
