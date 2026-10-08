
-- Os privilégios padrão do schema concedem ALL a anon/authenticated; restringe ao necessário.
REVOKE ALL ON public.deal_role_profiles, public.deal_role_profile_commercial, public.deal_role_profile_versions,
  public.deal_role_profile_events, public.deal_role_profile_attachments, public.deal_role_profile_share_links,
  public.deal_role_profile_client_proposals, public.deal_role_profile_handoffs, public.deal_role_profile_templates,
  public.deal_role_profile_imports FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.deal_role_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.deal_role_profile_commercial TO authenticated;
GRANT SELECT (id, profile_id, workspace_id, version, snapshot, approved_by, approved_at) ON public.deal_role_profile_versions TO authenticated;
GRANT SELECT, INSERT ON public.deal_role_profile_events TO authenticated;
GRANT SELECT ON public.deal_role_profile_attachments TO authenticated;
GRANT SELECT (id, profile_id, workspace_id, base_revision, allowed_fields, expires_at, revoked_at, max_reads, read_count, max_writes, write_count, last_access_at, created_by, created_at) ON public.deal_role_profile_share_links TO authenticated;
GRANT SELECT ON public.deal_role_profile_client_proposals TO authenticated;
GRANT SELECT ON public.deal_role_profile_handoffs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.deal_role_profile_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.deal_role_profile_imports TO authenticated;
REVOKE ALL ON FUNCTION public.role_profile_can(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.role_profile_can(uuid, text) TO authenticated, service_role;
