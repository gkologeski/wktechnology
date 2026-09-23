-- Corrige a checagem de administrador usada em policies RESTRICTIVE.
-- Os policies passam `owner_id` (um user id), mas a função só reconhecia
-- workspace ids, então nunca reconhecia ninguém como administrador.
CREATE OR REPLACE FUNCTION public.is_workspace_admin_of(_owner uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (
      SELECT 1 FROM public.workspaces w
       WHERE w.id = _owner AND w.created_by = _user
    )
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
       WHERE wm.workspace_id = _owner
         AND wm.user_id = _user
         AND wm.role IN ('owner','admin')
    )
    OR EXISTS (
      SELECT 1
        FROM public.workspace_members actor
        JOIN public.workspace_members owner_m
          ON owner_m.workspace_id = actor.workspace_id
       WHERE actor.user_id = _user
         AND actor.role IN ('owner','admin')
         AND owner_m.user_id = _owner
    )
    OR EXISTS (
      SELECT 1
        FROM public.workspaces w
        JOIN public.workspace_members actor
          ON actor.workspace_id = w.id
       WHERE w.created_by = _owner
         AND actor.user_id = _user
         AND actor.role IN ('owner','admin')
    );
$function$;

-- Resolve o workspace a partir de um user id também por vínculo de membro.
CREATE OR REPLACE FUNCTION public.resolve_workspace_id(_owner uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT w.id FROM public.workspaces w WHERE w.id = _owner),
    (SELECT w.id FROM public.workspaces w WHERE w.created_by = _owner ORDER BY w.created_at LIMIT 1),
    (SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = _owner ORDER BY wm.joined_at LIMIT 1)
  );
$function$;
