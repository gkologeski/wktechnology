-- Identidade do Agente SDR (Lia) por workspace: usuário sem login (banido), membro
-- ativo que espelha cargos/pacotes de quem a criou. Aditivo; nada é removido.
CREATE TABLE IF NOT EXISTS public.sdr_agent_identities (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT 'Lia (Agente SDR)',
  mirrored_from uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sdr_agent_identities TO authenticated;
GRANT ALL ON public.sdr_agent_identities TO service_role;
ALTER TABLE public.sdr_agent_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY sdr_agent_identities_select ON public.sdr_agent_identities
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

-- Cópia de segurança da transferência do histórico (valor anterior por coluna).
CREATE TABLE IF NOT EXISTS public.sdr_agent_reassign_backup (
  id bigserial PRIMARY KEY,
  workspace_id uuid NOT NULL,
  run_id uuid NOT NULL,
  table_name text NOT NULL,
  row_id uuid NOT NULL,
  column_name text NOT NULL,
  old_value uuid,
  undone_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sdr_agent_reassign_backup_run_idx
  ON public.sdr_agent_reassign_backup(workspace_id, run_id);
GRANT ALL ON public.sdr_agent_reassign_backup TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.sdr_agent_reassign_backup_id_seq TO service_role;
ALTER TABLE public.sdr_agent_reassign_backup ENABLE ROW LEVEL SECURITY;
-- Sem políticas para authenticated: acesso só pelo servidor após checar admin.

-- Transfere para a Lia somente registros comprovadamente dela:
-- notas com assunto fixo do agente e ações do agente sem autor humano.
-- Leads não entram (gatilhos de workflow dispariam). p_apply=false só conta.
CREATE OR REPLACE FUNCTION public.sdr_agent_reassign_history(p_workspace uuid, p_apply boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_agent uuid; v_run uuid := gen_random_uuid(); v_acts int; v_actions int;
  v_subjects text[] := ARRAY['Indicação recebida pela Lia',
    'Número corporativo informado na conversa com a Lia','Resumo da conversa (Agente SDR)'];
BEGIN
  SELECT user_id INTO v_agent FROM sdr_agent_identities WHERE workspace_id = p_workspace;
  IF v_agent IS NULL THEN RAISE EXCEPTION 'Perfil da Lia não criado neste workspace.'; END IF;
  SELECT count(*) INTO v_acts FROM activities WHERE workspace_id = p_workspace
    AND subject = ANY(v_subjects) AND deleted_at IS NULL
    AND (owner_id IS DISTINCT FROM v_agent OR assigned_to IS DISTINCT FROM v_agent);
  SELECT count(*) INTO v_actions FROM sdr_actions WHERE workspace_id = p_workspace AND created_by IS NULL;
  IF NOT p_apply THEN
    RETURN jsonb_build_object('activities', v_acts, 'sdr_actions', v_actions);
  END IF;
  INSERT INTO sdr_agent_reassign_backup(workspace_id, run_id, table_name, row_id, column_name, old_value)
    SELECT p_workspace, v_run, 'activities', a.id, c.col, c.val
    FROM activities a CROSS JOIN LATERAL (VALUES ('owner_id', a.owner_id), ('assigned_to', a.assigned_to),
      ('created_by', a.created_by)) c(col, val)
    WHERE a.workspace_id = p_workspace AND a.subject = ANY(v_subjects) AND a.deleted_at IS NULL
      AND (a.owner_id IS DISTINCT FROM v_agent OR a.assigned_to IS DISTINCT FROM v_agent);
  UPDATE activities SET owner_id = v_agent, assigned_to = v_agent, created_by = v_agent
    WHERE id IN (SELECT row_id FROM sdr_agent_reassign_backup WHERE run_id = v_run AND table_name = 'activities');
  INSERT INTO sdr_agent_reassign_backup(workspace_id, run_id, table_name, row_id, column_name, old_value)
    SELECT p_workspace, v_run, 'sdr_actions', id, 'created_by', NULL
    FROM sdr_actions WHERE workspace_id = p_workspace AND created_by IS NULL;
  UPDATE sdr_actions SET created_by = v_agent
    WHERE id IN (SELECT row_id FROM sdr_agent_reassign_backup WHERE run_id = v_run AND table_name = 'sdr_actions');
  RETURN jsonb_build_object('run_id', v_run, 'activities', v_acts, 'sdr_actions', v_actions);
END $$;

CREATE OR REPLACE FUNCTION public.sdr_agent_reassign_undo(p_workspace uuid, p_run uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n int;
BEGIN
  UPDATE activities a SET
    owner_id = (SELECT old_value FROM sdr_agent_reassign_backup b WHERE b.run_id = p_run AND b.row_id = a.id AND b.column_name = 'owner_id' AND b.table_name = 'activities'),
    assigned_to = (SELECT old_value FROM sdr_agent_reassign_backup b WHERE b.run_id = p_run AND b.row_id = a.id AND b.column_name = 'assigned_to' AND b.table_name = 'activities'),
    created_by = (SELECT old_value FROM sdr_agent_reassign_backup b WHERE b.run_id = p_run AND b.row_id = a.id AND b.column_name = 'created_by' AND b.table_name = 'activities')
  WHERE a.workspace_id = p_workspace AND a.id IN (SELECT row_id FROM sdr_agent_reassign_backup
    WHERE run_id = p_run AND workspace_id = p_workspace AND table_name = 'activities' AND undone_at IS NULL);
  UPDATE sdr_actions s SET created_by = NULL WHERE s.workspace_id = p_workspace AND s.id IN (
    SELECT row_id FROM sdr_agent_reassign_backup WHERE run_id = p_run AND workspace_id = p_workspace
      AND table_name = 'sdr_actions' AND undone_at IS NULL);
  UPDATE sdr_agent_reassign_backup SET undone_at = now()
    WHERE run_id = p_run AND workspace_id = p_workspace AND undone_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('restored', v_n);
END $$;

REVOKE ALL ON FUNCTION public.sdr_agent_reassign_history(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sdr_agent_reassign_undo(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sdr_agent_reassign_history(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.sdr_agent_reassign_undo(uuid, uuid) TO service_role;

-- Novas ações do agente sem autor humano passam a ter a Lia como autora.
CREATE OR REPLACE FUNCTION public.sdr_actions_default_agent_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    SELECT user_id INTO NEW.created_by FROM sdr_agent_identities WHERE workspace_id = NEW.workspace_id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sdr_actions_default_agent_author() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_sdr_actions_agent_author ON public.sdr_actions;
CREATE TRIGGER trg_sdr_actions_agent_author BEFORE INSERT ON public.sdr_actions
  FOR EACH ROW EXECUTE FUNCTION public.sdr_actions_default_agent_author();
