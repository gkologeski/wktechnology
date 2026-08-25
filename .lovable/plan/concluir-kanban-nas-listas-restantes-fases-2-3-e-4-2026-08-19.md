# Concluir Kanban nas listas restantes (Fases 2, 3 e 4)

Continuação do plano de visualização Kanban, reutilizando `KanbanBoard` e `ViewModeToggle` já existentes. Trabalho apenas de frontend/apresentação: sem alterar schema, RLS, RBAC ou regra de negócio.

## Fase 2 (restante)

| Tela           | Rota      | Campo de etapa                                                  | Drag |
| -------------- | --------- | --------------------------------------------------------------- | ---- |
| Pessoas        | `/people` | `people.status` (ativo, banco, licença, offboarding, desligado) | sim  |
| Ofertas do ATS | `/offers` | `ats_offers.status`                                             | sim  |

## Fase 3

| Tela                 | Rota                                     | Campo de etapa       | Drag                                                |
| -------------------- | ---------------------------------------- | -------------------- | --------------------------------------------------- |
| Serviços do catálogo | `/catalog/services`                      | `services.status`    | sim                                                 |
| Chamados internos    | `/admin/bug-reports` e `/my-bug-reports` | `bug_reports.status` | sim (apenas em `/admin/bug-reports`, com permissão) |

## Fase 4 — boards somente leitura

Status derivado de regra de negócio ou de integração externa, então o kanban entra como agrupamento + contagem, com `readOnly`:

| Tela               | Rota                  | Campo                      | Motivo                                         |
| ------------------ | --------------------- | -------------------------- | ---------------------------------------------- |
| Contratos          | `/contracts`          | `contracts.status`         | ciclo de vida controlado por ações do contrato |
| Contas a pagar     | `/finance/payable`    | `financial_entries.status` | status recalculado a partir dos pagamentos     |
| Contas a receber   | `/finance/receivable` | `financial_entries.status` | idem                                           |
| NFSe               | `/finance/nfse`       | `nfse_invoices.status`     | status do provedor fiscal                      |
| Faturas de cliente | `/invoices`           | `customer_invoices.status` | status do provedor de cobrança                 |

## Padrão aplicado em cada tela

- Toggle Tabela | Kanban ao lado dos filtros, com o modo em search param (`view=table|kanban`, opcional para não quebrar links existentes).
- Colunas declaradas a partir dos mapas de rótulos já usados na tela (rótulos em pt-BR), com cor via token semântico.
- Card com o essencial da linha: título/nome com link para o detalhe, um ou dois metadados e responsável quando a tabela tiver `assigned_to`.
- `canUpdate` ligado às chaves de permissão do módulo (`techpeople.*`, `techhire.*`, `techfinance.*`, `techcontracts.*`), desabilitando drag e o menu "Mover para".
- Alternativa acessível ao drag pelo menu "Mover para..." do card, foco visível, rolagem horizontal no mobile.
- Estados loading skeleton, empty e error do design system; invalidação de cache pela `queryKey` da própria tela.
- Ações em massa, seleção múltipla e edição inline continuam só na visão de tabela.

## Detalhes técnicos

- `validateSearch` com `view` opcional em cada rota, como em Projetos e Tarefas.
- Boards de leitura recebem `readOnly`, sem update de etapa.
- Update de etapa segue pelo cliente Supabase com RLS como fonte de verdade e `deniedIfUnaffected` para reportar bloqueio silencioso.
- Nas telas com paginação server-side, o kanban agrupa as linhas da página atual e o rodapé de paginação continua visível, para não dar impressão de dados faltando.
- Sem novas dependências, sem migrations.

## Validação

- `npx tsgo --noEmit` e lint ao final de cada fase.
- Verificação manual por tela: toggle, agrupamento, contagens, drag permitido/bloqueado, "Mover para", recarregar com `?view=kanban`, estados vazio/carregando/erro, dark mode e mobile.
