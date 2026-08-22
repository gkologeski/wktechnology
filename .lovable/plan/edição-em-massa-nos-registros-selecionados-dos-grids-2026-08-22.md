# Edição em massa nos registros selecionados dos grids

## Situação atual (verificada)

- Já existe edição em massa dinâmica (campos do catálogo da entidade) via
  `GridBulkBar` + `BulkEditFieldsDialog` + server function `bulkUpdateEntity`.
- Telas que já têm o botão "Editar em massa": Leads, Contatos, Empresas,
  Tarefas, Candidatos, Vagas, Ofertas, Propostas, Serviços, Projetos, Tarefas de
  projeto, Pessoas, Benefícios, Documentos, Incidentes e Financeiro (entradas).
- Lacunas confirmadas:
  - **Negócios** (`deals.tsx` / `src/components/deals/deals-list.tsx`): o grid
    não tem seleção múltipla nem barra de ações em massa.
  - **Contratos** (`contracts.index.tsx`): tem seleção e `ContractsBulkBar`,
    mas a barra só oferece ações próprias, sem edição em massa.
  - **Notas / Comunicações** (`entity-list.tsx`): usam o diálogo antigo com
    lista fixa de campos (`BulkEditDialog`), não o catálogo dinâmico.

## O que será feito

### 1. Negócios ganham seleção e edição em massa
Adicionar seleção por linha (com "selecionar todos" e "selecionar todos os
resultados do filtro", como nos outros grids) e usar a `GridBulkBar` padrão, que
já traz exportar, editar em massa, responsável, criar atividade e excluir com
confirmação por contagem. Sem remover nenhuma ação atual da tela.

### 2. Contratos ganham "Editar em massa"
Incluir o botão na `ContractsBulkBar` existente, abrindo o diálogo dinâmico com
os campos permitidos de contratos. As ações atuais da barra permanecem
intactas, e o botão só aparece para quem tem permissão de atualizar.

### 3. Notas e Comunicações passam a usar o diálogo dinâmico
`entity-list.tsx` passa a abrir o diálogo por catálogo quando a tabela é
suportada, mantendo os campos hoje declarados no topo da lista; tabelas fora do
catálogo continuam com o diálogo antigo (nada quebra).

### 4. Consistência pós-edição
Toast com a contagem realmente alterada, aviso quando a permissão bloquear
parte da seleção, limpeza da seleção e atualização automática do grid — o mesmo
comportamento já usado nas exclusões.

## Detalhes técnicos

- Reuso de `useGridSelection`, `GridBulkBar`, `BulkEditFieldsDialog`,
  `bulkUpdateEntity` e `isBulkEditEntity`; nenhum componente novo é necessário.
- `contracts` já consta em `BULK_EDIT_ENTITIES`; para Negócios (`deals`) e Notas
  (`activities`) também. Se alguma tabela alvo faltar, ela é adicionada apenas
  nessa lista (sem tocar em schema).
- Sem alteração de schema, RLS, permissões ou regra de negócio: a validação de
  campos continua sendo camada extra sobre a RLS.
- Visibilidade do botão continua condicionada às permissões da UI
  (`canUpdate`), com a RLS como fonte de verdade.
- Validação: `bunx tsgo --noEmit`, `bun run lint`, `bun run test` e conferência
  manual em um grid do TechSales, um de contratos e um do TechHire.

## Fora de escopo

Edição em massa em telas Kanban, campos personalizados (`custom_fields`) e
importação/atualização via CSV.
