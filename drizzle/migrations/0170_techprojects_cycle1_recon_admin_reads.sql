-- Leituras da central de conciliação passam a exigir admin ativo explicitamente e rodam
-- com privilégio do dono (sem custo de RLS por linha em ~110 mil registros). Mesmo corpo de antes.
ALTER FUNCTION public.project_reconciliation_overview(uuid) RENAME TO project_reconciliation_overview_body;
ALTER FUNCTION public.project_reconciliation_breakdown(uuid, text, date, date, text, uuid, uuid, integer, integer)
  RENAME TO project_reconciliation_breakdown_body;
ALTER FUNCTION public.project_link_people_overview(uuid) RENAME TO project_link_people_overview_body;
REVOKE ALL ON FUNCTION public.project_reconciliation_overview_body(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.project_reconciliation_breakdown_body(uuid, text, date, date, text, uuid, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.project_link_people_overview_body(uuid) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.project_reconciliation_overview_body(uuid) IS 'Interna: chamada só pela versão que confere admin.';
COMMENT ON FUNCTION public.project_reconciliation_breakdown_body(uuid, text, date, date, text, uuid, uuid, integer, integer) IS 'Interna: chamada só pela versão que confere admin.';
COMMENT ON FUNCTION public.project_link_people_overview_body(uuid) IS 'Interna: chamada só pela versão que confere admin.';

CREATE FUNCTION public.project_reconciliation_overview(p_ws uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public SET statement_timeout = '60s' AS $$
BEGIN
  PERFORM public.project_recon_assert_admin(p_ws, false);
  RETURN public.project_reconciliation_overview_body(p_ws);
END $$;
REVOKE ALL ON FUNCTION public.project_reconciliation_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_reconciliation_overview(uuid) TO authenticated, service_role;

CREATE FUNCTION public.project_reconciliation_breakdown(
  p_ws uuid, p_provider text, p_from date, p_to date, p_group text,
  p_user uuid DEFAULT NULL, p_project uuid DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE (group_key text, label text, erp_rows bigint, erp_seconds numeric, linked_rows bigint,
               linked_erp_seconds numeric, source_seconds numeric, diff_seconds numeric,
               rows_with_open_issues bigint, total_groups bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public SET statement_timeout = '60s' AS $$
BEGIN
  PERFORM public.project_recon_assert_admin(p_ws, false);
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Período inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_group NOT IN ('month','person','project') OR coalesce(p_provider, 'all') NOT IN ('all','clockify','jibble','erp') THEN
    RAISE EXCEPTION 'Agrupamento ou fonte inválidos.' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY SELECT * FROM public.project_reconciliation_breakdown_body(
    p_ws, p_provider, p_from, p_to, p_group, p_user, p_project, p_limit, p_offset);
END $$;
REVOKE ALL ON FUNCTION public.project_reconciliation_breakdown(uuid, text, date, date, text, uuid, uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_reconciliation_breakdown(uuid, text, date, date, text, uuid, uuid, integer, integer) TO authenticated, service_role;

CREATE FUNCTION public.project_link_people_overview(p_ws uuid)
RETURNS TABLE (user_id uuid, user_name text, member_status text, entries bigint, entries_with_person bigint,
               person_ids uuid[], suggestions bigint, linked_by_trace bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public SET statement_timeout = '60s' AS $$
BEGIN
  PERFORM public.project_recon_assert_admin(p_ws, false);
  RETURN QUERY SELECT * FROM public.project_link_people_overview_body(p_ws);
END $$;
REVOKE ALL ON FUNCTION public.project_link_people_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_link_people_overview(uuid) TO authenticated, service_role;
