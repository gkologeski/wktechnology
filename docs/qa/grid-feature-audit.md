# Auditoria de recursos dos grids — 30/09/2026

Levantamento somente leitura, feito por busca no código de `src/routes/_authenticated`. É heurístico: um "—" indica que o recurso não foi encontrado no arquivo da rota. Ele pode existir num componente filho e precisa ser confirmado antes de implementar.

## Correção da referência anterior

A afirmação de que os grids centrais já possuíam todos os recursos estava incorreta. A leitura dos componentes filhos confirmou famílias diferentes e cobertura desigual:

- Empresas e Contatos tinham seleção somente da página; a seleção de todos os resultados filtrados foi corrigida em 30/09/2026.
- Leads já possuía seleção global.
- Negócios carrega até 1.000 registros e filtra no navegador.
- Tickets carrega até 500 registros, filtra/ordena no navegador, não tem paginação real e combina filtros superiores com painel lateral.
- `EntityList` é usado hoje apenas por Comunicações e Notas; os demais grids compõem primitivas compartilhadas manualmente.

O padrão alvo passa a ser o contrato descrito no plano aprovado de padronização completa, orientado pelo catálogo de campos e sem escolha manual das funções básicas por tela.

## Grids com lacunas

| Grid                                                                          | Tem hoje                          | Falta (proposta)                                    | Esforço  |
| ----------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------- | -------- |
| Empresas                                                                      | tudo, exceto a ordenação completa | ordenar por todas as colunas que vêm do banco       | P        |
| Vagas (ATS)                                                                   | filtros, seleção, massa           | ordenação, busca, exportar, colunas, visões         | M        |
| Ofertas (ATS)                                                                 | seleção, massa                    | ordenação, filtros, busca, exportar                 | M        |
| Pessoas                                                                       | busca, seleção, massa             | ordenação, filtros laterais, exportar, colunas      | M        |
| Benefícios / Documentos / Incidentes (People)                                 | seleção, massa                    | ordenação, busca, filtros, exportar                 | M cada   |
| Projetos                                                                      | busca, seleção, massa             | ordenação, filtros, exportar, colunas               | M        |
| Tarefas de projetos                                                           | busca, seleção, massa             | ordenação, filtro de responsável múltiplo, exportar | M        |
| Propostas                                                                     | seleção, massa                    | ordenação, busca, filtros, exportar                 | M        |
| Tickets                                                                       | busca, seleção, massa             | ordenação, filtros laterais, exportar, colunas      | M        |
| Faturas                                                                       | busca                             | ordenação, seleção, filtros, exportar               | M        |
| NFS-e / Recorrências / Contas bancárias / Auditoria financeira                | —                                 | ordenação, busca, exportar, paginação               | P–M cada |
| Pessoas: faturamento, margem, onboarding, offboarding, psicossocial, meu time | —                                 | ordenação, busca, exportar                          | P–M cada |
| Campanhas de e-mail                                                           | —                                 | ordenação, busca, filtros, exportar                 | M        |
| Modelos de contrato                                                           | busca                             | ordenação, exportar                                 | P        |
| Timesheet                                                                     | seleção                           | ordenação, filtros, exportar                        | M        |

Telas de configuração (KB, snippets, portal, segmentos, equipes, exportações, cobrança, diagnóstico RBAC) são listas administrativas curtas. Não recomendo esses recursos nelas.

## Proposta de fases

1. **Ordenação:** criar um componente comum de ordenação por coluna e aplicar em todos os grids operacionais, começando por Empresas.
2. **Exportar e busca** nos grids operacionais que ainda não têm.
3. **Filtros laterais e visões salvas:** migrar Tickets, Projetos, Pessoas, Propostas e Faturas para o padrão `EntityList`.
4. **Arrastar colunas** nos grids migrados.

## Situação da Fase 1 (30/09/2026) — concluída

Ordenação por coluna aplicada com `SortableTableHead` + `useClientSort` (ordena as linhas já carregadas; vazios no fim; ordem não persiste ao recarregar) em: Tickets, Projetos, Propostas, Pessoas, Benefícios, Documentos, Incidentes, Faturas, Vagas, Ofertas, Campanhas de e-mail, Modelos de contrato, NFS-e, Recorrências, Contas bancárias, Tarefas de projetos e Timesheet. Empresas usa ordenação no banco. Colunas de responsável/pessoa por código interno ficaram sem ordenação.

## Fase 2 — concluída (2026-09-30)

Exportar (CSV/JSON/XLSX) e busca local adicionados via `GridListToolbar` em Tickets, Projetos, Propostas, Pessoas, Benefícios, Documentos, Incidentes, Faturas, Vagas, Ofertas, Campanhas de e-mail, Modelos de contrato, NFS-e, Recorrências, Contas bancárias, Tarefas de projetos e Timesheet. Telas com busca própria mantêm a existente.

## Fase 3 — concluída (2026-09-30)

Painel lateral de filtros (`GridFilterPanel`/`GridFilterChips`) e menu de visões salvas (`GridSavedViewsMenu`, tabela `saved_views`) adicionados via `GridListToolbar` em Tickets, Projetos, Pessoas, Propostas e Faturas, sem remover os filtros existentes. Visão padrão aplicada ao abrir; visões guardam filtros, busca e ordenação.

## Inventário ampliado e Fase 4 — 30/09/2026

| Família / telas                     | Situação confirmada                                                      | Próxima migração                                                         |
| ----------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Empresas, Contatos, Leads           | paginação/ordenação no servidor, colunas configuráveis e seleção global  | consolidar filtros, views e exportação completa                          |
| Negócios                            | quatro modos, filtros superiores e lote local de até 1.000               | paginação/contagem no servidor e painel lateral, preservando os modos    |
| Tickets                             | Tabela/Quadro/Split, filtros duplicados, lote de até 500 e colunas fixas | mockup obrigatório e migração completa como prova do padrão              |
| Projetos                            | seleção, massa, toolbar, filtros/views e Kanban                          | migrar para a fundação única                                             |
| Tarefas de projeto                  | seleção, massa, toolbar e Kanban; sem painel/views                       | completar filtros/views e seleção global real                            |
| Serviços                            | seleção, massa, Kanban e colunas; filtros superiores                     | completar painel/views e paginação real                                  |
| Contratos                           | seleção global, massa, Kanban e colunas; filtros próprios                | integrar toolbar, painel/views e fundação única                          |
| ATS                                 | Candidatos, Vagas e Ofertas têm composição própria e cobertura parcial   | lote TechHire                                                            |
| People                              | cobertura desigual; Pessoas é a referência mais completa                 | lote TechPeople                                                          |
| Financeiro                          | cobertura desigual; várias listas processam lote local                   | lote TechFinance                                                         |
| Comunicações e Notas                | `EntityList` legado                                                      | migrar após estabilizar a nova fundação                                  |
| Listas administrativas e relatórios | nem sempre exigem seleção ou ações em massa                              | justificar exceções e manter estados, busca e ordenação quando aplicável |

### Contrato de conformidade

Todo grid operacional deve ter busca, filtros laterais, chips, views, ordenação e paginação no servidor, seleção da página e de todos os resultados filtrados, barra única de ações em massa conforme RBAC, exportação completa, colunas configuráveis/reordenáveis persistidas e estados loading/empty/error. Kanban é obrigatório apenas quando houver etapa/status compatível.

### Fase 4 aprovada

Projetos, Tarefas de projeto, Serviços e Contratos serão migrados para a fundação única. A fase também fecha seleção global, edição/atribuição/criação de atividade/exportação/exclusão em massa e persistência de colunas em qualquer grid operacional ainda híbrido. Tickets terá mockup e aprovação visual antes da migração, conforme regra do projeto.
