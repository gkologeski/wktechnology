CREATE TABLE public.sdr_agent_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  playbook_id uuid NOT NULL REFERENCES public.sdr_playbooks(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  persona jsonb NOT NULL DEFAULT '{}'::jsonb,
  flow jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  published_by uuid,
  UNIQUE (playbook_id, version)
);
CREATE UNIQUE INDEX sdr_agent_versions_one_draft ON public.sdr_agent_versions (playbook_id) WHERE status = 'draft';
CREATE UNIQUE INDEX sdr_agent_versions_one_published ON public.sdr_agent_versions (playbook_id) WHERE status = 'published';
GRANT SELECT ON public.sdr_agent_versions TO authenticated;
GRANT ALL ON public.sdr_agent_versions TO service_role;
ALTER TABLE public.sdr_agent_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sdr_agent_versions_select ON public.sdr_agent_versions FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

ALTER TABLE public.sdr_turn_jobs ADD COLUMN IF NOT EXISTS agent_version_id uuid REFERENCES public.sdr_agent_versions(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.sdr_turn_jobs.agent_version_id IS 'Versão publicada do agente (persona/fluxo) usada neste turno.';

-- Promoção atômica do rascunho; a versão publicada anterior vira arquivada.
CREATE OR REPLACE FUNCTION public.sdr_publish_agent_version(p_version uuid, p_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v record;
BEGIN
  SELECT * INTO v FROM public.sdr_agent_versions WHERE id = p_version FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'versão não encontrada'; END IF;
  IF v.status = 'published' THEN RETURN v.id; END IF;
  UPDATE public.sdr_agent_versions SET status = 'archived', updated_at = now()
   WHERE playbook_id = v.playbook_id AND status = 'published';
  UPDATE public.sdr_agent_versions
     SET status = 'published', published_at = now(), published_by = p_user, updated_at = now()
   WHERE id = v.id;
  RETURN v.id;
END;
$$;
REVOKE ALL ON FUNCTION public.sdr_publish_agent_version(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sdr_publish_agent_version(uuid, uuid) TO service_role;