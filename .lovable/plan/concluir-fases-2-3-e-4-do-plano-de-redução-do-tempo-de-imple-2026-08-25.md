# Concluir Fases 2, 3 e 4 do plano de redução do tempo de implementação

## Estado verificado agora

- `workflow-builder.tsx`: 1.910 linhas (ainda monolítico).
- `hubspot-steps.server.ts`: 1.492 linhas (já reduzido de 2.547, mas ainda grande).
- 105 rotas importam `*.functions.ts` estaticamente no topo.
- `recharts` estático apenas em `chart-kit.tsx` e `ui/chart.tsx`; `@tiptap` apenas em `word-editor.tsx` (ambos já são pontos centralizados — nada a fazer aqui).
- Banco: 312 tabelas em `public`; RLS habilitada em todas; 45 sem `workspace_id`; 1 sem nenhuma policy (`payment_webhook_events`); 5 sem GRANT de leitura para usuários autenticados (`outbound_webhooks`, `calendar_accounts`, `payment_webhook_events`, `profiles`, `email_accounts`).
- 134 arquivos ainda chamam `.delete()` direto; apenas 9 usam `deleteRowGuarded` e 6 usam `handle-permission-error`.

Observação: várias tabelas com policies "incompletas" são logs append-only (`audit_logs`, `cron_run_logs`, `ip_access_log`, etc.). Não serão alteradas — a restrição é intencional.

## Fase 2 — concluir a redução do grafo de módulos

1. Quebrar `src/components/workflows/workflow-builder.tsx` em `src/components/workflows/builder/`:
   - `steps-panel.tsx` (lista + drag-and-drop dos passos),
   - `step-config-panel.tsx` (configuração do passo selecionado + campos extra),
   - `conditions-panel.tsx` (grupos AND/OR),
   - `trigger-panel.tsx` (gatilho e agendamento),
   - o arquivo original permanece como container de estado/orquestração.
   Sem mudança de comportamento: mesmos props, mesmas mutations, mesmo autosave.
2. Reduzir `hubspot-steps.server.ts` extraindo os grupos de passos restantes (associações e enriquecimento) para módulos próprios, deixando o arquivo como dispatcher fino.
3. Quebrar as rotas mais pesadas restantes em componentes sob `src/components/<domínio>/`: `finance.banking.tsx` (1.380), `settings.teams.tsx` (1.237), `(ats)/jobs.index.tsx` (1.118), `tasks.tsx` (1.105).
4. Reduzir imports estáticos de server functions nas 20 rotas mais pesadas: funções usadas só em ação do usuário passam a ser chamadas via `useServerFn` no handler ou `await import()`; loaders continuam como estão.

## Fase 3 — estabilizar dados e permissões

1. Migration única de correção pontual (sem mudar regra de negócio):
   - `payment_webhook_events`: adicionar policy de serviço (somente `service_role`), mantendo-a inacessível ao cliente;
   - revisar os 5 casos sem GRANT: `profiles`, `calendar_accounts`, `email_accounts` e `outbound_webhooks` recebem GRANT coerente com as policies já existentes; `payment_webhook_events` permanece sem acesso de cliente.
2. Documentar em `docs/workspace-isolation-compliance.md` a lista das 45 tabelas sem `workspace_id`, classificando cada uma como global de plataforma, tabela-ponte ou pendência real. Só as pendências reais viram itens de correção — sem migration em lote cega.
3. Padronizar exclusões: aplicar `deleteRowGuarded` e `handle-permission-error` nos fluxos de exclusão restantes, começando pelos grids e telas de detalhe dos módulos principais (Sales, ATS, People, Contracts, Finance, Projects, Service).
4. Ampliar `tests/e2e/permission-visibility.spec.ts` com cenários por papel (admin, manager, member) cobrindo Leads, Contatos, Negócios, Contratos e People — leitura, edição e exclusão bloqueada.

## Fase 4 — processo de entrega

1. Criar `docs/templates/plan-bug.md`, `plan-feature.md` e `plan-refactor.md`.
2. Registrar em `docs/operations-runbook.md` a regra: plano de correção simples não expande para schema/RLS/permissões sem nova aprovação explícita.
3. Criar `docs/polimento-semanal.md` como fila única de ajustes pequenos de UI, em vez de um plano por ajuste.
4. Repriorizar `docs/backlog-pendencias.md`, marcando o que fica congelado até a Fase 3 terminar.

## Fora de escopo

- Remover funcionalidade, redesenhar telas, alterar regra de negócio.
- Migration em lote de `workspace_id` nas tabelas globais/ponte.

## Validação

- `bun run typecheck`, `bun run lint`, `bun run test` e `bun run build` após cada item da Fase 2, comparando com a baseline (~69s de build, ~22-31s de typecheck).
- Smoke manual: Workflows (criar/editar/reordenar passos), HubSpot sync, Banking, Times, Vagas, Tarefas.
- Fase 3: linter de banco + os novos cenários E2E por papel.
