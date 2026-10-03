-- Fase 2 Representante externa: aditivo; só afeta cargos com restricted_visibility.
CREATE OR REPLACE FUNCTION public.rep_is_restricted()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rep_restricted_workspaces());
$$;
GRANT EXECUTE ON FUNCTION public.rep_is_restricted() TO authenticated;

-- Empresas do próprio representante (sem as "vinculadas").
CREATE OR REPLACE FUNCTION public.rep_my_company_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.companies WHERE owner_id = auth.uid() OR assigned_to = auth.uid();
$$;
CREATE OR REPLACE FUNCTION public.rep_my_contact_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.contacts WHERE owner_id = auth.uid() OR assigned_to = auth.uid();
$$;

-- Histórico de outros vendedores em empresas/contatos vinculados deixa de aparecer.
DROP POLICY IF EXISTS rep_scope_select_activities ON public.activities;
CREATE POLICY rep_scope_select_activities ON public.activities AS RESTRICTIVE FOR SELECT TO authenticated
  USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces())
         OR owner_id = auth.uid() OR assigned_to = auth.uid()
         OR related_lead_id IN (SELECT public.rep_my_lead_ids())
         OR related_deal_id IN (SELECT public.rep_my_deal_ids())
         OR related_contact_id IN (SELECT public.rep_my_contact_ids())
         OR related_company_id IN (SELECT public.rep_my_company_ids()));

-- Busca "empresa já cadastrada" para o representante: só id e nome, sem detalhes.
CREATE OR REPLACE FUNCTION public.rep_find_companies(_q text)
RETURNS TABLE(id uuid, name text, other_owner boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name,
         coalesce(c.assigned_to, c.owner_id) IS DISTINCT FROM auth.uid()
  FROM public.companies c
  WHERE public.rep_is_restricted()
    AND length(trim(coalesce(_q, ''))) >= 3
    AND c.workspace_id IN (SELECT public.rep_restricted_workspaces())
    AND c.deleted_at IS NULL
    AND (c.name ILIKE '%' || trim(_q) || '%'
         OR regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g') =
            nullif(regexp_replace(_q, '\D', '', 'g'), ''))
  ORDER BY c.name
  LIMIT 8;
$$;
GRANT EXECUTE ON FUNCTION public.rep_find_companies(text) TO authenticated;

-- Responsável atual da empresa (para o aviso de conflito de carteira).
CREATE OR REPLACE FUNCTION public.company_portfolio_owner(_company_id uuid)
RETURNS TABLE(owner_id uuid, owner_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(c.assigned_to, c.owner_id), p.full_name
  FROM public.companies c
  LEFT JOIN public.profiles p ON p.id = coalesce(c.assigned_to, c.owner_id)
  WHERE c.id = _company_id
    AND public.is_workspace_member(c.workspace_id, auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.company_portfolio_owner(uuid) TO authenticated;