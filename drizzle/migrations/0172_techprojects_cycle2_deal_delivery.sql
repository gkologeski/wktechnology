-- Ciclo 2 TechProjects: negócio ganho -> projeto de entrega (criar ou vincular), vínculos recíprocos,
-- fila durável com retry/lease, revisões e conciliação do histórico.
-- Aditiva: nenhuma coluna/tabela removida; nenhum apontamento, data, duração, status, bloqueio ou ID de origem alterado.
-- Ativação NÃO reprocessa negócios antigos: só transições depois do marco `activated_at` geram fila.

-- ------------------------------------------------------------------ 1. projeto: vínculo direto e origem
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_group_key text,
  ADD COLUMN IF NOT EXISTS source_line_item_id uuid REFERENCES public.deal_line_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin text;
ALTER TABLE public.projects ADD CONSTRAINT projects_origin_chk
  CHECK (origin IS NULL OR origin IN ('deal_auto','deal_manual','deal_history','manual','internal'));
ALTER TABLE public.projects ADD CONSTRAINT projects_deal_group_chk
  CHECK (deal_id IS NULL OR (delivery_group_key IS NOT NULL AND delivery_group_key ~ '^[a-z0-9][a-z0-9_-]{0,39}$'));
COMMENT ON COLUMN public.projects.deal_id IS
  'Negócio de origem principal (um negócio pode gerar vários projetos, um por grupo de entrega). Negócios consolidados ficam em project_deal_links.';
COMMENT ON COLUMN public.projects.delivery_group_key IS 'Grupo de entrega do negócio que este projeto atende; chave de idempotência com deal_id.';
COMMENT ON COLUMN public.projects.origin IS 'Como o projeto nasceu: deal_auto (política), deal_manual, deal_history, manual, internal. NULL = anterior ao ciclo 2.';
CREATE UNIQUE INDEX IF NOT EXISTS projects_deal_group_uniq ON public.projects (deal_id, delivery_group_key) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS projects_contract_idx ON public.projects (contract_id) WHERE contract_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS projects_service_idx ON public.projects (service_id) WHERE service_id IS NOT NULL;

-- ------------------------------------------------------------------ 2. negócios consolidados (relação explícita)
CREATE TABLE public.project_deal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  delivery_group_key text NOT NULL DEFAULT 'default' CHECK (delivery_group_key ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, deal_id),
  UNIQUE (deal_id, delivery_group_key)
);
GRANT SELECT ON public.project_deal_links TO authenticated;
GRANT ALL ON public.project_deal_links TO service_role;
ALTER TABLE public.project_deal_links ENABLE ROW LEVEL SECURITY;
CREATE INDEX project_deal_links_project_idx ON public.project_deal_links (project_id);

-- ------------------------------------------------------------------ 3. política por workspace
CREATE TABLE public.deal_delivery_policies (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  activated_at timestamptz,
  allow_groups boolean NOT NULL DEFAULT true,
  origins jsonb NOT NULL DEFAULT '{"user":true,"system":true,"workflow":true,"import":false}'::jsonb,
  project_creator_id uuid,
  default_operational_owner_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(origins) = 'object'),
  CHECK (NOT enabled OR (activated_at IS NOT NULL AND project_creator_id IS NOT NULL))
);
GRANT SELECT ON public.deal_delivery_policies TO authenticated;
GRANT ALL ON public.deal_delivery_policies TO service_role;
ALTER TABLE public.deal_delivery_policies ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------ 4. grupos de entrega explícitos por item do negócio
CREATE TABLE public.deal_delivery_items (
  line_item_id uuid PRIMARY KEY REFERENCES public.deal_line_items(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  group_key text NOT NULL CHECK (group_key ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  group_label text CHECK (group_label IS NULL OR length(group_label) <= 120),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.deal_delivery_items TO authenticated;
GRANT ALL ON public.deal_delivery_items TO service_role;
ALTER TABLE public.deal_delivery_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX deal_delivery_items_deal_idx ON public.deal_delivery_items (deal_id);

-- ------------------------------------------------------------------ 5. fila durável de provisionamento
CREATE TABLE public.deal_delivery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  transition_key text NOT NULL,
  origin text NOT NULL CHECK (origin IN ('user','system','workflow','import','manual')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed','skipped','cancelled')),
  skip_reason text,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 6 CHECK (max_attempts BETWEEN 1 AND 20),
  next_run_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_token uuid,
  last_error text,
  result jsonb,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (deal_id, transition_key)
);
GRANT SELECT ON public.deal_delivery_jobs TO authenticated;
GRANT ALL ON public.deal_delivery_jobs TO service_role;
ALTER TABLE public.deal_delivery_jobs ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX deal_delivery_jobs_open_uniq ON public.deal_delivery_jobs (deal_id)
  WHERE status IN ('pending','running','failed');
CREATE INDEX deal_delivery_jobs_due_idx ON public.deal_delivery_jobs (next_run_at)
  WHERE status IN ('pending','running','failed');
CREATE INDEX deal_delivery_jobs_ws_idx ON public.deal_delivery_jobs (workspace_id, status);

-- ------------------------------------------------------------------ 6. eventos: auditoria, revisões e reversão
CREATE TABLE public.deal_delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('project_created','project_linked','project_unlinked','history_linked',
    'link_reverted','groups_changed','owner_changed','policy_changed','job_failed',
    'review_deal_left_won','review_company_changed','review_link_conflict','review_resolved')),
  origin text,
  actor uuid,
  job_id uuid REFERENCES public.deal_delivery_jobs(id) ON DELETE SET NULL,
  batch_id uuid,
  before jsonb,
  after jsonb,
  note text CHECK (note IS NULL OR length(note) <= 1000),
  needs_review boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text,
  reverted_at timestamptz,
  reverted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.deal_delivery_events TO authenticated;
GRANT ALL ON public.deal_delivery_events TO service_role;
ALTER TABLE public.deal_delivery_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX deal_delivery_events_deal_idx ON public.deal_delivery_events (deal_id, created_at DESC);
CREATE INDEX deal_delivery_events_project_idx ON public.deal_delivery_events (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX deal_delivery_events_review_idx ON public.deal_delivery_events (workspace_id)
  WHERE needs_review AND resolved_at IS NULL;
CREATE INDEX deal_delivery_events_batch_idx ON public.deal_delivery_events (batch_id) WHERE batch_id IS NOT NULL;

-- ------------------------------------------------------------------ 7. estado do agendador (sem dados de tenant)
CREATE TABLE public.deal_delivery_worker_state (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_run_at timestamptz,
  last_processed integer NOT NULL DEFAULT 0,
  last_work_at timestamptz,
  runs bigint NOT NULL DEFAULT 0
);
GRANT ALL ON public.deal_delivery_worker_state TO service_role;
ALTER TABLE public.deal_delivery_worker_state ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------ 8. auxiliares de acesso
CREATE OR REPLACE FUNCTION public.deal_stage_type(p_pipeline uuid, p_stage_id text, p_stage text)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(
    (SELECT s->>'type' FROM public.pipelines pl
       CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(pl.stages) = 'array' THEN pl.stages ELSE '[]'::jsonb END) s
      WHERE p_pipeline IS NOT NULL AND p_stage_id IS NOT NULL AND pl.id = p_pipeline
        AND s->>'value' = p_stage_id AND s->>'type' IN ('open','won','lost') LIMIT 1),
    CASE p_stage WHEN 'won' THEN 'won' WHEN 'lost' THEN 'lost' ELSE 'open' END) $$;
COMMENT ON FUNCTION public.deal_stage_type(uuid, text, text) IS
  'Tipo real da etapa: o "type" da etapa no funil do negócio (inclui etapas personalizadas); sem funil cadastrado, a etapa canônica (stage).';
GRANT EXECUTE ON FUNCTION public.deal_stage_type(uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.deal_delivery_is_active_member(p_ws uuid, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_ws IS NOT NULL AND p_user IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = p_ws AND wm.user_id = p_user AND wm.status = 'active') $$;
REVOKE ALL ON FUNCTION public.deal_delivery_is_active_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_delivery_is_active_member(uuid, uuid) TO authenticated, service_role;

-- Espelha a política de leitura de projects (workspace ativo + permissões).
CREATE OR REPLACE FUNCTION public.project_visible_to_current_user(_project uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.projects p
     WHERE p.id = _project
       AND p.workspace_id IN (SELECT public.current_user_workspaces())
       AND public.deal_delivery_is_active_member(p.workspace_id, auth.uid())
       AND (p.owner_id = auth.uid() OR public.is_workspace_admin_v2(p.workspace_id, auth.uid())
            OR public.user_has_permission(auth.uid(), p.workspace_id, 'techprojects.projects.view.workspace')
            OR public.user_has_permission(auth.uid(), p.workspace_id, 'techprojects.projects.view.own'))) $$;
REVOKE ALL ON FUNCTION public.project_visible_to_current_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_visible_to_current_user(uuid) TO authenticated, service_role;

-- Espelha a política de edição de projects.
CREATE OR REPLACE FUNCTION public.project_editable_by_current_user(_project uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.project_visible_to_current_user(_project) AND EXISTS (
    SELECT 1 FROM public.projects p
     WHERE p.id = _project
       AND (public.is_workspace_admin_v2(p.workspace_id, auth.uid())
            OR public.user_has_permission(auth.uid(), p.workspace_id, 'techprojects.projects.update.workspace')
            OR (p.owner_id = auth.uid() AND public.user_has_permission(auth.uid(), p.workspace_id, 'techprojects.projects.update.own')))) $$;
REVOKE ALL ON FUNCTION public.project_editable_by_current_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_editable_by_current_user(uuid) TO authenticated, service_role;

-- Espelha a política de edição de deals (escopo comercial + restrição de representante).
CREATE OR REPLACE FUNCTION public.deal_delivery_can_edit_deal(_deal uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.deal_visible_to_current_user(_deal) AND EXISTS (
    SELECT 1 FROM public.deals d
     WHERE d.id = _deal
       AND d.workspace_id IN (SELECT public.current_user_workspaces())
       AND (public.user_has_permission(auth.uid(), d.workspace_id, 'techsales.deals.update.workspace')
            OR public.user_has_permission(auth.uid(), d.workspace_id, 'techsales.deals.update.team')
            OR (public.user_has_permission(auth.uid(), d.workspace_id, 'techsales.deals.update.own')
                AND public.is_own_record(d.owner_id, d.assigned_to)))) $$;
REVOKE ALL ON FUNCTION public.deal_delivery_can_edit_deal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_delivery_can_edit_deal(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.deal_delivery_can_create_project(_ws uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
     AND _ws IN (SELECT public.current_user_workspaces())
     AND public.deal_delivery_is_active_member(_ws, auth.uid())
     AND (public.is_workspace_admin_v2(_ws, auth.uid())
          OR public.user_has_permission(auth.uid(), _ws, 'techprojects.projects.create.own')
          OR public.user_has_permission(auth.uid(), _ws, 'techprojects.projects.create.workspace')) $$;
REVOKE ALL ON FUNCTION public.deal_delivery_can_create_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_delivery_can_create_project(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.deal_delivery_assert_user(p_ws uuid, p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR p_ws IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.current_user_workspaces() w(id) WHERE w.id = p_ws)
     OR NOT public.deal_delivery_is_active_member(p_ws, auth.uid()) THEN
    RAISE EXCEPTION 'Sem acesso a este workspace.' USING ERRCODE = '42501';
  END IF;
  IF p_write AND public.is_read_only_view() THEN
    RAISE EXCEPTION 'O modo Ver como é somente leitura.' USING ERRCODE = '42501';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_assert_user(uuid, boolean) FROM PUBLIC, anon;

-- ------------------------------------------------------------------ 9. RLS (leitura; gravação só pelas funções)
CREATE POLICY project_deal_links_read ON public.project_deal_links FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND (public.deal_visible_to_current_user(deal_id) OR public.project_visible_to_current_user(project_id)));
CREATE POLICY deal_delivery_policies_read ON public.deal_delivery_policies FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND public.is_active_workspace_admin(workspace_id, auth.uid()));
CREATE POLICY deal_delivery_items_read ON public.deal_delivery_items FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()) AND public.deal_visible_to_current_user(deal_id));
CREATE POLICY deal_delivery_jobs_read ON public.deal_delivery_jobs FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND (public.deal_visible_to_current_user(deal_id) OR public.is_active_workspace_admin(workspace_id, auth.uid())));
CREATE POLICY deal_delivery_events_read ON public.deal_delivery_events FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND (public.is_active_workspace_admin(workspace_id, auth.uid())
              OR (deal_id IS NOT NULL AND public.deal_visible_to_current_user(deal_id))
              OR (project_id IS NOT NULL AND public.project_visible_to_current_user(project_id))));

-- ------------------------------------------------------------------ 10. guardas de coerência
CREATE OR REPLACE FUNCTION public.projects_delivery_validate(
  p_ws uuid, p_deal uuid, p_group text, p_contact uuid, p_line uuid, p_contract uuid, p_company uuid, p_service uuid,
  p_chk_deal boolean, p_chk_contact boolean, p_chk_line boolean, p_chk_contract boolean, p_chk_service boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_contract_company uuid; v_service_contract uuid; v_line_deal uuid; v_ok boolean;
BEGIN
  IF p_chk_deal THEN
    IF NOT EXISTS (SELECT 1 FROM public.deals d WHERE d.id = p_deal AND d.workspace_id = p_ws) THEN
      RAISE EXCEPTION 'O negócio do projeto precisa ser do mesmo workspace.' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM public.project_deal_links l WHERE l.deal_id = p_deal AND l.delivery_group_key = p_group) THEN
      RAISE EXCEPTION 'Esta entrega do negócio já está ligada a outro projeto.' USING ERRCODE = '23505';
    END IF;
  END IF;
  IF p_chk_contact AND NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = p_contact AND c.workspace_id = p_ws) THEN
    RAISE EXCEPTION 'O contato do projeto precisa ser do mesmo workspace.' USING ERRCODE = '23514';
  END IF;
  IF p_chk_line THEN
    SELECT li.deal_id INTO v_line_deal FROM public.deal_line_items li WHERE li.id = p_line AND li.workspace_id = p_ws;
    IF v_line_deal IS NULL OR v_line_deal IS DISTINCT FROM p_deal THEN
      RAISE EXCEPTION 'O item de origem precisa pertencer ao negócio do projeto.' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF p_chk_contract THEN
    SELECT true, c.counterparty_company_id INTO v_ok, v_contract_company
      FROM public.contracts c WHERE c.id = p_contract AND c.workspace_id = p_ws;
    IF v_ok IS NULL THEN
      RAISE EXCEPTION 'O contrato do projeto precisa ser do mesmo workspace.' USING ERRCODE = '23514';
    END IF;
    IF p_company IS NOT NULL AND v_contract_company IS NOT NULL AND v_contract_company <> p_company THEN
      RAISE EXCEPTION 'O contrato é de outra empresa: revise antes de vincular.' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF p_chk_service THEN
    SELECT true, s.contract_id INTO v_ok, v_service_contract FROM public.services s WHERE s.id = p_service AND s.workspace_id = p_ws;
    IF v_ok IS NULL THEN
      RAISE EXCEPTION 'O serviço do projeto precisa ser do mesmo workspace.' USING ERRCODE = '23514';
    END IF;
    IF p_contract IS NOT NULL AND v_service_contract IS DISTINCT FROM p_contract THEN
      RAISE EXCEPTION 'O serviço não pertence ao contrato do projeto.' USING ERRCODE = '23514';
    END IF;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.projects_delivery_validate(uuid, uuid, text, uuid, uuid, uuid, uuid, uuid, boolean, boolean, boolean, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.projects_delivery_validate(uuid, uuid, text, uuid, uuid, uuid, uuid, uuid, boolean, boolean, boolean, boolean, boolean) TO authenticated, service_role;

-- Invocador de propósito: `current_user` distingue gravação direta do navegador das funções de entrega.
CREATE OR REPLACE FUNCTION public.projects_delivery_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE c_deal boolean; c_contact boolean; c_line boolean; c_contract boolean; c_service boolean; v_link_change boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_link_change := NEW.deal_id IS NOT NULL OR NEW.delivery_group_key IS NOT NULL OR NEW.source_line_item_id IS NOT NULL
                     OR NEW.origin IN ('deal_auto','deal_manual','deal_history');
    c_deal := NEW.deal_id IS NOT NULL;
    c_contact := NEW.client_contact_id IS NOT NULL;
    c_line := NEW.source_line_item_id IS NOT NULL;
    c_contract := NEW.contract_id IS NOT NULL;
    c_service := NEW.service_id IS NOT NULL;
  ELSE
    v_link_change := NEW.deal_id IS DISTINCT FROM OLD.deal_id OR NEW.delivery_group_key IS DISTINCT FROM OLD.delivery_group_key
                     OR NEW.source_line_item_id IS DISTINCT FROM OLD.source_line_item_id OR NEW.origin IS DISTINCT FROM OLD.origin;
    c_deal := NEW.deal_id IS NOT NULL AND (NEW.deal_id IS DISTINCT FROM OLD.deal_id OR NEW.delivery_group_key IS DISTINCT FROM OLD.delivery_group_key);
    c_contact := NEW.client_contact_id IS NOT NULL AND NEW.client_contact_id IS DISTINCT FROM OLD.client_contact_id;
    c_line := NEW.source_line_item_id IS NOT NULL AND (NEW.source_line_item_id IS DISTINCT FROM OLD.source_line_item_id OR NEW.deal_id IS DISTINCT FROM OLD.deal_id);
    c_contract := NEW.contract_id IS NOT NULL AND (NEW.contract_id IS DISTINCT FROM OLD.contract_id OR NEW.company_id IS DISTINCT FROM OLD.company_id);
    c_service := NEW.service_id IS NOT NULL AND (NEW.service_id IS DISTINCT FROM OLD.service_id OR NEW.contract_id IS DISTINCT FROM OLD.contract_id);
  END IF;
  -- Vínculo com o negócio só pelas ações de entrega (funções do banco), nunca por gravação direta do navegador.
  IF v_link_change AND current_user IN ('authenticated','anon') THEN
    RAISE EXCEPTION 'Vínculo com negócio só pelas ações de entrega.' USING ERRCODE = '42501';
  END IF;
  IF c_deal OR c_contact OR c_line OR c_contract OR c_service THEN
    PERFORM public.projects_delivery_validate(NEW.workspace_id, NEW.deal_id, NEW.delivery_group_key, NEW.client_contact_id,
      NEW.source_line_item_id, NEW.contract_id, NEW.company_id, NEW.service_id, c_deal, c_contact, c_line, c_contract, c_service);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS projects_delivery_guard ON public.projects;
CREATE TRIGGER projects_delivery_guard BEFORE INSERT OR UPDATE OF deal_id, delivery_group_key, source_line_item_id,
  client_contact_id, contract_id, service_id, company_id, origin ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.projects_delivery_guard();

CREATE OR REPLACE FUNCTION public.project_deal_links_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws uuid; v_primary uuid;
BEGIN
  SELECT p.workspace_id, p.deal_id INTO v_ws, v_primary FROM public.projects p WHERE p.id = NEW.project_id;
  IF v_ws IS NULL OR v_ws <> NEW.workspace_id
     OR NOT EXISTS (SELECT 1 FROM public.deals d WHERE d.id = NEW.deal_id AND d.workspace_id = NEW.workspace_id) THEN
    RAISE EXCEPTION 'Projeto e negócio precisam ser do mesmo workspace.' USING ERRCODE = '23514';
  END IF;
  IF v_primary = NEW.deal_id THEN
    RAISE EXCEPTION 'Este negócio já é a origem principal do projeto.' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (SELECT 1 FROM public.projects p WHERE p.deal_id = NEW.deal_id AND p.delivery_group_key = NEW.delivery_group_key) THEN
    RAISE EXCEPTION 'Esta entrega do negócio já está ligada a outro projeto.' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER project_deal_links_guard BEFORE INSERT OR UPDATE ON public.project_deal_links
  FOR EACH ROW EXECUTE FUNCTION public.project_deal_links_guard();

-- ------------------------------------------------------------------ 11. núcleo: criar ou vincular a entrega do negócio
-- Única porta de criação. Trava por negócio + índices únicos: chamadas concorrentes nunca duplicam.
CREATE OR REPLACE FUNCTION public.deal_delivery_ensure_internal(
  p_deal uuid, p_origin text, p_creator uuid, p_audit_actor uuid, p_job uuid, p_operational_owner uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d record; pol record; g record;
  v_creator uuid; v_owner uuid; v_explicit boolean; v_company uuid; v_contact uuid;
  v_contracts uuid[]; v_contract uuid; v_role public.contract_role := 'provider';
  v_services uuid[]; v_service uuid; v_line uuid; v_hours numeric; v_recurring boolean; v_lines jsonb;
  v_proj uuid; v_name text; v_results jsonb := '[]'::jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('deal_delivery'), hashtext(p_deal::text));
  SELECT x.id, x.workspace_id, x.name, x.description, x.company_id, x.primary_contact_id, x.deleted_at
    INTO d FROM public.deals x WHERE x.id = p_deal;
  IF NOT FOUND OR d.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Negócio não encontrado ou excluído.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO pol FROM public.deal_delivery_policies WHERE workspace_id = d.workspace_id;
  v_creator := coalesce(p_creator, pol.project_creator_id);
  IF NOT public.deal_delivery_is_active_member(d.workspace_id, v_creator) THEN
    RAISE EXCEPTION 'O criador dos projetos não é membro ativo do workspace. Revise a política de entrega.' USING ERRCODE = '22023';
  END IF;
  v_owner := coalesce(p_operational_owner, pol.default_operational_owner_id);
  IF v_owner IS NOT NULL AND NOT public.deal_delivery_is_active_member(d.workspace_id, v_owner) THEN v_owner := NULL; END IF;

  v_explicit := coalesce(pol.allow_groups, true) AND EXISTS (
    SELECT 1 FROM public.deal_delivery_items i JOIN public.deal_line_items li ON li.id = i.line_item_id AND li.deal_id = p_deal
     WHERE i.deal_id = p_deal AND i.group_key <> 'none');
  SELECT c.id INTO v_company FROM public.companies c
   WHERE c.id = d.company_id AND c.workspace_id = d.workspace_id AND c.deleted_at IS NULL;
  SELECT c.id INTO v_contact FROM public.contacts c
   WHERE c.id = d.primary_contact_id AND c.workspace_id = d.workspace_id AND c.deleted_at IS NULL;
  -- Contrato só quando há exatamente um contrato principal coerente (mesmo workspace e mesma empresa); nunca "o primeiro".
  SELECT array_agg(c.id ORDER BY c.id) INTO v_contracts FROM public.contracts c
   WHERE c.deal_id = p_deal AND c.workspace_id = d.workspace_id AND c.document_kind <> 'amendment'
     AND (c.counterparty_company_id IS NULL OR v_company IS NULL OR c.counterparty_company_id = v_company);
  IF coalesce(cardinality(v_contracts), 0) = 1 THEN
    v_contract := v_contracts[1];
    SELECT c.role INTO v_role FROM public.contracts c WHERE c.id = v_contract;
  END IF;

  FOR g IN
    SELECT s.key, s.label, s.items FROM (
      SELECT i.group_key AS key, max(i.group_label) AS label,
             array_agg(li.id ORDER BY li.position, li.created_at) AS items
        FROM public.deal_delivery_items i JOIN public.deal_line_items li ON li.id = i.line_item_id AND li.deal_id = p_deal
       WHERE v_explicit AND i.deal_id = p_deal AND i.group_key <> 'none'
       GROUP BY i.group_key
      UNION ALL
      SELECT 'default', NULL::text,
             coalesce((SELECT array_agg(li.id ORDER BY li.position, li.created_at) FROM public.deal_line_items li
                        WHERE li.deal_id = p_deal
                          AND NOT EXISTS (SELECT 1 FROM public.deal_delivery_items i
                                           WHERE i.line_item_id = li.id AND i.group_key = 'none')), '{}'::uuid[])
       WHERE NOT v_explicit) s
    ORDER BY s.key
  LOOP
    v_proj := NULL;
    SELECT p.id INTO v_proj FROM public.projects p WHERE p.deal_id = p_deal AND p.delivery_group_key = g.key;
    IF v_proj IS NULL THEN
      SELECT l.project_id INTO v_proj FROM public.project_deal_links l WHERE l.deal_id = p_deal AND l.delivery_group_key = g.key;
    END IF;
    IF v_proj IS NOT NULL THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object('group', g.key, 'project_id', v_proj, 'action', 'existing'));
      CONTINUE;
    END IF;
    v_services := ARRAY(SELECT s.id FROM public.services s
                         WHERE v_contract IS NOT NULL AND s.contract_id = v_contract AND s.workspace_id = d.workspace_id
                           AND s.source_deal_line_item_id = ANY (g.items));
    v_service := CASE WHEN cardinality(v_services) = 1 THEN v_services[1] END;
    v_line := CASE WHEN cardinality(g.items) = 1 THEN g.items[1] END;
    SELECT sum(li.quantity) FILTER (WHERE li.unit = 'hour' AND li.cadence IS NULL),
           coalesce(bool_or(li.unit = 'hour' AND li.cadence IS NOT NULL), false),
           coalesce(jsonb_agg(jsonb_build_object('id', li.id, 'name', li.name, 'quantity', li.quantity, 'unit', li.unit,
                    'cadence', li.cadence, 'service_catalog_id', li.service_catalog_id) ORDER BY li.position, li.created_at), '[]'::jsonb)
      INTO v_hours, v_recurring, v_lines
      FROM public.deal_line_items li WHERE li.id = ANY (g.items);
    IF v_recurring THEN v_hours := NULL; END IF;
    v_name := left(d.name || CASE WHEN g.key <> 'default' THEN ' · ' || coalesce(nullif(btrim(g.label), ''), g.key) ELSE '' END, 200);

    INSERT INTO public.projects (workspace_id, owner_id, name, description, status, role, company_id, client_contact_id,
      contract_id, service_id, deal_id, delivery_group_key, source_line_item_id, origin, planned_hours, assigned_to, metadata)
    VALUES (d.workspace_id, v_creator, v_name, d.description, 'planning', v_role, v_company, v_contact,
      v_contract, v_service, p_deal, g.key, v_line,
      CASE p_origin WHEN 'manual' THEN 'deal_manual' WHEN 'history' THEN 'deal_history' ELSE 'deal_auto' END,
      v_hours, coalesce(v_owner, v_creator),
      jsonb_build_object('delivery', jsonb_build_object(
        'deal_id', p_deal, 'group_key', g.key, 'group_label', g.label, 'origin', p_origin, 'job_id', p_job,
        'line_items', v_lines, 'contracts_found', coalesce(cardinality(v_contracts), 0),
        'operational_owner_defined', v_owner IS NOT NULL, 'created_at', now())))
    RETURNING id INTO v_proj;
    -- Responsável operacional indefinido fica vazio (pendência visível); nunca herda o vendedor.
    IF v_owner IS NULL THEN
      UPDATE public.projects SET assigned_to = NULL WHERE id = v_proj;
    END IF;
    INSERT INTO public.deal_delivery_events (workspace_id, deal_id, project_id, kind, origin, actor, job_id, after)
    VALUES (d.workspace_id, p_deal, v_proj, 'project_created', p_origin, p_audit_actor, p_job,
            jsonb_build_object('deal_id', p_deal, 'group_key', g.key, 'company_id', v_company, 'contract_id', v_contract,
                               'service_id', v_service, 'source_line_item_id', v_line));
    v_results := v_results || jsonb_build_array(jsonb_build_object('group', g.key, 'project_id', v_proj, 'action', 'created'));
  END LOOP;
  RETURN jsonb_build_object('deal_id', p_deal, 'results', v_results);
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_ensure_internal(uuid, text, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Um evento da fila: confere workspace/política/etapa do negócio provado pelo evento e chama o núcleo.
CREATE OR REPLACE FUNCTION public.deal_delivery_process_job(p_job uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j record; d record; pol record;
BEGIN
  SELECT * INTO j FROM public.deal_delivery_jobs WHERE id = p_job;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento não encontrado.'; END IF;
  SELECT x.id, x.workspace_id, x.deleted_at, x.pipeline_id, x.stage_id, x.stage::text AS stage
    INTO d FROM public.deals x WHERE x.id = j.deal_id;
  IF NOT FOUND OR d.workspace_id <> j.workspace_id THEN
    RAISE EXCEPTION 'O negócio do evento não pertence ao workspace do evento.';
  END IF;
  IF d.deleted_at IS NOT NULL THEN RETURN jsonb_build_object('job_status', 'skipped', 'reason', 'deal_deleted'); END IF;
  SELECT * INTO pol FROM public.deal_delivery_policies WHERE workspace_id = j.workspace_id;
  IF NOT FOUND OR NOT pol.enabled THEN RETURN jsonb_build_object('job_status', 'skipped', 'reason', 'policy_disabled'); END IF;
  IF public.deal_stage_type(d.pipeline_id, d.stage_id, d.stage) <> 'won' THEN
    RETURN jsonb_build_object('job_status', 'skipped', 'reason', 'not_won');
  END IF;
  RETURN public.deal_delivery_ensure_internal(j.deal_id, j.origin, NULL, j.actor, j.id)
         || jsonb_build_object('job_status', 'done');
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_process_job(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Uma tentativa com lease; erro vira falha com backoff e pendência visível; a venda nunca é desfeita.
CREATE OR REPLACE FUNCTION public.deal_delivery_attempt(p_job uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j record; v_res jsonb; v_msg text; v_att int; v_max int;
BEGIN
  SELECT * INTO j FROM public.deal_delivery_jobs WHERE id = p_job FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN jsonb_build_object('job_status', 'locked', 'job_id', p_job); END IF;
  IF j.status NOT IN ('pending','failed','running') THEN
    RETURN jsonb_build_object('job_status', j.status, 'job_id', p_job, 'result', j.result);
  END IF;
  IF j.status = 'running' AND j.lease_until > now() THEN RETURN jsonb_build_object('job_status', 'leased', 'job_id', p_job); END IF;
  UPDATE public.deal_delivery_jobs
     SET status = 'running', attempts = attempts + 1, lease_until = now() + interval '5 minutes',
         lease_token = gen_random_uuid(), updated_at = now()
   WHERE id = p_job RETURNING attempts, max_attempts INTO v_att, v_max;
  BEGIN
    v_res := public.deal_delivery_process_job(p_job);
    UPDATE public.deal_delivery_jobs
       SET status = v_res->>'job_status', skip_reason = v_res->>'reason', result = v_res, last_error = NULL,
           lease_until = NULL, lease_token = NULL, finished_at = now(), updated_at = now()
     WHERE id = p_job;
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    UPDATE public.deal_delivery_jobs
       SET status = 'failed', last_error = left(v_msg, 500), lease_until = NULL, lease_token = NULL, updated_at = now(),
           next_run_at = now() + least(interval '6 hours', interval '1 minute' * power(2, v_att))
     WHERE id = p_job;
    IF v_att = 1 OR v_att >= v_max THEN
      INSERT INTO public.deal_delivery_events (workspace_id, deal_id, kind, origin, job_id, note, needs_review)
      VALUES (j.workspace_id, j.deal_id, 'job_failed', j.origin, p_job, left(v_msg, 500), v_att >= v_max);
    END IF;
    v_res := jsonb_build_object('job_status', 'failed', 'error', left(v_msg, 500));
  END;
  RETURN v_res || jsonb_build_object('job_id', p_job);
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_attempt(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Agendador (pg_cron no próprio banco): processa eventos vencidos, inclusive leases expirados.
CREATE OR REPLACE FUNCTION public.deal_delivery_run_jobs(p_limit integer DEFAULT 25)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET statement_timeout = '110s' AS $$
DECLARE r record; v jsonb; n int := 0; n_done int := 0; n_failed int := 0; n_skipped int := 0;
BEGIN
  IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501'; END IF;
  FOR r IN
    SELECT id FROM public.deal_delivery_jobs
     WHERE ((status IN ('pending','failed') AND attempts < max_attempts) OR (status = 'running' AND lease_until < now()))
       AND next_run_at <= now()
     ORDER BY next_run_at, created_at
     LIMIT least(greatest(coalesce(p_limit, 25), 1), 200)
  LOOP
    v := public.deal_delivery_attempt(r.id);
    n := n + 1;
    CASE v->>'job_status' WHEN 'done' THEN n_done := n_done + 1; WHEN 'failed' THEN n_failed := n_failed + 1;
      WHEN 'skipped' THEN n_skipped := n_skipped + 1; ELSE NULL; END CASE;
  END LOOP;
  INSERT INTO public.deal_delivery_worker_state (id, last_run_at, last_processed, last_work_at, runs)
  VALUES (1, now(), n, CASE WHEN n > 0 THEN now() END, 1)
  ON CONFLICT (id) DO UPDATE SET last_run_at = now(), last_processed = n, runs = deal_delivery_worker_state.runs + 1,
    last_work_at = CASE WHEN n > 0 THEN now() ELSE deal_delivery_worker_state.last_work_at END;
  RETURN jsonb_build_object('processed', n, 'done', n_done, 'failed', n_failed, 'skipped', n_skipped);
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_run_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deal_delivery_run_jobs(integer) TO service_role;

-- Ação de workflow: o motor envia o workspace do run; o banco confere que o negócio é desse workspace.
CREATE OR REPLACE FUNCTION public.deal_delivery_workflow_ensure(p_deal uuid, p_workspace uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d record; pol record; v_job uuid;
BEGIN
  IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501'; END IF;
  SELECT x.id, x.workspace_id, x.deleted_at, x.pipeline_id, x.stage_id, x.stage::text AS stage
    INTO d FROM public.deals x WHERE x.id = p_deal;
  IF NOT FOUND OR d.workspace_id IS DISTINCT FROM p_workspace OR d.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'O negócio não pertence ao workspace do fluxo.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO pol FROM public.deal_delivery_policies WHERE workspace_id = p_workspace;
  IF NOT FOUND OR NOT pol.enabled THEN RETURN jsonb_build_object('job_status', 'skipped', 'reason', 'policy_disabled'); END IF;
  IF NOT coalesce((pol.origins->>'workflow')::boolean, false) THEN
    RETURN jsonb_build_object('job_status', 'skipped', 'reason', 'origin_workflow');
  END IF;
  IF public.deal_stage_type(d.pipeline_id, d.stage_id, d.stage) <> 'won' THEN
    RETURN jsonb_build_object('job_status', 'skipped', 'reason', 'not_won');
  END IF;
  INSERT INTO public.deal_delivery_jobs (workspace_id, deal_id, transition_key, origin)
  VALUES (p_workspace, p_deal, 'workflow:' || txid_current()::text, 'workflow')
  ON CONFLICT DO NOTHING RETURNING id INTO v_job;
  IF v_job IS NULL THEN
    SELECT id INTO v_job FROM public.deal_delivery_jobs
     WHERE deal_id = p_deal AND status IN ('pending','running','failed') ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF v_job IS NULL THEN RETURN jsonb_build_object('job_status', 'locked'); END IF;
  RETURN public.deal_delivery_attempt(v_job);
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_workflow_ensure(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deal_delivery_workflow_ensure(uuid, uuid) TO service_role;

-- ------------------------------------------------------------------ 12. transição persistente no próprio negócio
CREATE OR REPLACE FUNCTION public.deal_delivery_write_origin(p_import_hint boolean)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v text;
BEGIN
  IF auth.uid() IS NOT NULL AND coalesce(auth.role(), '') = 'authenticated' THEN RETURN 'user'; END IF;
  v := nullif(current_setting('app.deal_origin', true), '');
  IF v IS NULL THEN
    BEGIN
      v := nullif(current_setting('request.headers', true), '')::jsonb->>'x-techerp-origin';
    EXCEPTION WHEN others THEN v := NULL;
    END;
  END IF;
  IF v IN ('import','workflow','system') THEN RETURN v; END IF;
  IF v = 'api' THEN RETURN 'system'; END IF;
  IF p_import_hint THEN RETURN 'import'; END IF;
  RETURN 'system';
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_write_origin(boolean) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.deal_delivery_on_deal_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new text; v_old text; pol record; v_origin text; v_status text; v_reason text; v_import boolean; v_links boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.stage IS NOT DISTINCT FROM OLD.stage AND NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id
       AND NEW.pipeline_id IS NOT DISTINCT FROM OLD.pipeline_id AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at
       AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id THEN
      RETURN NULL;
    END IF;
  END IF;
  -- Registros do papel de teste (Ver como) nunca geram entrega.
  IF public.is_test_record(NEW.id) THEN RETURN NULL; END IF;
  v_new := CASE WHEN NEW.deleted_at IS NULL THEN public.deal_stage_type(NEW.pipeline_id, NEW.stage_id, NEW.stage::text) ELSE 'deleted' END;
  IF TG_OP = 'UPDATE' THEN
    v_old := CASE WHEN OLD.deleted_at IS NULL THEN public.deal_stage_type(OLD.pipeline_id, OLD.stage_id, OLD.stage::text) ELSE 'deleted' END;
  END IF;

  IF v_new = 'won' AND v_old IS DISTINCT FROM 'won' THEN
    SELECT * INTO pol FROM public.deal_delivery_policies
     WHERE workspace_id = NEW.workspace_id AND enabled AND activated_at IS NOT NULL;
    IF FOUND THEN
      IF TG_OP = 'INSERT' THEN
        v_import := NEW.hs_object_id IS NOT NULL OR NEW.hs_raw IS NOT NULL;
      ELSE
        v_import := NEW.hs_raw IS DISTINCT FROM OLD.hs_raw;
      END IF;
      v_origin := public.deal_delivery_write_origin(v_import);
      v_status := 'pending';
      IF (TG_OP = 'INSERT' OR v_origin = 'import') AND NEW.closed_at IS NOT NULL AND NEW.closed_at < pol.activated_at THEN
        v_status := 'skipped'; v_reason := 'closed_before_activation';
      ELSIF NOT coalesce((pol.origins->>v_origin)::boolean, false) THEN
        v_status := 'skipped'; v_reason := 'origin_' || v_origin;
      END IF;
      INSERT INTO public.deal_delivery_jobs (workspace_id, deal_id, transition_key, origin, status, skip_reason, actor, finished_at)
      VALUES (NEW.workspace_id, NEW.id, 'won:' || txid_current()::text, v_origin, v_status, v_reason, auth.uid(),
              CASE WHEN v_status = 'skipped' THEN now() END)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_links := EXISTS (SELECT 1 FROM public.projects p WHERE p.deal_id = NEW.id)
            OR EXISTS (SELECT 1 FROM public.project_deal_links l WHERE l.deal_id = NEW.id);
    IF v_old = 'won' AND v_new <> 'won' THEN
      UPDATE public.deal_delivery_jobs SET status = 'cancelled', skip_reason = 'deal_left_won', finished_at = now(), updated_at = now()
       WHERE deal_id = NEW.id AND status IN ('pending','failed');
      IF v_links AND NOT EXISTS (SELECT 1 FROM public.deal_delivery_events e WHERE e.deal_id = NEW.id
                                    AND e.kind = 'review_deal_left_won' AND e.resolved_at IS NULL) THEN
        INSERT INTO public.deal_delivery_events (workspace_id, deal_id, kind, actor, before, after, needs_review)
        VALUES (NEW.workspace_id, NEW.id, 'review_deal_left_won', auth.uid(), jsonb_build_object('stage_type', v_old),
                jsonb_build_object('stage_type', v_new, 'stage', NEW.stage, 'stage_id', NEW.stage_id), true);
      END IF;
    END IF;
    IF NEW.company_id IS DISTINCT FROM OLD.company_id AND v_links THEN
      INSERT INTO public.deal_delivery_events (workspace_id, deal_id, kind, actor, before, after, needs_review)
      VALUES (NEW.workspace_id, NEW.id, 'review_company_changed', auth.uid(),
              jsonb_build_object('company_id', OLD.company_id), jsonb_build_object('company_id', NEW.company_id), true);
    END IF;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS zz_deal_delivery_transition ON public.deals;
CREATE TRIGGER zz_deal_delivery_transition AFTER INSERT OR UPDATE OF stage, stage_id, pipeline_id, deleted_at, company_id
  ON public.deals FOR EACH ROW EXECUTE FUNCTION public.deal_delivery_on_deal_change();

-- ------------------------------------------------------------------ 13. vínculo manual (núcleo compartilhado com o histórico)
CREATE OR REPLACE FUNCTION public.deal_delivery_link_core(
  p_deal uuid, p_project uuid, p_group text, p_actor uuid, p_kind text, p_batch uuid, p_evidence jsonb, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d record; p record; v_mode text; v_link uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('deal_delivery'), hashtext(p_deal::text));
  SELECT x.id, x.workspace_id, x.company_id, x.deleted_at INTO d FROM public.deals x WHERE x.id = p_deal;
  SELECT x.id, x.workspace_id, x.deal_id, x.delivery_group_key, x.company_id INTO p FROM public.projects x WHERE x.id = p_project FOR UPDATE;
  IF d.id IS NULL OR d.deleted_at IS NOT NULL OR p.id IS NULL OR d.workspace_id <> p.workspace_id THEN
    RAISE EXCEPTION 'Negócio e projeto precisam existir no mesmo workspace.' USING ERRCODE = '23514';
  END IF;
  IF coalesce(p_group, '') !~ '^[a-z0-9][a-z0-9_-]{0,39}$' THEN
    RAISE EXCEPTION 'Grupo de entrega inválido.' USING ERRCODE = '22023';
  END IF;
  IF p.deal_id = p_deal OR EXISTS (SELECT 1 FROM public.project_deal_links l WHERE l.project_id = p_project AND l.deal_id = p_deal) THEN
    RAISE EXCEPTION 'Este projeto já está ligado a este negócio.' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (SELECT 1 FROM public.projects x WHERE x.deal_id = p_deal AND x.delivery_group_key = p_group)
     OR EXISTS (SELECT 1 FROM public.project_deal_links l WHERE l.deal_id = p_deal AND l.delivery_group_key = p_group) THEN
    RAISE EXCEPTION 'Esta entrega do negócio já tem projeto ligado.' USING ERRCODE = '23505';
  END IF;
  IF p.deal_id IS NULL THEN
    v_mode := 'primary';
    UPDATE public.projects SET deal_id = p_deal, delivery_group_key = p_group WHERE id = p_project;
  ELSE
    v_mode := 'consolidated';
    INSERT INTO public.project_deal_links (workspace_id, project_id, deal_id, delivery_group_key, note, created_by)
    VALUES (d.workspace_id, p_project, p_deal, p_group, p_note, p_actor) RETURNING id INTO v_link;
  END IF;
  INSERT INTO public.deal_delivery_events (workspace_id, deal_id, project_id, kind, actor, batch_id, before, after, note)
  VALUES (d.workspace_id, p_deal, p_project, p_kind, p_actor, p_batch,
          jsonb_build_object('project_deal_id', p.deal_id, 'project_group_key', p.delivery_group_key),
          jsonb_build_object('mode', v_mode, 'deal_id', p_deal, 'group_key', p_group, 'link_id', v_link)
            || coalesce(jsonb_build_object('evidence', p_evidence), '{}'::jsonb), p_note);
  IF p.company_id IS NOT NULL AND d.company_id IS NOT NULL AND p.company_id <> d.company_id THEN
    INSERT INTO public.deal_delivery_events (workspace_id, deal_id, project_id, kind, actor, batch_id, before, after, note, needs_review)
    VALUES (d.workspace_id, p_deal, p_project, 'review_link_conflict', p_actor, p_batch,
            jsonb_build_object('project_company_id', p.company_id), jsonb_build_object('deal_company_id', d.company_id), p_note, true);
  END IF;
  RETURN jsonb_build_object('mode', v_mode, 'project_id', p_project, 'deal_id', p_deal, 'group_key', p_group);
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_link_core(uuid, uuid, text, uuid, text, uuid, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;

-- ------------------------------------------------------------------ 14. ações do usuário (autorização por origem e destino)
CREATE OR REPLACE FUNCTION public.deal_delivery_ws_of_deal(p_deal uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT workspace_id FROM public.deals WHERE id = p_deal $$;
REVOKE ALL ON FUNCTION public.deal_delivery_ws_of_deal(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.deal_delivery_create_project(p_deal uuid, p_operational_owner uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws uuid := public.deal_delivery_ws_of_deal(p_deal); d record;
BEGIN
  PERFORM public.deal_delivery_assert_user(v_ws, true);
  IF NOT public.deal_visible_to_current_user(p_deal) THEN RAISE EXCEPTION 'Negócio sem acesso.' USING ERRCODE = '42501'; END IF;
  IF NOT public.deal_delivery_can_create_project(v_ws) THEN
    RAISE EXCEPTION 'Você não tem permissão para criar projetos.' USING ERRCODE = '42501';
  END IF;
  SELECT x.pipeline_id, x.stage_id, x.stage::text AS stage INTO d FROM public.deals x WHERE x.id = p_deal;
  IF public.deal_stage_type(d.pipeline_id, d.stage_id, d.stage) <> 'won' THEN
    RAISE EXCEPTION 'Só negócios ganhos criam projeto de entrega; para negócios abertos, vincule um projeto existente.' USING ERRCODE = '22023';
  END IF;
  IF p_operational_owner IS NOT NULL AND NOT public.deal_delivery_is_active_member(v_ws, p_operational_owner) THEN
    RAISE EXCEPTION 'O responsável operacional precisa ser membro ativo.' USING ERRCODE = '22023';
  END IF;
  RETURN public.deal_delivery_ensure_internal(p_deal, 'manual', auth.uid(), auth.uid(), NULL, p_operational_owner);
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_create_project(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_delivery_create_project(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.deal_delivery_link_project(p_deal uuid, p_project uuid, p_group text DEFAULT 'default', p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws uuid := public.deal_delivery_ws_of_deal(p_deal); v_pc uuid; v_dc uuid;
BEGIN
  PERFORM public.deal_delivery_assert_user(v_ws, true);
  IF NOT public.deal_delivery_can_edit_deal(p_deal) THEN RAISE EXCEPTION 'Você não pode editar este negócio.' USING ERRCODE = '42501'; END IF;
  IF NOT public.project_editable_by_current_user(p_project) THEN RAISE EXCEPTION 'Você não pode editar este projeto.' USING ERRCODE = '42501'; END IF;
  SELECT company_id INTO v_pc FROM public.projects WHERE id = p_project;
  SELECT company_id INTO v_dc FROM public.deals WHERE id = p_deal;
  IF v_pc IS NOT NULL AND v_dc IS NOT NULL AND v_pc <> v_dc AND length(btrim(coalesce(p_note, ''))) < 5 THEN
    RAISE EXCEPTION 'O projeto é de outra empresa: informe uma justificativa para vincular (ficará em revisão).' USING ERRCODE = '22023';
  END IF;
  RETURN public.deal_delivery_link_core(p_deal, p_project, coalesce(nullif(p_group, ''), 'default'), auth.uid(),
                                        'project_linked', NULL, NULL, nullif(btrim(coalesce(p_note, '')), ''));
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_link_project(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_delivery_link_project(uuid, uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.deal_delivery_unlink_project(p_deal uuid, p_project uuid, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws uuid := public.deal_delivery_ws_of_deal(p_deal); p record; v_mode text;
BEGIN
  PERFORM public.deal_delivery_assert_user(v_ws, true);
  IF length(btrim(coalesce(p_note, ''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo para desvincular.' USING ERRCODE = '22023'; END IF;
  IF NOT public.deal_delivery_can_edit_deal(p_deal) THEN RAISE EXCEPTION 'Você não pode editar este negócio.' USING ERRCODE = '42501'; END IF;
  IF NOT public.project_editable_by_current_user(p_project) THEN RAISE EXCEPTION 'Você não pode editar este projeto.' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('deal_delivery'), hashtext(p_deal::text));
  SELECT id, deal_id, delivery_group_key, source_line_item_id INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.deal_id = p_deal THEN
    v_mode := 'primary';
    UPDATE public.projects SET deal_id = NULL, delivery_group_key = NULL, source_line_item_id = NULL WHERE id = p_project;
  ELSIF EXISTS (SELECT 1 FROM public.project_deal_links WHERE project_id = p_project AND deal_id = p_deal) THEN
    v_mode := 'consolidated';
    DELETE FROM public.project_deal_links WHERE project_id = p_project AND deal_id = p_deal;
  ELSE
    RAISE EXCEPTION 'Este projeto não está ligado a este negócio.' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.deal_delivery_events (workspace_id, deal_id, project_id, kind, actor, before, after, note)
  VALUES (v_ws, p_deal, p_project, 'project_unlinked', auth.uid(),
          jsonb_build_object('mode', v_mode, 'group_key', p.delivery_group_key, 'source_line_item_id', p.source_line_item_id),
          '{}'::jsonb, btrim(p_note));
  RETURN jsonb_build_object('mode', v_mode);
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_unlink_project(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_delivery_unlink_project(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.deal_delivery_set_groups(p_deal uuid, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws uuid := public.deal_delivery_ws_of_deal(p_deal); v_before jsonb; v_after jsonb; r record; n int := 0;
BEGIN
  PERFORM public.deal_delivery_assert_user(v_ws, true);
  IF NOT public.deal_delivery_can_edit_deal(p_deal) THEN RAISE EXCEPTION 'Você não pode editar este negócio.' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) > 500 THEN RAISE EXCEPTION 'Lista de itens inválida.' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('deal_delivery'), hashtext(p_deal::text));
  SELECT coalesce(jsonb_agg(jsonb_build_object('line_item_id', line_item_id, 'group_key', group_key, 'group_label', group_label) ORDER BY line_item_id), '[]')
    INTO v_before FROM public.deal_delivery_items WHERE deal_id = p_deal;
  FOR r IN SELECT (e->>'line_item_id')::uuid AS li, nullif(btrim(e->>'group_key'), '') AS gk, nullif(btrim(e->>'group_label'), '') AS gl
             FROM jsonb_array_elements(p_items) e
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.deal_line_items li WHERE li.id = r.li AND li.deal_id = p_deal AND li.workspace_id = v_ws) THEN
      RAISE EXCEPTION 'Item não pertence a este negócio.' USING ERRCODE = '22023';
    END IF;
    IF r.gk IS NULL OR r.gk = 'default' THEN
      DELETE FROM public.deal_delivery_items WHERE line_item_id = r.li;
    ELSE
      IF r.gk !~ '^[a-z0-9][a-z0-9_-]{0,39}$' THEN RAISE EXCEPTION 'Grupo de entrega inválido: %', r.gk USING ERRCODE = '22023'; END IF;
      INSERT INTO public.deal_delivery_items (line_item_id, workspace_id, deal_id, group_key, group_label, updated_by, updated_at)
      VALUES (r.li, v_ws, p_deal, r.gk, left(r.gl, 120), auth.uid(), now())
      ON CONFLICT (line_item_id) DO UPDATE SET group_key = EXCLUDED.group_key, group_label = EXCLUDED.group_label,
        updated_by = EXCLUDED.updated_by, updated_at = now();
    END IF;
    n := n + 1;
  END LOOP;
  SELECT coalesce(jsonb_agg(jsonb_build_object('line_item_id', line_item_id, 'group_key', group_key, 'group_label', group_label) ORDER BY line_item_id), '[]')
    INTO v_after FROM public.deal_delivery_items WHERE deal_id = p_deal;
  IF v_before IS DISTINCT FROM v_after THEN
    INSERT INTO public.deal_delivery_events (workspace_id, deal_id, kind, actor, before, after)
    VALUES (v_ws, p_deal, 'groups_changed', auth.uid(), jsonb_build_object('items', v_before), jsonb_build_object('items', v_after));
  END IF;
  RETURN jsonb_build_object('items', n);
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_set_groups(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_delivery_set_groups(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.deal_delivery_retry(p_deal uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws uuid := public.deal_delivery_ws_of_deal(p_deal); v_job uuid;
BEGIN
  PERFORM public.deal_delivery_assert_user(v_ws, true);
  IF NOT public.deal_visible_to_current_user(p_deal) THEN RAISE EXCEPTION 'Negócio sem acesso.' USING ERRCODE = '42501'; END IF;
  SELECT id INTO v_job FROM public.deal_delivery_jobs
   WHERE deal_id = p_deal AND (status IN ('pending','failed') OR (status = 'running' AND lease_until < now()))
   ORDER BY created_at DESC LIMIT 1;
  IF v_job IS NULL THEN RAISE EXCEPTION 'Não há preparação pendente ou com falha para este negócio.' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.deal_delivery_jobs SET next_run_at = now(), attempts = least(attempts, max_attempts - 1), actor = auth.uid(), updated_at = now()
   WHERE id = v_job;
  RETURN public.deal_delivery_attempt(v_job);
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_retry(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_delivery_retry(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.deal_delivery_set_operational_owner(p_project uuid, p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  SELECT id, workspace_id, assigned_to, deal_id INTO p FROM public.projects WHERE id = p_project;
  PERFORM public.deal_delivery_assert_user(p.workspace_id, true);
  IF NOT public.project_editable_by_current_user(p_project) THEN RAISE EXCEPTION 'Você não pode editar este projeto.' USING ERRCODE = '42501'; END IF;
  IF p_user IS NOT NULL AND NOT public.deal_delivery_is_active_member(p.workspace_id, p_user) THEN
    RAISE EXCEPTION 'O responsável precisa ser membro ativo do workspace.' USING ERRCODE = '22023';
  END IF;
  -- Só o responsável do registro; nenhuma permissão, membership ou papel é concedido.
  UPDATE public.projects SET assigned_to = p_user WHERE id = p_project;
  INSERT INTO public.deal_delivery_events (workspace_id, deal_id, project_id, kind, actor, before, after)
  VALUES (p.workspace_id, p.deal_id, p_project, 'owner_changed', auth.uid(),
          jsonb_build_object('assigned_to', p.assigned_to), jsonb_build_object('assigned_to', p_user));
  RETURN jsonb_build_object('assigned_to', p_user);
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_set_operational_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_delivery_set_operational_owner(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.deal_delivery_resolve_review(p_event uuid, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record;
BEGIN
  SELECT * INTO e FROM public.deal_delivery_events WHERE id = p_event;
  IF NOT FOUND OR NOT e.needs_review OR e.resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Revisão não encontrada ou já resolvida.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.deal_delivery_assert_user(e.workspace_id, true);
  IF length(btrim(coalesce(p_note, ''))) < 5 THEN RAISE EXCEPTION 'Descreva a decisão da revisão.' USING ERRCODE = '22023'; END IF;
  IF NOT (public.is_active_workspace_admin(e.workspace_id, auth.uid())
          OR (e.deal_id IS NOT NULL AND public.deal_delivery_can_edit_deal(e.deal_id))
          OR (e.project_id IS NOT NULL AND public.project_editable_by_current_user(e.project_id))) THEN
    RAISE EXCEPTION 'Sem permissão para resolver esta revisão.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.deal_delivery_events SET resolved_at = now(), resolved_by = auth.uid(), resolution_note = btrim(p_note) WHERE id = p_event;
  RETURN jsonb_build_object('resolved', true);
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_resolve_review(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_delivery_resolve_review(uuid, text) TO authenticated;

-- ------------------------------------------------------------------ 15. leituras seguras (sem valor/custo do negócio)
CREATE OR REPLACE FUNCTION public.deal_delivery_overview(p_deal uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d record; pol record; v_type text; v_explicit boolean; v_ws uuid; v_ro boolean;
  v_contracts int; v_bad_contracts int; v_projects jsonb; v_items jsonb; v_job jsonb; v_reviews jsonb;
  v_pending jsonb := '[]'::jsonb; v_unassigned int; v_has_any boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.deal_visible_to_current_user(p_deal) THEN
    RAISE EXCEPTION 'Negócio não encontrado ou sem acesso.' USING ERRCODE = '42501';
  END IF;
  SELECT x.id, x.workspace_id, x.company_id, x.pipeline_id, x.stage_id, x.stage::text AS stage, x.closed_at
    INTO d FROM public.deals x WHERE x.id = p_deal;
  v_ws := d.workspace_id;
  v_ro := public.is_read_only_view();
  v_type := public.deal_stage_type(d.pipeline_id, d.stage_id, d.stage);
  SELECT enabled, activated_at, allow_groups, origins INTO pol FROM public.deal_delivery_policies WHERE workspace_id = v_ws;
  v_explicit := coalesce(pol.allow_groups, true) AND EXISTS (SELECT 1 FROM public.deal_delivery_items i WHERE i.deal_id = p_deal AND i.group_key <> 'none');
  SELECT count(*) FILTER (WHERE c.counterparty_company_id IS NULL OR d.company_id IS NULL OR c.counterparty_company_id = d.company_id),
         count(*) FILTER (WHERE c.counterparty_company_id IS NOT NULL AND d.company_id IS NOT NULL AND c.counterparty_company_id <> d.company_id)
    INTO v_contracts, v_bad_contracts
    FROM public.contracts c WHERE c.deal_id = p_deal AND c.workspace_id = v_ws AND c.document_kind <> 'amendment';

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', li.id, 'name', li.name, 'quantity', li.quantity, 'unit', li.unit,
           'cadence', li.cadence, 'group_key', i.group_key, 'group_label', i.group_label) ORDER BY li.position, li.created_at), '[]')
    INTO v_items FROM public.deal_line_items li LEFT JOIN public.deal_delivery_items i ON i.line_item_id = li.id
   WHERE li.deal_id = p_deal;
  SELECT count(*) INTO v_unassigned FROM public.deal_line_items li
   WHERE v_explicit AND li.deal_id = p_deal AND NOT EXISTS (SELECT 1 FROM public.deal_delivery_items i WHERE i.line_item_id = li.id);

  SELECT coalesce(jsonb_agg(x ORDER BY x->>'group_key', x->>'created_at'), '[]') INTO v_projects FROM (
    SELECT jsonb_build_object(
      'id', p.id, 'name', p.name, 'status', p.status, 'group_key', s.group_key, 'link', s.link, 'origin', p.origin,
      'created_at', p.created_at, 'visible', public.project_visible_to_current_user(p.id),
      'assigned_to', p.assigned_to, 'assigned_name', pr.full_name,
      'company_matches', (p.company_id IS NULL OR d.company_id IS NULL OR p.company_id = d.company_id),
      'has_company', p.company_id IS NOT NULL, 'has_contract', p.contract_id IS NOT NULL, 'has_service', p.service_id IS NOT NULL,
      'pending', to_jsonb(array_remove(ARRAY[
          CASE WHEN p.assigned_to IS NULL THEN 'no_operational_owner' END,
          CASE WHEN p.company_id IS NULL THEN 'project_without_company' END,
          CASE WHEN p.company_id IS NOT NULL AND d.company_id IS NOT NULL AND p.company_id <> d.company_id THEN 'company_mismatch' END,
          CASE WHEN p.planned_hours IS NULL THEN 'planned_hours_missing' END], NULL))) AS x
      FROM (SELECT pp.id, pp.delivery_group_key AS group_key, 'primary'::text AS link FROM public.projects pp WHERE pp.deal_id = p_deal
            UNION ALL
            SELECT l.project_id, l.delivery_group_key, 'consolidated' FROM public.project_deal_links l WHERE l.deal_id = p_deal) s
      JOIN public.projects p ON p.id = s.id
      LEFT JOIN public.profiles pr ON pr.id = p.assigned_to) q;
  v_has_any := jsonb_array_length(v_projects) > 0;

  SELECT to_jsonb(j) INTO v_job FROM (
    SELECT id, status, origin, attempts, max_attempts, last_error, skip_reason, next_run_at, created_at, finished_at
      FROM public.deal_delivery_jobs WHERE deal_id = p_deal ORDER BY created_at DESC LIMIT 1) j;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'created_at', e.created_at, 'project_id', e.project_id,
           'note', e.note) ORDER BY e.created_at DESC), '[]')
    INTO v_reviews FROM public.deal_delivery_events e WHERE e.deal_id = p_deal AND e.needs_review AND e.resolved_at IS NULL;

  IF d.company_id IS NULL THEN v_pending := v_pending || '"deal_without_company"'::jsonb; END IF;
  IF v_contracts = 0 THEN v_pending := v_pending || '"no_contract"'::jsonb; END IF;
  IF v_contracts > 1 THEN v_pending := v_pending || '"contract_ambiguous"'::jsonb; END IF;
  IF v_bad_contracts > 0 THEN v_pending := v_pending || '"contract_company_mismatch"'::jsonb; END IF;
  IF v_unassigned > 0 THEN v_pending := v_pending || '"items_without_group"'::jsonb; END IF;
  IF v_type = 'won' AND NOT v_has_any THEN
    v_pending := v_pending || CASE
      WHEN v_job IS NOT NULL AND v_job->>'status' = 'failed' THEN '"job_failed"'::jsonb
      WHEN v_job IS NOT NULL AND v_job->>'status' IN ('pending','running') THEN '"job_pending"'::jsonb
      WHEN v_job IS NOT NULL AND v_job->>'status' = 'skipped' THEN '"job_skipped"'::jsonb
      WHEN coalesce(pol.enabled, false) THEN '"won_without_project"'::jsonb
      ELSE '"policy_disabled"'::jsonb END;
  END IF;

  RETURN jsonb_build_object(
    'deal', jsonb_build_object('id', d.id, 'stage_type', v_type, 'closed_at', d.closed_at, 'has_company', d.company_id IS NOT NULL,
                               'contracts', v_contracts),
    'policy', jsonb_build_object('enabled', coalesce(pol.enabled, false), 'activated_at', pol.activated_at,
                                 'allow_groups', coalesce(pol.allow_groups, true)),
    'groups_explicit', v_explicit,
    'items', v_items, 'projects', v_projects, 'job', v_job, 'reviews', v_reviews, 'pending', v_pending,
    'can', jsonb_build_object(
      'create', NOT v_ro AND v_type = 'won' AND public.deal_delivery_can_create_project(v_ws),
      'link', NOT v_ro AND public.deal_delivery_can_edit_deal(p_deal),
      'groups', NOT v_ro AND public.deal_delivery_can_edit_deal(p_deal),
      'retry', NOT v_ro AND v_job IS NOT NULL AND v_job->>'status' IN ('failed','pending')));
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_delivery_overview(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_delivery_origin(p_project uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; v_deals jsonb; v_reviews jsonb; v_line jsonb; v_primary_visible boolean; v_deal_company uuid; v_seconds numeric;
BEGIN
  IF NOT public.project_visible_to_current_user(p_project) THEN
    RAISE EXCEPTION 'Projeto não encontrado ou sem acesso.' USING ERRCODE = '42501';
  END IF;
  SELECT x.* INTO p FROM public.projects x WHERE x.id = p_project;
  v_primary_visible := p.deal_id IS NOT NULL AND public.deal_visible_to_current_user(p.deal_id);
  SELECT coalesce(jsonb_agg(CASE WHEN s.visible THEN jsonb_build_object('visible', true, 'id', dl.id, 'name', dl.name, 'link', s.link,
             'group_key', s.group_key, 'stage_type', public.deal_stage_type(dl.pipeline_id, dl.stage_id, dl.stage::text), 'closed_at', dl.closed_at)
           ELSE jsonb_build_object('visible', false, 'link', s.link) END ORDER BY s.link DESC), '[]')
    INTO v_deals
    FROM (SELECT p.deal_id AS deal_id, 'primary'::text AS link, p.delivery_group_key AS group_key, v_primary_visible AS visible WHERE p.deal_id IS NOT NULL
          UNION ALL
          SELECT l.deal_id, 'consolidated', l.delivery_group_key, public.deal_visible_to_current_user(l.deal_id)
            FROM public.project_deal_links l WHERE l.project_id = p_project) s
    JOIN public.deals dl ON dl.id = s.deal_id;
  IF v_primary_visible AND p.source_line_item_id IS NOT NULL THEN
    SELECT jsonb_build_object('id', li.id, 'name', li.name, 'quantity', li.quantity, 'unit', li.unit) INTO v_line
      FROM public.deal_line_items li WHERE li.id = p.source_line_item_id;
  END IF;
  IF v_primary_visible THEN SELECT company_id INTO v_deal_company FROM public.deals WHERE id = p.deal_id; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'created_at', e.created_at) ORDER BY e.created_at DESC), '[]')
    INTO v_reviews FROM public.deal_delivery_events e
   WHERE e.needs_review AND e.resolved_at IS NULL AND (e.project_id = p_project OR (v_primary_visible AND e.deal_id = p.deal_id AND e.project_id IS NULL));
  SELECT coalesce(sum(public.project_entry_seconds(t.started_at, t.stopped_at, t.duration_minutes, t.hours)), 0) INTO v_seconds
    FROM public.project_time_entries t WHERE t.project_id = p_project;
  RETURN jsonb_build_object(
    'id', p.id, 'origin', p.origin,
    'imported_from', to_jsonb(array_remove(ARRAY[CASE WHEN p.metadata ? 'clockify' THEN 'clockify' END,
                                                CASE WHEN p.metadata ? 'jibble' THEN 'jibble' END], NULL)),
    'company', (SELECT jsonb_build_object('id', c.id, 'name', c.name) FROM public.companies c WHERE c.id = p.company_id),
    'contact', (SELECT jsonb_build_object('id', c.id, 'name', btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')))
                  FROM public.contacts c WHERE c.id = p.client_contact_id),
    'assigned', (SELECT jsonb_build_object('id', pr.id, 'name', pr.full_name) FROM public.profiles pr WHERE pr.id = p.assigned_to),
    'contract_id', p.contract_id, 'service_id', p.service_id, 'group_key', p.delivery_group_key,
    'source_line_item', v_line, 'deals', v_deals, 'reviews', v_reviews, 'logged_seconds', v_seconds,
    'pending', to_jsonb(array_remove(ARRAY[
      CASE WHEN p.assigned_to IS NULL THEN 'no_operational_owner' END,
      CASE WHEN p.company_id IS NULL THEN 'project_without_company' END,
      CASE WHEN v_deal_company IS NOT NULL AND p.company_id IS NOT NULL AND v_deal_company <> p.company_id THEN 'company_mismatch' END,
      CASE WHEN p.deal_id IS NOT NULL AND p.contract_id IS NULL THEN 'no_contract' END,
      CASE WHEN p.deal_id IS NOT NULL AND p.planned_hours IS NULL THEN 'planned_hours_missing' END], NULL)),
    'can', jsonb_build_object('edit', NOT public.is_read_only_view() AND public.project_editable_by_current_user(p_project)));
END $$;
REVOKE ALL ON FUNCTION public.project_delivery_origin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_delivery_origin(uuid) TO authenticated;

-- ------------------------------------------------------------------ 16. política (somente administrador ativo)
CREATE OR REPLACE FUNCTION public.deal_delivery_policy_get(p_ws uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE pol record; ws record;
BEGIN
  PERFORM public.project_recon_assert_admin(p_ws, false);
  SELECT * INTO pol FROM public.deal_delivery_policies WHERE workspace_id = p_ws;
  SELECT * INTO ws FROM public.deal_delivery_worker_state WHERE id = 1;
  RETURN jsonb_build_object(
    'policy', CASE WHEN pol.workspace_id IS NULL THEN NULL ELSE jsonb_build_object(
      'enabled', pol.enabled, 'activated_at', pol.activated_at, 'allow_groups', pol.allow_groups, 'origins', pol.origins,
      'project_creator_id', pol.project_creator_id, 'default_operational_owner_id', pol.default_operational_owner_id,
      'updated_at', pol.updated_at, 'updated_by', pol.updated_by) END,
    'worker', jsonb_build_object('last_run_at', ws.last_run_at, 'last_work_at', ws.last_work_at),
    'jobs', (SELECT coalesce(jsonb_object_agg(status, n), '{}') FROM (SELECT status, count(*) n FROM public.deal_delivery_jobs
              WHERE workspace_id = p_ws GROUP BY 1) x),
    'projects', jsonb_build_object(
      'auto', (SELECT count(*) FROM public.projects WHERE workspace_id = p_ws AND origin = 'deal_auto'),
      'manual', (SELECT count(*) FROM public.projects WHERE workspace_id = p_ws AND origin = 'deal_manual'),
      'history', (SELECT count(*) FROM public.projects WHERE workspace_id = p_ws AND origin = 'deal_history'),
      'linked', (SELECT count(*) FROM public.projects WHERE workspace_id = p_ws AND deal_id IS NOT NULL)),
    'reviews_open', (SELECT count(*) FROM public.deal_delivery_events WHERE workspace_id = p_ws AND needs_review AND resolved_at IS NULL));
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_policy_get(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_delivery_policy_get(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.deal_delivery_policy_save(
  p_ws uuid, p_enabled boolean, p_allow_groups boolean, p_origins jsonb, p_creator uuid, p_default_owner uuid, p_reset_activation boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev record; v_origins jsonb; v_activated timestamptz;
BEGIN
  PERFORM public.project_recon_assert_admin(p_ws, true);
  IF p_origins IS NULL OR jsonb_typeof(p_origins) <> 'object' THEN RAISE EXCEPTION 'Origens inválidas.' USING ERRCODE = '22023'; END IF;
  v_origins := jsonb_build_object(
    'user', coalesce((p_origins->>'user')::boolean, false), 'system', coalesce((p_origins->>'system')::boolean, false),
    'workflow', coalesce((p_origins->>'workflow')::boolean, false), 'import', coalesce((p_origins->>'import')::boolean, false));
  IF p_enabled AND NOT public.deal_delivery_is_active_member(p_ws, p_creator) THEN
    RAISE EXCEPTION 'Escolha um membro ativo como criador dos projetos.' USING ERRCODE = '22023';
  END IF;
  IF p_default_owner IS NOT NULL AND NOT public.deal_delivery_is_active_member(p_ws, p_default_owner) THEN
    RAISE EXCEPTION 'O responsável operacional padrão precisa ser membro ativo.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_prev FROM public.deal_delivery_policies WHERE workspace_id = p_ws FOR UPDATE;
  v_activated := CASE WHEN p_enabled AND (v_prev.activated_at IS NULL OR p_reset_activation) THEN now() ELSE v_prev.activated_at END;
  INSERT INTO public.deal_delivery_policies (workspace_id, enabled, activated_at, allow_groups, origins, project_creator_id,
    default_operational_owner_id, created_by, updated_by, updated_at)
  VALUES (p_ws, p_enabled, v_activated, coalesce(p_allow_groups, true), v_origins, p_creator, p_default_owner, auth.uid(), auth.uid(), now())
  ON CONFLICT (workspace_id) DO UPDATE SET enabled = EXCLUDED.enabled, activated_at = v_activated, allow_groups = EXCLUDED.allow_groups,
    origins = EXCLUDED.origins, project_creator_id = EXCLUDED.project_creator_id,
    default_operational_owner_id = EXCLUDED.default_operational_owner_id, updated_by = auth.uid(), updated_at = now();
  INSERT INTO public.deal_delivery_events (workspace_id, kind, actor, before, after)
  VALUES (p_ws, 'policy_changed', auth.uid(),
          CASE WHEN v_prev.workspace_id IS NULL THEN NULL ELSE jsonb_build_object('enabled', v_prev.enabled, 'activated_at', v_prev.activated_at,
            'allow_groups', v_prev.allow_groups, 'origins', v_prev.origins, 'project_creator_id', v_prev.project_creator_id,
            'default_operational_owner_id', v_prev.default_operational_owner_id) END,
          jsonb_build_object('enabled', p_enabled, 'activated_at', v_activated, 'allow_groups', coalesce(p_allow_groups, true),
            'origins', v_origins, 'project_creator_id', p_creator, 'default_operational_owner_id', p_default_owner));
  RETURN public.deal_delivery_policy_get(p_ws);
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_policy_save(uuid, boolean, boolean, jsonb, uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_delivery_policy_save(uuid, boolean, boolean, jsonb, uuid, uuid, boolean) TO authenticated;

-- ------------------------------------------------------------------ 17. histórico (central de conciliação, somente administrador)
CREATE OR REPLACE FUNCTION public.deal_delivery_pair_snapshot(p_deal uuid, p_project uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT md5(concat_ws('|', p.deal_id, p.delivery_group_key, p.company_id, p.contract_id,
      (SELECT string_agg(l.deal_id::text, ',' ORDER BY l.deal_id) FROM public.project_deal_links l WHERE l.project_id = p.id),
      d.stage, d.stage_id, d.company_id, d.deleted_at,
      (SELECT string_agg(x.id::text, ',' ORDER BY x.id) FROM public.projects x WHERE x.deal_id = d.id),
      (SELECT string_agg(l.project_id::text, ',' ORDER BY l.project_id) FROM public.project_deal_links l WHERE l.deal_id = d.id)))
    FROM public.projects p, public.deals d WHERE p.id = p_project AND d.id = p_deal $$;
REVOKE ALL ON FUNCTION public.deal_delivery_pair_snapshot(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.deal_delivery_pair_check(p_ws uuid, p_deal uuid, p_project uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d record; p record; v_blocked text; v_warn text[] := '{}'; v_seconds numeric; v_other int;
BEGIN
  SELECT x.id, x.workspace_id, x.name, x.company_id, x.deleted_at, public.deal_stage_type(x.pipeline_id, x.stage_id, x.stage::text) AS st
    INTO d FROM public.deals x WHERE x.id = p_deal;
  SELECT x.id, x.workspace_id, x.name, x.company_id, x.deal_id INTO p FROM public.projects x WHERE x.id = p_project;
  IF d.id IS NULL OR d.workspace_id <> p_ws OR d.deleted_at IS NOT NULL THEN v_blocked := 'deal_not_found';
  ELSIF p.id IS NULL OR p.workspace_id <> p_ws THEN v_blocked := 'project_not_found';
  ELSIF d.st <> 'won' THEN v_blocked := 'deal_not_won';
  ELSIF p.deal_id = p_deal OR EXISTS (SELECT 1 FROM public.project_deal_links l WHERE l.project_id = p_project AND l.deal_id = p_deal) THEN v_blocked := 'already_linked';
  ELSIF EXISTS (SELECT 1 FROM public.projects x WHERE x.deal_id = p_deal AND x.delivery_group_key = 'default')
     OR EXISTS (SELECT 1 FROM public.project_deal_links l WHERE l.deal_id = p_deal AND l.delivery_group_key = 'default') THEN v_blocked := 'deal_has_project';
  ELSIF p.company_id IS NOT NULL AND d.company_id IS NOT NULL AND p.company_id <> d.company_id THEN v_blocked := 'company_mismatch';
  END IF;
  IF p.id IS NOT NULL THEN
    SELECT coalesce(sum(public.project_entry_seconds(t.started_at, t.stopped_at, t.duration_minutes, t.hours)), 0) INTO v_seconds
      FROM public.project_time_entries t WHERE t.project_id = p_project;
    SELECT count(*) INTO v_other FROM public.project_deal_links l WHERE l.project_id = p_project;
    IF v_seconds > 0 THEN v_warn := array_append(v_warn, 'project_has_hours'); END IF;
    IF p.deal_id IS NOT NULL THEN v_warn := array_append(v_warn, 'project_has_other_deal'); END IF;
    IF p.company_id IS NULL THEN v_warn := array_append(v_warn, 'project_without_company'); END IF;
  END IF;
  IF d.id IS NOT NULL AND d.company_id IS NULL THEN v_warn := array_append(v_warn, 'deal_without_company'); END IF;
  RETURN jsonb_build_object('deal_id', p_deal, 'project_id', p_project, 'deal_name', d.name, 'project_name', p.name,
    'mode', CASE WHEN p.deal_id IS NULL THEN 'primary' ELSE 'consolidated' END,
    'blocked', v_blocked, 'warnings', to_jsonb(v_warn), 'logged_seconds', coalesce(v_seconds, 0),
    'snapshot', public.deal_delivery_pair_snapshot(p_deal, p_project));
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_pair_check(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.deal_delivery_history_list(
  p_ws uuid, p_filter text DEFAULT 'missing', p_q text DEFAULT NULL, p_from date DEFAULT NULL, p_to date DEFAULT NULL,
  p_page integer DEFAULT 1, p_size integer DEFAULT 25)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET statement_timeout = '60s' AS $$
DECLARE v_total int; v_rows jsonb; v_summary jsonb; v_recent jsonb; v_size int := least(greatest(coalesce(p_size, 25), 1), 100);
BEGIN
  PERFORM public.project_recon_assert_admin(p_ws, false);
  IF p_filter NOT IN ('missing','linked','all') THEN RAISE EXCEPTION 'Filtro inválido.' USING ERRCODE = '22023'; END IF;
  DROP TABLE IF EXISTS pg_temp._dd_won;
  CREATE TEMP TABLE _dd_won ON COMMIT DROP AS
  SELECT d.id, d.name, d.closed_at, d.company_id, d.created_at,
         (SELECT count(*) FROM (SELECT 1 FROM public.projects x WHERE x.deal_id = d.id
                                UNION ALL SELECT 1 FROM public.project_deal_links l WHERE l.deal_id = d.id) z) AS n_projects
    FROM public.deals d
   WHERE d.workspace_id = p_ws AND d.deleted_at IS NULL
     AND public.deal_stage_type(d.pipeline_id, d.stage_id, d.stage::text) = 'won';
  DROP TABLE IF EXISTS pg_temp._dd_pstats;
  CREATE TEMP TABLE _dd_pstats ON COMMIT DROP AS
  SELECT t.project_id, min(t.started_at) AS first_at,
         sum(public.project_entry_seconds(t.started_at, t.stopped_at, t.duration_minutes, t.hours)) AS secs
    FROM public.project_time_entries t WHERE t.workspace_id = p_ws GROUP BY t.project_id;
  SELECT jsonb_build_object('won', count(*), 'with_project', count(*) FILTER (WHERE n_projects > 0),
                            'missing', count(*) FILTER (WHERE n_projects = 0)) INTO v_summary FROM _dd_won;
  SELECT count(*) INTO v_total FROM _dd_won w
   WHERE (p_filter = 'all' OR (p_filter = 'missing' AND w.n_projects = 0) OR (p_filter = 'linked' AND w.n_projects > 0))
     AND (p_q IS NULL OR w.name ILIKE '%' || p_q || '%')
     AND (p_from IS NULL OR w.closed_at >= p_from) AND (p_to IS NULL OR w.closed_at < p_to + 1);
  SELECT coalesce(jsonb_agg(r ORDER BY (r->>'closed_at') DESC NULLS LAST), '[]') INTO v_rows FROM (
    SELECT jsonb_build_object(
      'id', w.id, 'name', w.name, 'closed_at', w.closed_at, 'n_projects', w.n_projects,
      'company', (SELECT jsonb_build_object('id', c.id, 'name', c.name) FROM public.companies c WHERE c.id = w.company_id),
      'contracts', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'number', c.number, 'title', c.title, 'kind', c.document_kind,
                      'company_ok', (c.counterparty_company_id IS NULL OR w.company_id IS NULL OR c.counterparty_company_id = w.company_id))), '[]')
                    FROM public.contracts c WHERE c.deal_id = w.id AND c.workspace_id = p_ws),
      'services', (SELECT count(*) FROM public.services s JOIN public.deal_line_items li ON li.id = s.source_deal_line_item_id
                    WHERE li.deal_id = w.id AND s.workspace_id = p_ws),
      'projects', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'link', x.link)), '[]') FROM (
                     SELECT p.id, p.name, 'primary' AS link FROM public.projects p WHERE p.deal_id = w.id
                     UNION ALL SELECT p.id, p.name, 'consolidated' FROM public.project_deal_links l JOIN public.projects p ON p.id = l.project_id
                      WHERE l.deal_id = w.id) x),
      'nature', (SELECT to_jsonb(array_agg(DISTINCT n)) FROM (
                   SELECT CASE WHEN upper(coalesce(sc.category, '')) LIKE 'HUNT%' THEN 'hunting'
                               WHEN sc.service_type = 'recurring' THEN 'recurring'
                               WHEN sc.service_type = 'project' THEN 'project' END AS n
                     FROM public.deal_line_items li LEFT JOIN public.service_catalog sc ON sc.id = li.service_catalog_id
                    WHERE li.deal_id = w.id
                   UNION ALL
                   SELECT 'amendment' FROM public.contracts c WHERE c.deal_id = w.id AND c.document_kind = 'amendment'
                   UNION ALL
                   SELECT 'repeat_client' WHERE w.company_id IS NOT NULL AND EXISTS (
                     SELECT 1 FROM _dd_won o WHERE o.company_id = w.company_id AND o.id <> w.id AND o.closed_at < w.closed_at)) z
                  WHERE n IS NOT NULL),
      'candidates', (SELECT coalesce(jsonb_agg(cs.cand ORDER BY cs.rk), '[]')
                     FROM (SELECT cand, row_number() OVER (ORDER BY exact DESC, has_deal, abs_days NULLS LAST, pname) AS rk FROM (
        SELECT jsonb_build_object('project_id', p.id, 'name', p.name, 'criterion', k.criterion, 'exact', k.exact,
                 'project_has_deal', p.deal_id IS NOT NULL, 'company_matches', (p.company_id IS NULL OR w.company_id IS NULL OR p.company_id = w.company_id),
                 'first_entry', fe.first_at, 'logged_seconds', fe.secs,
                 'days_from_close', CASE WHEN fe.first_at IS NOT NULL AND w.closed_at IS NOT NULL
                                         THEN round(extract(epoch FROM (fe.first_at - w.closed_at)) / 86400) END,
                 'evidence', k.evidence) AS cand,
               k.exact, (p.deal_id IS NOT NULL) AS has_deal, p.name AS pname,
               abs(extract(epoch FROM (fe.first_at - w.closed_at))) AS abs_days
          FROM (
            SELECT p2.id AS pid, 'contract_fk'::text AS criterion, true AS exact, jsonb_build_object('contract_id', c.id, 'contract_number', c.number) AS evidence
              FROM public.contracts c JOIN public.projects p2 ON p2.contract_id = c.id
             WHERE c.deal_id = w.id AND c.workspace_id = p_ws AND p2.workspace_id = p_ws
            UNION
            SELECT p2.id, 'service_line_fk', true, jsonb_build_object('service_id', s.id, 'line_item_id', li.id)
              FROM public.deal_line_items li JOIN public.services s ON s.source_deal_line_item_id = li.id
              JOIN public.projects p2 ON p2.service_id = s.id
             WHERE li.deal_id = w.id AND p2.workspace_id = p_ws
            UNION
            SELECT p2.id, 'company_period', false, jsonb_build_object('company_id', w.company_id)
              FROM public.projects p2 WHERE w.company_id IS NOT NULL AND p2.workspace_id = p_ws AND p2.company_id = w.company_id
          ) k
          JOIN public.projects p ON p.id = k.pid
          LEFT JOIN _dd_pstats fe ON fe.project_id = p.id
         WHERE p.deal_id IS DISTINCT FROM w.id AND NOT EXISTS (SELECT 1 FROM public.project_deal_links l WHERE l.project_id = p.id AND l.deal_id = w.id)
         ) c0 ORDER BY exact DESC, has_deal, abs_days NULLS LAST, pname LIMIT 8) cs)) AS r
      FROM _dd_won w
     WHERE (p_filter = 'all' OR (p_filter = 'missing' AND w.n_projects = 0) OR (p_filter = 'linked' AND w.n_projects > 0))
       AND (p_q IS NULL OR w.name ILIKE '%' || p_q || '%')
       AND (p_from IS NULL OR w.closed_at >= p_from) AND (p_to IS NULL OR w.closed_at < p_to + 1)
     ORDER BY w.closed_at DESC NULLS LAST, w.id
     OFFSET (greatest(coalesce(p_page, 1), 1) - 1) * v_size LIMIT v_size) q;
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'created_at' DESC), '[]') INTO v_recent FROM (
    SELECT jsonb_build_object('id', e.id, 'kind', e.kind, 'created_at', e.created_at, 'deal_id', e.deal_id, 'project_id', e.project_id,
             'deal_name', dl.name, 'project_name', p.name, 'mode', e.after->>'mode', 'criterion', e.after->'evidence'->>'criterion',
             'batch_id', e.batch_id, 'note', e.note,
             'revertable', e.reverted_at IS NULL AND (
               (e.after->>'mode' = 'primary' AND p.deal_id = e.deal_id AND p.delivery_group_key = e.after->>'group_key')
               OR (e.after->>'mode' = 'consolidated' AND EXISTS (SELECT 1 FROM public.project_deal_links l
                     WHERE l.project_id = e.project_id AND l.deal_id = e.deal_id AND l.delivery_group_key = e.after->>'group_key')))) AS x
      FROM public.deal_delivery_events e
      LEFT JOIN public.deals dl ON dl.id = e.deal_id
      LEFT JOIN public.projects p ON p.id = e.project_id
     WHERE e.workspace_id = p_ws AND e.kind IN ('history_linked','project_linked') AND e.reverted_at IS NULL
     ORDER BY e.created_at DESC LIMIT 30) r;
  RETURN jsonb_build_object('summary', v_summary || jsonb_build_object(
      'reviews_open', (SELECT count(*) FROM public.deal_delivery_events WHERE workspace_id = p_ws AND needs_review AND resolved_at IS NULL)),
    'total', v_total, 'page', greatest(coalesce(p_page, 1), 1), 'page_size', v_size, 'rows', v_rows, 'recent_links', v_recent);
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_history_list(uuid, text, text, date, date, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_delivery_history_list(uuid, text, text, date, date, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.deal_delivery_history_preview(p_ws uuid, p_pairs jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.project_recon_assert_admin(p_ws, false);
  IF jsonb_typeof(p_pairs) <> 'array' OR jsonb_array_length(p_pairs) > 100 THEN RAISE EXCEPTION 'Até 100 pares por prévia.' USING ERRCODE = '22023'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(public.deal_delivery_pair_check(p_ws, (e->>'deal_id')::uuid, (e->>'project_id')::uuid)), '[]')
            FROM jsonb_array_elements(p_pairs) e);
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_history_preview(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_delivery_history_preview(uuid, jsonb) TO authenticated;

-- Lote atômico: cada par precisa bater com o snapshot da prévia (controle de concorrência).
CREATE OR REPLACE FUNCTION public.deal_delivery_history_apply(p_ws uuid, p_pairs jsonb, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e jsonb; v_check jsonb; v_batch uuid := gen_random_uuid(); n int := 0;
BEGIN
  PERFORM public.project_recon_assert_admin(p_ws, true);
  IF length(btrim(coalesce(p_note, ''))) < 5 THEN RAISE EXCEPTION 'Informe a justificativa do lote.' USING ERRCODE = '22023'; END IF;
  IF jsonb_typeof(p_pairs) <> 'array' OR jsonb_array_length(p_pairs) = 0 OR jsonb_array_length(p_pairs) > 100 THEN
    RAISE EXCEPTION 'Envie de 1 a 100 pares.' USING ERRCODE = '22023';
  END IF;
  FOR e IN SELECT x FROM jsonb_array_elements(p_pairs) x ORDER BY x->>'deal_id', x->>'project_id' LOOP
    PERFORM pg_advisory_xact_lock(hashtext('deal_delivery'), hashtext(e->>'deal_id'));
    v_check := public.deal_delivery_pair_check(p_ws, (e->>'deal_id')::uuid, (e->>'project_id')::uuid);
    IF v_check->>'blocked' IS NOT NULL THEN
      RAISE EXCEPTION 'Par bloqueado (%): % ↔ %', v_check->>'blocked', v_check->>'deal_name', v_check->>'project_name' USING ERRCODE = '22023';
    END IF;
    IF v_check->>'snapshot' IS DISTINCT FROM e->>'snapshot' THEN
      RAISE EXCEPTION 'Os dados mudaram desde a prévia (% ↔ %). Gere a prévia de novo.', v_check->>'deal_name', v_check->>'project_name' USING ERRCODE = '40001';
    END IF;
    PERFORM public.deal_delivery_link_core((e->>'deal_id')::uuid, (e->>'project_id')::uuid, 'default', auth.uid(), 'history_linked', v_batch,
      jsonb_build_object('criterion', coalesce(e->>'criterion', 'manual')), btrim(p_note));
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('batch_id', v_batch, 'linked', n);
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_history_apply(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_delivery_history_apply(uuid, jsonb, text) TO authenticated;

-- Só FK/ID exato e incontestável: um único candidato exato, mesmo workspace, sem conflito de empresa e sem projeto já ligado.
CREATE OR REPLACE FUNCTION public.deal_delivery_history_apply_exact(p_ws uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET statement_timeout = '120s' AS $$
DECLARE r record; v_batch uuid := gen_random_uuid(); n int := 0; n_skip int := 0;
BEGIN
  PERFORM public.project_recon_assert_admin(p_ws, true);
  FOR r IN
    WITH won AS (
      SELECT d.id, d.company_id FROM public.deals d
       WHERE d.workspace_id = p_ws AND d.deleted_at IS NULL AND public.deal_stage_type(d.pipeline_id, d.stage_id, d.stage::text) = 'won'
         AND NOT EXISTS (SELECT 1 FROM public.projects x WHERE x.deal_id = d.id AND x.delivery_group_key = 'default')
         AND NOT EXISTS (SELECT 1 FROM public.project_deal_links l WHERE l.deal_id = d.id AND l.delivery_group_key = 'default')),
    cand AS (
      SELECT w.id AS deal_id, p.id AS project_id, 'contract_fk' AS criterion
        FROM won w JOIN public.contracts c ON c.deal_id = w.id AND c.workspace_id = p_ws
        JOIN public.projects p ON p.contract_id = c.id AND p.workspace_id = p_ws
      UNION
      SELECT w.id, p.id, 'service_line_fk'
        FROM won w JOIN public.deal_line_items li ON li.deal_id = w.id
        JOIN public.services s ON s.source_deal_line_item_id = li.id AND s.workspace_id = p_ws
        JOIN public.projects p ON p.service_id = s.id AND p.workspace_id = p_ws),
    uniq AS (
      SELECT deal_id, min(project_id::text)::uuid AS project_id, string_agg(DISTINCT criterion, ',') AS criterion
        FROM cand GROUP BY deal_id HAVING count(DISTINCT project_id) = 1),
    proj_once AS (SELECT project_id FROM uniq GROUP BY project_id HAVING count(*) = 1)
    SELECT u.deal_id, u.project_id, u.criterion FROM uniq u JOIN proj_once o ON o.project_id = u.project_id
     ORDER BY u.deal_id
  LOOP
    IF (public.deal_delivery_pair_check(p_ws, r.deal_id, r.project_id))->>'blocked' IS NOT NULL THEN
      n_skip := n_skip + 1; CONTINUE;
    END IF;
    PERFORM public.deal_delivery_link_core(r.deal_id, r.project_id, 'default', auth.uid(), 'history_linked', v_batch,
      jsonb_build_object('criterion', r.criterion), 'Vínculo exato por chave de origem');
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('batch_id', v_batch, 'linked', n, 'skipped', n_skip);
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_history_apply_exact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_delivery_history_apply_exact(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.deal_delivery_history_create(p_ws uuid, p_deals uuid[], p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_deal uuid; v_res jsonb := '[]'::jsonb; d record;
BEGIN
  PERFORM public.project_recon_assert_admin(p_ws, true);
  IF length(btrim(coalesce(p_note, ''))) < 5 THEN RAISE EXCEPTION 'Informe a justificativa.' USING ERRCODE = '22023'; END IF;
  IF p_deals IS NULL OR cardinality(p_deals) = 0 OR cardinality(p_deals) > 25 THEN
    RAISE EXCEPTION 'Selecione de 1 a 25 negócios por vez.' USING ERRCODE = '22023';
  END IF;
  FOREACH v_deal IN ARRAY (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(p_deals) x) LOOP
    SELECT x.workspace_id, x.deleted_at, public.deal_stage_type(x.pipeline_id, x.stage_id, x.stage::text) AS st INTO d
      FROM public.deals x WHERE x.id = v_deal;
    IF d.workspace_id IS DISTINCT FROM p_ws OR d.deleted_at IS NOT NULL OR d.st <> 'won' THEN
      RAISE EXCEPTION 'Só negócios ganhos deste workspace.' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.projects x WHERE x.deal_id = v_deal) OR EXISTS (SELECT 1 FROM public.project_deal_links l WHERE l.deal_id = v_deal) THEN
      RAISE EXCEPTION 'Um dos negócios já tem projeto ligado; revise a seleção.' USING ERRCODE = '22023';
    END IF;
    v_res := v_res || jsonb_build_array(public.deal_delivery_ensure_internal(v_deal, 'history', auth.uid(), auth.uid(), NULL));
  END LOOP;
  UPDATE public.deal_delivery_events SET note = btrim(p_note)
   WHERE workspace_id = p_ws AND kind = 'project_created' AND deal_id = ANY (p_deals) AND actor = auth.uid() AND created_at >= now() - interval '1 second' AND note IS NULL;
  RETURN jsonb_build_object('created', v_res);
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_history_create(uuid, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_delivery_history_create(uuid, uuid[], text) TO authenticated;

-- Reversão só de vínculos intactos; nunca apaga projeto, horas ou contrato.
CREATE OR REPLACE FUNCTION public.deal_delivery_history_revert(p_ws uuid, p_events uuid[], p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; n int := 0; n_skip int := 0; v_ok boolean;
BEGIN
  PERFORM public.project_recon_assert_admin(p_ws, true);
  IF length(btrim(coalesce(p_note, ''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo da reversão.' USING ERRCODE = '22023'; END IF;
  FOR e IN SELECT * FROM public.deal_delivery_events
            WHERE workspace_id = p_ws AND id = ANY (p_events) AND kind IN ('history_linked','project_linked') AND reverted_at IS NULL
            ORDER BY created_at DESC FOR UPDATE
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext('deal_delivery'), hashtext(e.deal_id::text));
    v_ok := false;
    IF e.after->>'mode' = 'primary' THEN
      UPDATE public.projects SET deal_id = NULL, delivery_group_key = NULL
       WHERE id = e.project_id AND deal_id = e.deal_id AND delivery_group_key = e.after->>'group_key'
         AND (e.before->>'project_deal_id') IS NULL;
      v_ok := FOUND;
    ELSIF e.after->>'mode' = 'consolidated' THEN
      DELETE FROM public.project_deal_links WHERE project_id = e.project_id AND deal_id = e.deal_id AND delivery_group_key = e.after->>'group_key';
      v_ok := FOUND;
    END IF;
    IF v_ok THEN
      UPDATE public.deal_delivery_events SET reverted_at = now(), reverted_by = auth.uid() WHERE id = e.id;
      INSERT INTO public.deal_delivery_events (workspace_id, deal_id, project_id, kind, actor, before, after, note)
      VALUES (p_ws, e.deal_id, e.project_id, 'link_reverted', auth.uid(), e.after, jsonb_build_object('reverted_event', e.id), btrim(p_note));
      n := n + 1;
    ELSE
      n_skip := n_skip + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('reverted', n, 'skipped', n_skip);
END $$;
REVOKE ALL ON FUNCTION public.deal_delivery_history_revert(uuid, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_delivery_history_revert(uuid, uuid[], text) TO authenticated;
