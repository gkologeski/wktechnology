-- ============================================================================
-- Onda 5 / Slice 2 / Fase 1: Talent CRM
-- ============================================================================

-- 1) ats_talent_pools
CREATE TABLE public.ats_talent_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'static' CHECK (type IN ('static','smart','system')),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  color TEXT,
  system_key TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, system_key)
);
CREATE INDEX ats_talent_pools_owner_idx ON public.ats_talent_pools(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_talent_pools TO authenticated;
GRANT ALL ON public.ats_talent_pools TO service_role;

ALTER TABLE public.ats_talent_pools ENABLE ROW LEVEL SECURITY;

CREATE POLICY ats_talent_pools_workspace_select ON public.ats_talent_pools
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_member(owner_id, auth.uid()));

CREATE POLICY ats_talent_pools_workspace_insert ON public.ats_talent_pools
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_member(owner_id, auth.uid()));

CREATE POLICY ats_talent_pools_workspace_update ON public.ats_talent_pools
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_member(owner_id, auth.uid()));

CREATE POLICY ats_talent_pools_workspace_delete ON public.ats_talent_pools
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_member(owner_id, auth.uid()));

CREATE TRIGGER trg_ats_talent_pools_updated_at
  BEFORE UPDATE ON public.ats_talent_pools
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) ats_talent_pool_members
CREATE TABLE public.ats_talent_pool_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES public.ats_talent_pools(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.ats_candidates(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  added_by UUID,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','auto','referral','silver_medalist','sequence','import')),
  notes TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pool_id, candidate_id)
);
CREATE INDEX ats_talent_pool_members_pool_idx ON public.ats_talent_pool_members(pool_id);
CREATE INDEX ats_talent_pool_members_candidate_idx ON public.ats_talent_pool_members(candidate_id);
CREATE INDEX ats_talent_pool_members_owner_idx ON public.ats_talent_pool_members(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_talent_pool_members TO authenticated;
GRANT ALL ON public.ats_talent_pool_members TO service_role;

ALTER TABLE public.ats_talent_pool_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY ats_talent_pool_members_workspace_select ON public.ats_talent_pool_members
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_member(owner_id, auth.uid()));
CREATE POLICY ats_talent_pool_members_workspace_insert ON public.ats_talent_pool_members
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_member(owner_id, auth.uid()));
CREATE POLICY ats_talent_pool_members_workspace_delete ON public.ats_talent_pool_members
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_member(owner_id, auth.uid()));
CREATE POLICY ats_talent_pool_members_workspace_update ON public.ats_talent_pool_members
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_member(owner_id, auth.uid()));

-- 3) Extensão de ats_candidates: status de relacionamento
ALTER TABLE public.ats_candidates
  ADD COLUMN IF NOT EXISTS relationship_status TEXT NOT NULL DEFAULT 'cold'
    CHECK (relationship_status IN ('cold','engaged','nurturing','do_not_contact')),
  ADD COLUMN IF NOT EXISTS last_touch_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS relationship_owner_id UUID;

CREATE INDEX IF NOT EXISTS ats_candidates_relationship_status_idx
  ON public.ats_candidates(owner_id, relationship_status);
CREATE INDEX IF NOT EXISTS ats_candidates_next_action_idx
  ON public.ats_candidates(owner_id, next_action_at)
  WHERE next_action_at IS NOT NULL;

-- 4) Trigger: candidato rejeitado em estágio final → Silver Medalists
CREATE OR REPLACE FUNCTION public.ats_auto_add_silver_medalist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool_id UUID;
  v_stage_lower TEXT;
BEGIN
  -- Só processa quando status muda para rejected/withdrawn
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('rejected','withdrawn') THEN
    RETURN NEW;
  END IF;

  v_stage_lower := lower(coalesce(NEW.stage_value, OLD.stage_value, ''));
  -- Considera "finalista" se passou por offer/onsite/final
  IF v_stage_lower NOT LIKE '%offer%'
     AND v_stage_lower NOT LIKE '%onsite%'
     AND v_stage_lower NOT LIKE '%final%' THEN
    RETURN NEW;
  END IF;

  -- Garante pool sistema
  SELECT id INTO v_pool_id
    FROM public.ats_talent_pools
   WHERE owner_id = NEW.owner_id AND system_key = 'silver_medalists'
   LIMIT 1;

  IF v_pool_id IS NULL THEN
    INSERT INTO public.ats_talent_pools (owner_id, name, description, type, system_key, color)
    VALUES (NEW.owner_id, 'Silver Medalists',
            'Candidatos rejeitados em estágios finais — alta prioridade para futuras vagas.',
            'system', 'silver_medalists', '#94a3b8')
    RETURNING id INTO v_pool_id;
  END IF;

  INSERT INTO public.ats_talent_pool_members (pool_id, candidate_id, owner_id, source)
  VALUES (v_pool_id, NEW.candidate_id, NEW.owner_id, 'silver_medalist')
  ON CONFLICT (pool_id, candidate_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ats_applications_silver_medalist ON public.ats_applications;
CREATE TRIGGER trg_ats_applications_silver_medalist
  AFTER UPDATE ON public.ats_applications
  FOR EACH ROW EXECUTE FUNCTION public.ats_auto_add_silver_medalist();

-- 5) Seed da feature flag
INSERT INTO public.feature_flags (owner_id, key, enabled, rollout_percentage, description, metadata)
SELECT DISTINCT owner_id, 'ats.sourcing.talent_crm', false, 0,
       'Talent CRM: pools, smart lists e status de relacionamento de candidatos.',
       '{}'::jsonb
  FROM public.ats_candidates
 ON CONFLICT (owner_id, key) DO NOTHING;