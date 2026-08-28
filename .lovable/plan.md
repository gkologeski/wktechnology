# Histórico na timeline + Kanban de Leads

Duas entregas independentes, na ordem abaixo.

## Parte 1 — Histórico de alterações e movimentações na timeline

Hoje o sistema já grava toda alteração de campo de `leads`, `contacts`, `companies` e `deals`
em uma tabela de histórico (triggers ativos, ~84 mil registros). Esse histórico só aparece hoje
em uma gaveta separada ("Histórico de propriedades") — não na timeline.

O que muda:

- A timeline da entidade passa a exibir eventos de histórico junto com atividades, e-mails,
  reuniões e pesquisas, ordenados no mesmo fluxo cronológico (igual HubSpot).
- Alterações feitas no mesmo instante pelo mesmo usuário são agrupadas em um único card
  ("Guilherme atualizou 3 propriedades"), com lista expansível de `Campo: antes → depois`.
- Movimentações de etapa/pipeline/substatus e troca de responsável ganham destaque próprio
  ("Etapa alterada: Contatando → Qualificando"), porque são os eventos mais consultados.
- Valores são exibidos em pt-BR e IDs são resolvidos para nomes (responsável, pipeline, etapa,
  substatus, empresa) — nunca hash.
- Novo filtro "Histórico" nos chips de tipo da timeline, ligado por padrão, para permitir
  esconder o ruído quando o usuário quiser ver só interações.
- Entidades cobertas: Lead, Contato, Empresa e Negócio (as que têm trigger de histórico hoje).

## Parte 2 — Kanban em /leads

/leads passa a ter alternância Lista/Kanban com as mesmas funcionalidades das outras entidades:

- Botão de alternância de visualização com persistência no search param (mesmo padrão de Negócios).
- Colunas = etapas do pipeline de Leads selecionado, com contador por coluna.
- Arrastar cartão entre colunas altera a etapa, respeitando RBAC e RLS (bloqueio silencioso é
  detectado e avisado). Alternativa acessível "Mover para..." no menu do cartão.
- Regra de qualificação preservada: mover para a etapa de qualificação abre o questionário de
  qualificação (mesmo comportamento da tela de detalhe), e mover para "Qualificado" continua
  restrito ao fluxo de qualificação — o Kanban não cria atalho para burlar o gate.
- Seleção múltipla nos cartões com a mesma barra de ações em massa dos grids (edição em massa,
  responsável, exclusão), como já existe no Kanban de Negócios.
- Cartão mostra nome, empresa, responsável, origem, score e substatus, com seletor rápido de
  substatus.
- Filtros, busca, período e visões salvas do grid continuam valendo no Kanban.

## Detalhes técnicos

Parte 1:

- Migration: estender `public.get_entity_timeline` com um `UNION ALL` de `property_history`
  (`source = 'history'`), respeitando `p_since`/`p_until`/`p_limit` e o mesmo isolamento por
  workspace já usado na função; nenhuma tabela nova.
- Extrair os mapas de rótulos de `src/components/property-history-drawer.tsx` para
  `src/lib/timeline/property-labels.ts` (reuso pelo drawer e pela timeline, sem duplicação).
- Novo componente `src/components/activity/history-timeline-item.tsx`; agrupamento por
  `changed_by` + janela de tempo em `src/lib/timeline/history-groups.ts`.
- `src/components/activity-timeline.tsx` passa a consumir as linhas `history` do RPC (já chama o
  RPC hoje para eventos de calendário) e a incluir "Histórico" na lista de filtros.
- Resolução de IDs para nomes via hook de rótulos de referência já existente.

Parte 2:

- Novo `src/components/leads/leads-board.tsx` sobre o `KanbanBoard` genérico
  (`src/components/kanban/kanban-board.tsx`) com `onMove` customizado para aplicar
  `deriveLeadStatus` e o gate de qualificação; `use-view-mode.ts` para persistência.
- `leads-toolbar.tsx` recebe o `ViewModeToggle`; `leads.tsx` renderiza tabela ou board conforme o
  modo, reaproveitando a mesma query, filtros e seleção.
- Sem alteração de schema, RLS ou regra de negócio nesta parte.

## Validação

`bun run lint`, `tsgo` (typecheck) e `bun run build:dev`; verificação manual da timeline de um
lead com histórico e do arrastar de cartões no Kanban de leads.
