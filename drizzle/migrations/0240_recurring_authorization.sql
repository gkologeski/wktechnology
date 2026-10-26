-- Legacy recurring billing is subject to the existing Finance matrix.
-- No default, role, override or membership grants are changed.
CREATE OR REPLACE FUNCTION public.recurring_context_access(c jsonb,w uuid,r text,a text,o uuid)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce(c->>'workspace'=w::text AND c->>'actor' IS NOT NULL
 AND r IN('recurrences','invoices') AND a IN('view','create','update','delete')
 AND (a='view' OR NOT coalesce((c->>'read_only')::boolean,true))
 AND (c->'keys'?('techfinance.'||r||'.view.workspace') OR(c->'keys'?('techfinance.'||r||'.view.own') AND c->>'actor'=o::text) OR(c->'keys'?('techfinance.'||r||'.view.team') AND(c->>'actor'=o::text OR c->'team'?o::text)))
 AND (c->'keys'?('techfinance.'||r||'.'||a||'.workspace') OR(c->'keys'?('techfinance.'||r||'.'||a||'.own') AND c->>'actor'=o::text) OR(c->'keys'?('techfinance.'||r||'.'||a||'.team') AND(c->>'actor'=o::text OR c->'team'?o::text))),false)
$$;
REVOKE ALL ON FUNCTION public.recurring_context_access(jsonb,uuid,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.recurring_context_access(jsonb,uuid,text,text,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.recurring_invoice_access(c jsonb,w uuid,a text,o uuid,p uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT recurring_context_access(c,w,'invoices',a,o) AND EXISTS(SELECT 1 FROM subscriptions s WHERE s.id=p AND s.workspace_id=w AND recurring_context_access(c,s.workspace_id,'recurrences','view',s.owner_id))
$$;
REVOKE ALL ON FUNCTION public.recurring_invoice_access(jsonb,uuid,text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.recurring_invoice_access(jsonb,uuid,text,uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.recurring_reference_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();BEGIN
 IF TG_OP='UPDATE' AND(NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id) THEN
 RAISE EXCEPTION 'Responsável e workspace são imutáveis nesta configuração.' USING ERRCODE='42501';END IF;
 -- Service-owned writers retain explicit tenant validation too.
 IF TG_TABLE_NAME='subscriptions' THEN
  IF NOT EXISTS(SELECT 1 FROM contacts WHERE id=NEW.contact_id AND workspace_id=NEW.workspace_id)
   OR(NEW.plan_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM recurring_plans WHERE id=NEW.plan_id AND workspace_id=NEW.workspace_id))
   OR(NEW.deal_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM deals WHERE id=NEW.deal_id AND workspace_id=NEW.workspace_id)) THEN
   RAISE EXCEPTION 'Vínculo de assinatura fora do workspace.' USING ERRCODE='42501';END IF;
  IF auth.uid() IS NOT NULL AND(TG_OP='INSERT' OR NEW.contact_id IS DISTINCT FROM OLD.contact_id OR NEW.deal_id IS DISTINCT FROM OLD.deal_id OR NEW.plan_id IS DISTINCT FROM OLD.plan_id) AND(NOT sales_record_access('contacts',NEW.contact_id,'view') OR(NEW.deal_id IS NOT NULL AND NOT sales_record_access('deals',NEW.deal_id,'view')) OR(NEW.plan_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM recurring_plans p WHERE p.id=NEW.plan_id AND recurring_context_access(c,p.workspace_id,'recurrences','view',p.owner_id)))) THEN
   RAISE EXCEPTION 'Vínculo de assinatura indisponível.' USING ERRCODE='42501';END IF;
 ELSIF TG_TABLE_NAME='subscription_invoices' THEN
  IF NOT EXISTS(SELECT 1 FROM subscriptions WHERE id=NEW.subscription_id AND workspace_id=NEW.workspace_id) THEN
  RAISE EXCEPTION 'Fatura e assinatura pertencem a workspaces diferentes.' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.recurring_reference_guard() FROM PUBLIC,anon,authenticated;
DO $pol$DECLARE t text;p record;action text;cmd text;predicate text;BEGIN
 FOREACH t IN ARRAY ARRAY['recurring_plans','subscriptions','subscription_invoices'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t AND permissive='PERMISSIVE' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);END LOOP;
  FOREACH action IN ARRAY ARRAY['view','create','update','delete'] LOOP
   cmd:=CASE action WHEN 'view' THEN 'SELECT' WHEN 'create' THEN 'INSERT' WHEN 'update' THEN 'UPDATE' ELSE 'DELETE' END;
   predicate:=CASE WHEN t='subscription_invoices' THEN format('public.recurring_invoice_access((SELECT public.work_access_context()),workspace_id,%L,owner_id,subscription_id)',action) ELSE format('public.recurring_context_access((SELECT public.work_access_context()),workspace_id,''recurrences'',%L,owner_id)',action) END;
   IF action='create' THEN predicate:=predicate||' AND owner_id=auth.uid()';END IF;
   EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO authenticated %s %s','recurring_'||action,t,cmd,CASE WHEN action<>'create' THEN 'USING('||predicate||')' ELSE '' END,CASE WHEN action IN('create','update') THEN 'WITH CHECK('||predicate||')' ELSE '' END);
  END LOOP;
  EXECUTE format('CREATE TRIGGER recurring_reference_guard BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.recurring_reference_guard()',t);
 END LOOP;
END $pol$;
CREATE OR REPLACE FUNCTION public.recurring_area_authorize(r text,a text DEFAULT 'view')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();BEGIN
 IF c->>'actor' IS NULL OR r NOT IN('recurrences','invoices') OR a NOT IN('view','create','update','delete')
 OR NOT EXISTS(SELECT 1 FROM unnest(ARRAY['own','team','workspace'])s WHERE c->'keys'?('techfinance.'||r||'.view.'||s))
 OR NOT EXISTS(SELECT 1 FROM unnest(ARRAY['own','team','workspace'])s WHERE c->'keys'?('techfinance.'||r||'.'||a||'.'||s))
 OR(a<>'view' AND coalesce((c->>'read_only')::boolean,true)) THEN
 RAISE EXCEPTION 'Sem permissão para esta ação de recorrência.' USING ERRCODE='42501';END IF;RETURN c;
END $$;
REVOKE ALL ON FUNCTION public.recurring_area_authorize(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.recurring_area_authorize(text,text) TO authenticated;
