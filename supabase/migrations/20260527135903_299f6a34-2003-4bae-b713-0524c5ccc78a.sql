
-- Helper: verifica se dois usuários compartilham algum workspace.
CREATE OR REPLACE FUNCTION public.shares_workspace_with(_other uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.workspace_members m1
      JOIN public.workspace_members m2 ON m1.workspace_id = m2.workspace_id
     WHERE m1.user_id = auth.uid()
       AND m2.user_id = _other
  );
$$;

REVOKE EXECUTE ON FUNCTION public.shares_workspace_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shares_workspace_with(uuid) TO authenticated, service_role;

-- notes-attachments: leitura também por membros do mesmo workspace do uploader.
DROP POLICY IF EXISTS notes_attachments_owner_select ON storage.objects;
CREATE POLICY notes_attachments_workspace_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'notes-attachments'
  AND (
    owner = auth.uid()
    OR public.is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid())
    OR public.shares_workspace_with(owner)
  )
);

-- exports: leitura por membros do workspace (1ª pasta = owner_id do workspace).
DROP POLICY IF EXISTS exports_owner_read ON storage.objects;
CREATE POLICY exports_workspace_read
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'exports'
  AND (
    ((storage.foldername(name))[1] = (auth.uid())::text)
    OR public.is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);
