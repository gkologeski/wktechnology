-- Ciclo 10: propagação explícita do tenant da entidade de origem em gatilhos que geravam
-- linhas-filhas sem workspace_id (o DEFAULT fixo do tenant original entrava no lugar).
-- Compatível: com um único workspace o resultado é idêntico; nenhum dado existente é alterado.
-- Rollback: reaplicar as definições anteriores registradas em
-- docs/architecture/performance-cycle-10-workspace-integrity.md (reintroduz o bug; só em emergência).

CREATE OR REPLACE FUNCTION public.create_ticket_survey()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if (tg_op = 'UPDATE')
     and new.status in ('resolved','closed')
     and (old.status is distinct from new.status)
     and not exists (select 1 from public.survey_responses where ticket_id = new.id) then
    if new.workspace_id is null then
      raise exception 'workspace_missing: chamado % sem workspace', new.id using errcode = '23502';
    end if;
    insert into public.survey_responses (workspace_id, owner_id, ticket_id, contact_id, kind)
    values (new.workspace_id, new.owner_id, new.id, new.contact_id, 'csat');
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.subscription_after_insert()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_start DATE; v_end DATE; v_due DATE; v_seq INT; v_contact_ws uuid;
BEGIN
  IF NEW.workspace_id IS NULL THEN
    RAISE EXCEPTION 'workspace_missing: assinatura % sem workspace', NEW.id USING ERRCODE = '23502';
  END IF;
  SELECT workspace_id INTO v_contact_ws FROM public.contacts WHERE id = NEW.contact_id;
  IF v_contact_ws IS NOT NULL AND v_contact_ws <> NEW.workspace_id THEN
    RAISE EXCEPTION 'workspace_mismatch: contato de outro workspace na assinatura %', NEW.id USING ERRCODE = '42501';
  END IF;
  IF NEW.status = 'canceled' OR NEW.status = 'completed' THEN
    RETURN NEW;
  END IF;
  v_start := NEW.start_date;
  v_due := COALESCE(NEW.trial_ends_at, NEW.start_date);
  v_end := public._add_billing_interval(v_start, NEW.interval, NEW.interval_count) - 1;

  SELECT COUNT(*)+1 INTO v_seq FROM public.subscription_invoices WHERE subscription_id = NEW.id;
  INSERT INTO public.subscription_invoices (workspace_id, owner_id, subscription_id, invoice_number, amount, currency, status, period_start, period_end, due_date)
  VALUES (NEW.workspace_id, NEW.owner_id, NEW.id,
          'INV-' || to_char(now(),'YYYYMM') || '-' || lpad(v_seq::text,4,'0') || '-' || substr(NEW.id::text,1,4),
          NEW.amount, NEW.currency, 'pending', v_start, v_end, v_due);

  UPDATE public.subscriptions SET next_billing_at = v_due WHERE id = NEW.id AND next_billing_at IS NULL;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.subscription_invoice_after_paid()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_sub public.subscriptions%ROWTYPE;
  v_next_start DATE; v_next_end DATE; v_next_due DATE; v_seq INT;
BEGIN
  IF NEW.status <> 'paid' OR (OLD.status = 'paid') THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_sub FROM public.subscriptions WHERE id = NEW.subscription_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF v_sub.workspace_id IS NULL OR v_sub.workspace_id <> NEW.workspace_id THEN
    RAISE EXCEPTION 'workspace_mismatch: fatura % e assinatura em workspaces diferentes', NEW.id USING ERRCODE = '42501';
  END IF;

  UPDATE public.subscriptions SET cycles_completed = cycles_completed + 1 WHERE id = v_sub.id;

  IF v_sub.total_cycles IS NOT NULL AND (v_sub.cycles_completed + 1) >= v_sub.total_cycles THEN
    UPDATE public.subscriptions SET status = 'completed', ended_at = now(), next_billing_at = NULL WHERE id = v_sub.id;
    RETURN NEW;
  END IF;

  IF v_sub.status IN ('canceled','completed','paused') THEN
    RETURN NEW;
  END IF;

  v_next_start := NEW.period_end + 1;
  v_next_end := public._add_billing_interval(v_next_start, v_sub.interval, v_sub.interval_count) - 1;
  v_next_due := v_next_start;

  -- Idempotência: não recria a fatura do mesmo período.
  IF EXISTS (SELECT 1 FROM public.subscription_invoices WHERE subscription_id = v_sub.id AND period_start = v_next_start) THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)+1 INTO v_seq FROM public.subscription_invoices WHERE subscription_id = v_sub.id;
  INSERT INTO public.subscription_invoices (workspace_id, owner_id, subscription_id, invoice_number, amount, currency, status, period_start, period_end, due_date)
  VALUES (v_sub.workspace_id, v_sub.owner_id, v_sub.id,
          'INV-' || to_char(now(),'YYYYMM') || '-' || lpad(v_seq::text,4,'0') || '-' || substr(v_sub.id::text,1,4),
          v_sub.amount, v_sub.currency, 'pending', v_next_start, v_next_end, v_next_due);

  UPDATE public.subscriptions SET next_billing_at = v_next_due, status = 'active' WHERE id = v_sub.id;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.tickets_default_pipeline()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.pipeline_id IS NULL THEN
    SELECT id INTO NEW.pipeline_id FROM public.pipelines
    WHERE entity = 'ticket' AND owner_id = NEW.owner_id AND workspace_id = NEW.workspace_id
    ORDER BY is_default DESC, created_at ASC LIMIT 1;
    IF NEW.pipeline_id IS NULL THEN
      SELECT id INTO NEW.pipeline_id FROM public.pipelines
      WHERE entity = 'ticket' AND workspace_id = NEW.workspace_id
      ORDER BY is_default DESC, created_at ASC LIMIT 1;
    END IF;
  END IF;
  IF NEW.stage IS NULL OR NEW.stage = '' THEN
    NEW.stage := 'new';
  END IF;
  RETURN NEW;
END;
$function$;