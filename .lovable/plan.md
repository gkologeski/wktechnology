
## Objetivo

Criar uma **Suíte de Prospecção** no TechSales que centralize toda a operação de Sales Engagement em `/prospecting`, com abas internas. A tela principal é uma **fila configurável** de leads/contatos para o SDR/BDR trabalhar (qualificar → cadenciar → agendar). Consolida as engines de cadência (ATS `ats_sourcing_sequences` + TechSales `sequences`) em uma **camada unificada nova** e adiciona **questionários de qualificação** (framework pronto + customizável, com score automático e decisão manual).

## Boas práticas incorporadas (Outreach, Salesloft, Apollo, HubSpot, Reply.io, Lemlist, Amplemarket)

- **Fila unificada de trabalho ("Today's tasks")** por prioridade/SLA — não por status estático.
- **Cadências multi-canal** com passos: email, LinkedIn (invite/message/task), WhatsApp, chamada, tarefa manual, wait, wait_invite_accept.
- **A/B por passo**, quiet hours, dias úteis, limite diário por canal.
- **Qualificação via framework** (BANT/MEDDIC/CHAMP/GPCT) + questionários customizáveis com peso por resposta → **score** somado ao lead scoring existente.
- **Decisão final manual** do SDR (qualificado / desqualificado / nutrição / agendado) sempre sobrepõe o score.
- **Handoff automatizado**: qualificado → cria negócio + agenda com AE.
- **Playbooks** ligados ao passo/pipeline; scripts ligados a call/canal.
- **Enrichment on-demand** dentro da própria fila.
- **Voice agent** como um dos canais opcionais da cadência.

## Arquitetura de rotas

Nova estrutura em `src/routes/_authenticated/`:

```text
prospecting.tsx                 (layout com <Outlet />, já existe)
prospecting.index.tsx           (Suite: layout de abas)
  ├── aba "Fila"                  → default, fila configurável
  ├── aba "Cadências"             → sequences unificadas
  ├── aba "Questionários"         → templates BANT/MEDDIC + custom
  ├── aba "Scoring"               → move de /settings/scoring
  ├── aba "Playbooks"             → move de /settings/playbooks
  ├── aba "Enrichment"            → move de /settings/enrichment
  ├── aba "Scripts"               → move de /settings/prospecting-scripts
  ├── aba "Voice Agent"           → move de /settings/voice-agent
  └── aba "Campanhas voz"         → link para /prospecting/campaigns
prospecting.leads.$id.tsx        (detalhe do lead na fila, com painel de qualificação)
prospecting.campaigns.*          (mantém)
```

Rotas antigas em `/settings/*` viram **redirects** para a aba correspondente (via `beforeLoad` com `redirect`). O `menu-config` remove essas entradas de settings e adiciona apenas **"Prospecção"** em Captar (já existe `Prospecção por voz`, será substituída por "Prospecção" apontando para `/prospecting`).

## Modelo de dados (novas tabelas)

Migrations (com GRANTs + RLS `owner_id = auth.uid()`):

1. `prospecting_queues` — filas configuráveis por usuário/workspace.
   - `id`, `owner_id`, `name`, `description`, `entity` (`lead|contact`), `filters` (jsonb: status, source, score min/max, segment, owner, tags, updated_at range), `sort` (jsonb), `is_shared` (bool), timestamps.
2. `prospecting_questionnaires` — templates de qualificação.
   - `id`, `owner_id`, `name`, `framework` (`bant|meddic|champ|gpct|custom`), `pipeline_id` (nullable), `product_id` (nullable), `enabled`, `pass_threshold` (int), timestamps.
3. `prospecting_questions` — perguntas do questionário.
   - `id`, `questionnaire_id`, `owner_id`, `order`, `label`, `type` (`single|multi|number|text|boolean`), `options` (jsonb: `[{ label, points }]`), `weight` (int), `required` (bool).
4. `prospecting_qualifications` — respostas + resultado por lead/contato.
   - `id`, `owner_id`, `questionnaire_id`, `entity` (`lead|contact`), `entity_id`, `answers` (jsonb), `score` (int), `decision` (`qualified|disqualified|nurture|scheduled|pending`), `decision_reason`, `qualified_by`, `qualified_at`.
5. `prospecting_cadences` — engine unificada de cadência (extensão das colunas comuns de `sequences` + `ats_sourcing_sequences`).
   - `id`, `owner_id`, `name`, `enabled`, `scope` (`sales|hr`), `queue_id` (nullable), timezone, quiet hours, daily limits, send days, timestamps.
6. `prospecting_cadence_steps` — passos, com colunas idênticas aos atuais `ats_sourcing_sequence_steps` (channel, delay_days, subject/body, task_instructions, variant, wait_invite_accept props).
7. `prospecting_enrollments` — inscrição por entidade (lead/contact/candidate) na cadência.
   - Espelha `ats_sourcing_enrollments`, com `entity` (`lead|contact|candidate`) + `entity_id`.

**Migração das engines existentes**: manter `sequences` (email-only TechSales) e `ats_sourcing_sequences` intactas para retrocompatibilidade; o novo módulo lê/escreve nas tabelas `prospecting_*`. Adicionar server function `migrateLegacyCadences` (idempotente, opt-in via botão em Cadências) que copia sequências legadas.

Sem alteração de outras tabelas.

## Server functions (novos módulos em `src/lib/prospecting/`)

- `queues.functions.ts` — CRUD filas + `listQueueItems` (paginado, aplica filtros JSON contra `leads`/`contacts`).
- `questionnaires.functions.ts` — CRUD questionários + perguntas; seeds dos frameworks (BANT/MEDDIC/CHAMP/GPCT).
- `qualifications.functions.ts` — `saveQualification` (calcula score somando `option.points * weight`), `setDecision`, `listByEntity`.
- `cadences.functions.ts` — CRUD cadências, passos, `enrollEntities`, `stopEnrollment`, `tickCadences` (equivalente ao tick atual do ATS, com suporte a `lead|contact|candidate`).
- `handoff.functions.ts` — `qualifyAndCreateDeal` (converte lead → contato+empresa+negócio, opcionalmente agenda reunião com AE via booking existente).

Todas com `.middleware([requireSupabaseAuth])` e validação Zod. Handoff reusa `convertLead` já existente onde aplicável.

## UI (componentes em `src/components/prospecting/`)

Design system TechHire/TechSales oficial (`PageHeader`, `SectionHeader`, `FilterBar`, `DataTable`, `EmptyState`, `LoadingSkeleton`, `MetricCard`, `StatusBadge`, `FormSection`).

- `prospecting-suite-tabs.tsx` — shell com abas dentro de `PageHeader`.
- `queue-builder-dialog.tsx` — cria/edita fila (nome + `FilterBuilder` reutilizado).
- `queue-workspace.tsx` — split view: lista à esquerda (cards com nome, empresa, score, última interação, SLA), painel à direita com abas **Detalhes | Qualificação | Cadências | Timeline**.
- `qualification-panel.tsx` — renderiza questionário ativo, calcula score em tempo real, botões de decisão (Qualificar / Desqualificar / Nutrição / Agendar) — decisão manual sempre disponível independente do score.
- `questionnaire-editor.tsx` — CRUD com sortable de perguntas, editor de opções com pontos.
- `cadence-builder.tsx` — reaproveita `sequence-builder.tsx` já existente, ampliado para escopo sales/hr e novo channel `call` (via voice agent).
- Abas Scoring/Playbooks/Enrichment/Scripts/Voice: **movem o conteúdo** dos componentes atuais das rotas `/settings/*` (não a rota), envolvendo em um wrapper leve. Nenhuma lógica de negócio muda.

## Sidebar / navegação

- `menu-config.ts`:
  - Em "Captar": substitui "Prospecção por voz" por **"Prospecção"** → `/prospecting`.
  - Em "Otimizar / Configurações": remove Scoring, Playbooks, Enrichment, Prospecção (voz), Scripts, Voice Agent do menu de settings. Mantém rotas legadas somente como redirects.
- Breadcrumbs e títulos das abas em PT-BR.

## Redirects (compatibilidade)

Rotas `/settings/scoring`, `/settings/playbooks`, `/settings/enrichment`, `/settings/prospecting`, `/settings/prospecting-scripts`, `/settings/voice-agent` passam a redirecionar para `/prospecting?tab=<slug>` via `beforeLoad`. Isso preserva bookmarks.

## Segurança

- Todas as novas tabelas: `GRANT` explícito + `ENABLE ROW LEVEL SECURITY` + policy `owner_id = auth.uid()` (sem anon).
- Server functions: `requireSupabaseAuth`; handoff valida permissão via matriz `permissions` existente (`leads.update`, `deals.create`).
- `prospecting_questionnaires.pipeline_id` valida FK/pertence ao workspace.

## Entregas por fase (implementação incremental)

1. **Fase 1** — Migrations + seeds de frameworks + server functions base.
2. **Fase 2** — Rota `/prospecting` com aba **Fila** (queue builder + workspace) e aba **Questionários**.
3. **Fase 3** — Painel de qualificação com score/decisão + handoff (criar negócio + agendar).
4. **Fase 4** — Aba **Cadências** unificada + inscrição a partir da fila; migração opt-in dos dados legados.
5. **Fase 5** — Migrar abas Scoring/Playbooks/Enrichment/Scripts/Voice para dentro da suíte; redirects; atualização de sidebar; documentação.

Cada fase entrega telas navegáveis, com loading/empty/error states, respeitando light/dark e responsividade.

## Fora do escopo

- Não altera engines legadas `sequences` e `ats_sourcing_sequences` além de leitura para migração opt-in.
- Não modifica RLS de leads/contatos/deals.
- Não altera Voice Agent internamente — apenas realoca a UI.
- Sem integração nova com provedores externos.

## Como validar

- Criar fila "Leads novos SP" com filtro `status = new AND state = SP`.
- Criar questionário BANT customizado, aplicar em um lead, ver score somado ao `lead_score` existente.
- Qualificar manualmente e converter para negócio via handoff.
- Inscrever 3 leads em uma cadência multi-canal e ver o tick agendar o primeiro passo.
- Abrir `/settings/scoring` → deve redirecionar para `/prospecting?tab=scoring`.
