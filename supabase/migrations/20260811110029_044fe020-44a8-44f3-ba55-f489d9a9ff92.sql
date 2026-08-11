-- 1. media_assets: reduce workspace-wide SELECT
DROP POLICY IF EXISTS "media_assets_workspace_select" ON public.media_assets;
CREATE POLICY "media_assets_scoped_select" ON public.media_assets
  FOR SELECT TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR assigned_to = auth.uid()
    OR public.is_workspace_admin(workspace_id, auth.uid())
  );

-- 2. whatsapp-media storage: single policy set per operation
DROP POLICY IF EXISTS "whatsapp_media_owner_read" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp_media_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp_media_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp_media_owner_write" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp_media_workspace_read" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp_media_workspace_update" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp_media_workspace_delete" ON storage.objects;

CREATE POLICY "whatsapp_media_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'whatsapp-media'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "whatsapp_media_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.whatsapp_messages wm
        WHERE wm.media_url = objects.name
          AND wm.workspace_id IN (SELECT public.current_user_workspaces())
      )
    )
  );

CREATE POLICY "whatsapp_media_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.whatsapp_messages wm
        WHERE wm.media_url = objects.name
          AND wm.workspace_id IN (SELECT public.current_user_workspaces())
      )
    )
  )
  WITH CHECK (
    bucket_id = 'whatsapp-media'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.whatsapp_messages wm
        WHERE wm.media_url = objects.name
          AND wm.workspace_id IN (SELECT public.current_user_workspaces())
      )
    )
  );

CREATE POLICY "whatsapp_media_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.whatsapp_messages wm
        WHERE wm.media_url = objects.name
          AND wm.workspace_id IN (SELECT public.current_user_workspaces())
      )
    )
  );

-- 3. sla_policies: drop legacy/duplicate permissive sets, keep one canonical set
DROP POLICY IF EXISTS "sla_policies_admin_select" ON public.sla_policies;
DROP POLICY IF EXISTS "sla_policies_select" ON public.sla_policies;
DROP POLICY IF EXISTS "sla_policies_admin_update" ON public.sla_policies;
DROP POLICY IF EXISTS "sla_policies_team_update" ON public.sla_policies;
DROP POLICY IF EXISTS "sla_policies_update" ON public.sla_policies;
DROP POLICY IF EXISTS "sla_policies_admin_delete" ON public.sla_policies;
DROP POLICY IF EXISTS "sla_policies_team_delete" ON public.sla_policies;
DROP POLICY IF EXISTS "sla_policies_delete" ON public.sla_policies;
DROP POLICY IF EXISTS "sla_policies_insert" ON public.sla_policies;

CREATE POLICY "sla_policies_ws_select" ON public.sla_policies
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "sla_policies_ws_insert" ON public.sla_policies
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "sla_policies_ws_update" ON public.sla_policies
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "sla_policies_ws_delete" ON public.sla_policies
  FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));

-- 4. ATS sourcing / talent pools: remove membership-only and duplicate sets
-- ats_talent_pools
DROP POLICY IF EXISTS "ats_talent_pools_workspace_select" ON public.ats_talent_pools;
DROP POLICY IF EXISTS "ats_talent_pools_workspace_insert" ON public.ats_talent_pools;
DROP POLICY IF EXISTS "ats_talent_pools_workspace_update" ON public.ats_talent_pools;
DROP POLICY IF EXISTS "ats_talent_pools_workspace_delete" ON public.ats_talent_pools;
CREATE POLICY "ats_talent_pools_insert" ON public.ats_talent_pools
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.can_write_owner(owner_id, auth.uid()) OR public.is_workspace_admin_of(owner_id, auth.uid()));

-- ats_referral_programs
DROP POLICY IF EXISTS "ref_prog_workspace_select" ON public.ats_referral_programs;
DROP POLICY IF EXISTS "ref_prog_admin_write" ON public.ats_referral_programs;
CREATE POLICY "ats_referral_programs_insert" ON public.ats_referral_programs
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin_of(owner_id, auth.uid()));

-- ats_interviewer_pools
DROP POLICY IF EXISTS "pools owner all" ON public.ats_interviewer_pools;
CREATE POLICY "ats_interviewer_pools_insert" ON public.ats_interviewer_pools
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.can_write_owner(owner_id, auth.uid()) OR public.is_workspace_admin_of(owner_id, auth.uid()));
CREATE POLICY "ats_interviewer_pools_owner_select" ON public.ats_interviewer_pools
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- ats_sourcing_sequences
DROP POLICY IF EXISTS "seq_workspace_select" ON public.ats_sourcing_sequences;
DROP POLICY IF EXISTS "seq_workspace_insert" ON public.ats_sourcing_sequences;
DROP POLICY IF EXISTS "seq_workspace_update" ON public.ats_sourcing_sequences;
DROP POLICY IF EXISTS "seq_workspace_delete" ON public.ats_sourcing_sequences;
CREATE POLICY "ats_sourcing_sequences_insert" ON public.ats_sourcing_sequences
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.can_write_owner(owner_id, auth.uid()) OR public.is_workspace_admin_of(owner_id, auth.uid()));
CREATE POLICY "ats_sourcing_sequences_owner_select" ON public.ats_sourcing_sequences
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- ats_applications: keep job-scoped/team/admin set, drop broad owner_all ALL policy
DROP POLICY IF EXISTS "ats_applications_owner_all" ON public.ats_applications;
CREATE POLICY "ats_applications_insert" ON public.ats_applications
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.can_write_owner(owner_id, auth.uid()) OR public.is_workspace_admin_of(owner_id, auth.uid()));
CREATE POLICY "ats_applications_owner_select" ON public.ats_applications
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());