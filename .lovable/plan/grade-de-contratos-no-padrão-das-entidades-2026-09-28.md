# Grade de Contratos no padrão das entidades

Alinhar a lista de `/contracts` (modo tabela) à estrutura usada em Empresas/Contatos/Leads, sem remover nada do que existe hoje (Kanban, agrupamento, aninhar vínculos, importações, ações em massa atuais).

## O que o usuário verá

- **Ordenação por coluna**: clicar no cabeçalho (Número, Título, Tipo, Status, Valor, Início, Término, Responsável, Criado em) alterna crescente/decrescente, com indicador visual. Ordenação vale para todos os contratos, não só a página.
- **Colunas configuráveis**: menu para mostrar/ocultar e reordenar colunas (mesmo seletor de Empresas), preferência salva por usuário.
- **Filtros no painel lateral** (mesmo `FiltersSidebar` das entidades): Tipo, Status, Empresa, Contratante, Responsável, Início e Término — os mesmos filtros de hoje, reorganizados. Chips de filtros ativos continuam.
- **Múltipla seleção** com checkbox de cabeçalho (selecionar página/todos), barra de ações em massa no padrão das entidades: editar campos em massa, atribuir responsável, exportar (CSV/XLSX) e excluir com confirmação e checagem de permissão.
- **Visões rápidas** (abas): Todos, Ativos, Em assinatura, Vencendo em 30 dias, Encerrados.
- Paginação no mesmo componente das entidades; estados de carregamento, vazio e erro preservados.

## Fora do escopo

Sem alteração de banco, RLS, permissões ou regras de contrato. Kanban, agrupamento e a tela de detalhe permanecem como estão.

## Detalhes técnicos

- Reutilizar `@/components/crm/hubspot-shell` (`Th` sortable, `HeaderCheckbox`, `FiltersSidebar`, `FilterGroup`, `CheckboxFilter`, `ViewsTabs`, `Pagination`, `Td`), `useGridColumns`, `ExportMenuButton`, `BulkEditFieldsDialog`, `deleteRowsGuarded`.
- `listContractsPaged`: adicionar parâmetros opcionais `sortBy` (lista fechada de colunas via zod) e `sortDir`, com padrão atual `created_at desc` — mudança aditiva, sem efeito em chamadas existentes. `status` passa a aceitar lista (múltiplos status) mantendo o valor único compatível.
- Estado de ordenação, colunas visíveis e visão em search params (`sort`, `dir`, `tab`), junto aos existentes.
- `ContractsTable` (em `contracts-grouped-list.tsx`) ganha cabeçalhos ordenáveis e colunas dinâmicas; o modo agrupado reutiliza a mesma tabela.
- `ContractsBulkBar` atual é mantido e ampliado (editar em massa/exportar), sem remover ações.
- Validação: tsgo, eslint, testes, build e Playwright (ordenar, filtrar, selecionar múltiplos, exportar) em desktop e mobile, sem excluir dados reais.
