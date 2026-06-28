## Elevar Vaga (Job) a entidade completa — padrão Candidato/Contato

Atualmente:
- `/jobs` já usa AtsPageHeader + FilterBar + grid de cards, mas só uma visão.
- `/jobs/$id` mostra header + kanban de candidaturas em coluna única.

Objetivo: tratar Vaga como entidade de primeira classe (igual Candidato), com lista multi-view e detalhe em 3 colunas, **sem alterar regra de negócio, RLS, schema ou remover funcionalidades**.

---

### Entrega 1 — Lista `/jobs` multi-view

Refatorar `src/routes/_authenticated/(ats)/jobs.tsx`:
- Manter AtsPageHeader, FilterBar, busca e filtros existentes.
- Adicionar **ViewSwitcher** (Table · Cards · Kanban por status · Kanban por departamento) — padrão idêntico ao usado em `/candidates`.
- Persistir a view escolhida em URL via `validateSearch` (`?view=table|cards|kanban-status|kanban-dept`), seguindo o padrão TanStack já usado no projeto.
- Views:
  - **Tabela**: DataTable com colunas Título, Status (StatusBadge), Pipeline, Departamento, Localização, Hiring Manager, Recrutador, Nº candidatos ativos, Aberta há (dias), Última movimentação. Linha clicável → `/jobs/$id`.
  - **Cards**: o grid atual (mantém o que existe hoje, só extraído como `JobsCardsView`).
  - **Kanban por status**: colunas Rascunho · Publicada · Pausada · Fechada · Arquivada. Drag-and-drop chama `saveAtsJob` para alterar `status` (mesmo server fn já usado pelo formulário).
  - **Kanban por departamento/squad**: colunas dinâmicas a partir do campo `department` da vaga; sem drag-and-drop (apenas agrupamento visual) na primeira versão, para não introduzir mutação de campo que hoje só é editável via form.
- EmptyState/LoadingSkeleton específicos por view (Skeletons.Table, Skeletons.CardsGrid, Skeletons.Kanban) reutilizando o que já existe em `@/components/ats/ui`.

Nenhuma mudança em `ats.functions.ts` para a lista — `listAtsJobs` já retorna os campos necessários; counts ativos virão de uma extensão pequena já existente (`listJobApplications` agregada) ou de um novo `listAtsJobsWithCounts` aditivo se necessário (server fn nova, sem mexer em policies, lendo apenas `ats_jobs` + `ats_applications` via `requireSupabaseAuth`).

### Entrega 2 — Detalhe `/jobs/$id` em 3 colunas

Refatorar `src/routes/_authenticated/(ats)/jobs.$id.tsx` para usar o `record-layout.tsx` (mesmo componente usado em `/candidates/$id`).

**Coluna esquerda — Ficha da vaga**
- Card "Vaga": título, StatusBadge, pipeline, departamento, seniority, localização, modelo (remoto/híbrido/presencial), faixa salarial, abertura, última movimentação, botão "Editar".
- Card "Equipe de hiring": hiring manager, recrutador, entrevistadores (lista de membros do pool quando vinculado).
- Card "Distribuição": link público da vaga, postagens (`ats_job_postings`), botão "Copiar link", "Compartilhar".

**Coluna central — abas (Tabs do design system)**
1. **Pipeline** (default) — kanban de candidaturas exatamente como hoje, com toda a lógica de DnD/move/scoring/export CSV preservada.
2. **Candidatos** — lista tabular das `ats_applications` da vaga (nome, estágio, score IA, origem, dias no estágio, última atividade) com filtros.
3. **Entrevistas** — agenda das `ats_interviews` ligadas a essa vaga.
4. **Scorecards** — template + resumo de avaliações (`listJobScorecardSummary` já existe).
5. **Atividade / Timeline** — usa `activity-timeline.tsx` filtrado por `entity_type='job'`.
6. **Postagens** — `ats_job_postings` (multi-posting; mantém banner "mock" quando aplicável).

**Coluna direita — Auxiliares**
- **Job Copilot** (IA): adapta o `CandidateCopilotPanel` para vaga — insights de funil, gargalos, recomendações de sourcing. Cria `src/components/ats/job-copilot-panel.tsx` reaproveitando `copilot_sessions`/`copilot_messages` já existentes; sem novo schema.
- **Match Score**: top 5 candidatos com maior `ai_match_score` (já calculado), com link para a aplicação.
- **DEI Snapshot**: KPIs do funil dessa vaga (já existe componente reutilizável).
- **Próximas entrevistas** (resumo das próximas 7 dias).

Botão "Adicionar candidato" no header continua funcionando — passa a abrir o `AssociateCandidateJobDialog` reutilizável criado na rodada anterior, com `presetJobId`.

### Entrega 3 — Quick Create + atalhos

- Item "Vaga" no QuickCreateMenu já existe para `/jobs?create=1`. Verificar que o modal de criação abre automaticamente quando `search.create === 1` (padrão das outras entidades).
- Adicionar entrada "Ir para vagas" no ⌘K Copilot.

---

### Detalhes técnicos

- **Sem alteração de schema, RLS, policies ou GRANTs.** Toda contagem agregada feita via server fn nova `listAtsJobsWithCounts` (opcional, aditiva) sob `requireSupabaseAuth`, reaproveitando policies existentes em `ats_jobs` e `ats_applications`.
- **Sem remover funcionalidades**: kanban atual, export CSV, scorecards summary, evaluation dialog — todos preservados, apenas movidos para dentro de abas.
- **URL state** via `validateSearch` (`view`, `tab`, filtros), nunca `useState` para coisas compartilháveis.
- **Componentes oficiais** do TechHire Design Foundation: `AtsPageHeader`, `FilterBar`, `MetricCard`, `DataTable`, `EmptyState`, `Skeletons`, `StatusBadge`, `StageBadge`, `ScoreBadge`, `MetaPill`, `Tabs`, `record-layout`.
- **Acessibilidade**: foco visível em DnD, aria-labels nos botões de view, navegação por teclado nas tabs.
- **Light/dark mode** validado via tokens semânticos de `src/styles.css`.
- **Loading/empty/error states** dedicados em cada view e cada aba.

### Arquivos previstos

Criados:
- `src/routes/_authenticated/(ats)/jobs.$id.tsx` (refatoração grande — pode ser dividido em sub-componentes em `src/components/ats/job-detail/`).
- `src/components/ats/job-detail/` (left-card, tabs, applications-table, postings-card, etc.).
- `src/components/ats/job-copilot-panel.tsx`.
- `src/components/ats/jobs-table-view.tsx`, `jobs-kanban-status.tsx`, `jobs-kanban-department.tsx`.

Alterados:
- `src/routes/_authenticated/(ats)/jobs.tsx` (ViewSwitcher + `validateSearch`).
- `src/lib/ats/ats.functions.ts` (aditivo: `listAtsJobsWithCounts`, se necessário).
- `src/components/copilot-cmdk.tsx` (atalho "Vagas").

Não alterados:
- `ats_jobs`, `ats_applications`, policies, GRANTs, RLS, server fns existentes.

### Como validar

1. `/jobs` — alternar Table/Cards/Kanban por status/Kanban por departamento; URL reflete a view; drag entre colunas de status atualiza a vaga.
2. `/jobs/$id` — 3 colunas; abrir todas as 6 abas; mover candidato no Pipeline; exportar CSV; abrir scorecards; ver timeline.
3. Botão "Adicionar candidato" abre dialog reutilizável com vaga pré-selecionada.
4. Light/dark mode + responsivo (desktop, tablet, mobile colapsa para coluna única com tabs no topo).
5. `bunx tsgo --noEmit` limpo.

### Riscos / pendências

- Refator grande no detalhe — manter PR mental dividido em sub-componentes para reduzir blast radius.
- Kanban por departamento só agrupa (não move) na primeira versão; mover entre deptos pode entrar depois.
- Job Copilot reusa storage existente; prompts específicos de vaga ficam configurados em código (sem migration).

### Próximo passo

Executar Entrega 1 (lista multi-view) e Entrega 2 (detalhe 3 colunas) em sequência, na mesma rodada, sem alterar regra de negócio.