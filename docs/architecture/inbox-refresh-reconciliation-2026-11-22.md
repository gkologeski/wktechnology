# RECONCILIA-INBOX — preservação após atualização

## Resultado e limites

Porte G, estimativa inicial 1–3 h. Escopo: reconciliar o draft com a revisão posterior recebida do app, sem novo lote funcional.

- Restaurado byte-exato pelo CLI: `src/lib/inbox-backend-regression.test.ts`.
- Alterado somente `roadmap.md` para registrar esta reconciliação; criado este relatório. Nenhum arquivo removido.
- A revisão recebida já contém o pacote Inbox e correções posteriores do Codex; não foram revertidos UI, Ajuda, contratos de permissão, fixtures ou tipos gerados.
- Não foi executado SQL de escrita, migração, aceite, publicação, ativação ou envio externo. Leitura local confirmou lock `O` e zero workflows Inbox ativos/publicados.
- Todas as entradas do journal do draft (até 0451) já constam byte-equivalentes como objetos no journal recebido (até 0458). SQL e snapshots recebidos preservados byte-exatos, sem duplicar ou renumerar migrações.
- A retirada da expansão create.team em 0442 foi mantida: a revisão posterior preserva own/workspace. A disponibilidade liberada no código e a migração 0452 são decisões já recebidas do app; não foram aplicadas ao banco deste draft nesta entrega.

## Validações desta entrega

- `lovable drafts plan`, `restore --all`, `verify`, com base antiga `37df8c84f90a`, referência preservada e base recebida `8f7111eed67d`, executados nesta ordem.
- Verificador inicial: 188 caminhos; 92 classificados `dropped` porque a versão recebida foi mantida. Isso não é certificação automática: as substituições deliberadas são enumeradas abaixo. Não se alteraram arquivos protegidos apenas para satisfazer a comparação binária.
- Verificador final: 188 caminhos, 91 versões recebidas deliberadamente mantidas (`dropped`); teste exclusivo restaurado confirmado byte-exato. Nenhum `certified` declarado.
- `bun run permissions:check`: falhou com `stale_contract` e `uncovered_source` em `src/integrations/supabase/types.ts`, recebido inalterado; baseline/contratos intocados.
- `bunx vitest run src/lib/inbox-backend-regression.test.ts src/lib/gmail-reply.test.ts src/lib/gmail-provider-time.test.ts src/lib/gmail-recovery.test.ts src/lib/gmail-sync-queue.test.ts src/lib/inbox/chat-send.test.ts src/lib/inbox-transport.test.ts src/lib/workflows/inbox-channel-events.test.ts src/lib/workflows/notification-events.test.ts`: 198 aprovados, 17 opt-in não executados.
- `git diff --check`: sem erros. Build/typecheck manual não executados; CI integral/worker/dispatch e testes opt-in não certificados por esta entrega. Playwright não executado: não houve mudança visual ou fluxo interativo novo.
- `bunx eslint src/lib/inbox-backend-regression.test.ts`: sem erros ou avisos. Sinal automático de compilação às 23:40:26 UTC: `build OK`.

## Revisão, segurança e próximos passos

Nenhuma regra de negócio, grant, RLS, segredo ou dado comercial alterado. Teste restaurado exige opt-in e alvo descartável antes de qualquer escrita. Os 17 casos não foram ativados nem contados como aprovados. A manutenção do lock foi conferida por leitura, não inferida do código recebido. Não há nova tela ou ação que demande artigo adicional.

Risco/pendência: gate global herdado continua vermelho; a CLI não distingue uma correção posterior recebida de um hunk perdido. A lista a seguir explicita cada decisão, sem alegar `certified`. Codex deve revisar os tipos/contrato no seu escopo e executar a CI da revisão exata; não iniciar liberação automaticamente.

## Inventário completo de decisões

| Arquivo | Decisão |
| --- | --- |
| `src/lib/inbox-backend-regression.test.ts` | Restaurado pelo CLI, byte-exato. |
| `db/seed.sql` | Manter conteúdo editorial posterior consolidado; não reintroduzir aviso de preparação obsoleto ou desfazer versões novas. |
| `docs/architecture/gmail-automatic-recovery-2026-11-22.md` | Conteúdo histórico preservado; manter formatação posterior. |
| `docs/architecture/gmail-durable-queue-review.md` | Conteúdo histórico preservado; manter formatação posterior. |
| `docs/architecture/inbox-acceptance-review-2026-11-22.md` | Conteúdo histórico preservado; manter formatação posterior. |
| `docs/architecture/inbox-additional-review.md` | Conteúdo histórico preservado; manter formatação posterior. |
| `docs/architecture/inbox-central-runtime-review.md` | Conteúdo histórico preservado; manter formatação posterior. |
| `docs/architecture/inbox-execution-runtime-review.md` | Já incorporado byte-exato; mantido. |
| `docs/architecture/inbox-functional-closing-2026-11-22.md` | Já incorporado byte-exato; mantido. |
| `docs/architecture/inbox-producers-2026-11-22.md` | Conteúdo histórico preservado; manter formatação posterior. |
| `docs/architecture/inbox-response-review-2026-11-22.md` | Já incorporado byte-exato; mantido. |
| `docs/architecture/workflow-inbox-channels-draft-review.md` | Conteúdo histórico preservado; manter formatação posterior. |
| `docs/architecture/workflow-inbox-producers-review.md` | Conteúdo histórico preservado; manter formatação posterior. |
| `docs/help/crm/conectar-sincronizar-gmail.md` | Manter conteúdo editorial posterior consolidado; não reintroduzir aviso de preparação obsoleto ou desfazer versões novas. |
| `docs/help/crm/criar-publicar-workflows.md` | Manter conteúdo editorial posterior consolidado; não reintroduzir aviso de preparação obsoleto ou desfazer versões novas. |
| `docs/security/permission-contracts.json` | Manter contratos/hashes posteriores do Codex; não restaurar contratos antigos. |
| `drizzle/migrations/0406_workflow_inbox_channel_foundation.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0407_workflow_inbox_occurrence_producers.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0408_workflow_inbox_proof_execution.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0409_workflow_inbox_release_lock.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0410_gmail_durable_sync_queue.sql` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/0411_inbox_visibility_oid_repair.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0412_inbox_catalog_and_receipt_journals.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0413_inbox_widget_atomic_producer.sql` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/0414_inbox_unipile_atomic_producer.sql` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/0415_inbox_recipient_guards.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0416_inbox_static_notification_snapshot.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0417_inbox_inapp_current_dispatch.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0418_inbox_external_current_dispatch.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0419_inbox_scheduled_current_recipients.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0420_inbox_unipile_history_effects.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0421_inbox_history_channel_safe_trigger.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0422_inbox_central_gmail_conversation.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0423_inbox_central_proof_worker.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0424_inbox_central_chain_reference.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0425_inbox_central_dispatch_seams.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0426_inbox_central_thread_rls_role.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0427_inbox_central_notification_context.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0428_inbox_central_recipient_subject_role.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0429_inbox_central_subject_restore.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0430_inbox_central_subject_auth_context.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0431_inbox_central_center_caller_rls.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0432_inbox_scheduled_proof_and_legacy_reuse.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0433_inbox_legacy_subject_bridge_name.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0434_inbox_message_parent_lock_order.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0435_inbox_workflow_guard_draft_and_channel.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0436_inbox_attested_human_transitions.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0437_inbox_confirmed_response_journal.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0438_inbox_transition_response_proof_current.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0439_inbox_gmail_created_and_current_transitions.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0440_inbox_canonical_transport_receipts.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0441_inbox_all_thirteen_current_proofs.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0442_inbox_chat_rls_and_first_response_eligibility.sql` | Supersessão explícita: retirar expansão indevida create.team, preservando own/workspace; não restaurar ALTER POLICY antigo. |
| `drizzle/migrations/0443_inbox_preserve_historical_response_barriers.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0444_inbox_preserve_service_chat_response_source.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0445_inbox_gmail_durable_acceptance_lineage.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0446_inbox_gmail_acceptance_provider_slot.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0447_inbox_resume_chain_identity.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0448_inbox_resume_original_time_restore_chat_0122.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0449_inbox_gmail_automatic_acceptance_recovery.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0450_inbox_gmail_recovery_lookup_audit.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/0451_inbox_gmail_recovery_message_defaults.sql` | Versão do app mantida byte-exata; draft já incorporado, diferenças de formatação. |
| `drizzle/migrations/meta/0406_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0407_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0408_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0409_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0410_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0411_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0412_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0413_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0414_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0415_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0416_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0417_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0418_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0419_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0420_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0421_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0422_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0423_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0424_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0425_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0426_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0427_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0428_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0429_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0430_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0431_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0432_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0433_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0434_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0435_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0436_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0437_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0438_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0439_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0440_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0441_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0442_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0443_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0444_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0445_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0446_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0447_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0448_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0449_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0450_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/0451_snapshot.json` | Já incorporado byte-exato; mantido. |
| `drizzle/migrations/meta/_journal.json` | Todos os registros do draft já incorporados; manter novas entradas 0452–0458, sem renumeração. |
| `roadmap.md` | Histórico inteiro preservado; seção desta entrega adicionada. |
| `scripts/isolated-db/AGENTS.md` | Já incorporado byte-exato; mantido. |
| `scripts/isolated-db/gmail-queue-local.ts` | Já incorporado byte-exato; mantido. |
| `scripts/isolated-db/inbox-central-local.ts` | Já incorporado byte-exato; mantido. |
| `scripts/isolated-db/inbox-gmail-transport-local.ts` | Já incorporado byte-exato; mantido. |
| `scripts/isolated-db/inbox-guard-local.ts` | Já incorporado byte-exato; mantido. |
| `scripts/isolated-db/inbox-producers-local.ts` | Já incorporado byte-exato; mantido. |
| `scripts/isolated-db/inbox-review-local.ts` | Já incorporado byte-exato; mantido. |
| `scripts/isolated-db/inbox-thirteen-local.ts` | Já incorporado byte-exato; mantido. |
| `scripts/isolated-db/inbox-unipile-transport-local.ts` | Já incorporado byte-exato; mantido. |
| `src/components/workflows/builder/inbox-channel-filters.tsx` | Implementação do draft preservada na revisão posterior; manter refinos/compatibilidade/formatação recebidos. |
| `src/components/workflows/builder/trigger-config-panel.tsx` | Implementação do draft preservada na revisão posterior; manter refinos/compatibilidade/formatação recebidos. |
| `src/components/workflows/builder/use-entity-field-options.ts` | Implementação do draft preservada na revisão posterior; manter refinos/compatibilidade/formatação recebidos. |
| `src/integrations/supabase/types.ts` | Manter tipos gerados posteriores e campos novos; não restaurar versão antiga. |
| `src/lib/email-send.functions.ts` | Manter gate adicional de conta connected sobre a implementação do draft. |
| `src/lib/gmail-provider-time.test.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/gmail-provider-time.ts` | Implementação do draft preservada na revisão posterior; manter refinos/compatibilidade/formatação recebidos. |
| `src/lib/gmail-recovery-postgres.test.ts` | Manter regressões/fixtures posteriores (CI portátil, datas privadas, catálogo e cenários corrigidos); não restaurar harness antigo. |
| `src/lib/gmail-recovery.server.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/gmail-recovery.test.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/gmail-reply.server.ts` | Manter gate adicional de conta connected sobre a implementação do draft. |
| `src/lib/gmail-reply.test.ts` | Manter regressões/fixtures posteriores (CI portátil, datas privadas, catálogo e cenários corrigidos); não restaurar harness antigo. |
| `src/lib/gmail-sync-queue.test.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/gmail-sync-queue.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/gmail-sync.server.ts` | Manter recuperação canônica posterior: status atual e acesso ao provedor antes de recuperar conta em erro. |
| `src/lib/help/official-catalogue.json` | Manter conteúdo editorial posterior consolidado; não reintroduzir aviso de preparação obsoleto ou desfazer versões novas. |
| `src/lib/inbox-dispatch-caller-postgres.test.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/inbox-execution-postgres.test.ts` | Manter regressões/fixtures posteriores (CI portátil, datas privadas, catálogo e cenários corrigidos); não restaurar harness antigo. |
| `src/lib/inbox-resume-postgres.test.ts` | Manter regressões/fixtures posteriores (CI portátil, datas privadas, catálogo e cenários corrigidos); não restaurar harness antigo. |
| `src/lib/inbox-transport.server.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/inbox-transport.test.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/inbox/AGENTS.md` | Já incorporado byte-exato; mantido. |
| `src/lib/inbox/chat-send.server.ts` | Implementação do draft preservada na revisão posterior; manter refinos/compatibilidade/formatação recebidos. |
| `src/lib/inbox/chat-send.test.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/live-chat.functions.ts` | Mesmas chaves own/workspace preservadas; comentário posterior mantido, sem reintroduzir create.team. |
| `src/lib/prospecting/sdr/service-transports.server.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/prospecting/sdr/service-worker.server.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/prospecting/sdr/service-worker.test.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/unipile/client-delivery.test.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/unipile/client.server.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/unipile/webhook-events.server.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/unipile/webhook-events.test.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/workflows.functions.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/workflows/AGENTS.md` | Já incorporado byte-exato; mantido. |
| `src/lib/workflows/associations.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/workflows/draft-payload.test.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/workflows/draft-payload.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/workflows/engine/authorization.server.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/workflows/inbox-channel-events.test.ts` | Manter regressões/fixtures posteriores (CI portátil, datas privadas, catálogo e cenários corrigidos); não restaurar harness antigo. |
| `src/lib/workflows/inbox-channel-events.ts` | Matriz fechada de 13 chaves e disponibilidade posterior já recebidas; nenhuma ativação executada neste draft. |
| `src/lib/workflows/inbox-channel-filters.test.ts` | Manter regressões/fixtures posteriores (CI portátil, datas privadas, catálogo e cenários corrigidos); não restaurar harness antigo. |
| `src/lib/workflows/inbox-channels.functions.ts` | Implementação do draft preservada na revisão posterior; manter refinos/compatibilidade/formatação recebidos. |
| `src/lib/workflows/inbox-channels.server.ts` | Implementação do draft preservada na revisão posterior; manter refinos/compatibilidade/formatação recebidos. |
| `src/lib/workflows/inbox-fixtures.test.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/workflows/notification-events.test.ts` | Manter regressões/fixtures posteriores (CI portátil, datas privadas, catálogo e cenários corrigidos); não restaurar harness antigo. |
| `src/lib/workflows/notification-events.ts` | Implementação do draft preservada na revisão posterior; manter refinos/compatibilidade/formatação recebidos. |
| `src/lib/workflows/schemas.ts` | Já incorporado byte-exato; mantido. |
| `src/lib/workflows/types.ts` | Implementação do draft preservada na revisão posterior; manter refinos/compatibilidade/formatação recebidos. |
| `src/lib/workflows/widget-producer.test.ts` | Manter regressões/fixtures posteriores (CI portátil, datas privadas, catálogo e cenários corrigidos); não restaurar harness antigo. |
| `src/routes/api/public/unipile/webhook.ts` | Já incorporado byte-exato; mantido. |
| `src/routes/api/public/widget/messages.ts` | Manter compatibilidade de widgets legados, confirmação UUID e erro neutro adicionados posteriormente. |
| `src/routes/widget.$workspaceId.tsx` | Já incorporado byte-exato; mantido. |
| `tests/fixtures/inbox/README.md` | Manter regressões/fixtures posteriores (CI portátil, datas privadas, catálogo e cenários corrigidos); não restaurar harness antigo. |
| `tests/fixtures/inbox/central.sql` | Manter regressões/fixtures posteriores (CI portátil, datas privadas, catálogo e cenários corrigidos); não restaurar harness antigo. |
| `tests/fixtures/inbox/chat-response-checks.ts` | Já incorporado byte-exato; mantido. |
| `tests/fixtures/inbox/chat-response.sql` | Manter regressões/fixtures posteriores (CI portátil, datas privadas, catálogo e cenários corrigidos); não restaurar harness antigo. |
| `tests/fixtures/inbox/data.sql` | Já incorporado byte-exato; mantido. |
| `tests/fixtures/inbox/dispatch-caller.ts` | Já incorporado byte-exato; mantido. |
| `tests/fixtures/inbox/gmail-response.sql` | Manter regressões/fixtures posteriores (CI portátil, datas privadas, catálogo e cenários corrigidos); não restaurar harness antigo. |
| `tests/fixtures/inbox/gmail-transport-checks.ts` | Manter regressões/fixtures posteriores (CI portátil, datas privadas, catálogo e cenários corrigidos); não restaurar harness antigo. |
| `tests/fixtures/inbox/guard-checks.ts` | Já incorporado byte-exato; mantido. |
| `tests/fixtures/inbox/guard.sql` | Manter regressões/fixtures posteriores (CI portátil, datas privadas, catálogo e cenários corrigidos); não restaurar harness antigo. |
| `tests/fixtures/inbox/load.ts` | Já incorporado byte-exato; mantido. |
| `tests/fixtures/inbox/runtime.ts` | Manter regressões/fixtures posteriores (CI portátil, datas privadas, catálogo e cenários corrigidos); não restaurar harness antigo. |
| `tests/fixtures/inbox/thirteen-producers.sql` | Manter regressões/fixtures posteriores (CI portátil, datas privadas, catálogo e cenários corrigidos); não restaurar harness antigo. |
| `tests/fixtures/inbox/thirteen-proof-checks.ts` | Já incorporado byte-exato; mantido. |
| `tests/fixtures/inbox/thirteen-read-checks.ts` | Já incorporado byte-exato; mantido. |
| `tests/fixtures/inbox/unipile-response.sql` | Manter regressões/fixtures posteriores (CI portátil, datas privadas, catálogo e cenários corrigidos); não restaurar harness antigo. |
| `tests/fixtures/inbox/unipile.sql` | Manter regressões/fixtures posteriores (CI portátil, datas privadas, catálogo e cenários corrigidos); não restaurar harness antigo. |
