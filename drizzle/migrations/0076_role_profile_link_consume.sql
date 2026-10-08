
CREATE OR REPLACE FUNCTION public.role_profile_link_consume(_hash text, _write boolean)
RETURNS TABLE(link_id uuid, profile_id uuid, workspace_id uuid, allowed_fields text[], base_revision integer, expires_at timestamptz, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.deal_role_profile_share_links;
BEGIN
  SELECT * INTO l FROM public.deal_role_profile_share_links s WHERE s.token_hash = _hash FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::text[], NULL::int, NULL::timestamptz, 'not_found'::text; RETURN; END IF;
  IF l.revoked_at IS NOT NULL THEN RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::text[], NULL::int, NULL::timestamptz, 'revoked'::text; RETURN; END IF;
  IF l.expires_at <= now() THEN RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::text[], NULL::int, NULL::timestamptz, 'expired'::text; RETURN; END IF;
  IF _write AND l.write_count >= l.max_writes THEN RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::text[], NULL::int, NULL::timestamptz, 'write_limit'::text; RETURN; END IF;
  IF NOT _write AND l.read_count >= l.max_reads THEN RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::text[], NULL::int, NULL::timestamptz, 'read_limit'::text; RETURN; END IF;
  UPDATE public.deal_role_profile_share_links
     SET read_count = read_count + CASE WHEN _write THEN 0 ELSE 1 END,
         write_count = write_count + CASE WHEN _write THEN 1 ELSE 0 END,
         last_access_at = now()
   WHERE id = l.id;
  RETURN QUERY SELECT l.id, l.profile_id, l.workspace_id, l.allowed_fields, l.base_revision, l.expires_at, NULL::text;
END $$;
REVOKE ALL ON FUNCTION public.role_profile_link_consume(text, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.role_profile_link_consume(text, boolean) TO service_role;
