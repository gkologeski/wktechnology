## Análise atual

**Tabela `tickets` hoje:**
- `pipeline_id uuid NULL` — já existe mas sem obrigatoriedade nem default.
- **Não** existe coluna `stage`. A etapa do funil hoje está armazenada em `external_ids.hs_pipeline_stage` (JSONB, legado HubSpot), com fallback no enum `status`.
- 345 tickets ativos: 1 sem pipeline, 343 com etapa em `external_ids`.

**Comparativo com `deals`:**
- `deals.stage text NOT NULL default 'new'` + `deals.stage_id uuid NULL` + `deals.pipeline_id uuid NULL`.
- Kanban e detalhe leem/escrevem em `stage` diretamente.

**Problema:** tickets simulam etapa via JSONB, o que dificulta filtros, workflows, relatórios, RLS e a UI (o builder de workflow não expõe "Etapa do ticket" porque a coluna não existe).

---

## Objetivo

Elevar pipeline + etapa a cidadãos de primeira classe em `tickets`, com paridade de comportamento em relação a `deals`.

---

## Mudanças

### 1. Migration (`supabase--migration`)
- `ALTER TABLE public.tickets ADD COLUMN stage text;`
- Backfill: `stage = COALESCE(external_ids->>'hs_pipeline_stage', status::text)` para todos os tickets.
- Garantir pipeline padrão: nos tickets com `pipeline_id IS NULL`, atribuir o pipeline "Pipeline de Tickets" (id `1cd9a035-…`) — atualmente apenas 1 registro.
- `ALTER TABLE public.tickets ALTER COLUMN pipeline_id SET NOT NULL;`
- `ALTER TABLE public.tickets ALTER COLUMN pipeline_id SET DEFAULT '1cd9a035-b1aa-4b19-b2bb-7ce9e9f263df';` (pipeline default de tickets).
- Índice: `CREATE INDEX IF NOT EXISTS idx_tickets_pipeline_stage ON public.tickets(pipeline_id, stage) WHERE deleted_at IS NULL;`
- Não remover `external_ids.hs_pipeline_stage` (mantém compatibilidade com sync HubSpot); apenas deixa de ser fonte de verdade.
- Sem alteração de RLS/policies/GRANTs — coluna herda as políticas existentes.

### 2. Leitura de etapa (`src/routes/_authenticated/tickets.$id.tsx`, `src/components/tickets/tickets-board.tsx`, `src/components/tickets/ticket-card.tsx`, `src/components/tickets/tickets-split-view.tsx`, `src/components/tickets/tickets-sidebar.tsx`)
- Substituir a lógica `external_ids.hs_pipeline_stage → status → primeira etapa` por leitura direta de `ticket.stage`, com fallback apenas para tickets legados sem backfill (defensivo).
- `StageTracker` no detalhe passa a receber `ticket.stage` diretamente.

### 3. Escrita de etapa
- **Board (`tickets-board.tsx` `handleDragEnd`)** e **detalhe (`tickets.$id.tsx` `handleStageChange`)**: gravar `stage` (coluna real) além de sincronizar `status` (open/closed conforme `stage.type`) e manter `external_ids.hs_pipeline_stage` em espelho para HubSpot.
- **Criação de ticket** (dialog "Novo chamado" em `src/routes/_authenticated/tickets.tsx` — form já grava `pipeline_id`): incluir `stage` inicial = primeira etapa do pipeline selecionado.
- **Bulk edit** e **workflow engine (`create_ticket`, `set_field`)**: nada muda em código; a coluna passa a ser um campo comum, e o builder já ganhará "Etapa" automaticamente via `getEntityFieldCatalog` (nomeação abaixo).

### 4. Builder de Workflows
- `src/lib/entity-fields.functions.ts`: adicionar rótulo `stage: "Etapa"` (já existe rótulo `stage_id: "Etapa (ID)"`) — o catálogo `pipelineStageOptions` só é montado hoje para `deals` e `leads`; estender para `tickets`, filtrando `pipelines.entity = 'ticket'` para popular as opções do select de "Etapa" com todos os pipelines de ticket.
- `src/components/workflows/workflow-builder.tsx` (ação `create_ticket`): expor campo **Etapa** dependente do Pipeline selecionado (mesmo padrão de `create_deal`) — quando pipeline definido, listar `stages` desse pipeline; caso contrário, mostrar select combinado como no filtro.
- Filtros em `trigger` continuam funcionando pois `stage` passa a ser coluna real.

### 5. UI Kanban
- Confirmar que `tickets-board.tsx` já monta as colunas a partir de `pipeline.stages` — mantido; apenas a chave de agrupamento passa a ser `t.stage`.
- Sem redesign visual.

---

## Escopo fora
- Não alterar RLS/GRANTs, autenticação ou lógica de sync HubSpot.
- Não remover `external_ids.hs_pipeline_stage` (backwards compat).
- Não mexer no engine de workflows (`engine.server.ts`) — coluna real já é suportada por `set_field`/filters genéricos.
- Não alterar o enum `ticket_status`.

---

## Validação
- `supabase--read_query`: conferir que `stage` foi populado em 100% dos tickets e nenhum `pipeline_id IS NULL`.
- Abrir `/tickets`: kanban por pipeline mostra os cards nas colunas corretas (paridade com HubSpot).
- Arrastar um card no board → recarregar → etapa persiste no banco em `tickets.stage`.
- Alterar etapa no detalhe do ticket → mesmo comportamento.
- Criar ticket via botão "Novo chamado" → registro nasce em `pipeline_id` + `stage` iniciais.
- Workflow builder → ação "Criar ticket" mostra select **Etapa** com as etapas do pipeline escolhido.
- Workflow builder → gatilho "Ticket atualizado" com filtro `stage = X` continua disparando.

---

## Riscos
- Backfill errado em tickets com `status` não presente no `stages` do pipeline associado → mitigação: se `stage` resultante não pertencer ao pipeline, cair para a primeira etapa do pipeline no backfill.
- HubSpot sync bidirecional que só grava `external_ids.hs_pipeline_stage`: o mirror escrita na UI mantém compatibilidade; sync inbound (`hs_raw` → tickets) precisa espelhar em `stage` também — incluir esse ponto num item de backlog se ainda não estiver coberto (verificar `hubspot-sync-state`/edge de importação antes de finalizar a implementação).
