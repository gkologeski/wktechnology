CREATE OR REPLACE FUNCTION public.form_next_assignee(_form_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c record; active uuid[]; pick uuid;
BEGIN
  SELECT id, workspace_id, assignment_mode, assignment_member_ids, assignment_cursor
    INTO c FROM public.forms WHERE id = _form_id FOR UPDATE;
  IF NOT FOUND OR c.assignment_mode NOT IN ('member','round_robin') THEN RETURN NULL; END IF;
  SELECT array_agg(m ORDER BY ord) INTO active
  FROM unnest(c.assignment_member_ids) WITH ORDINALITY AS u(m, ord)
  WHERE EXISTS (SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = c.workspace_id AND wm.user_id = u.m AND wm.status = 'active');
  IF active IS NULL OR array_length(active, 1) IS NULL THEN RETURN NULL; END IF;
  IF c.assignment_mode = 'member' THEN RETURN active[1]; END IF;
  pick := active[(COALESCE(c.assignment_cursor,0) % array_length(active, 1)) + 1];
  UPDATE public.forms SET assignment_cursor = COALESCE(assignment_cursor,0) + 1 WHERE id = _form_id;
  RETURN pick;
END; $$;
REVOKE ALL ON FUNCTION public.form_next_assignee(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.form_next_assignee(uuid) TO service_role;