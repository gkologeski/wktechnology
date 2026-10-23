-- Permission alignment, cycle 1. No role grants or business records are changed.
-- These five helpers are internal: their SECURITY DEFINER triggers retain EXECUTE
-- as function owner. Browser/API subjects cannot invoke the helpers directly.
REVOKE ALL ON FUNCTION public.recalc_deal_value(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_deal_value(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalc_financial_entry(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_quote_templates(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_silver_medalist_pool(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_deal_value(uuid), public.recompute_deal_value(uuid),
  public.recalc_financial_entry(uuid), public.seed_quote_templates(uuid, uuid),
  public.ensure_silver_medalist_pool(uuid) TO service_role;
DO $revoke_api$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='techerp_api_subject') THEN
    REVOKE ALL ON FUNCTION public.recalc_deal_value(uuid), public.recompute_deal_value(uuid),
      public.recalc_financial_entry(uuid), public.seed_quote_templates(uuid,uuid),
      public.ensure_silver_medalist_pool(uuid) FROM techerp_api_subject;
  END IF;
END $revoke_api$;

-- Metadata-only contract. No SELECT of business rows, temporary tables, or
-- distinct customer values. Options come from SQL enums/boolean only; existing
-- application registries continue to supply pipeline and catalog choices.
-- Authenticated active members may inspect the allowlisted schema for builders.
-- Trusted service_role also needs this metadata when processing campaign filters.
CREATE OR REPLACE FUNCTION public.get_entity_field_catalog(p_table text, p_owner_id uuid)
RETURNS TABLE(column_name text, data_type text, distinct_values text[],
  distinct_count integer, is_nullable text, has_default boolean)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $fn$
BEGIN
  IF current_user <> 'service_role' THEN
    IF auth.uid() IS NULL OR p_owner_id IS DISTINCT FROM auth.uid()
       OR NOT EXISTS (SELECT 1 FROM public.profiles p
          WHERE p.id=auth.uid() AND p.active_workspace_id IS NOT NULL
            AND public.is_workspace_member(p.active_workspace_id,auth.uid())
            AND p.active_workspace_id IN (SELECT public.current_user_workspaces())) THEN
      RAISE EXCEPTION 'Acesso ao catálogo de campos não autorizado.' USING ERRCODE='42501';
    END IF;
  END IF;
  IF p_table IS NULL OR p_table NOT IN (
    'leads','contacts','companies','deals','tickets','activities',
    'ats_jobs','ats_candidates','ats_applications','ats_interviews','ats_offers',
    'projects','project_tasks','project_milestones','contracts','financial_entries',
    'bank_payments','quotes','proposals','products','services',
    'recurring_plans','subscription_invoices','customer_invoices'
  ) THEN
    RAISE EXCEPTION 'Tabela não permitida no catálogo de campos.' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
    SELECT c.column_name::text, c.data_type::text,
      CASE WHEN c.data_type='boolean' THEN ARRAY['false','true']::text[] ELSE en.labels END,
      CASE WHEN c.data_type='boolean' THEN 2 ELSE NULLIF(en.total,0) END,
      c.is_nullable::text, c.column_default IS NOT NULL
    FROM information_schema.columns c
    LEFT JOIN LATERAL (
      SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels,
             count(*)::integer AS total
      FROM pg_catalog.pg_enum e
      JOIN pg_catalog.pg_type t ON t.oid=e.enumtypid
      JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
      WHERE t.typname=c.udt_name AND n.nspname=c.udt_schema
    ) en ON true
    WHERE c.table_schema='public' AND c.table_name=p_table
    ORDER BY c.ordinal_position;
END;
$fn$;
REVOKE ALL ON FUNCTION public.get_entity_field_catalog(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_entity_field_catalog(text,uuid) TO authenticated, service_role;

-- Destructive LGPD action: an explicit compliance deletion grant AND candidate
-- update scope are required. Owner alone is not authorization; NULL never passes.
CREATE OR REPLACE FUNCTION public.anonymize_ats_candidate(_candidate_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_user uuid:=auth.uid(); v_workspace uuid; v_owner uuid;
BEGIN
  IF v_user IS NULL OR public.is_read_only_view() THEN
    RAISE EXCEPTION 'Anonimização não autorizada.' USING ERRCODE='42501';
  END IF;
  SELECT c.workspace_id,c.owner_id INTO v_workspace,v_owner
    FROM public.ats_candidates c WHERE c.id=_candidate_id FOR UPDATE;
  IF v_workspace IS NULL
     OR NOT public.is_workspace_member(v_workspace,v_user)
     OR v_workspace NOT IN (SELECT public.current_user_workspaces())
     OR NOT public.user_has_permission(v_user,v_workspace,'techhire.compliance.delete.workspace')
     OR NOT (public.user_has_permission(v_user,v_workspace,'techhire.candidates.update.workspace')
       OR (v_owner=v_user AND public.user_has_permission(v_user,v_workspace,'techhire.candidates.update.own'))) THEN
    RAISE EXCEPTION 'Anonimização não autorizada.' USING ERRCODE='42501';
  END IF;
  UPDATE public.ats_candidates SET full_name='[REDACTED]',email=NULL,phone=NULL,
    linkedin_url=NULL,location=NULL,current_position=NULL,current_company=NULL,
    cv_url=NULL,cv_parsed=NULL,notes=NULL,tags=ARRAY[]::text[],
    lgpd_redacted_at=now(),updated_at=now() WHERE id=_candidate_id;
  UPDATE public.ats_candidate_consents SET granted=false,revoked_at=now()
    WHERE candidate_id=_candidate_id AND granted=true AND revoked_at IS NULL;
  INSERT INTO public.access_audit_log(workspace_id,actor_id,action,entity_type,entity_id,details)
    VALUES(v_workspace,v_user,'candidate_anonymized','ats_candidate',_candidate_id,
      jsonb_build_object('authorization','techhire.compliance.delete.workspace','source','anonymize_ats_candidate'));
END;
$fn$;
REVOKE ALL ON FUNCTION public.anonymize_ats_candidate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.anonymize_ats_candidate(uuid) TO authenticated, service_role;

-- The preserved internal silver-medalist trigger had an ambiguous pool_id
-- variable in ON CONFLICT under plpgsql.variable_conflict=error. Rename only
-- the local variable; keep the candidate transition and idempotency unchanged.
CREATE OR REPLACE FUNCTION public.ats_handle_silver_medalist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_pool_id uuid;
BEGIN
  IF NEW.status='rejected' AND COALESCE(OLD.status,'')<>'rejected'
     AND NEW.stage_value IN ('interview','onsite','offer') AND NEW.candidate_id IS NOT NULL THEN
    v_pool_id := public.ensure_silver_medalist_pool(NEW.owner_id);
    INSERT INTO public.ats_talent_pool_members(pool_id,candidate_id,owner_id,added_by,source)
      VALUES(v_pool_id,NEW.candidate_id,NEW.owner_id,NEW.owner_id,'silver_medalist')
      ON CONFLICT(pool_id,candidate_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$fn$;
