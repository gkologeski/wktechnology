ALTER TABLE public.whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS assignment_mode text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS assignment_member_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assignment_cursor integer NOT NULL DEFAULT 0;

ALTER TABLE public.whatsapp_campaigns
  ADD CONSTRAINT whatsapp_campaigns_assignment_mode_chk
  CHECK (assignment_mode IN ('auto','member','round_robin','unassigned'));

COMMENT ON COLUMN public.whatsapp_campaigns.assignment_mode IS 'auto = Central de Distribuição na resposta; member = um membro; round_robin = rodízio entre assignment_member_ids; unassigned = sem responsável';

CREATE OR REPLACE FUNCTION public.wa_campaign_next_assignee(_campaign_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  active uuid[];
  pick uuid;
BEGIN
  SELECT id, workspace_id, assignment_mode, assignment_member_ids, assignment_cursor
    INTO c FROM public.whatsapp_campaigns WHERE id = _campaign_id FOR UPDATE;
  IF NOT FOUND OR c.assignment_mode NOT IN ('member','round_robin') THEN
    RETURN NULL;
  END IF;
  SELECT array_agg(m ORDER BY ord) INTO active
  FROM unnest(c.assignment_member_ids) WITH ORDINALITY AS u(m, ord)
  WHERE EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = c.workspace_id AND wm.user_id = u.m AND wm.status = 'active'
  );
  IF active IS NULL OR array_length(active, 1) IS NULL THEN
    RETURN NULL;
  END IF;
  IF c.assignment_mode = 'member' THEN
    RETURN active[1];
  END IF;
  pick := active[(c.assignment_cursor % array_length(active, 1)) + 1];
  UPDATE public.whatsapp_campaigns SET assignment_cursor = assignment_cursor + 1 WHERE id = _campaign_id;
  RETURN pick;
END;
$$;

REVOKE ALL ON FUNCTION public.wa_campaign_next_assignee(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_campaign_next_assignee(uuid) TO service_role;