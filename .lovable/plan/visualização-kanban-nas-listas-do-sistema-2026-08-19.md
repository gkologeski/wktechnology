# Visualização Kanban nas listas do sistema

Adicionar alternância "Tabela | Kanban" nas telas de lista que possuem uma coluna de etapa/status, reaproveitando o padrão já existente em Negócios, Tickets, Candidatos e Vagas.

## O que já existe

- `EntityBoard` (usado por Leads/Contatos via `EntityList`) com drag-and-drop e update direto na tabela.
- Boards dedicados: Negócios (`deals-board`), Tickets (`tickets-board`), Candidatos e Vagas (ATS).
- `KanbanScrollContainer` para rolagem horizontal.

## Telas sem kanban hoje (verificadas)

Com coluna de status/etapa e grid já padronizado:

| Tela                      | Tabela                               | Campo de etapa                                          | Arrastar                            |
| ------------------------- | ------------------------------------ | ------------------------------------------------------- | ----------------------------------- |
| Tarefas de projetos       | `project_tasks`                      | `status` (todo/doing/review/done)                       | sim                                 |
| Projetos                  | `projects`                           | `status` (planning/active/on_hold/done/cancelled)       | sim                                 |
| Pessoas                   | `people`                             | `status` (active/bench/on_leave/offboarding/terminated) | sim                                 |
| Incidentes                | `people_incidents`                   | `status` (texto)                                        | sim                                 |
| Propostas                 | `proposals`                          | `status` (enum `proposal_status`)                       | sim                                 |
| Ofertas (ATS)             | `ats_offers`                         | `status` (texto)                                        | sim                                 |
| Serviços do catálogo      | `services`                           | `status` (enum `service_status`)                        | sim                                 |
| Contratos                 | `contracts`                          | `status` (enum `contract_status`)                       | não (ciclo de vida controlado)      |
| Contas a pagar / receber  | `financial_entries`                  | `status`                                                | não (status derivado de pagamentos) |
| NFSe e Faturas de cliente | `nfse_invoices`, `customer_invoices` | `status`                                                | não (status do provedor)            |
| Chamados internos         | `bug_reports`                        | `status`                                                | sim                                 |

Onde "arrastar: não", o kanban entra como visualização de leitura (agrupamento + contagem), porque o status é calculado por regra de negócio (ex.: `recalc_financial_entry`) ou por integração externa — mudar por drag criaria inconsistência silenciosa.

## Abordagem

1. Generalizar `EntityBoard` em um `KanbanBoard` reutilizável, mantendo o comportamento atual das telas que já o usam:
   - colunas declarativas (`value`, `label`, cor via token semântico);
   - `readOnly` para boards de leitura;
   - `canUpdate` (RBAC) desabilitando o drag e o menu "Mover para";
   - alternativa acessível ao drag: menu por card "Mover para..." + foco visível;
   - invalidação de cache por `queryKey` da tela (sem `window.location`);
   - estados loading skeleton, empty e error do design system.
2. Cada tela declara apenas a configuração do board (campo, colunas, render do card) e ganha um toggle Tabela/Kanban ao lado dos filtros, com a escolha preservada em search param.
3. Migração por fases, validando cada lote.

## Fases

- Fase 1 — `KanbanBoard` reutilizável + Tarefas de projetos e Projetos.
- Fase 2 — People (Pessoas, Incidentes) e ATS/Vendas (Propostas, Ofertas).
- Fase 3 — Catálogo de Serviços e Chamados internos.
- Fase 4 — Boards de leitura: Contratos, Contas a pagar/receber, NFSe e Faturas.

## Detalhes técnicos

- Modo de visualização em search param (`view=table|kanban`) via `validateSearch`, como nas grids atuais.
- Update de etapa pelo cliente Supabase com RLS como fonte de verdade, no mesmo padrão de `GridBulkBar`, reportando falha quando nenhuma linha for afetada (`deniedIfUnaffected`).
- Chaves de permissão por módulo já existentes (`techprojects.tasks.update.*`, `techpeople.*`, `techhire.*`, `techfinance.*`); sem alteração de RBAC, RLS ou schema.
- Seleção múltipla e ações em massa continuam na visão de tabela; o kanban não altera as grids existentes.
- Cores das colunas por tokens semânticos, sem classes de cor avulsas; validar light/dark e responsividade (colunas com rolagem horizontal no mobile).

## Validação

- `tsgo --noEmit` e lint por fase.
- Verificação manual por tela: toggle, agrupamento correto, contagens, drag permitido/bloqueado, permissão negada, atualização imediata da lista após mover, estados vazio/carregando/erro, dark mode e mobile.
