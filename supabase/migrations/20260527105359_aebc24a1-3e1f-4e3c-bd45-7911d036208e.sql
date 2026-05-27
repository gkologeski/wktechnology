
-- 1) WhatsApp media: remove public-read e políticas duplicadas
DROP POLICY IF EXISTS "wa media public read" ON storage.objects;
DROP POLICY IF EXISTS "wa media service delete" ON storage.objects;
DROP POLICY IF EXISTS "wa media auth insert" ON storage.objects;
DROP POLICY IF EXISTS "wa media auth update" ON storage.objects;

-- 2) deal_contacts: política workspace-scoped (mantém legacy owner)
CREATE POLICY "deal_contacts_workspace_all"
  ON public.deal_contacts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deals d
       WHERE d.id = deal_contacts.deal_id
         AND public.is_workspace_member(d.workspace_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deals d
       WHERE d.id = deal_contacts.deal_id
         AND public.is_workspace_member(d.workspace_id, auth.uid())
    )
  );

-- 3) enrichment_job_items: política workspace-scoped
CREATE POLICY "enrichment_job_items_workspace_all"
  ON public.enrichment_job_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.enrichment_jobs j
       WHERE j.id = enrichment_job_items.job_id
         AND public.is_workspace_member(j.workspace_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.enrichment_jobs j
       WHERE j.id = enrichment_job_items.job_id
         AND public.is_workspace_member(j.workspace_id, auth.uid())
    )
  );

-- 4) segment_members: política workspace-scoped
CREATE POLICY "segment_members_workspace_all"
  ON public.segment_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.segments s
       WHERE s.id = segment_members.segment_id
         AND public.is_workspace_member(s.workspace_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.segments s
       WHERE s.id = segment_members.segment_id
         AND public.is_workspace_member(s.workspace_id, auth.uid())
    )
  );

-- 5) current_user_workspaces: NÃO devolver TODOS os workspaces para platform admins.
-- Acesso amplo para super-admin deve passar por server functions usando service role.
CREATE OR REPLACE FUNCTION public.current_user_workspaces()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
$$;

-- is_workspace_member já mantém o bypass para platform_admin via OR is_platform_admin(_user).
-- Para realmente isolar dados de tenants, removemos esse bypass também:
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
     WHERE workspace_id = _workspace AND user_id = _user
  )
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin_v2(_workspace uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
     WHERE workspace_id = _workspace AND user_id = _user AND role = 'admin'
  )
$$;
