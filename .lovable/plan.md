# Filtro de Responsável pelo TechERP + auditoria dos grids

## Causa do problema (conferida no banco)
- As 32.001 empresas estão com o Guilherme como responsável no TechERP, mas 31.689 delas têm a Grasiele como dona no HubSpot.
- Ao marcar a Grasiele, o filtro também buscava pelo dono do HubSpot, por isso vinham empresas do Guilherme.
- O mesmo desencontro existe em Contatos (50.387), Leads (4.852) e Negócios (821).

## Parte 1: o filtro passa a considerar só o responsável do TechERP
- Marcar uma pessoa mostra apenas os registros em que ela é a responsável no TechERP. O dono do HubSpot deixa de ser considerado.
- Vale para Empresas, Contatos e Leads, que são as grades que usam esse filtro.
- A lista continua com uma linha por pessoa, separada em Ativos e Inativos. Responsáveis do HubSpot sem usuário ligado saem da lista, porque não são responsáveis de nenhum registro no TechERP.
- Nenhum dado é alterado.
- Consequência esperada: marcar a Grasiele hoje mostra zero empresas, porque ela não é responsável por nenhuma no TechERP.

## Parte 2: auditoria dos grids (somente leitura)
- Levantar todos os grids do sistema, cerca de 43 telas com tabela, e comparar estes recursos:
  - ordenação por coluna, e quais colunas permitem ordenar;
  - filtros laterais;
  - busca;
  - seleção múltipla;
  - selecionar todos os resultados filtrados;
  - edição e atribuição em massa;
  - exportação;
  - arrastar colunas e salvar a ordem;
  - visualizações salvas;
  - paginação.
- Empresas já está confirmada como lacuna: hoje só dá para ordenar por Nome, Criada em e Atualizada em.
- Entrega: uma tabela de lacunas por grid, com a proposta de implementação e o esforço de cada item, para você escolher o que fazer. Nada é implementado nesta parte.

## Detalhes técnicos
- `owner-filter.tsx`: `buildOwnerOptions` usado só para agrupar; `toggle` grava apenas uuids (sem `hs:`). Opções sem `hasUser` são descartadas.
- `ownerFilterOrExpr` / `contacts.tsx` / `leads.tsx`: remover a cláusula `hubspot_owner_id.in.(...)`. `splitOwnerIds` ignora `hs:` vindos de filtros salvos antigos.
- Ajustar `owner-filter-options.test.ts` e adicionar teste do helper.
- Validar no navegador em /companies: Grasiele deve dar 0 e Guilherme deve dar 32.001. O mesmo teste vale para /contacts.
- Auditoria: `rg` em `src/routes/_authenticated` por `EntityList`, `SortableColumnHeader`, `useGridSelection`, `GridBulkBar`, `ExportMenuButton`, `useGridColumns` e FilterGroup. O relatório vai para `docs/qa/grid-feature-audit.md`.
