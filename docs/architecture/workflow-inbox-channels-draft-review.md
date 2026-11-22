# CANAIS-ATENDIMENTO — entrega parcial, não liberar

## Estado e escopo

Pacote 2 de gatilhos da Inbox. Porte G; previsão inicial 6–8 horas. O pedido integral **não foi concluído**. Este checkpoint não está pronto para aceite, merge nem publicação.

## Preparado/aplicado

- Catálogo explícito separado por Gmail/chat/LinkedIn, campos mínimos, matching por conta/canal e origem somente leitura. A chave WhatsApp permanece independente.
- Infraestrutura SQL de evidências/ocorrências, recibos, ativação e validação de execução foi aplicada **somente ao banco isolado deste draft**, pela ferramenta nativa: 0406–0409.
- A ferramenta regenerou automaticamente `src/integrations/supabase/types.ts`; não houve geração manual nem baseline regenerado.
- 0409 proíbe habilitar/publicar workflows dessa origem. A origem nova está removida da escolha geral de entidades e seus eventos não são oferecidos no seletor enquanto o bloqueio de release estiver fechado.
- Componentes e funções de seleção de contas estão preparados, mas sem contratos completos/testes de autorização; não certificá-los como entrega funcional.
- Nenhuma mensagem externa, regra real, credencial ou canal WK foi ativado. Nenhum aceite do draft/publicação/SQL em produção.

## Revisão: lacunas materiais

1. Gmail: distinguir bootstrap/history expirado/incremental; persistir retry durável antes de avançar o cursor; não transformar histórico em inbound.
2. Widget: idempotência transacional de retries, evidência visitor/session-bound, status/atribuição reais e primeira resposta confirmada.
3. Unipile: prova HMAC/provider timestamp privada e durável; excluir self/history/hydration; conectar o produtor ao recibo.
4. Completar `notification_business_proof_current`, `sales_event_reference_access`, destinatário atual nas três vias, href e reutilização de avisos legados. Os wrappers novos não bastam para a cadeia completa.
5. SQL necessita revisão real: ACLs/ownership/contexto do sujeito, checks de conta/conversa/prova, cutoff/desativação e profundidade das ações. Não retirar o release lock sem essa revisão.
6. NOTIFICA-CENTRAL e catálogo oficial/Ajuda não atualizados. Contratos por hash e cinco cenários por fronteira ainda não implementados.
7. Testes PostgreSQL/JWT de RLS, concorrência, desligamento, assinatura das provas, primeira resposta, readonly e regressão WhatsApp ainda não executados.

## Validações efetivamente executadas

- `bun run permissions:check`: **falhou (1)**, contratos/hashs desatualizados e fontes novas sem contrato. Nenhum contrato fictício foi criado para passar o gate.
- `bunx vitest run src/lib/workflows/inbox-channel-events.test.ts src/lib/workflows/notification-events.test.ts`: **107 passaram, 15 falharam**, 122 testes; suíte nova passou, suíte de regressão falhou por catálogo não alinhado e fixtures sem metadados dos canais novos. Asserções não foram relaxadas.
- Compilação automática da prévia: últimas entradas `build OK`, 23:43:42 e 23:43:56 UTC. O erro TS7053 no teste foi corrigido com mapa indexável. Não equivale a CI integral.
- Consulta local `psql` de verificação: **falhou por permission denied for schema techerp_api**. O sucesso da aplicação foi informado pela ferramenta de migração, mas esta consulta não valida a guard por execução.
- `verify` integral, build manual, performance, Help coverage e Playwright: **não executados**. Tipos/build manuais não rodados; a plataforma compila automaticamente.

## Arquivos

Infraestrutura: `drizzle/migrations/0406_workflow_inbox_channel_foundation.sql`, `0407_workflow_inbox_occurrence_producers.sql`, `0408_workflow_inbox_proof_execution.sql`, `0409_workflow_inbox_release_lock.sql` e metadados nativos.
Lógica: `src/lib/workflows/inbox-channel-events.ts`, `inbox-channels.server.ts`, `inbox-channels.functions.ts`, `notification-events.ts`, `schemas.ts`, `types.ts`, `associations.ts`, `engine/authorization.server.ts`.
UI preparada: `src/components/workflows/builder/inbox-channel-filters.tsx`, `trigger-config-panel.tsx`, `use-entity-field-options.ts`.
Testes: `src/lib/workflows/inbox-channel-events.test.ts`, `notification-events.test.ts`.
Outros: types gerados automaticamente, `roadmap.md`, este relatório. Nenhum arquivo removido.

## Revisão manual e próximo passo

Codex deve inspecionar o diff e 0406–0409 antes de qualquer aceite. Continuar produtores/provas/destinatários/contratos/Ajuda, executar testes reais e gates completos. O release lock é deliberado: não removê-lo para simular conclusão. O draft não deve ser aceito neste estado; aceitar transfere suas mudanças de estrutura para o app, mas os dados do draft não são transferidos.
