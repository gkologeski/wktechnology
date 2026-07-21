
CREATE TABLE public.workflow_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  event_pattern TEXT NOT NULL,
  action JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.workflow_subscriptions(owner_id, enabled);
CREATE INDEX ON public.workflow_subscriptions(event_pattern);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_subscriptions TO authenticated;
GRANT ALL ON public.workflow_subscriptions TO service_role;

ALTER TABLE public.workflow_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace read workflow_subscriptions"
  ON public.workflow_subscriptions FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(auth.uid(), owner_id));

CREATE POLICY "admin manage workflow_subscriptions"
  ON public.workflow_subscriptions FOR ALL
  TO authenticated
  USING (public.is_workspace_admin_v2(auth.uid(), owner_id))
  WITH CHECK (public.is_workspace_admin_v2(auth.uid(), owner_id));

CREATE TRIGGER update_workflow_subscriptions_updated_at
  BEFORE UPDATE ON public.workflow_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT conname INTO cname FROM pg_constraint
   WHERE conrelid = 'public.workflow_events'::regclass
     AND contype='c'
     AND pg_get_constraintdef(oid) ILIKE '%entity%IN%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.workflow_events DROP CONSTRAINT %I', cname);
    ALTER TABLE public.workflow_events ADD CONSTRAINT workflow_events_entity_check
      CHECK (entity IN (
        'leads','contacts','companies','deals','tickets','activities',
        'ats_jobs','ats_candidates','ats_applications','ats_interviews',
        'projects','project_tasks','project_milestones','contracts',
        'financial_entries','bank_payments','quotes','proposals','products',
        'services','recurring_plans','subscription_invoices','customer_invoices',
        'people','people_documents','people_goals','people_one_on_ones',
        'people_reviews','people_assessments','people_incidents',
        'people_allocations','people_timesheets','people_onboarding_plans',
        'workflow_subscriptions'
      ));
  END IF;
END $$;

INSERT INTO public.workflow_subscriptions (owner_id, name, description, event_pattern, action, enabled)
SELECT w.id,
  'Provisionamento de acesso (onboarding)',
  'Cria ticket automaticamente quando o onboarding de uma pessoa começa.',
  'people.onboarding_started',
  jsonb_build_object(
    'type','create_ticket',
    'subject','Provisionamento de acesso — {{payload.person_id}}',
    'description','Provisionar acessos, e-mail, VPN e ferramentas para a pessoa recém-contratada.',
    'priority','high'
  ),
  true
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.workflow_subscriptions s
   WHERE s.owner_id = w.id AND s.event_pattern = 'people.onboarding_started'
);

INSERT INTO public.workflow_subscriptions (owner_id, name, description, event_pattern, action, enabled)
SELECT w.id,
  'Revogação de acesso (offboarding)',
  'Cria ticket automaticamente quando o offboarding de uma pessoa começa.',
  'people.offboarding_started',
  jsonb_build_object(
    'type','create_ticket',
    'subject','Revogação de acesso — {{payload.person_id}}',
    'description','Revogar acessos, encerrar e-mail, recolher equipamentos e finalizar pendências.',
    'priority','high'
  ),
  true
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.workflow_subscriptions s
   WHERE s.owner_id = w.id AND s.event_pattern = 'people.offboarding_started'
);
