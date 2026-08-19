# Grids completos nas telas de lista do sistema

Padronizar as listas/tabelas de ATS, People, Financeiro e Projetos/Serviços/Contratos com as mesmas funções dos grids de Contatos e Negócios.

## Funcionalidades confirmadas para as novas grids

Seleção
- Checkbox por linha e no cabeçalho (página atual).
- "Selecionar todos os N registros" respeitando os filtros ativos (todas as páginas).

Ações em massa
- Edição em massa (marcar quais campos sobrescrever).
- Exclusão em massa com confirmação digitando a contagem.
- Atribuir responsável em massa.
- Criar atividade/tarefa em massa para os selecionados.

Colunas
- Editor de colunas: mostrar/ocultar, reordenar, restaurar padrão.
- Preferência salva por usuário e por grid.
- Campos personalizados da entidade como colunas.

Busca, filtros e views
- Busca textual e ordenação por coluna.
- Filtro avançado com grupos AND/OR.
- Views salvas + presets por entidade.
- Filtros de responsável e de período.

Edição
- Edição inline na célula para texto, número, data e select.
- Modal de criação/edição por entidade.

Dados
- Paginação server-side com contagem total.
- Exportação CSV do resultado filtrado.

Extras
- Menu de ações por linha (abrir, editar, excluir, duplicar quando aplicável).
- Visão Kanban alternativa onde existirem etapas (vagas, propostas, tarefas, lançamentos).
- Estados padrão de loading skeleton, empty e error conforme design system TechHire.
- Guardas de RBAC por ação: esconder/desabilitar editar, excluir e ações em massa sem permissão.

## Abordagem

1. Generalizar o grid atual em um componente reutilizável (`DataGrid`) extraído de `EntityList`, sem alterar o comportamento de Contatos/Negócios/Leads/Empresas.
2. Cada tela passa a declarar apenas a sua configuração: tabela, colunas, campos de formulário, campos de edição em massa, filtros, presets, ações de linha e etapas de Kanban.
3. Migrar tela por tela, validando cada lote antes de avançar.

## Fases de migração

Fase 0 — Base
- Extrair `DataGrid` + hook de dados (busca, filtros, ordenação, paginação, contagem, seleção global).
- Generalizar a tabela alvo (hoje o grid aceita apenas companies/contacts/leads/deals/activities).
- Reaproveitar `useGridColumns`, `BulkActionBar`, `BulkEditDialog`, `ConfirmCountDialog`, `FilterBuilder`, views salvas, `AssigneeFilter` e `DateRangeFilter`.
- Camada de permissões por ação usando o RBAC existente.

Fase 1 — ATS
- Candidatos, Vagas, Propostas. Kanban nas entidades com etapa.

Fase 2 — People
- Pessoas, Documentos, Benefícios, Incidentes.

Fase 3 — Financeiro
- Lançamentos, Faturas, Recorrências, NFSe. Kanban por status em Lançamentos.

Fase 4 — Projetos, Serviços e Contratos
- Projetos, Tarefas, Serviços, Contratos. Kanban em Tarefas.

## Detalhes técnicos

- Estado de filtro/página/ordenação em search params via `validateSearch` + `fallback`, como já feito nas telas atuais.
- Leituras e mutações continuam em server functions com `requireSupabaseAuth`; nada de acesso a banco em componentes de apresentação.
- Seleção global de "todos os filtrados" busca apenas os IDs, com limite de segurança e feedback de progresso.
- Exclusão/edição em massa passam pelas mesmas checagens de RLS e `delete-guard`, reportando quantos registros foram efetivamente afetados.
- Preferências de coluna reutilizam `user_grid_preferences` com uma `gridKey` por tela.
- Sem alteração de schema prevista, exceto eventuais índices de ordenação/paginação se alguma listagem ficar lenta.
- Invalidação de cache por entidade seguindo as convenções de `src/lib/entity-queries.ts`.

## Validação

- `tsgo` e lint após cada fase.
- Verificação manual por tela: seleção, seleção total, edição em massa, exclusão com contagem, colunas, filtros, views, CSV, paginação, inline edit, Kanban, estados e permissões.
