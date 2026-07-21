# Sprint Timesheet na ficha da pessoa

Fechar as lacunas da aba **Timesheet** em `/people/$id`, cobrindo KPIs, filtros, subtotais, exportação, ações operacionais e visão de alocações com tarifas corretas.

## Escopo confirmado (respostas)
- Completar KPIs + filtros/presets + subtotais/export
- Ações operacionais na ficha (aprovar/rejeitar/lançar)
- Alocações + tarifas corretas

Fora do escopo: mexer em módulo Projects, mudar schema de `project_time_entries`, alterar workflows/permissões existentes.

---

## Fase 1 — KPIs e cálculo de tarifas corretas

Server: `src/lib/people/timesheet.functions.ts`
- `listPersonTimesheet` passa a considerar tarifa efetiva por linha, com fallback em ordem:
  1. `project_time_entries.hourly_rate` (existente)
  2. `people_allocations.bill_rate` da alocação vigente no `entry_date`
  3. `null` (não conta em receita)
- Custo por hora efetivo por linha, com fallback:
  1. `people_allocations.cost_rate`
  2. `people.cost_hour`
- Totais expostos passam a incluir: `hours`, `billableHours`, `approvedHours`, `pendingHours`, `revenue`, `cost`, `margin`, `capacityHours` (soma de horas contratadas nas alocações vigentes no período), `utilization` (billableHours ÷ capacityHours).
- Sem mudança de schema; usa `people_allocations` já existente.

UI: `src/components/people/timesheet-panel.tsx`
- Grade de KPIs de 4 → 6 cards: Horas totais, Billable, Aprovadas, Utilização (%), Receita, Custo, Margem (agrupados em duas linhas).
- Margem mantém sinal (verde/vermelho); Utilização mostra % com barra.

## Fase 2 — Filtros e presets

Estado local (não vai para URL para não poluir a rota da pessoa):
- Presets: "Semana", "Mês atual", "Últimos 30 dias", "Trimestre", "Personalizado".
- Filtro por Projeto (multi) — options vindas dos entries carregados.
- Filtro por Status: Todos / Pendente aprovação / Aprovado.
- Filtro por Tipo: Todos / Billable / Interno.
- Botão "Limpar filtros".

Aplicação dos filtros: totais e tabela são recalculados no cliente sobre o resultado do server para responsividade; a query só refaz quando muda período.

## Fase 3 — Subtotais por dia, links e export

Tabela em `TimesheetPanel`:
- Renderiza linhas de cabeçalho de dia com total de horas e valor do dia.
- Coluna Projeto vira link para `/projects/$id` quando existir.
- Coluna Tarefa vira link para a tarefa (rota já existente do módulo Projects).
- Botão "Exportar CSV" no header do card "Apontamentos" — gera CSV no cliente com os apontamentos filtrados (data, projeto, tarefa, descrição, horas, valor, custo, status). Sem servidor.

## Fase 4 — Ações operacionais (aprovar / rejeitar / lançar horas)

Novos server functions em `src/lib/people/timesheet.functions.ts`:
- `approveTimesheetEntries({ ids: uuid[] })` — atualiza `approved_at = now()`, `approved_by = auth.uid()` respeitando RLS. Retorna contagem.
- `unapproveTimesheetEntries({ ids: uuid[] })` — limpa `approved_at`/`approved_by`.
- `upsertTimeEntry({ id?, project_id, task_id?, allocation_id?, person_id, entry_date, hours, billable, hourly_rate?, description? })` — cria/edita apontamento em `project_time_entries`. Sem alterar schema; usa colunas já existentes.
- `deleteTimeEntry({ id })` — remove apontamento.

Todos com `.middleware([requireSupabaseAuth])` e queries via `context.supabase` (RLS aplicada).

UI:
- Checkbox por linha + checkbox "selecionar tudo" no cabeçalho.
- Barra flutuante com contagem selecionada e ações: "Aprovar", "Remover aprovação", "Excluir".
- Botão "Lançar horas" no header do card, abrindo dialog `TimeEntryDialog` (Popover não — precisa de campos suficientes). Campos: projeto (Combobox), tarefa (opcional), alocação (auto-preenche a partir de projeto+data), data, horas (numérico com step 0.25), billable (switch), taxa/h (opcional, com preview do valor), descrição.
- Ação "Editar" no menu contextual (ícone `...`) de cada linha reabre o mesmo dialog em modo edição.
- Confirmação em "Excluir" via `AlertDialog`.
- Todas as mutations invalidam `["person-timesheet", personId, ...]`.

Permissões: as políticas atuais de `project_time_entries` já permitem que o dono aponte e que gestores aprovem — a UI apenas expõe os botões; qualquer ausência de permissão retorna erro tratado com toast (`Não foi possível aprovar…`). Sem alteração de RLS neste plano.

## Fase 5 — Visão de alocações no período

Novo card "Alocações no período" acima do card de apontamentos:
- Server: `listPersonAllocations({ person_id, start, end })` — lista `people_allocations` cujo intervalo intercepta o período, com `contract_id/project_id/role/bill_rate/cost_rate/hours_per_week/start/end`.
- UI: tabela compacta mostrando Contrato/Projeto, Papel, Período, Horas contratadas no período, Horas apontadas (billable), Utilização % e Margem estimada.
- Se não houver alocações: `EmptyState` com CTA "Adicionar alocação" que abre o dialog já existente na aba Alocações (se disponível) ou apenas informa.

---

## Detalhes técnicos

- Sem migrations; nenhuma coluna nova.
- Reaproveita `project_time_entries`, `people_allocations`, `projects`, `project_tasks`, `people` (já existentes).
- Segue tokens semânticos e componentes shadcn já usados no painel (`Card`, `Table`, `Badge`, `Button`, `Dialog`, `AlertDialog`, `Checkbox`, `Popover`, `Combobox`).
- `useQuery` continua sendo a fonte; mutations usam `useMutation` + `queryClient.invalidateQueries`.
- CSV gerado com `Blob`/`URL.createObjectURL`; nome `timesheet-<pessoa>-<periodo>.csv`.
- Zero mudança em rotas, sidebar ou permissões RLS.

## Riscos
- Aprovar/rejeitar depende de política RLS já existente para `approved_at`; se estiver restrita a gestor, usuário comum verá toast de erro — comportamento correto, sem regressão.
- `hourly_rate` fallback por alocação pode diferir de valores históricos; explicitado em tooltip "Tarifa efetiva".

## Como validar
1. Abrir `/people/<id>` → aba Timesheet.
2. Trocar preset para "Últimos 30 dias" e conferir KPIs e barra de utilização.
3. Filtrar por projeto e status pendente; conferir subtotais por dia.
4. Selecionar 2 linhas e aprovar; ver KPI "Aprovadas" e "Utilização" reagirem.
5. Clicar "Lançar horas", criar entry, ver aparecer no dia certo.
6. Exportar CSV e abrir na planilha.
7. Conferir card "Alocações no período" com bill/cost rate refletindo em Receita/Margem.

## Próximo passo recomendado (não incluído)
- Aprovação em lote via workflow (notificação ao gestor) e widget de Timesheet no dashboard do gestor.
