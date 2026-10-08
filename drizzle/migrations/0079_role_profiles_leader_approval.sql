-- Líder de equipe (equipes nomeadas = user_groups) e vínculos de origem dos perfis.
ALTER TABLE public.user_group_members ADD COLUMN IF NOT EXISTS is_leader boolean NOT NULL DEFAULT false;
ALTER TABLE public.deal_role_profiles
  ADD COLUMN IF NOT EXISTS source_line_item_id uuid,
  ADD COLUMN IF NOT EXISTS job_profile_id uuid,
  ADD COLUMN IF NOT EXISTS contracting_preset_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS deal_role_profiles_source_line_uq
  ON public.deal_role_profiles(deal_id, source_line_item_id)
  WHERE source_line_item_id IS NOT NULL AND archived_at IS NULL;
COMMENT ON TABLE public.deal_role_profile_commercial IS 'DEPRECATED: comercial interno retirado do perfil de vaga; dados históricos preservados e só leitura pela UI.';

CREATE TABLE public.role_profile_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  deal_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  approver_id uuid NOT NULL,
  team_ids uuid[] NOT NULL DEFAULT '{}',
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','decided','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  UNIQUE (workspace_id, idempotency_key)
);
CREATE TABLE public.role_profile_approval_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.role_profile_approval_requests(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.deal_role_profiles(id) ON DELETE CASCADE,
  profile_revision integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','changes_requested','superseded')),
  version integer,
  comment text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, profile_id)
);
CREATE INDEX role_profile_approval_items_profile_idx ON public.role_profile_approval_items(profile_id, status);
CREATE TABLE public.role_profile_approval_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.role_profile_approval_requests(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email','notification')),
  recipient_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','suppressed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, channel, recipient_id)
);

GRANT SELECT ON public.role_profile_approval_requests TO authenticated;
GRANT SELECT ON public.role_profile_approval_items TO authenticated;
GRANT SELECT ON public.role_profile_approval_deliveries TO authenticated;
GRANT ALL ON public.role_profile_approval_requests TO service_role;
GRANT ALL ON public.role_profile_approval_items TO service_role;
GRANT ALL ON public.role_profile_approval_deliveries TO service_role;

ALTER TABLE public.role_profile_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_profile_approval_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_profile_approval_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY rp_appr_req_select ON public.role_profile_approval_requests FOR SELECT TO authenticated
  USING (approver_id = auth.uid() OR public.role_profile_can(workspace_id, 'techsales.role_profiles.view.workspace'));
CREATE POLICY rp_appr_item_select ON public.role_profile_approval_items FOR SELECT TO authenticated
  USING (public.role_profile_can(workspace_id, 'techsales.role_profiles.view.workspace')
    OR EXISTS (SELECT 1 FROM public.role_profile_approval_requests r WHERE r.id = request_id AND r.approver_id = auth.uid()));
CREATE POLICY rp_appr_deliv_select ON public.role_profile_approval_deliveries FOR SELECT TO authenticated
  USING (public.role_profile_can(workspace_id, 'techsales.role_profiles.view.workspace'));

-- Resolve o líder pela equipe (user_groups) do responsável pelo negócio.
CREATE OR REPLACE FUNCTION public.role_profile_resolve_leader(_deal uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d record; v_owner uuid; v_groups jsonb; v_group_ids uuid[]; v_leaders uuid[];
BEGIN
  SELECT id, workspace_id, assigned_to, owner_id INTO d FROM public.deals WHERE id = _deal AND deleted_at IS NULL;
  IF NOT FOUND OR NOT public.is_workspace_member(d.workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'Negócio não encontrado ou sem acesso' USING ERRCODE = '42501';
  END IF;
  v_owner := COALESCE(d.assigned_to, d.owner_id);
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('status','no_owner','owner_id',NULL,'groups','[]'::jsonb,'leader_ids','[]'::jsonb);
  END IF;
  SELECT COALESCE(array_agg(g.id), '{}'), COALESCE(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name) ORDER BY g.name), '[]'::jsonb)
    INTO v_group_ids, v_groups
    FROM public.user_groups g JOIN public.user_group_members m ON m.group_id = g.id
   WHERE g.workspace_id = d.workspace_id AND m.user_id = v_owner;
  IF cardinality(v_group_ids) = 0 THEN
    RETURN jsonb_build_object('status','no_team','owner_id',v_owner,'groups',v_groups,'leader_ids','[]'::jsonb);
  END IF;
  SELECT COALESCE(array_agg(DISTINCT l.user_id), '{}') INTO v_leaders
    FROM public.user_group_members l
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = l.user_id
   WHERE l.group_id = ANY(v_group_ids) AND l.is_leader AND COALESCE(wm.status,'active') <> 'inactive';
  RETURN jsonb_build_object(
    'status', CASE WHEN cardinality(v_leaders) = 0 THEN 'no_leader' WHEN cardinality(v_leaders) > 1 THEN 'ambiguous' ELSE 'ok' END,
    'owner_id', v_owner, 'groups', v_groups, 'group_ids', to_jsonb(v_group_ids),
    'leader_ids', to_jsonb(v_leaders),
    'leader_id', CASE WHEN cardinality(v_leaders) = 1 THEN v_leaders[1] END);
END $$;
REVOKE ALL ON FUNCTION public.role_profile_resolve_leader(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.role_profile_resolve_leader(uuid) TO authenticated, service_role;

-- Solicitação agrupada de validação (uma por lote, idempotente).
CREATE OR REPLACE FUNCTION public.role_profile_request_validation(_deal uuid, _expected jsonb, _key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d record; r jsonb; v_req uuid; v_existing uuid; p public.deal_role_profiles; k text; v_exp int; v_ids uuid[] := '{}';
BEGIN
  SELECT id, workspace_id INTO d FROM public.deals WHERE id = _deal AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Negócio não encontrado' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.role_profile_can(d.workspace_id, 'techsales.role_profiles.update.workspace') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: techsales.role_profiles.update.workspace' USING ERRCODE = '42501';
  END IF;
  IF _key IS NULL OR length(_key) < 8 OR length(_key) > 120 THEN RAISE EXCEPTION 'Chave de idempotência inválida'; END IF;
  SELECT id INTO v_existing FROM public.role_profile_approval_requests WHERE workspace_id = d.workspace_id AND idempotency_key = _key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('request_id', v_existing, 'already', true);
  END IF;
  IF jsonb_typeof(_expected) <> 'object' OR (SELECT count(*) FROM jsonb_object_keys(_expected)) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos um perfil';
  END IF;
  r := public.role_profile_resolve_leader(_deal);
  IF r->>'status' <> 'ok' THEN RAISE EXCEPTION 'APPROVER_UNRESOLVED: %', r->>'status' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.role_profile_approval_requests(workspace_id, deal_id, requested_by, approver_id, team_ids, idempotency_key)
    VALUES (d.workspace_id, _deal, auth.uid(), (r->>'leader_id')::uuid,
            ARRAY(SELECT jsonb_array_elements_text(r->'group_ids'))::uuid[], _key)
    RETURNING id INTO v_req;
  FOR k IN SELECT jsonb_object_keys(_expected) LOOP
    v_exp := (_expected->>k)::int;
    SELECT * INTO p FROM public.deal_role_profiles WHERE id = k::uuid FOR UPDATE;
    IF NOT FOUND OR p.deal_id <> _deal OR p.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Perfil % não pertence ao negócio', k; END IF;
    IF p.revision <> v_exp THEN RAISE EXCEPTION 'STALE_REVISION: %', p.title USING ERRCODE = '40001'; END IF;
    IF p.status NOT IN ('draft','awaiting_info','in_validation') THEN RAISE EXCEPTION 'Perfil "%" não está em edição (status %)', p.title, p.status; END IF;
    UPDATE public.role_profile_approval_items SET status = 'superseded' WHERE profile_id = p.id AND status = 'pending';
    UPDATE public.deal_role_profiles SET status = 'in_validation', revision = revision + 1, updated_at = now() WHERE id = p.id;
    INSERT INTO public.role_profile_approval_items(request_id, workspace_id, profile_id, profile_revision)
      VALUES (v_req, d.workspace_id, p.id, p.revision + 1);
    INSERT INTO public.deal_role_profile_events(profile_id, workspace_id, kind, from_status, to_status, actor_id, details)
      VALUES (p.id, d.workspace_id, 'validation_requested', p.status, 'in_validation', auth.uid(),
              jsonb_build_object('request_id', v_req, 'approver_id', r->>'leader_id'));
    v_ids := v_ids || p.id;
  END LOOP;
  INSERT INTO public.role_profile_approval_deliveries(request_id, workspace_id, channel, recipient_id)
    VALUES (v_req, d.workspace_id, 'notification', (r->>'leader_id')::uuid),
           (v_req, d.workspace_id, 'email', (r->>'leader_id')::uuid);
  RETURN jsonb_build_object('request_id', v_req, 'already', false, 'approver_id', r->>'leader_id', 'profiles', to_jsonb(v_ids));
END $$;
REVOKE ALL ON FUNCTION public.role_profile_request_validation(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.role_profile_request_validation(uuid, jsonb, text) TO authenticated, service_role;

-- Decisão do líder por perfil, vinculada à revisão solicitada.
CREATE OR REPLACE FUNCTION public.role_profile_leader_decide(_item uuid, _decision text, _comment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it public.role_profile_approval_items; rq public.role_profile_approval_requests; p public.deal_role_profiles;
        r jsonb; v_id uuid; v_num int; v_to text;
BEGIN
  IF _decision NOT IN ('approve','request_changes') THEN RAISE EXCEPTION 'Decisão inválida'; END IF;
  SELECT * INTO it FROM public.role_profile_approval_items WHERE id = _item FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO rq FROM public.role_profile_approval_requests WHERE id = it.request_id;
  IF rq.approver_id <> auth.uid() THEN RAISE EXCEPTION 'PERMISSION_DENIED: somente o líder designado decide' USING ERRCODE = '42501'; END IF;
  r := public.role_profile_resolve_leader(rq.deal_id);
  IF r->>'status' <> 'ok' OR (r->>'leader_id')::uuid <> auth.uid() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: você não é mais o líder da equipe deste negócio' USING ERRCODE = '42501';
  END IF;
  IF it.status <> 'pending' THEN RAISE EXCEPTION 'ITEM_NOT_PENDING: %', it.status; END IF;
  SELECT * INTO p FROM public.deal_role_profiles WHERE id = it.profile_id FOR UPDATE;
  IF p.revision <> it.profile_revision OR p.status <> 'in_validation' THEN
    UPDATE public.role_profile_approval_items SET status = 'superseded' WHERE id = it.id;
    RETURN jsonb_build_object('status','superseded');
  END IF;
  IF _decision = 'approve' THEN
    v_num := p.last_version + 1;
    v_to := CASE WHEN p.ats_job_id IS NOT NULL THEN 'forwarded' ELSE 'approved' END;
    INSERT INTO public.deal_role_profile_versions(profile_id, workspace_id, version, snapshot, approved_by)
      VALUES (p.id, p.workspace_id, v_num,
              jsonb_build_object('title',p.title,'quantity',p.quantity,'modality',p.modality,'priority',p.priority,
                                 'seniority',p.seniority,'contact_id',p.contact_id,'data',p.data),
              auth.uid())
      RETURNING id INTO v_id;
    UPDATE public.deal_role_profiles SET status = v_to, approved_version_id = v_id, last_version = v_num,
           revision = revision + 1, updated_at = now() WHERE id = p.id;
    UPDATE public.role_profile_approval_items SET status = 'approved', version = v_num, decided_by = auth.uid(),
           decided_at = now(), comment = left(_comment, 1000) WHERE id = it.id;
    INSERT INTO public.deal_role_profile_events(profile_id, workspace_id, kind, from_status, to_status, version, actor_id, details)
      VALUES (p.id, p.workspace_id, 'approved', p.status, v_to, v_num, auth.uid(), jsonb_build_object('request_id', rq.id, 'via', 'leader'));
  ELSE
    IF coalesce(btrim(_comment),'') = '' THEN RAISE EXCEPTION 'Descreva os ajustes necessários'; END IF;
    UPDATE public.deal_role_profiles SET status = 'awaiting_info', revision = revision + 1, updated_at = now() WHERE id = p.id;
    UPDATE public.role_profile_approval_items SET status = 'changes_requested', decided_by = auth.uid(),
           decided_at = now(), comment = left(_comment, 1000) WHERE id = it.id;
    INSERT INTO public.deal_role_profile_events(profile_id, workspace_id, kind, from_status, to_status, actor_id, reason, details)
      VALUES (p.id, p.workspace_id, 'changes_requested', p.status, 'awaiting_info', auth.uid(), left(_comment, 500), jsonb_build_object('request_id', rq.id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.role_profile_approval_items WHERE request_id = rq.id AND status = 'pending') THEN
    UPDATE public.role_profile_approval_requests SET status = 'decided', decided_at = now() WHERE id = rq.id;
  END IF;
  RETURN jsonb_build_object('status', CASE WHEN _decision = 'approve' THEN 'approved' ELSE 'changes_requested' END, 'version', v_num);
END $$;
REVOKE ALL ON FUNCTION public.role_profile_leader_decide(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.role_profile_leader_decide(uuid, text, text) TO authenticated, service_role;

-- Edição de conteúdo invalida aprovação pendente daquela versão.
CREATE OR REPLACE FUNCTION public.role_profile_supersede_on_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.data, NEW.title, NEW.quantity, NEW.modality, NEW.seniority, NEW.priority)
     IS DISTINCT FROM (OLD.data, OLD.title, OLD.quantity, OLD.modality, OLD.seniority, OLD.priority) THEN
    UPDATE public.role_profile_approval_items SET status = 'superseded'
     WHERE profile_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER deal_role_profiles_supersede_on_edit AFTER UPDATE ON public.deal_role_profiles
  FOR EACH ROW EXECUTE FUNCTION public.role_profile_supersede_on_edit();