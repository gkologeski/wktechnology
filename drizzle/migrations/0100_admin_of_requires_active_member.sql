-- Admin desativado (workspace_members.status <> 'active') deixa de ser tratado como admin.
-- Antes, is_workspace_admin_of ignorava o status: um admin desativado continuava lendo
-- e-mails/WhatsApp/agenda de membros pelas políticas que chamam esta função.
-- Só endurece (nenhum admin inativo existe hoje); o criador do workspace segue igual.
CREATE OR REPLACE FUNCTION public.is_workspace_admin_of(_owner uuid, _user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
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
         AND wm.status = 'active'
    )
    OR EXISTS (
      SELECT 1
        FROM public.workspace_members actor
        JOIN public.workspace_members owner_m
          ON owner_m.workspace_id = actor.workspace_id
       WHERE actor.user_id = _user
         AND actor.role IN ('owner','admin')
         AND actor.status = 'active'
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
         AND actor.status = 'active'
    );
$function$;
