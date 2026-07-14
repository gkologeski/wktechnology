
CREATE TABLE public.snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  workspace_id uuid,
  name text NOT NULL,
  shortcut text NOT NULL,
  body_html text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  folder text,
  visibility text NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal','shared')),
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snippets_shortcut_format CHECK (shortcut ~ '^[a-zA-Z0-9_\-/]+$'),
  CONSTRAINT snippets_shortcut_length CHECK (char_length(shortcut) BETWEEN 1 AND 40),
  CONSTRAINT snippets_name_length CHECK (char_length(name) BETWEEN 1 AND 120)
);

CREATE UNIQUE INDEX snippets_personal_shortcut_uniq
  ON public.snippets (owner_id, shortcut)
  WHERE visibility = 'personal';

CREATE UNIQUE INDEX snippets_shared_shortcut_uniq
  ON public.snippets (workspace_id, shortcut)
  WHERE visibility = 'shared';

CREATE INDEX snippets_owner_idx ON public.snippets (owner_id);
CREATE INDEX snippets_workspace_idx ON public.snippets (workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.snippets TO authenticated;
GRANT ALL ON public.snippets TO service_role;
ALTER TABLE public.snippets ENABLE ROW LEVEL SECURITY;

CREATE POLICY snippets_select
  ON public.snippets FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR (
      visibility = 'shared'
      AND workspace_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = public.snippets.workspace_id
          AND wm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY snippets_insert
  ON public.snippets FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (
      visibility = 'personal'
      OR (
        visibility = 'shared'
        AND workspace_id IS NOT NULL
        AND public.is_workspace_admin(workspace_id, auth.uid())
      )
    )
  );

CREATE POLICY snippets_update
  ON public.snippets FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR (visibility = 'shared' AND workspace_id IS NOT NULL AND public.is_workspace_admin(workspace_id, auth.uid()))
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR (visibility = 'shared' AND workspace_id IS NOT NULL AND public.is_workspace_admin(workspace_id, auth.uid()))
  );

CREATE POLICY snippets_delete
  ON public.snippets FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    OR (visibility = 'shared' AND workspace_id IS NOT NULL AND public.is_workspace_admin(workspace_id, auth.uid()))
  );

CREATE OR REPLACE FUNCTION public.snippets_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER snippets_updated_at
BEFORE UPDATE ON public.snippets
FOR EACH ROW EXECUTE FUNCTION public.snippets_touch_updated_at();

CREATE OR REPLACE FUNCTION public.increment_snippet_usage(_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  UPDATE public.snippets
  SET usage_count = usage_count + 1
  WHERE id = _id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_snippet_usage(uuid) TO authenticated;

INSERT INTO public.snippets (owner_id, workspace_id, name, shortcut, body_html, body_text, folder, visibility)
SELECT
  es.owner_id,
  NULL::uuid,
  COALESCE(NULLIF(es.shortcut, ''), 'snippet') AS name,
  es.shortcut,
  '' AS body_html,
  es.body AS body_text,
  'Email (legado)' AS folder,
  'personal' AS visibility
FROM public.email_snippets es
WHERE es.owner_id IS NOT NULL
ON CONFLICT DO NOTHING;
