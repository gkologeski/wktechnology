CREATE OR REPLACE FUNCTION public.proposal_asset_storage_allowed(p_path text, p_write boolean)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  first_seg text;
  ws_id uuid;
  ctx jsonb;
BEGIN
  IF auth.uid() IS NULL OR p_path IS NULL OR p_path LIKE '%..%' THEN
    RETURN false;
  END IF;
  first_seg := split_part(p_path, '/', 1);
  IF first_seg !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  ws_id := first_seg::uuid;
  ctx := public.sales_policy_context(ARRAY['techsales.proposal_templates', 'techsales.proposals']);
  IF p_write THEN
    IF public.is_read_only_view() THEN
      RETURN false;
    END IF;
    RETURN public.sales_context_access(ctx, ws_id, 'techsales.proposal_templates', 'view', ARRAY[]::uuid[])
      AND (
        public.sales_context_access(ctx, ws_id, 'techsales.proposal_templates', 'create', ARRAY[]::uuid[])
        OR public.sales_context_access(ctx, ws_id, 'techsales.proposal_templates', 'update', ARRAY[]::uuid[])
      );
  END IF;
  RETURN public.sales_context_access(ctx, ws_id, 'techsales.proposal_templates', 'view', ARRAY[]::uuid[])
    OR public.sales_context_access(ctx, ws_id, 'techsales.proposals', 'view', ARRAY[]::uuid[]);
END $function$;

REVOKE ALL ON FUNCTION public.proposal_asset_storage_allowed(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proposal_asset_storage_allowed(text, boolean) TO authenticated;

CREATE POLICY proposal_assets_anon_boundary
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (bucket_id <> 'proposal-assets')
  WITH CHECK (bucket_id <> 'proposal-assets');

CREATE POLICY proposal_assets_storage_read
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'proposal-assets' AND public.proposal_asset_storage_allowed(name, false));

CREATE POLICY proposal_assets_storage_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'proposal-assets' AND public.proposal_asset_storage_allowed(name, true));

CREATE POLICY proposal_assets_storage_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'proposal-assets' AND public.proposal_asset_storage_allowed(name, true));

CREATE POLICY proposal_assets_storage_boundary
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (bucket_id <> 'proposal-assets' OR public.proposal_asset_storage_allowed(name, false))
  WITH CHECK (bucket_id <> 'proposal-assets' OR public.proposal_asset_storage_allowed(name, true));
