-- Cargo com visibilidade restrita (ex.: Representante de Vendas externa).
-- Aditivo: só afeta usuários cujo cargo tenha restricted_visibility = true.
ALTER TABLE public.job_roles
  ADD COLUMN IF NOT EXISTS restricted_visibility boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.job_roles.restricted_visibility IS
  'Quando true, o usuário só lê/edita no TechSales o que é dele (responsável ou criador) e os registros vinculados; exclui só o que criou.';

CREATE OR REPLACE FUNCTION public.is_sales_restricted(_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
    AND NOT public.is_workspace_admin_of(_workspace_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_job_roles ujr
      JOIN public.job_roles jr ON jr.id = ujr.role_id
      WHERE ujr.user_id = auth.uid()
        AND jr.restricted_visibility
        AND (ujr.workspace_id = _workspace_id OR jr.workspace_id = _workspace_id)
    );
$$;

-- "Meu" registro: sou o responsável ou o criador.
CREATE OR REPLACE FUNCTION public.rep_is_mine(_owner_id uuid, _assigned_to uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (_owner_id = auth.uid() OR _assigned_to = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.rep_can_see_lead(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.leads l WHERE l.id = _id
    AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR l.assigned_user_id = auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.rep_can_see_deal(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.deals d WHERE d.id = _id
    AND (d.owner_id = auth.uid() OR d.assigned_to = auth.uid()));
$$;

-- Empresa visível: minha, ou ligada a um lead/negócio/contato meu.
CREATE OR REPLACE FUNCTION public.rep_can_see_company(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = _id
           AND (c.owner_id = auth.uid() OR c.assigned_to = auth.uid()))
      OR EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = _id
           AND (l.owner_id = auth.uid() OR l.assigned_to = auth.uid() OR l.assigned_user_id = auth.uid()))
      OR EXISTS (SELECT 1 FROM public.deals d WHERE d.company_id = _id
           AND (d.owner_id = auth.uid() OR d.assigned_to = auth.uid()))
      OR EXISTS (SELECT 1 FROM public.contacts ct WHERE ct.company_id = _id
           AND (ct.owner_id = auth.uid() OR ct.assigned_to = auth.uid()));
$$;

-- Contato visível: meu, de empresa vinculada, ou ligado a negócio meu.
CREATE OR REPLACE FUNCTION public.rep_can_see_contact(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.contacts ct WHERE ct.id = _id
           AND (ct.owner_id = auth.uid() OR ct.assigned_to = auth.uid()
                OR (ct.company_id IS NOT NULL AND public.rep_can_see_company(ct.company_id))))
      OR EXISTS (SELECT 1 FROM public.deal_contacts dc WHERE dc.contact_id = _id
           AND public.rep_can_see_deal(dc.deal_id));
$$;

-- Políticas RESTRITIVAS: para quem não é restrito, "NOT is_sales_restricted" é
-- verdadeiro e nada muda. As políticas permissivas existentes continuam valendo.
CREATE POLICY rep_scope_select_leads ON public.leads AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.is_sales_restricted(workspace_id)
         OR owner_id = auth.uid() OR assigned_to = auth.uid() OR assigned_user_id = auth.uid());
CREATE POLICY rep_scope_update_leads ON public.leads AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_sales_restricted(workspace_id)
         OR owner_id = auth.uid() OR assigned_to = auth.uid() OR assigned_user_id = auth.uid());
CREATE POLICY rep_scope_delete_leads ON public.leads AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_sales_restricted(workspace_id) OR owner_id = auth.uid());

CREATE POLICY rep_scope_select_deals ON public.deals AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.is_sales_restricted(workspace_id) OR public.rep_is_mine(owner_id, assigned_to));
CREATE POLICY rep_scope_update_deals ON public.deals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_sales_restricted(workspace_id) OR public.rep_is_mine(owner_id, assigned_to));
CREATE POLICY rep_scope_delete_deals ON public.deals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_sales_restricted(workspace_id) OR owner_id = auth.uid());

CREATE POLICY rep_scope_select_companies ON public.companies AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.is_sales_restricted(workspace_id) OR public.rep_can_see_company(id));
CREATE POLICY rep_scope_update_companies ON public.companies AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_sales_restricted(workspace_id) OR public.rep_is_mine(owner_id, assigned_to));
CREATE POLICY rep_scope_delete_companies ON public.companies AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_sales_restricted(workspace_id) OR owner_id = auth.uid());

CREATE POLICY rep_scope_select_contacts ON public.contacts AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.is_sales_restricted(workspace_id) OR public.rep_can_see_contact(id));
CREATE POLICY rep_scope_update_contacts ON public.contacts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_sales_restricted(workspace_id) OR public.rep_is_mine(owner_id, assigned_to));
CREATE POLICY rep_scope_delete_contacts ON public.contacts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_sales_restricted(workspace_id) OR owner_id = auth.uid());

-- Atividades: todas as das entidades dela; edita/exclui só as dela.
CREATE POLICY rep_scope_select_activities ON public.activities AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.is_sales_restricted(workspace_id)
         OR public.rep_is_mine(owner_id, assigned_to)
         OR (related_lead_id IS NOT NULL AND public.rep_can_see_lead(related_lead_id))
         OR (related_deal_id IS NOT NULL AND public.rep_can_see_deal(related_deal_id))
         OR (related_contact_id IS NOT NULL AND public.rep_can_see_contact(related_contact_id))
         OR (related_company_id IS NOT NULL AND public.rep_can_see_company(related_company_id)));
CREATE POLICY rep_scope_update_activities ON public.activities AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_sales_restricted(workspace_id) OR public.rep_is_mine(owner_id, assigned_to));
CREATE POLICY rep_scope_delete_activities ON public.activities AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_sales_restricted(workspace_id) OR public.rep_is_mine(owner_id, assigned_to));

-- Cotações: as dela e as dos negócios dela; nunca exclui.
CREATE POLICY rep_scope_select_quotes ON public.quotes AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.is_sales_restricted(workspace_id)
         OR public.rep_is_mine(owner_id, assigned_to)
         OR (deal_id IS NOT NULL AND public.rep_can_see_deal(deal_id)));
CREATE POLICY rep_scope_update_quotes ON public.quotes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_sales_restricted(workspace_id) OR public.rep_is_mine(owner_id, assigned_to));
CREATE POLICY rep_scope_delete_quotes ON public.quotes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_sales_restricted(workspace_id));
