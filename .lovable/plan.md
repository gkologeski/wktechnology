## Problema

O trigger `trg_wf_events_contracts` insere em `workflow_events` com `entity='contracts'`, mas o `CHECK constraint workflow_events_entity_check` só aceita 9 valores (leads, contacts, companies, deals, tickets, ats_jobs, ats_candidates, ats_applications, ats_interviews). Qualquer UPDATE em contratos falha.

Há mais 12 entidades na mesma situação (services, quotes, customer_invoices, subscription_invoices, recurring_plans, project_milestones, proposals, products, financial_entries, bank_payments, project_tasks, projects) — todas têm trigger `enqueue_workflow_event` mas não estão no CHECK. Ficam quebradas do mesmo jeito assim que alguém edita.

## Correção

Migration única que substitui o CHECK constraint por uma lista alinhada com as entidades que hoje têm trigger `enqueue_workflow_event`:

```sql
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
```

Sem alteração de código de aplicação.

## Validação

1. Editar/salvar contrato em `/contracts/:id` — não deve mais retornar o erro.
2. `SELECT DISTINCT entity FROM workflow_events ORDER BY 1;` continua ok.
