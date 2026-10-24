-- Activate only after compatible application publication. No role grants.
DO $$ DECLARE t text;p record;BEGIN
 FOREACH t IN ARRAY ARRAY['bank_connections','bank_connection_tokens','bank_connection_events','bank_payments','bank_charges','bank_statement_transactions'] LOOP
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t AND permissive='PERMISSIVE' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);END LOOP;
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 END LOOP;
END $$;
-- Credentials, connection state, raw provider payload and audit writes never come from browser DML.
GRANT SELECT(id,workspace_id,provider,status,mode,display_name,scopes,external_account_id,last_sync_at,last_error,current_balance,balance_synced_at,last_statement_sync_at,created_at,updated_at) ON bank_connections TO authenticated;
GRANT SELECT(id,connection_id,workspace_id,event_type,actor_id,payload,created_at) ON bank_connection_events TO authenticated;
GRANT SELECT ON bank_payments,bank_charges TO authenticated;
GRANT SELECT(id,workspace_id,connection_id,bank_account_id,external_id,posted_at,amount,direction,description,counterparty,category,balance_after,reconciliation_status,matched_payment_id,created_at,updated_at) ON bank_statement_transactions TO authenticated;
CREATE POLICY banking_view ON bank_connections FOR SELECT TO authenticated USING(banking_access(workspace_id,'view'));
CREATE POLICY banking_view ON bank_connection_events FOR SELECT TO authenticated USING(banking_access(workspace_id,'view'));
CREATE POLICY banking_view ON bank_payments FOR SELECT TO authenticated USING(banking_access(workspace_id,'view'));
CREATE POLICY banking_view ON bank_charges FOR SELECT TO authenticated USING(banking_access(workspace_id,'view'));
CREATE POLICY banking_view ON bank_statement_transactions FOR SELECT TO authenticated USING(banking_access(workspace_id,'view'));
-- Reconciliation is the only caller-bound statement write; guard checks the linked payment.
GRANT UPDATE(reconciliation_status,matched_payment_id) ON bank_statement_transactions TO authenticated;
CREATE POLICY banking_reconcile ON bank_statement_transactions FOR UPDATE TO authenticated USING(banking_access(workspace_id,'reconcile')) WITH CHECK(banking_access(workspace_id,'reconcile'));
CREATE OR REPLACE FUNCTION public.banking_statement_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE p financial_payments;e financial_entries;BEGIN
 IF current_user IN('postgres','supabase_admin','service_role') THEN RETURN NEW;END IF;
 IF NOT banking_access(OLD.workspace_id,'reconcile') OR (to_jsonb(NEW)-ARRAY['reconciliation_status','matched_payment_id','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['reconciliation_status','matched_payment_id','updated_at']) THEN RAISE EXCEPTION 'Alteração bancária não autorizada.' USING ERRCODE='42501';END IF;
 IF NEW.reconciliation_status='matched' THEN
 SELECT * INTO p FROM financial_payments WHERE id=NEW.matched_payment_id AND workspace_id=OLD.workspace_id;
 SELECT * INTO e FROM financial_entries WHERE id=p.entry_id AND workspace_id=OLD.workspace_id;
 IF p.id IS NULL OR e.id IS NULL OR NOT finance_payment_access(e.id,'view') OR p.amount<>abs(OLD.amount) OR (OLD.direction='credit' AND e.direction<>'receivable') OR (OLD.direction='debit' AND e.direction<>'payable') THEN RAISE EXCEPTION 'Baixa incompatível ou indisponível.' USING ERRCODE='23514';END IF;
 -- One payment cannot be matched twice, even across concurrent statements.
 PERFORM pg_advisory_xact_lock(hashtextextended('banking-match:'||p.id,0));
 IF EXISTS(SELECT 1 FROM bank_statement_transactions WHERE matched_payment_id=p.id AND reconciliation_status='matched' AND id<>OLD.id) THEN RAISE EXCEPTION 'Baixa já conciliada.' USING ERRCODE='23514';END IF;
 ELSIF NEW.matched_payment_id IS NOT NULL THEN RAISE EXCEPTION 'Somente conciliação pode vincular baixa.' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.banking_statement_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zzz_banking_statement_guard BEFORE UPDATE ON bank_statement_transactions FOR EACH ROW EXECUTE FUNCTION public.banking_statement_guard();
NOTIFY pgrst,'reload schema';
