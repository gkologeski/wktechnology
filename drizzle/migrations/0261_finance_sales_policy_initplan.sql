-- A política por linha chamava finance_sales_access para cada venda e estourava o tempo.
-- Agora a permissão é avaliada uma vez por consulta e a linha só compara o workspace.
CREATE OR REPLACE FUNCTION public.finance_sales_visible_workspaces()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT COALESCE(array_agg(m.workspace_id), '{}'::uuid[])
  FROM public.workspace_members m
  WHERE m.user_id = auth.uid()
    AND m.status = 'active'
    AND public.finance_sales_access(m.workspace_id, auth.uid())
$$;
REVOKE ALL ON FUNCTION public.finance_sales_visible_workspaces() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.finance_sales_visible_workspaces() TO authenticated, service_role;

DROP POLICY IF EXISTS finance_sales_select ON public.finance_sales;
CREATE POLICY finance_sales_select ON public.finance_sales FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT unnest(public.finance_sales_visible_workspaces())));