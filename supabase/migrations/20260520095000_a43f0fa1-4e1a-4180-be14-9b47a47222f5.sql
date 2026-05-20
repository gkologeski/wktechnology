
CREATE TABLE public.ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  entity text NOT NULL CHECK (entity IN ('lead','contact','deal','ticket')),
  entity_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'conversation' CHECK (kind IN ('conversation','call')),
  summary text NOT NULL,
  key_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  sentiment text,
  model text,
  window_from timestamptz,
  window_to timestamptz,
  source_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_summaries_entity_idx ON public.ai_summaries (owner_id, entity, entity_id, created_at DESC);

ALTER TABLE public.ai_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_summaries owner read"
  ON public.ai_summaries FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));

CREATE POLICY "ai_summaries owner write"
  ON public.ai_summaries FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));

CREATE POLICY "ai_summaries owner update"
  ON public.ai_summaries FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));

CREATE POLICY "ai_summaries owner delete"
  ON public.ai_summaries FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));

CREATE TRIGGER ai_summaries_set_updated_at
  BEFORE UPDATE ON public.ai_summaries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
