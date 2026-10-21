-- TechProjects — ciclo 6: custo da RLS de apontamentos com 1 milhão de linhas.
-- As políticas restritivas de permissão avaliavam user_has_permission(auth.uid(), workspace_id, ...)
-- POR LINHA (~20 ms cada). Agora a lista de workspaces permitidos é calculada uma vez por consulta.
-- Equivalência: toda linha visível/alterável já precisa estar em current_user_workspaces() pelas
-- políticas permissivas ws_project_time_entries_*; dentro desse conjunto, a regra é a MESMA
-- (admin do workspace OU alguma das permissões listadas, inclusive negações e membership ativo,
-- pois user_has_permission(u, w, k) = k ∈ user_effective_permissions(u, w)).
-- Prova: tests/sql/cycle6-rls-equivalence.sh (conjuntos idênticos por usuário × sessão × comando).
CREATE OR REPLACE FUNCTION public.project_time_perm_workspaces(p_keys text[])
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT w.id FROM public.current_user_workspaces() AS w(id)
   WHERE public.is_workspace_admin_v2(w.id, auth.uid())
      OR EXISTS (SELECT 1 FROM public.user_effective_permissions(auth.uid(), w.id) k WHERE k = ANY (p_keys)) $function$;
REVOKE ALL ON FUNCTION public.project_time_perm_workspaces(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_time_perm_workspaces(text[]) TO authenticated, service_role;

ALTER POLICY ptime_perm_select ON public.project_time_entries
  USING (workspace_id IN (SELECT public.project_time_perm_workspaces(ARRAY[
    'techprojects.time_entries.view.workspace','techprojects.time_entries.view.own',
    'techpeople.timesheet.view.workspace','techpeople.timesheet.view.own'])));
ALTER POLICY ptime_perm_update ON public.project_time_entries
  USING (workspace_id IN (SELECT public.project_time_perm_workspaces(ARRAY[
    'techprojects.time_entries.update.workspace','techprojects.time_entries.update.own',
    'techpeople.timesheet.update.workspace','techpeople.timesheet.update.own'])));
ALTER POLICY ptime_perm_delete ON public.project_time_entries
  USING (workspace_id IN (SELECT public.project_time_perm_workspaces(ARRAY[
    'techprojects.time_entries.delete.workspace','techpeople.timesheet.delete.workspace'])));
