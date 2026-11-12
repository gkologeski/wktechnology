ALTER TABLE public.import_connector_schedules ADD COLUMN IF NOT EXISTS job_state jsonb;

-- Executa uma etapa do importador ClickUp em nome do dono da agenda (somente agendador / service_role).
-- A permissão do ator continua sendo conferida por clickup_import_require dentro de cada etapa.
CREATE OR REPLACE FUNCTION public.clickup_import_delegate(p_actor uuid, p_fn text, p_args jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE a jsonb := coalesce(p_args, '{}'::jsonb);
BEGIN
  IF p_actor IS NULL THEN RAISE EXCEPTION 'Ator obrigatório.'; END IF;
  PERFORM set_config('request.jwt.claim.sub', p_actor::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_actor, 'role', 'authenticated')::text, true);
  CASE p_fn
    WHEN 'clickup_import_access' THEN
      RETURN to_jsonb(clickup_import_access((a->>'p_ws')::uuid, p_actor, a->>'p_action'));
    WHEN 'clickup_import_start' THEN
      RETURN to_jsonb(clickup_import_start((a->>'p_ws')::uuid));
    WHEN 'clickup_import_stage' THEN
      RETURN clickup_import_stage((a->>'p_run')::uuid, a->'p_groups', a->'p_tasks', a->'p_people');
    WHEN 'clickup_import_finish_collect' THEN
      RETURN clickup_import_finish_collect((a->>'p_run')::uuid, a->'p_counts');
    WHEN 'clickup_import_set_group' THEN
      PERFORM clickup_import_set_group((a->>'p_group')::uuid, a->>'p_action', (a->>'p_space')::uuid,
        a->>'p_new_space', (a->>'p_project')::uuid, a->>'p_new_project', a->>'p_list_name');
      RETURN NULL;
    WHEN 'clickup_import_apply_step' THEN
      RETURN clickup_import_apply_step((a->>'p_run')::uuid, coalesce((a->>'p_limit')::int, 300));
    WHEN 'clickup_import_sync_assignees' THEN
      RETURN clickup_import_sync_assignees((a->>'p_run')::uuid, coalesce((a->>'p_limit')::int, 500));
    ELSE
      RAISE EXCEPTION 'Etapa não permitida.' USING ERRCODE = '42501';
  END CASE;
END $$;
REVOKE ALL ON FUNCTION public.clickup_import_delegate(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clickup_import_delegate(uuid, text, jsonb) TO service_role;