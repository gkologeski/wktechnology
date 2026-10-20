CREATE OR REPLACE FUNCTION public.project_time_entries_validate()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE
  v_overlap record;
  v_forced boolean := NEW.source = 'import' AND current_setting('app.clockify_force_import', true) = 'on';
BEGIN
  IF NEW.project_id IS NULL THEN RAISE EXCEPTION 'Apontamento exige um projeto.'; END IF;
  IF NEW.user_id IS NULL THEN RAISE EXCEPTION 'Apontamento exige um profissional.'; END IF;

  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    IF NEW.end_time < NEW.start_time OR (NEW.end_time = NEW.start_time AND NOT v_forced) THEN
      RAISE EXCEPTION 'O horário final deve ser maior que o horário inicial.';
    END IF;
    NEW.duration_minutes := ROUND(EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60)::int;
  ELSIF NEW.duration_minutes IS NULL AND NEW.hours IS NOT NULL THEN
    NEW.duration_minutes := GREATEST(0, ROUND(NEW.hours * 60))::int;
  END IF;

  IF NEW.duration_minutes IS NOT NULL THEN
    IF NEW.duration_minutes < 0 THEN RAISE EXCEPTION 'A duração do apontamento não pode ser negativa.'; END IF;
    NEW.hours := ROUND((NEW.duration_minutes::numeric / 60), 2);
  END IF;

  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL AND NOT v_forced THEN
    SELECT t.start_time, t.end_time INTO v_overlap
      FROM public.project_time_entries t
     WHERE t.user_id = NEW.user_id AND t.entry_date = NEW.entry_date
       AND t.id IS DISTINCT FROM NEW.id
       AND t.start_time IS NOT NULL AND t.end_time IS NOT NULL
       AND t.start_time < NEW.end_time AND t.end_time > NEW.start_time
     LIMIT 1;
    IF v_overlap IS NOT NULL THEN
      RAISE EXCEPTION 'Já existe um apontamento entre % e % neste dia.',
        to_char(v_overlap.start_time, 'HH24:MI'), to_char(v_overlap.end_time, 'HH24:MI');
    END IF;
  END IF;

  IF NEW.created_by IS NULL THEN NEW.created_by := COALESCE(auth.uid(), NEW.user_id); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- Exceção única: grava os apontamentos do Clockify retidos em revisão de uma execução.
CREATE OR REPLACE FUNCTION public.clockify_import_force_pending(p_workspace uuid, p_run uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  rec record; v_src text; v_owner uuid; v_user uuid; v_project uuid; v_task uuid;
  tz text; s timestamptz; e timestamptz; d date; d_last date; seg int;
  ss timestamptz; se timestamptz; st time; et time; secs bigint; v_id uuid;
  n_entries int := 0; n_rec int := 0; n_skip int := 0; v_secs bigint := 0;
  by_reason jsonb := '{}'::jsonb;
BEGIN
  SELECT source_workspace_id, requested_by INTO v_src, v_owner
    FROM public.clockify_import_runs WHERE id = p_run AND workspace_id = p_workspace;
  IF v_src IS NULL THEN RAISE EXCEPTION 'Execução não encontrada.'; END IF;
  PERFORM set_config('app.clockify_import', 'on', true);
  PERFORM set_config('app.clockify_force_import', 'on', true);

  FOR rec IN SELECT * FROM public.clockify_staging_records
     WHERE workspace_id = p_workspace AND source_workspace_id = v_src
       AND entity_type = 'time_entry' AND status = 'pending_review'
  LOOP
    SELECT target_id INTO v_user FROM public.clockify_mappings
     WHERE workspace_id = p_workspace AND source_workspace_id = v_src AND entity_type = 'user'
       AND external_id = rec.payload->>'userId' AND decision IN ('auto','confirmed') AND target_id IS NOT NULL;
    SELECT target_id INTO v_project FROM public.clockify_import_links
     WHERE workspace_id = p_workspace AND source_workspace_id = v_src AND entity_type = 'project'
       AND external_id = rec.payload->>'projectId' LIMIT 1;
    v_task := NULL;
    IF rec.payload->>'taskId' IS NOT NULL THEN
      SELECT target_id INTO v_task FROM public.clockify_import_links
       WHERE workspace_id = p_workspace AND source_workspace_id = v_src AND entity_type = 'task'
         AND external_id = rec.payload->>'taskId' LIMIT 1;
    END IF;
    s := (rec.payload->'timeInterval'->>'start')::timestamptz;
    e := (rec.payload->'timeInterval'->>'end')::timestamptz;
    tz := COALESCE(rec.payload->'timeInterval'->>'timeZone', 'America/Sao_Paulo');
    IF v_user IS NULL OR v_project IS NULL OR s IS NULL OR e IS NULL OR e < s THEN
      n_skip := n_skip + 1; CONTINUE;
    END IF;

    d := (s AT TIME ZONE tz)::date;
    d_last := (e AT TIME ZONE tz)::date;
    IF e > s AND (e AT TIME ZONE tz)::time = '00:00' THEN d_last := d_last - 1; END IF;
    IF d_last < d THEN d_last := d; END IF;
    seg := 0;
    WHILE d <= d_last LOOP
      ss := GREATEST(s, (d::timestamp) AT TIME ZONE tz);
      se := LEAST(e, ((d + 1)::timestamp) AT TIME ZONE tz);
      st := (ss AT TIME ZONE tz)::time;
      et := CASE WHEN se = ((d + 1)::timestamp) AT TIME ZONE tz AND se > ss THEN '24:00'::time
                 ELSE (se AT TIME ZONE tz)::time END;
      secs := EXTRACT(EPOCH FROM (se - ss))::bigint;
      INSERT INTO public.project_time_entries (workspace_id, project_id, task_id, user_id,
        entry_date, start_time, end_time, description, billable, hourly_rate,
        source, external_id, status, locked_at, created_by, started_at, stopped_at)
      VALUES (p_workspace, v_project, v_task, v_user, d, st, et, rec.payload->>'description', false,
        NULLIF((rec.payload->'hourlyRate'->>'amount')::numeric / 100, 0), 'import',
        'clockify:' || rec.external_id || ':' || seg, 'locked', now(), v_owner, ss, se)
      RETURNING id INTO v_id;
      INSERT INTO public.clockify_import_links (workspace_id, source_workspace_id, entity_type, external_id,
        segment, target_table, target_id, source_hash, imported_snapshot, source_seconds,
        source_start_utc, source_end_utc, source_timezone, local_date, meta, last_run_id)
      VALUES (p_workspace, v_src, 'time_entry', rec.external_id, seg, 'project_time_entries', v_id,
        rec.payload_hash, jsonb_build_object('user_id', v_user, 'project_id', v_project, 'task_id', v_task,
          'entry_date', d, 'start_time', st, 'end_time', et, 'billable', false, 'status', 'locked'),
        secs, ss, se, tz, d,
        jsonb_build_object('forced_reason', rec.reason_code, 'forced_at', now(),
          'tag_ids', COALESCE(rec.payload->'tagIds', '[]'::jsonb),
          'entry_seconds', EXTRACT(EPOCH FROM (e - s))::bigint, 'segments_total', d_last - (s AT TIME ZONE tz)::date + 1),
        p_run);
      n_entries := n_entries + 1; v_secs := v_secs + secs;
      seg := seg + 1; d := d + 1;
    END LOOP;
    UPDATE public.clockify_staging_records SET status = 'imported', last_run_id = p_run,
      reason_detail = 'Importado com exceção: ' || COALESCE(reason_code, '') WHERE id = rec.id;
    by_reason := jsonb_set(by_reason, ARRAY[COALESCE(rec.reason_code,'none')],
      to_jsonb(COALESCE((by_reason->>COALESCE(rec.reason_code,'none'))::int, 0) + 1));
    n_rec := n_rec + 1;
  END LOOP;
  PERFORM set_config('app.clockify_force_import', 'off', true);
  RETURN jsonb_build_object('records', n_rec, 'entries', n_entries, 'skipped', n_skip,
    'seconds', v_secs, 'by_reason', by_reason);
END $function$;

REVOKE ALL ON FUNCTION public.clockify_import_force_pending(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clockify_import_force_pending(uuid, uuid) TO service_role;