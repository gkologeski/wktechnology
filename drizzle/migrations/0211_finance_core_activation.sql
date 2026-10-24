-- Activate only after publishing compatible handlers and UI.
DO $$ DECLARE t text;p record;BEGIN
 FOREACH t IN ARRAY ARRAY['financial_entries','financial_payments'] LOOP
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t AND permissive='PERMISSIVE' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);END LOOP;
 END LOOP;
END $$;
CREATE POLICY finance_view ON public.financial_entries FOR SELECT TO authenticated USING(finance_context_access((SELECT finance_access_context()),workspace_id,'entries','view',COALESCE(assigned_to,owner_id)));
CREATE POLICY finance_create ON public.financial_entries FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid() AND COALESCE(assigned_to,owner_id)=auth.uid() AND finance_scope_access(workspace_id,'entries','create',auth.uid()));
CREATE POLICY finance_update ON public.financial_entries FOR UPDATE TO authenticated USING(finance_context_entry_access((SELECT finance_access_context()),workspace_id,'update',COALESCE(assigned_to,owner_id)) OR finance_context_entry_access((SELECT finance_access_context()),workspace_id,'cancel',COALESCE(assigned_to,owner_id))) WITH CHECK(finance_context_access((SELECT finance_access_context()),workspace_id,'entries','view',COALESCE(assigned_to,owner_id)));
CREATE POLICY finance_delete ON public.financial_entries FOR DELETE TO authenticated USING(finance_context_entry_access((SELECT finance_access_context()),workspace_id,'delete',COALESCE(assigned_to,owner_id)));
CREATE POLICY finance_view ON public.financial_payments FOR SELECT TO authenticated USING(finance_context_payment_access((SELECT finance_access_context()),entry_id,workspace_id,'view'));
CREATE POLICY finance_create ON public.financial_payments FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND finance_context_payment_access((SELECT finance_access_context()),entry_id,workspace_id,'create'));
-- A posted payment is immutable. Reverse (delete) and post a corrected record.
CREATE POLICY finance_delete ON public.financial_payments FOR DELETE TO authenticated USING(finance_context_payment_access((SELECT finance_access_context()),entry_id,workspace_id,'delete'));

CREATE OR REPLACE FUNCTION public.finance_core_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE e public.financial_entries;v_total numeric;v_row jsonb;v_ref record;v_workspace uuid;v_id uuid;BEGIN
 -- Internal recalc and trusted service writers keep their explicit origin tenant.
 -- No authenticated caller can SET ROLE to these database owners.
 IF current_user NOT IN('authenticated','anon') THEN RETURN COALESCE(NEW,OLD);END IF;
 IF auth.uid() IS NULL OR public.is_read_only_view() THEN RAISE EXCEPTION 'Operação financeira não autorizada.' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='financial_entries' THEN
  IF TG_OP='DELETE' THEN
   IF OLD.paid_amount<>0 OR EXISTS(SELECT 1 FROM financial_payments WHERE entry_id=OLD.id) THEN RAISE EXCEPTION 'Reverta as baixas antes de excluir o lançamento.' USING ERRCODE='23514';END IF;
   RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' THEN
   IF NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.parent_entry_id IS DISTINCT FROM OLD.parent_entry_id OR NEW.origin_type IS DISTINCT FROM OLD.origin_type OR NEW.origin_id IS DISTINCT FROM OLD.origin_id THEN RAISE EXCEPTION 'Autoria, origem e workspace são imutáveis.' USING ERRCODE='42501';END IF;
   IF NEW.paid_amount IS DISTINCT FROM OLD.paid_amount OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status<>'cancelled') THEN RAISE EXCEPTION 'O saldo e o status são calculados pelas baixas.' USING ERRCODE='23514';END IF;
   IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT finance_entry_access(OLD.id,'cancel') THEN RAISE EXCEPTION 'Sem permissão para cancelar.' USING ERRCODE='42501';END IF;
    IF OLD.paid_amount<>0 THEN RAISE EXCEPTION 'Reverta as baixas antes de cancelar.' USING ERRCODE='23514';END IF;
   END IF;
   IF (to_jsonb(NEW)-ARRAY['status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','updated_at']) AND NOT finance_entry_access(OLD.id,'update') THEN RAISE EXCEPTION 'Sem permissão para editar.' USING ERRCODE='42501';END IF;
   IF OLD.paid_amount<>0 AND (NEW.amount,NEW.currency,NEW.direction,NEW.competence_date) IS DISTINCT FROM (OLD.amount,OLD.currency,OLD.direction,OLD.competence_date) THEN RAISE EXCEPTION 'Reverta as baixas antes de alterar condições financeiras.' USING ERRCODE='23514';END IF;
   IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NOT user_has_permission(auth.uid(),NEW.workspace_id,'techfinance.entries.assign.workspace') THEN RAISE EXCEPTION 'Sem permissão para reatribuir.' USING ERRCODE='42501';END IF;
  ELSE
   IF NEW.paid_amount<>0 OR NEW.status NOT IN('open','overdue') THEN RAISE EXCEPTION 'Novo lançamento deve iniciar sem baixas.' USING ERRCODE='23514';END IF;
  END IF;
  IF NEW.assigned_to IS NOT NULL AND NOT is_workspace_member(NEW.workspace_id,NEW.assigned_to) THEN RAISE EXCEPTION 'Responsável inativo ou de outro workspace.' USING ERRCODE='23514';END IF;
  IF NEW.amount<=0 OR NEW.amount::text IN('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Valor deve ser positivo.' USING ERRCODE='23514';END IF;
  IF TG_OP='UPDATE' AND NEW.amount IS DISTINCT FROM OLD.amount AND NEW.amount<(SELECT COALESCE(sum(a.amount),0) FROM financial_entry_allocations a WHERE a.entry_id=NEW.id) THEN RAISE EXCEPTION 'Valor inferior ao rateio existente.' USING ERRCODE='23514';END IF;
  v_row:=to_jsonb(NEW);v_workspace:=NEW.workspace_id;
  FOR v_ref IN SELECT * FROM (VALUES('category_id','financial_categories'),('counterparty_company_id','companies'),('contract_id','contracts'),('service_id','services'),('project_id','projects'),('legal_entity_id','legal_entities'),('counterparty_legal_entity_id','legal_entities'),('parent_entry_id','financial_entries')) r(col,tbl) LOOP
   v_id:=(v_row->>v_ref.col)::uuid;
   IF v_id IS NOT NULL AND (TG_OP='INSERT' OR (to_jsonb(NEW)->v_ref.col) IS DISTINCT FROM (to_jsonb(OLD)->v_ref.col)) THEN
    -- Caller must be able to resolve the parent through its own RLS too.
    EXECUTE format('SELECT workspace_id FROM public.%I WHERE id=$1',v_ref.tbl) INTO v_id USING v_id;
    IF v_id IS DISTINCT FROM v_workspace THEN RAISE EXCEPTION 'Vínculo financeiro indisponível ou de outro workspace.' USING ERRCODE='23514';END IF;
   END IF;
  END LOOP;
 ELSE
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Baixa contabilizada é imutável; reverta e registre novamente.' USING ERRCODE='23514';END IF;
  v_row:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  e:=finance_lock_payment_entry((v_row->>'entry_id')::uuid,CASE WHEN TG_OP='DELETE' THEN 'delete' ELSE 'create' END);
  IF e.id IS NULL OR e.workspace_id IS DISTINCT FROM (v_row->>'workspace_id')::uuid OR NOT finance_payment_access(e.id,CASE WHEN TG_OP='DELETE' THEN 'delete' ELSE 'create' END) THEN RAISE EXCEPTION 'Lançamento indisponível ou sem permissão para a baixa.' USING ERRCODE='42501';END IF;
  IF TG_OP='INSERT' THEN
   IF e.status='cancelled' OR NEW.amount<=0 OR NEW.created_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Baixa inválida.' USING ERRCODE='23514';END IF;
   IF NEW.bank_account_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM financial_bank_accounts a WHERE a.id=NEW.bank_account_id AND a.workspace_id=e.workspace_id AND a.active) THEN RAISE EXCEPTION 'Conta bancária indisponível.' USING ERRCODE='23514';END IF;
   -- paid_amount is authoritative even if the caller cannot SELECT other payments.
   IF e.paid_amount+NEW.amount>e.amount THEN RAISE EXCEPTION 'A baixa excede o saldo em aberto.' USING ERRCODE='23514';END IF;
  END IF;
 END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
REVOKE ALL ON FUNCTION public.finance_core_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zzz_finance_core_guard BEFORE INSERT OR UPDATE OR DELETE ON public.financial_entries FOR EACH ROW EXECUTE FUNCTION public.finance_core_guard();
CREATE TRIGGER zzz_finance_core_guard BEFORE INSERT OR UPDATE OR DELETE ON public.financial_payments FOR EACH ROW EXECUTE FUNCTION public.finance_core_guard();
NOTIFY pgrst,'reload schema';

DO $$ DECLARE p record;BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='financial_recurrences' AND permissive='PERMISSIVE' LOOP EXECUTE format('DROP POLICY %I ON public.financial_recurrences',p.policyname);END LOOP;
END $$;
CREATE POLICY finance_view ON public.financial_recurrences FOR SELECT TO authenticated USING(finance_context_access((SELECT finance_access_context()),workspace_id,'recurrences','view',COALESCE(assigned_to,owner_id)));
CREATE POLICY finance_create ON public.financial_recurrences FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid() AND COALESCE(assigned_to,owner_id)=auth.uid() AND finance_scope_access(workspace_id,'recurrences','create',auth.uid()));
CREATE POLICY finance_update ON public.financial_recurrences FOR UPDATE TO authenticated USING(finance_recurrence_access(id,'update')) WITH CHECK(finance_scope_access(workspace_id,'recurrences','update',COALESCE(assigned_to,owner_id)));
CREATE POLICY finance_delete ON public.financial_recurrences FOR DELETE TO authenticated USING(finance_recurrence_access(id,'delete'));
CREATE OR REPLACE FUNCTION public.finance_recurrence_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF current_user NOT IN('authenticated','anon') THEN RETURN COALESCE(NEW,OLD);END IF;
 IF TG_OP='DELETE' THEN
  IF OLD.occurrences_generated>0 THEN RAISE EXCEPTION 'Recorrência com histórico: pause em vez de excluir.' USING ERRCODE='23514';END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND ((NEW.id,NEW.owner_id,NEW.workspace_id,NEW.assigned_to,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.owner_id,OLD.workspace_id,OLD.assigned_to,OLD.created_at)) THEN RAISE EXCEPTION 'Identidade e autoria da recorrência são imutáveis.' USING ERRCODE='42501';END IF;
 IF (TG_OP='INSERT' AND (NEW.occurrences_generated<>0 OR NEW.last_generated_entry_id IS NOT NULL OR NEW.next_run_date<>NEW.start_date)) OR (TG_OP='UPDATE' AND (NEW.occurrences_generated,NEW.last_generated_entry_id,NEW.next_run_date) IS DISTINCT FROM (OLD.occurrences_generated,OLD.last_generated_entry_id,OLD.next_run_date)) THEN RAISE EXCEPTION 'Progresso da recorrência é atualizado somente pelo gerador atômico.' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(NEW.template) IS DISTINCT FROM 'object' OR (COALESCE((NEW.template->>'amount')::numeric,0)<=0 OR (NEW.template->>'amount') IN('NaN','Infinity','-Infinity')) OR length(trim(COALESCE(NEW.template->>'description','')))=0 OR (NEW.end_date IS NOT NULL AND NEW.end_date<NEW.start_date) THEN RAISE EXCEPTION 'Modelo ou intervalo de recorrência inválido.' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.finance_recurrence_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zzz_finance_recurrence_guard BEFORE INSERT OR UPDATE OR DELETE ON public.financial_recurrences FOR EACH ROW EXECUTE FUNCTION public.finance_recurrence_guard();

-- Cost allocations are entry children, never writable just because entry.view
-- passed. They do not introduce a parallel finance mutation permission.
DO $$ DECLARE p record;BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='financial_entry_allocations' AND permissive='PERMISSIVE' LOOP EXECUTE format('DROP POLICY %I ON public.financial_entry_allocations',p.policyname);END LOOP;
END $$;
CREATE POLICY finance_view ON public.financial_entry_allocations FOR SELECT TO authenticated USING(finance_entry_access(entry_id,'view'));
CREATE POLICY finance_create ON public.financial_entry_allocations FOR INSERT TO authenticated WITH CHECK(finance_entry_access(entry_id,'update'));
CREATE POLICY finance_update ON public.financial_entry_allocations FOR UPDATE TO authenticated USING(finance_entry_access(entry_id,'update')) WITH CHECK(finance_entry_access(entry_id,'update'));
CREATE POLICY finance_delete ON public.financial_entry_allocations FOR DELETE TO authenticated USING(finance_entry_access(entry_id,'update'));
CREATE OR REPLACE FUNCTION public.finance_allocation_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE e public.financial_entries;total numeric;BEGIN
 IF current_user NOT IN('authenticated','anon') THEN RETURN COALESCE(NEW,OLD);END IF;
 SELECT * INTO e FROM financial_entries WHERE id=COALESCE(NEW.entry_id,OLD.entry_id) FOR UPDATE;
 -- A parent deletion already authorized by its own RLS cascades allocations.
 IF NOT FOUND AND TG_OP='DELETE' THEN RETURN OLD;END IF;
 IF e.id IS NULL OR NOT finance_entry_access(e.id,'update') THEN RAISE EXCEPTION 'Sem permissão para alterar rateios.' USING ERRCODE='42501';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;
 IF TG_OP='UPDATE' AND (NEW.id,NEW.entry_id) IS DISTINCT FROM (OLD.id,OLD.entry_id) THEN RAISE EXCEPTION 'Vínculo do rateio é imutável.' USING ERRCODE='42501';END IF;
 IF NEW.amount<=0 OR NOT EXISTS(SELECT 1 FROM financial_cost_centers c WHERE c.id=NEW.cost_center_id AND c.workspace_id=e.workspace_id AND c.active) THEN RAISE EXCEPTION 'Centro de custo ou valor inválido.' USING ERRCODE='23514';END IF;
 SELECT COALESCE(sum(a.amount),0) INTO total FROM financial_entry_allocations a WHERE a.entry_id=e.id AND a.id<>NEW.id;
 IF total+NEW.amount>e.amount THEN RAISE EXCEPTION 'Rateio excede o valor do lançamento.' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.finance_allocation_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zzz_finance_allocation_guard BEFORE INSERT OR UPDATE OR DELETE ON public.financial_entry_allocations FOR EACH ROW EXECUTE FUNCTION public.finance_allocation_guard();
NOTIFY pgrst,'reload schema';
