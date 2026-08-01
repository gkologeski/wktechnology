-- 1) meetings: sempre vincular owner_id ao criador
DROP POLICY IF EXISTS ws_insert_meetings ON public.meetings;
CREATE POLICY ws_insert_meetings ON public.meetings
FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND (
    (
      workspace_id IN (SELECT current_user_workspaces())
      AND user_has_permission(auth.uid(), workspace_id, 'techsales.meetings.create.own')
    )
    OR workspace_id IS NULL
  )
);

-- 2) profiles: telefone não visível para pares do workspace
REVOKE SELECT (phone) ON public.profiles FROM authenticated;
REVOKE SELECT (phone) ON public.profiles FROM anon;

-- 3) whatsapp-media: exigir que o objeto pertença a mensagem do workspace do usuário
DROP POLICY IF EXISTS whatsapp_media_workspace_read ON storage.objects;
DROP POLICY IF EXISTS whatsapp_media_workspace_update ON storage.objects;
DROP POLICY IF EXISTS whatsapp_media_workspace_delete ON storage.objects;

CREATE POLICY whatsapp_media_workspace_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'whatsapp-media'
  AND EXISTS (
    SELECT 1 FROM public.whatsapp_messages wm
    WHERE wm.media_url = objects.name
      AND wm.workspace_id IN (SELECT current_user_workspaces())
  )
);

CREATE POLICY whatsapp_media_workspace_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'whatsapp-media'
  AND EXISTS (
    SELECT 1 FROM public.whatsapp_messages wm
    WHERE wm.media_url = objects.name
      AND wm.workspace_id IN (SELECT current_user_workspaces())
  )
)
WITH CHECK (
  bucket_id = 'whatsapp-media'
  AND EXISTS (
    SELECT 1 FROM public.whatsapp_messages wm
    WHERE wm.media_url = objects.name
      AND wm.workspace_id IN (SELECT current_user_workspaces())
  )
);

CREATE POLICY whatsapp_media_workspace_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'whatsapp-media'
  AND EXISTS (
    SELECT 1 FROM public.whatsapp_messages wm
    WHERE wm.media_url = objects.name
      AND wm.workspace_id IN (SELECT current_user_workspaces())
  )
);