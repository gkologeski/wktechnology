
-- media_assets table to back the Media Library
CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket text NOT NULL DEFAULT 'media',
  path text NOT NULL,
  filename text NOT NULL,
  mime text,
  size_bytes bigint,
  url text NOT NULL,
  url_expires_at timestamptz,
  width int,
  height int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT ALL ON public.media_assets TO service_role;

CREATE INDEX media_assets_workspace_created_idx ON public.media_assets (workspace_id, created_at DESC);
CREATE INDEX media_assets_owner_idx ON public.media_assets (owner_user_id);

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY media_assets_workspace_select ON public.media_assets
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR workspace_id = auth.uid());

CREATE POLICY media_assets_workspace_insert ON public.media_assets
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND (public.is_workspace_member(workspace_id, auth.uid()) OR workspace_id = auth.uid())
  );

CREATE POLICY media_assets_owner_update ON public.media_assets
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_workspace_admin(workspace_id, auth.uid()))
  WITH CHECK (owner_user_id = auth.uid() OR public.is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY media_assets_owner_delete ON public.media_assets
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_workspace_admin(workspace_id, auth.uid()));

CREATE TRIGGER media_assets_set_updated_at
  BEFORE UPDATE ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage policies for the 'media' bucket
-- Path layout: {workspace_id}/yyyy/mm/{uuid}-{filename}

CREATE POLICY media_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'media'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

CREATE POLICY media_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

CREATE POLICY media_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'media'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

CREATE POLICY media_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'media'
    AND (
      owner = auth.uid()
      OR public.is_workspace_admin(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );
