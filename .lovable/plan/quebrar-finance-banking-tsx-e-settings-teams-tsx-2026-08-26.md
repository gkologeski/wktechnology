# Quebrar `finance.banking.tsx` e `settings.teams.tsx`

Refatoração puramente estrutural: mesma UI, mesmas queries, mesmas mutations, mesmas permissões. Nenhuma mudança de comportamento, schema, RLS ou regra de negócio.

## Estado verificado

- `src/routes/_authenticated/finance.banking.tsx`: 1.380 linhas, um único componente `BankingPage` com 4 abas (Extrato, Cobranças, Pagamentos, Histórico), ~10 mutations e ~6 queries, mais `BankingHealthCard` no fim do arquivo.
- `src/routes/_authenticated/settings.teams.tsx`: 1.237 linhas, um único componente `UsersPage` com ~20 blocos de `useState` (convite, remoção/reatribuição, edição, papéis), cards de métricas, tabela de convites e tabela de membros.

## Banking — nova estrutura

`src/components/finance/banking/`

- `connection-card.tsx` — cartão de conexão bancária (conectar, sincronizar, desconectar) e o diálogo mock de conclusão de OAuth.
- `statement-tab.tsx` — extrato + conciliação.
- `charges-tab.tsx` — lista de cobranças, diálogo de nova cobrança, detalhe, cancelar, simular pagamento.
- `payments-tab.tsx` — lista de pagamentos, diálogo de novo pagamento, aprovar/cancelar/simular liquidação.
- `events-tab.tsx` — histórico de eventos.
- `banking-health-card.tsx` — movido do fim da rota.

A rota fica como container: `PageHeader`, `Tabs` e as queries de nível de página, passando dados/callbacks por props. Cada aba possui suas próprias queries e mutations quando pertencem só a ela, invalidando as mesmas query keys de hoje. As abas de cobranças/pagamentos/histórico entram via `lazy` + `Suspense` com skeleton, para só carregar quando o usuário abre a aba.

## Teams — nova estrutura

`src/components/teams/`

- `invite-user-dialog.tsx` — formulário de convite (papel + conjunto de permissões obrigatório) e exibição do link gerado.
- `teams-metrics.tsx` — cards de métricas do topo.
- `pending-invites-table.tsx` — tabela de convites pendentes com reenviar/revogar.
- `members-table.tsx` — busca, filtro por papel e tabela de membros com ações.
- `edit-member-dialog.tsx` — edição de nome, telefone e papel.
- `member-roles-dialog.tsx` — cargo primário, cargos extras e conjuntos de permissões extras.
- `remove-member-dialog.tsx` — remoção com reatribuição de registros (`assigned_to`) e contagens.

A rota mantém a orquestração: estado de seleção corrente, `refetch` das listas e as verificações `<Can>` existentes, exatamente como hoje. O card `UnlinkedAccountsCard` já é externo e permanece.

## Regras da refatoração

- Nenhuma query, mutation, `<Can>`, toast ou label alterada; apenas movida.
- Sem novos componentes de UI: seguem `@/components/ui/*` e o design system atual.
- Sem Supabase/server functions dentro de componentes puramente apresentacionais — quem hoje chama server fn continua chamando no componente que detém a ação.
- Estados de loading/empty/error preservados idênticos.

## Validação

- `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build` (comparar tempo com a baseline ~69s).
- Smoke manual: Finance → Banking (conectar mock, sincronizar, criar cobrança, criar pagamento, aprovar, ver histórico) e Configurações → Times (convidar, reenviar, revogar, editar membro, papéis, remover com reatribuição).

## Fora de escopo

- Redesenho visual, remoção de funcionalidade, mudança de permissões/RLS/schema.
