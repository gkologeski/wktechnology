
# Plano: Paridade HubSpot completa (Listagem + Detalhe)

Implementa as 35 funcionalidades mapeadas. Itens já existentes (1, 9, 18, 19) ficam fora do escopo. Itens reaproveitam a infra existente: `EntityList`, `BulkActionBar`, `BulkEditDialog`, registry de integrações.

Tudo aplica a **leads, contacts, companies, deals** simultaneamente (entidades reutilizam `EntityList`).

---

## Sprint 1 — Refinos da seleção em massa (#2, #3, #4, #5)

**#2 Bulk Edit avançado (append / replace / remove)**
- Estender `BulkEditDialog`: detectar tipo do campo (text, single-select, multi-select, array).
- Para multi-select: 3 modos (`Append`, `Replace`, `Remove`).
- Aplicar via `update().in("id", ids)` calculando o novo array no client antes do update (Postgres não tem operador atômico genérico para "append único"; vamos buscar valores atuais → mesclar → escrever em transação curta por chunk de 50).

**#3 Bulk Delete com confirmação digitada**
- Substituir `confirm()` por dialog que pede ao usuário **digitar o número exato** de registros para liberar o botão "Excluir".
- Componente novo: `<ConfirmCountDialog count={n} entity="leads" />`.

**#4 Bulk Assign (reatribuir owner)**
- Hoje `owner_id` é fixo do usuário logado (RLS). Para suportar reatribuição, precisa de **organizações/times**.
- Decisão: criar tabela `team_members` (workspace_owner_id, member_user_id, role) + ajustar RLS de leads/contacts/companies/deals para `owner_id IN (members of team)`.
- Bulk Assign vira dropdown com membros do time.

**#5 Bulk Create Tasks**
- Ação "Criar tarefa" no `BulkActionBar` → dialog com campos `subject`, `due_date`, `type=task`, `body`.
- Insere N rows em `activities` com `related_lead_id`/`related_contact_id`/`related_deal_id` por record.

---

## Sprint 2 — Views, filtros e colunas (#10, #11, #12, #13, #14)

**Tabelas novas:**
```
saved_views (id, owner_id, entity, name, is_shared, filters jsonb,
             column_order text[], sort_by, sort_dir, quick_filters jsonb)
```

**#10 Quick filters configuráveis**
- Barra de chips no topo da `EntityList` (até 10).
- Botão "+" abre dropdown listando todas as colunas/propriedades da entidade.
- Cada chip vira um popover com critérios apropriados ao tipo (texto: contém/igual; select: lista; data: range; número: operadores).

**#11 Advanced filters (AND/OR aninhado)**
- Construtor de filtros recursivo (`FilterNode = Group | Condition`).
- UI estilo HubSpot: grupos colapsáveis com switch AND/OR.
- Compilador `filtersToSupabase(node)` → encadeia `.eq/.ilike/.in/.gte` no query builder.

**#12 Saved views (preset + customizadas)**
- Sidebar lateral na `EntityList` listando: "Todas", "Minhas views", "Compartilhadas".
- Ações: criar, renomear, duplicar, excluir, definir como padrão, compartilhar (`is_shared=true`).
- View armazena filtros + colunas + sort + quick_filters.

**#13 Preset views por entidade**
- Hardcoded no registry de cada entidade (não vai pra DB):
  - Leads: Open / Recent activity / Not in sequence / All / My leads
  - Deals: Open / Closing this month / My deals / Won / Lost
  - Contacts: All / Recently created / My contacts
  - Companies: All / Target accounts / Recently active

**#14 Edit columns**
- Botão "Editar colunas" abre dialog com checkboxes + drag-to-reorder (`@dnd-kit/sortable`).
- Persiste em `saved_views.column_order` da view ativa.

---

## Sprint 3 — Inline edit, Kanban e pipelines (#15, #16, #17)

**#15 Edit inline na tabela**
- `EntityList` recebe prop `inlineEditableFields`.
- Célula vira input/select/datepicker no clique; salva onBlur ou Enter via `update().eq("id", id)`.
- Validação otimista: roll-back visual em caso de erro.

**#16 Board view (Kanban)**
- Toggle Tabela/Board no header da `EntityList`.
- Componente novo `EntityBoard`: colunas = stages/status, cards arrastáveis com `@dnd-kit`.
- Aplicável a: Deals (por `stage`), Leads (por `status`).
- Drag entre colunas = `update({ stage: newStage })`.

**#17 Multi-pipeline**
- Tabela nova: `pipelines (id, owner_id, entity, name, is_default, stages jsonb)` (stages = array ordenado de `{value, label, color, probability}`).
- Adicionar coluna `pipeline_id` em `deals` e `leads` (nullable, default = pipeline padrão).
- Migrar `DEAL_STAGES`/`LEAD_STATUSES` (constantes em `src/lib/crm.ts`) para serem **stages padrão** copiados na criação da pipeline default por usuário.
- Dropdown "Pipeline" no header → filtra registros e muda colunas do Kanban.
- Settings → Pipelines: CRUD de pipelines e stages.

---

## Sprint 4 — Tela de detalhe do Lead (#22, #23, #24, #25, #26, #27, #28)

Criar rota `_authenticated/leads.$id.tsx` (e equivalentes para contacts/companies/deals).

**#22 Lead stage tracker (linha do tempo visual)**
- Componente `<StageTracker stages={...} current={...} />` — barra horizontal com ícones por stage.

**#23 Atualização automática de stage**
- Trigger Postgres `auto_advance_lead_stage()`: ao inserir em `activities` com `related_lead_id` e tipo email/call/meeting/task, se `lead.status='new'` → `'contacted'` (≈ Attempting). Ao registrar atividade com outcome=Connected → `'qualified-prep'` (novo valor enum) ou similar.
- Tabela de mapeamento `activity_type → stage_transition` configurável em `pipelines.config.auto_advance_rules`.

**#24 Activity quick icons**
- Painel direito do detalhe com 5 botões: Note · Email · Call · Task · Meeting.
- Clique abre dialog específico (compor email não envia de verdade — só registra; integração de envio fica fora de escopo).

**#25 Recent communications**
- Card "Comunicações recentes" com últimas 3 atividades de tipo email/call.

**#26 Previous / Recent / Upcoming activities (tabs)**
- Refatorar `ActivityTimeline` para aceitar `mode="grouped"`, agrupando em 3 abas + filtro por tipo.

**#27 Schedule next activity**
- Botão "Agendar próxima atividade" no painel direito → cria activity com `due_date` futuro.
- Card "Próximas atividades" lista as 3 mais próximas.

**#28 Call/Meeting outcomes**
- Adicionar colunas em `activities`: `outcome text`, `outcome_set_at timestamptz`.
- Outcomes padrão: Connected, No answer, Left voicemail, Bad number, Wrong contact, Meeting completed, No-show.
- Dropdown na atividade após criação.

---

## Sprint 5 — Customização do painel direito (#29, #30, #31)

**#29 Customize Properties (right panel)**
- Tabela nova: `record_layouts (id, owner_id, entity, sections jsonb)` — `sections=[{title, properties:[fieldNames]}]`.
- Drawer "Customizar painel" → drag-and-drop de campos entre seções.
- Painel direito do detalhe lê esse layout para renderizar.

**#30 View all properties**
- Modal com lista completa de todos os campos da entidade (usar metadata do registry).

**#31 Property history (audit log)**
- Tabela nova: `property_history (id, entity, entity_id, owner_id, property, old_value jsonb, new_value jsonb, changed_by, changed_at)`.
- Trigger genérico `log_property_changes()` em leads/contacts/companies/deals que escreve diff por coluna alterada.
- UI: botão "Ver histórico" por campo no painel direito → drawer com timeline.

---

## Sprint 6 — Associações, scoring e ABM (#32, #33, #34, #35)

**#32 Associated records melhorados**
- Cards de relacionamento no detalhe: Contatos · Empresas · Negócios · Atividades · Leads convertidos.
- Botões "Associar existente" / "Criar novo" inline.
- Para deals: usar `deal_contacts` (já existe) + criar `deal_companies` análogo se necessário.

**#33 Playbooks**
- Tabela `playbooks (id, owner_id, name, entity, content jsonb)` — content = lista de perguntas/seções markdown.
- Tabela `playbook_responses (id, playbook_id, entity_id, responses jsonb, completed_at)`.
- Painel "Playbooks" no detalhe lista os aplicáveis; clicar abre drawer com formulário das perguntas.

**#34 Lead scoring + label**
- Adicionar colunas `score int default 0`, `label text` em `leads` e `contacts`.
- Tabela `scoring_rules (id, owner_id, entity, name, condition jsonb, points int)`.
- Função SQL `recalc_score(entity, id)` chamada por trigger em activities/contacts/leads.
- Badge colorido (Hot/Warm/Cold) baseado em faixas configuráveis.

**#35 Target Accounts (ABM)**
- Adicionar `is_target_account boolean default false` em `companies`.
- Adicionar `target_account_tier text` (Tier 1/2/3).
- Filtro/preset view "Target Accounts" usa esse flag.
- Indicador visual (estrela) em listagem e detalhe.

---

## Sprint 7 — Workflows, sequences, segmentos, GDPR (#6, #7, #8, #20, #21)

**#6 Static segments (listas)**
- Tabela `segments (id, owner_id, entity, name, kind 'static'|'dynamic', filters jsonb)`.
- Tabela `segment_members (segment_id, entity_id)` — para listas estáticas.
- Bulk action "Adicionar à lista" no `BulkActionBar`.

**#7 Sequences (cadências)**
- Tabela `sequences (id, owner_id, name, entity, steps jsonb)` — steps = `[{day_offset, type:'email'|'task'|'call', template}]`.
- Tabela `sequence_enrollments (id, sequence_id, entity_id, current_step, status, enrolled_at)`.
- Bulk action "Inscrever em sequência".
- Worker (server fn agendado) processa steps; envio de email real fica como TODO (depende de connector Resend/Mailgun).

**#8 Workflows (automação)**
- Tabela `workflows (id, owner_id, name, trigger jsonb, actions jsonb, entity)`.
- Triggers suportados: created, updated (campo X), enrolled in segment, score crossed threshold.
- Actions: update field, create task, add to segment, send notification, call webhook, enrich via integração.
- Editor visual fica fora de escopo desta sprint — UI apenas JSON editor + presets.

**#20 GDPR / subscriptions / marketing flag**
- Adicionar colunas em `contacts`: `marketing_status` (marketing/non-marketing), `legal_basis` (consent/legitimate-interest/...), `consent_date`.
- Tabela `subscription_types (id, owner_id, name)` + `contact_subscriptions (contact_id, subscription_type_id, opted_in, source, updated_at)`.
- Bulk actions: Set marketing / non-marketing / Add legal basis / Edit subscriptions.

**#21 CSV import genérico**
- Tela `_authenticated/$entity.import.tsx` (parametrizada).
- Upload CSV → parser (`papaparse`) → mapeamento de colunas → preview 10 linhas → execução com `enrichment_jobs(kind='import')`.
- Atualiza existing por chave única (email/domain) + insere novos.

---

## Decisões técnicas

- **Tipagem**: campos `jsonb` (filters, sections, steps) tipados via Zod schemas em `src/lib/schemas/`.
- **Reuso**: TODO refactor — `EntityList` já é genérico, novas props (`viewsEnabled`, `quickFiltersEnabled`, `boardEnabled`, `pipelineKey`, `inlineEditableFields`, `customColumnsEnabled`) entram com defaults `false` para não quebrar telas atuais.
- **RLS**: toda tabela nova com `owner_id = auth.uid()`. Tabelas com escopo de time (saved_views compartilhada, sequences, workflows) ganham policy adicional `is_shared = true OR owner_id = auth.uid()`.
- **Performance**: views listas com filtros compilados aplicam `.range()` para paginação server-side (substituir paginação client atual quando filtros viram server-side).

## Ordem de migrações (8 grupos)

```text
1. saved_views, record_layouts, property_history (+ trigger genérico)
2. pipelines + leads.pipeline_id + deals.pipeline_id
3. activities.outcome, leads.score/label, contacts.score/label, companies.is_target_account/tier
4. team_members + reescrita de RLS de leads/contacts/companies/deals
5. segments + segment_members
6. sequences + sequence_enrollments
7. workflows
8. subscription_types + contact_subscriptions + contacts.marketing_status/legal_basis
```

## O que fica de fora (e por quê)

- **Envio real de email/SMS/WhatsApp** nas sequences → depende de connector externo (Resend/Twilio); estrutura fica pronta, envio vira TODO.
- **Editor visual de workflows (drag-n-drop tipo Zapier)** → escopo de produto inteiro; entregamos JSON-editor + presets nesta fase.
- **Multi-tenant real (orgs/workspaces)** → `team_members` cobre o caso de Bulk Assign, mas não substitui workspace completo.
- **Permissões granulares (Super Admin, View as user, Bulk delete)** → adicionar role `admin`/`member` em `team_members` é suficiente; UI de permissions detalhada fica fora.

## Estimativa

7 sprints. Cada sprint é entregável independente — você pode pausar entre sprints e usar o CRM normalmente. Recomendo aprovar sprint a sprint após ver o resultado da anterior.
