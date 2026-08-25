# Responsável (assigned_to) em todas as entidades e telas

## Objetivo

Todo registro de negócio e operacional passa a ter um **Responsável** explícito, editável na tela de detalhe/edição e filtrável nas listas — como já acontece hoje em Contatos, Empresas, Negócios, Leads, Tarefas e Tickets.

## Decisões já confirmadas

- Campo **dedicado** `assigned_to` (usuário responsável), separado de `owner_id` (que hoje serve de escopo do workspace em boa parte das tabelas).
- Abrangência: entidades de negócio **+** telas operacionais. Configurações puras, logs técnicos e tabelas de junção ficam de fora.
- Entrega única (uma migração + ajustes de UI de uma vez).
- Backfill: `assigned_to` recebe o criador do registro (`created_by`, ou `owner_id` quando ele já é um usuário real); novos registros assumem o usuário atual, com possibilidade de troca.

## Escopo por módulo

Tabelas que recebem `assigned_to` (as que já têm responsável real permanecem como estão):

- **CRM / Vendas**: activities, meetings, proposals, quotes, services, contracts, contract_approvals, deal_loss_reasons, notes, surveys, forms, form_submissions.
- **Prospecção**: prospecting_searches, prospecting_queues, prospecting_items, cadences/sequences, enrichment_jobs, playbooks, scoring_rules.
  - **Fila de Prospecção** (`/prospecting?tab=fila` e o player `prospecting/queues/$queueId/play`) entra explicitamente: responsável na própria fila (quem responde por ela) e responsável em cada item da fila, com filtro de Responsável na lista de filas e na lista de itens, além de exibição do responsável no cabeçalho do player.
- **ATS**: ats_jobs, ats_candidates, ats_applications, ats_interviews, ats_offers, ats_referrals, ats_talent_pools, ats_sourcing_sequences.
- **Pessoas**: people, people_allocations, people_documents, people_goals, people_incidents, people_reviews, people_one_on_ones, people_onboarding_plans.
- **Projetos**: projects, project_lists, project_milestones (project_tasks já tem responsável).
- **Financeiro**: financial_entries, financial_recurrences, customer_invoices, customer_payments, nfse_invoices, bank_charges, bank_payments, legal_entities.
- **Operacional / Marketing**: email_broadcasts, landing_pages, campaigns, dashboards, custom_reports, custom_object_records, media_assets/arquivos, bookings, kb_articles, macros.

Fora do escopo: tabelas de log e auditoria (audit_logs, domain_events, _\_events, _\_log), tabelas de junção sem entidade própria, tabelas de configuração de plataforma (plans, feature_flags, modules, permissions, job_roles), integrações e filas técnicas.

## Trabalho a executar

### 1. Banco de dados (uma migração)

- `ALTER TABLE ... ADD COLUMN assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL` em cada tabela do escopo.
- Índice `idx_<tabela>_assigned_to` para suportar o filtro.
- Backfill: `UPDATE ... SET assigned_to = COALESCE(created_by, owner_id)` apenas quando o valor referenciar um usuário existente em `auth.users`.
- RLS: nenhuma política existente é afrouxada. As políticas de escopo continuam usando `owner_id`/`workspace_id`; `assigned_to` é apenas um atributo de negócio.
- Grants já existentes nas tabelas permanecem inalterados (coluna nova herda o grant da tabela).

### 2. Camada de dados

- `select` das server functions de listagem passa a trazer `assigned_to` e o perfil do responsável (nome/avatar).
- Novo parâmetro opcional de filtro `assignedTo?: string[]` + `includeUnassigned?: boolean` nas funções de listagem afetadas, aplicado com `.in()` / `.is(null)`.
- Nas mutações de criação, default `assigned_to = auth.uid()` quando não informado.

### 3. UI compartilhada

- Generalizar `src/components/entity/owner-field.tsx` para gravar em `assigned_to` (mantendo compatibilidade com as telas que hoje usam `owner_id`), exposto como **AssigneeField**.
- Reutilizar `src/components/owner-filter.tsx` (já suporta "Sem responsável") como filtro padrão, ligado ao novo parâmetro.
- Componente de coluna/badge de responsável para grids e cards.

### 4. Telas

Para cada tela de lista do escopo: coluna/badge "Responsável" + filtro de Responsável na FilterBar. Para cada tela de detalhe: campo Responsável editável no painel de propriedades. Formulários de criação passam a exibir o campo já preenchido com o usuário atual.

Todas seguem o design system: componentes oficiais, tokens semânticos, estados de loading/empty/error preservados, labels acessíveis, responsivo e dark mode.

## Riscos e cuidados

- Volume alto de arquivos alterados; a migração é aditiva e não remove nem renomeia nada, então o sistema continua funcionando mesmo onde a UI ainda não exibir o campo.
- `owner_id` **não** será alterado nem migrado — evitar regressão de RLS é prioridade.
- Backfill só grava IDs que existam em `auth.users`, evitando violação de FK.

## Validação

- Typecheck, lint e build.
- Conferência manual: criar um registro em cada módulo e verificar responsável preenchido; filtrar por responsável e por "Sem responsável"; trocar o responsável e recarregar.
- Linter de segurança do banco após a migração.
