ALTER TABLE public.workflow_events DROP CONSTRAINT workflow_events_entity_check;
ALTER TABLE public.workflow_events ADD CONSTRAINT workflow_events_entity_check
  CHECK (entity IN (
    'leads','contacts','companies','deals','tickets',
    'ats_jobs','ats_candidates','ats_applications','ats_interviews',
    'contracts','services','quotes','products',
    'proposals','customer_invoices','subscription_invoices','recurring_plans',
    'financial_entries','bank_payments',
    'projects','project_tasks','project_milestones'
  ));