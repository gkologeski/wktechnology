
# Plano executável — Contratos, Serviços, Projetos e Financeiro (MVP integrado)

Decisões travadas com base nas respostas:
1. MVP simultâneo dos 4 módulos (fundação unificada).
2. Projetos em nível **PSA** (timesheet, custo × receita, marcos billáveis).
3. Financeiro unificado em **`financial_entries`** desde o dia 1 — `customer_invoices` vira uma view/compat layer.
4. Contrato `client` (compras) tem fluxo de aprovação próprio, distinto do `provider`.
5. E-sign usa o motor interno (`esign_*`) — sem integração externa.

Encadeamento:
```text
Company ──┬─ Deal ──► Contrato(s) ──► Serviço(s) ──► Projeto(s)
          └────────────► Contrato(s) direto (compras)
                              │            │              │
                              └────────────┴──────────────┴──► financial_entries (AR/AP)
```

---

## Fase 1 — Fundação de dados e módulos ERP

**Migrations (uma por módulo, na ordem):**

1. **Catálogo de módulos**
   - `INSERT` em `public.modules` de `contracts`, `services`, `projects`, `finance` (com `sort_order`, `icon`, `default_product_name`).
   - Adicionar entradas em `MODULES` (`src/lib/modules/registry.ts`) e ampliar `ModuleId` para `crm | ats | contracts | services | projects | finance`.

2. **Enums compartilhados**
   - `contract_role` (`provider`, `client`)
   - `contract_status` (`draft`, `in_review`, `in_negotiation`, `awaiting_signature`, `active`, `renewing`, `ended`, `terminated`)
   - `service_type` (`one_time`, `recurring`, `usage_based`, `milestone`)
   - `service_status` (`pending`, `active`, `paused`, `cancelled`, `completed`)
   - `service_cadence` (`monthly`, `quarterly`, `yearly`, `on_delivery`)
   - `project_status` (`planning`, `active`, `on_hold`, `done`, `cancelled`)
   - `financial_direction` (`receivable`, `payable`)
   - `financial_origin_type` (`contract`, `service`, `project_milestone`, `manual`, `expense`)
   - `financial_entry_status` (`open`, `partial`, `paid`, `overdue`, `cancelled`)

Toda migration segue o padrão obrigatório: CREATE TABLE → GRANT (`authenticated` + `service_role`) → ENABLE RLS → POLICIES `ws_*` via `current_user_workspaces()`.

---

## Fase 2 — Contratos (CLM)

**Tabelas:**
- `contracts` — id, workspace_id, owner_id, `role`, `counterparty_company_id`, `deal_id?`, `title`, `number` (gerado, `C-YYYYMM-####`), `status`, `starts_at`, `ends_at`, `auto_renew`, `notice_days`, `total_value`, `currency`, `readjustment_index`, `readjustment_period`, `payment_terms` (jsonb), `body_html`, `signed_at`, `signed_pdf_path`, timestamps.
- `contract_versions` — histórico (version_no, body_html, snapshot jsonb, created_by).
- `contract_clauses` — biblioteca reutilizável (title, body_html, tags, `role_scope`).
- `contract_templates` — template padrão por tipo/role (title, body_html, default_values jsonb).
- `contract_approvals` — aprovações (approver_id, `stage` — `legal`/`finance`/`purchasing`, status, comment). Regras por `role`:
  - `provider`: fluxo Legal → Finance (opcional).
  - `client`: fluxo Purchasing → Finance → Legal.
- `contract_events` — audit trail (evento, ator, payload jsonb).
- `contract_addendums` — aditivos vinculados a `parent_contract_id`.
- Reaproveita `esign_documents` / `esign_signers` via `contract_id` (novo FK).

**Rotas:**
- `/contracts` (lista com filtros por role/status/vencimento).
- `/contracts/$id` (detalhe: header + abas Overview / Versões / Aprovações / Assinaturas / Serviços / Financeiro / Aditivos / Timeline).
- `/contracts/new` + wizard (Tipo & role → Contraparte & deal → Cláusulas/template → Vigência & valores → Aprovação/assinatura).
- `/contract/$token` (pública, leitura + assinatura).
- Settings: `/settings/contracts/templates`, `/settings/contracts/clauses`, `/settings/contracts/approval-flows`.

**Ganho de deal** → cria contrato `provider` com itens da cotação aceita como serviços rascunho. O workflow atual "Criar Contrato → ticket em FI - Solicitações" é depreciado e substituído por: workflow que cria `contracts` diretamente.

---

## Fase 3 — Serviços

**Tabela `services`:**
`id, workspace_id, owner_id, contract_id, role` (herda), `product_id?`, `name`, `description`, `type`, `status`, `quantity`, `unit_price`, `currency`, `cadence?`, `starts_at`, `ends_at?`, `next_billing_at?`, `delivery_owner_id`, `metadata jsonb`, timestamps.

**Rotas:**
- `/services` (lista com filtros role/type/status/próxima cobrança).
- `/services/$id` (detalhe: dados, projetos vinculados, lançamentos financeiros gerados, health).
- Aba "Serviços" dentro de `/contracts/$id`.

**Motor de billing** (server function + cron):
- Job `services-billing-tick` (a cada 15min, mesmo padrão do cron atual) percorre serviços `active` com `next_billing_at <= now()` e cria `financial_entry` (`receivable` para `provider`, `payable` para `client`), avança `next_billing_at`.
- `one_time`: gera 1 entry ao ativar. `usage_based`: entry manual/consumo (fase B). `milestone`: gerado pelo projeto ao concluir marco billável.

`subscriptions` e `recurring_plans` legados são mantidos por compatibilidade, mas novos fluxos usam `services`. Migração de dados fica como pendência documentada.

---

## Fase 4 — Projetos (PSA)

**Tabelas:**
- `projects` — id, workspace_id, owner_id, `service_id`, `contract_id` (denormalizado), `role`, `name`, `status`, `starts_at`, `due_at`, `progress` (0-100), `planned_hours`, `planned_cost`, `metadata jsonb`.
- `project_members` — `project_id`, `user_id`, `role_in_project` (`manager`, `contributor`, `viewer`), `cost_rate_hour` (numeric), `bill_rate_hour` (numeric).
- `project_milestones` — `project_id`, `name`, `due_at`, `status`, `billable` (bool), `bill_amount`, `financial_entry_id?` (preenchido ao concluir billable).
- `project_tasks` — `project_id`, `title`, `description`, `status` (`todo/doing/review/done`), `assignee_id`, `due_at`, `sort_order`, `milestone_id?`.
- `project_time_entries` — `project_id`, `task_id?`, `user_id`, `date`, `hours` (numeric), `description`, `billable` (bool), `approved_at?`.

**Rotas:**
- `/projects` (lista + kanban por status).
- `/projects/$id` (abas Overview / Tarefas kanban / Marcos timeline / Timesheet / Membros / Financeiro / Anexos).
- `/timesheet` (grade semanal por usuário — todas as suas horas).
- Signals de kanban plugados (`src/lib/kanban/`) — atraso de marco, estouro de orçamento, projetos parados.

**Cálculos**:
- Custo realizado = Σ(`hours` × `cost_rate_hour`).
- Receita billável = Σ(`hours` × `bill_rate_hour`) + marcos billáveis concluídos.
- Margem = Receita − Custo. Exibido no header do projeto e no dashboard financeiro.

**Marco billable concluído** → cria `financial_entry` (receivable/payable conforme role).

---

## Fase 5 — Financeiro unificado

**Tabelas novas:**
- `financial_categories` — árvore (`parent_id`, `name`, `kind` = `revenue`/`expense`, `code`).
- `financial_entries` — fonte única. Campos: id, workspace_id, owner_id, `direction`, `origin_type`, `origin_id`, `counterparty_company_id`, `category_id`, `description`, `amount`, `currency`, `competence_date`, `due_date`, `paid_amount` default 0, `status`, `payment_method?`, `notes`, `attachments jsonb`, `external_ref` (para NFSe/gateway), timestamps.
- `financial_payments` — parcial ou total: `entry_id`, `paid_at`, `amount`, `method`, `bank_account?`, `reference`.
- `financial_bank_accounts` — contas bancárias/caixa (nome, tipo, saldo inicial).

**Compat / migração de `customer_invoices`:**
- Trigger espelha inserts/updates existentes em `financial_entries` (`direction='receivable'`, `origin_type='manual'` se sem serviço, senão `'service'`).
- Novos fluxos usam apenas `financial_entries`. `customer_invoices` fica read-only depois do backfill.
- Backfill em migration: converte todos os `customer_invoices` e `customer_payments` existentes para `financial_entries` + `financial_payments`.

**Rotas / módulo Finance:**
- `/finance` (dashboard: AR total, AP total, saldo previsto 30/60/90, aging, DSO/DPO).
- `/finance/receivable` (lista de AR com filtros por status/competência/cliente).
- `/finance/payable` (lista de AP idem).
- `/finance/entries/$id` (detalhe + pagamentos + anexos).
- `/finance/cashflow` (view diária/mensal, exportável).
- `/finance/categories` (plano de contas).
- `/finance/bank-accounts`.
- Integração com `nfse_invoices` existente: entry receivable pode disparar emissão de NFSe (mantém adapter atual).
- Cobrança via Asaas/Pagar.me: reaproveita webhook em `payments/br-webhook.$provider.ts`, agora vinculando ao `financial_entry_id`.

---

## Fase 6 — RBAC, RLS e navegação

**RBAC** (`docs/visibility-matrix.md`):
- Novas permissões: `contracts:read/write/approve`, `services:read/write`, `projects:read/write/manage_members/log_time`, `finance:read_ar/write_ar/read_ap/write_ap/reconcile/manage_categories`.
- Cargos:
  - `legal` (aprova contratos), `purchasing` (aprova compras client), `finance_analyst`, `finance_manager`, `project_manager`, `consultant` (só suas horas), atualizando `finance_admin`.
- Gate em `techhire_rbac_gate` estendido para os novos módulos.

**RLS:** todas as tabelas novas usam padrão `ws_*` + `current_user_workspaces()`. Documentos financeiros sensíveis (`financial_entries` com custos) só visíveis a quem tem `finance:read_*`. Projetos: consultor vê apenas projetos em que é membro (via `project_members`).

**Sidebar:** novos grupos "Contratos", "Serviços", "Projetos", "Financeiro" registrados em `src/lib/menu-config.ts` e no `MODULES` registry. `ERP_SIDEBAR_GROUPS` (ERP Home) inalterado.

---

## Fase 7 — Integrações com o que já existe

- **Deal ganho** → botão/workflow "Criar contrato a partir do deal" (herda empresa, contato, itens da cotação aceita).
- **Cotação aceita** → itens viram `services` rascunho do contrato.
- **Workflow builder**: novos triggers (`contract.status_changed`, `service.billing_due`, `project.milestone_completed`, `financial_entry.overdue`) e ações (`create_contract`, `create_service`, `create_project`, `create_financial_entry`). Depreciado o hack "Criar contrato → ticket em FI - Solicitações".
- **Timeline de atividades** ganha itens de contrato/serviço/projeto/entry (mesma tabela `activities`, novos `type`s).
- **AI Agent** (`agent-drawer`): tools novas — `search_contract`, `create_contract`, `search_service`, `log_time`, `create_financial_entry` (todas com `ProposalCard` para aprovação humana).
- **Portal público** `/portal/$token`: cliente vê contratos, serviços e faturas AR.
- **Kanban signals**: `contracts-signals`, `projects-signals` (atraso de marco, orçamento estourado, contrato próximo do vencimento sem renovação).

---

## Fase 8 — UX/UI (TechHire Standard aplicado a todos)

Toda tela nova segue `docs/techhire-design-system.md` + `docs/new-screen-ux-ui-checklist.md`:
- `PageHeader`, `SectionHeader`, `MetricCard`, `FilterBar`, `DataTable`, `EmptyState`, `LoadingSkeleton`, `ErrorState`, `StatusBadge`, `FormSection`.
- Modais de criação usam padrão consolidado (`QuickCreate*Dialog`).
- Sincronização sem F5 via `use-invalidate-on-close` + `dialog-refresh` já existentes.
- Dark mode + responsividade + a11y verificados por tela.

---

## Faseamento de entrega (ordem operacional, MVP simultâneo)

Como decidiu MVP integrado, entregamos em **sprints verticais curtas** cortando os 4 módulos, cada sprint sobe algo utilizável:

- **Sprint 1** — Migrations base + enums + `MODULES` + sidebar. Rotas placeholder + shells de listas vazias (nada quebrado).
- **Sprint 2** — Contratos MVP (CRUD, templates, cláusulas, e-sign, página pública). Workflow "deal ganho → contrato".
- **Sprint 3** — Serviços MVP (CRUD, ligação com contrato, motor de billing → gera `financial_entries`).
- **Sprint 4** — Financeiro MVP (`financial_entries`, AR/AP, dashboard, backfill de `customer_invoices`, integração NFSe/Asaas).
- **Sprint 5** — Projetos MVP (kanban de tarefas, marcos, timesheet, custo × receita, marco billable → entry).
- **Sprint 6** — Aprovações (fluxos legal/purchasing/finance por role), signals de kanban, tools da IA, portal do cliente.
- **Sprint 7** — Polimento: relatórios, exportações, alertas, retirada gradual dos hacks via ticket.

---

## Riscos e pendências conhecidas

- **Backfill de `customer_invoices` → `financial_entries`** precisa validação com dados de produção antes de cortar leitura no legado. Manter dual-write por 1 sprint.
- **Custo/rate por membro** exige dados que hoje não existem — Sprint 5 introduz UI de setup por projeto; sem valores → margem exibida como "n/d".
- **Workflow existente "Criar Contrato"** continua funcionando até Sprint 2 concluir; migração dos workflows ativos precisa ser feita manualmente pelo cliente ou via script.
- **Recurring plans / subscriptions legadas**: manter operando; nova ativação usa `services`. Migração fica como tarefa de operação, não bloqueante.
- Sem integração externa de e-sign — validade jurídica depende do adapter interno atual (aceito pelo usuário).

Confirma que posso começar pela **Sprint 1** (fundação: enums, tabelas base vazias, `MODULES`, sidebar, rotas shell) ao entrar em build mode?
