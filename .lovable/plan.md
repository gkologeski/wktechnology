# Plano: fechar os itens parciais (🟡) do HubSpot Feature Map

Objetivo: levar os 16 itens marcados como 🟡 a ✅, agrupados em 4 releases que podem ser entregues em sequência. Cada release é independente e entregável sozinho.

---

## Release 1 — Quick wins (P + base já pronta)

Itens com infraestrutura completa, faltando só UI / polimento. Maior ROI imediato.

1. **Notes — menções (@) e anexos**
   - Editor: integrar menções no `rich-html-editor` lendo de `workspace_members`/`profiles`.
   - Anexos: bucket `notes-attachments` já existe → adicionar upload + lista no painel de note.
   - Persistência: usar JSONB existente em `activities` (sem migration nova).

2. **Tasks — Queues + "play through queue"**
   - Rota `/tasks/queues` e `/tasks/queues/$queueId/play` já existem (esqueleto).
   - Tabelas `task_queues` + `task_queue_items` já existem.
   - Completar: tela de execução sequencial (next/skip/complete), botão "Iniciar fila" e contador de progresso.

3. **Stages com probabilidade no forecast**
   - Campo `probability` já existe em `pipelines.stages` (JSONB).
   - Atualizar `DealsForecast` para multiplicar `value × probability` por stage e mostrar coluna "Forecast ponderado".

4. **Subscription types — UI**
   - Tabelas `subscription_types` + `contact_subscriptions` prontas.
   - CRUD em `/settings/subscriptions` (já existe rota vazia) + toggles no record do contact.

5. **Card layout por pipeline**
   - Estrutura parcial em `deals-board-card`.
   - Adicionar settings panel para escolher quais campos aparecem no card (salvar em `record_layouts`).

**Saída:** 5 itens 🟡 → ✅. Estimativa: 1 release pequeno (~P cada).

---

## Release 2 — Listas dinâmicas + Filter builder

Bloqueia segmentação e campanhas. Faz sentido entregar junto.

6. **Listas dinâmicas (smart lists) — evaluator**
   - Schema `segments.kind = 'dynamic'` + `segment_members` já existem.
   - Criar `segments-tick` handler (já existe a rota `/api/public/hooks/segments-tick`) para reavaliar membros periodicamente.
   - Cron job no `reschedule_lovable_cron` (já tem o padrão).

7. **Filter builder com AND/OR aninhado**
   - `filter-builder-dialog` hoje só faz lista plana.
   - Refatorar modelo de filtro para árvore (`{op: 'AND'|'OR', children: [...]}`).
   - Compartilhar o mesmo modelo entre segments, saved_views e workflows.

8. **Wizard CSV — dedupe e mapeamento avançado**
   - Adicionar passo de "match field" (e-mail, telefone, external_id).
   - Detectar duplicatas antes do insert e oferecer merge/skip/create-new.

**Saída:** 3 itens 🟡 → ✅. Desbloqueia Release 3.

---

## Release 3 — Engine de automação (Workflows + Sequences + Scoring)

Itens grandes (G) mas com tabelas já modeladas. Maior valor estratégico.

9. **Workflows — engine + builder visual**
   - Engine: handler `/api/public/hooks/workflows-tick` (existe) consome `workflow_events` (trigger DB já enfileira) → executa ações (`send_email`, `update_field`, `create_task`, `wait_delay`, `branch_if`).
   - Builder: React Flow no `workflow-builder.tsx` (esqueleto pronto) — nodes para trigger / condition / action / delay.
   - Runs: `workflow_runs` já existe → exibir histórico em `workflow-runs-list`.

10. **Sequences — executor + UI de cadência**
    - Tabelas `sequences` + `sequence_enrollments` prontas.
    - Executor no `sequences-tick` (rota existe): processar steps com delay, enviar email/criar task.
    - UI: builder linear de steps (email → wait 2d → call → wait 1d → email).

11. **Lead scoring — executor + UI**
    - Tabela `scoring_rules` + `score_events` + `scoring_cursors` prontas.
    - Executor no `scoring-tick` (existe): aplicar regras → escrever em `score_events` → somar em `leads.score`.
    - UI: editor de regras (campo + operador + pontos) em `/settings/scoring` (rota existe).

**Saída:** 3 itens 🟡 → ✅. Habilita "Outbound estruturado" no roadmap.

---

## Release 4 — Polimento de Companies, Activities, Customização, AI

Itens menores que valem fechar para considerar 🟡=0.

12. **Companies — hierarquia parent/child + enrich por domínio**
    - Migration: adicionar `parent_company_id` em `companies` (self FK).
    - UI: campo "Empresa-mãe" + árvore no record.
    - Enrich por domínio: já existe trigger `contact_link_company_by_domain`; expor botão "Enriquecer agora" usando a função `link_contacts_by_email_domain`.

13. **Activities — gravação de call + threading de email**
    - Calls: campo `recording_url` em `activities` + player no timeline.
    - Email threading: usar `email_threads` (já existe) para agrupar `email_messages` no timeline do contato.

14. **Custom properties — UI de gerenciamento**
    - Tabela `custom_properties` pronta + JSONB `hs_raw`/custom nos objetos.
    - UI em `/settings/custom-properties` (rota existe): CRUD de definições por objeto, com tipo (text/number/date/select).
    - Renderizar dinamicamente no `properties-panel`.

15. **Grupos de propriedades + Record sidebar layout**
    - Tabela `record_layouts` pronta.
    - UI para arrastar campos em grupos e ordená-los; usar no `record-layout.tsx`.

16. **AI — resumo automático de call/email no timeline**
    - Tabela `ai_summaries` + AI Gateway prontos.
    - Worker: ao inserir uma activity de tipo call/email com transcript, chamar Lovable AI e gravar TL;DR.
    - UI: badge "Resumo IA" no `activity-timeline` abrindo `ai-summary-panel`.

17. **Apollo / Lusha — refinar UX**
    - Conectores parciais existem em `integrations/apollo.functions.ts`.
    - Padronizar UI de bulk enrich (`bulk-enrich-dialog`) com preview de campos antes do commit + log em `enrichment_jobs`.

**Saída:** 6 itens 🟡 → ✅. Mapa fica com **0 itens parciais**.

---

## Resumo da entrega

| Release | Itens | Esforço | Desbloqueio |
|---|---|---|---|
| 1 — Quick wins | 5 | P | UX imediata |
| 2 — Segmentação | 3 | M | campanhas, smart lists |
| 3 — Automação | 3 | G | outbound, workflows |
| 4 — Polimento | 6 | M | fecha o mapa parcial |

## Detalhes técnicos

- **Sem novas tabelas** nos Releases 1–3 (exceto `companies.parent_company_id` no Release 4). Todo o schema já existe.
- **Cron**: novos workers reaproveitam o padrão `reschedule_lovable_cron` + `/api/public/hooks/*-tick` com `requireCronAuth`.
- **RLS**: tudo já está `workspace_owner_id`-scoped — só herdar policies existentes.
- **Frontend**: novos componentes ficam em `src/components/<dominio>/` seguindo a convenção atual; rotas em `src/routes/_authenticated/`.

## Ordem sugerida de execução

Começar pelo **Release 1** (alta entrega, baixo risco) para ganhar momentum, depois **Release 3** (maior valor estratégico) e por fim **2** e **4** em paralelo conforme capacidade.

Confirma se quer que eu comece pelo Release 1 inteiro, ou prefere escolher itens específicos de cada release?
