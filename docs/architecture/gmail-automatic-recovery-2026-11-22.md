# GMAIL-RECUPERA — recuperação automática de aceite Gmail humano

Porte G; previsão inicial 2–3 horas. Backend implementado e testado; migrations 0449–0451 aplicadas **somente neste draft**. Não publicado, aceito ou ativado. Lock `inbox_runtime_release_guard = O`; zero workflows Inbox habilitados/publicados.

## 1. Resultado e escopo confirmado

- O `syncAccount` canônico drena aceites privados antes de renovar token ou consultar History API. A composição pode terminar e descartar a tentativa: a recuperação não depende de novo `sendGmailWithInboxReceipt`.
- Fila privada `techerp_api.inbox_gmail_recovery`: trigger transacional no aceite, backfill de **todos** os aceites existentes (sem janela de data ou amostra dos últimos 100), índice de vencimento e lookup indexado do provider real.
- Claims de até 25 por conta/workspace, `SKIP LOCKED`, token, lease de 5 minutos e ordenação por vencimento/data original/ID. Falhas voltam a pending com backoff 30 s até 1 h; não ocupam permanentemente o início da fila. Leases abandonados são retomados e auditados como expired.
- Projeção e conclusão atômicas em RPC service-only: revalida job, conta conectada, proprietário/membro ativo, workspace, ator original e view+create da conversa. Mantém corpo, ID da mensagem, provider ID, instante original e linhagem privada; emissão continua na função canônica e é idempotente.
- O sync ignora IDs de envios humanos já aceitos: History API não cria um espelho concorrente em lugar da mensagem canônica. Reserva incerta, espelho, sequência sem payload humano e service_job não entram nesta fila.
- Auditoria privada por tentativa: início/fim, resultado, expiração e **apenas SQLSTATE**, nunca texto de erro/payload. Diagnóstico service-only só retorna estado/auditoria, após autorização atual da conta.
- Nenhuma chamada ao provedor send na recuperação. `confirmed_at` de novos aceites continua usando o default `clock_timestamp()`; recibos filhos copiam a data privada original.

## 2. Arquivos criados

- `src/lib/gmail-recovery.server.ts`
- `src/lib/gmail-recovery.test.ts`
- `src/lib/gmail-recovery-postgres.test.ts`
- `drizzle/migrations/0449_inbox_gmail_automatic_acceptance_recovery.sql`
- `drizzle/migrations/0450_inbox_gmail_recovery_lookup_audit.sql`
- `drizzle/migrations/0451_inbox_gmail_recovery_message_defaults.sql`
- Snapshots correspondentes em `drizzle/migrations/meta/` (gerenciados pela ferramenta).
- Este relatório.

## 3. Arquivos alterados e removidos

Alterados: `src/lib/gmail-sync.server.ts`, `src/lib/inbox/AGENTS.md`, `roadmap.md`, journal gerenciado e tipos Supabase regenerados pela ferramenta. **Nenhum arquivo removido.** Root AGENTS não foi alterado: limite de tamanho impediu a nota, registrada no AGENTS da Inbox.

UI, Ajuda, harness existente, contratos locais, baseline, campanhas, exportações, SDR/sequências, compositores e rotas não foram editados. A ampliação service-only é exclusivamente a fronteira privada de recuperação solicitada; não há grants ou políticas novas de usuário.

## 4. Revisão, problemas e correções

- Primeira execução real detectou `23502`: `jsonb_populate_record` produzia NULL para listas ausentes, em vez dos defaults canônicos vazios. 0451 corrige somente as listas da projeção; preserva assinaturas/OIDs/ACLs e não modifica recibos ou mensagens existentes.
- A primeira tentativa dessa correção via SQL dinâmico foi recusada pela ferramenta e **não aplicada**. A versão estática foi aplicada em 0451.
- TypeScript exigiu guards para resultados nullable; corrigidos, diagnóstico automático posterior `build OK`.
- Divergência de formatação detectada e corrigida por ESLint `--fix`; lint final: **0 erros, 2 avisos de tamanho** (sync existente e teste de regressão).
- Diff revisado: sem mudanças de permissões de chat, sem remoção de funcionalidades, sem credenciais/logs de payload, `git diff --check` sem erros.

## 5. Validações executadas e testes

Comando final dirigido:

```sh
INBOX_BACKEND_REGRESSIONS=1 GMAIL_RECOVERY_REGRESSIONS=1 bunx vitest run \
  src/lib/gmail-recovery.test.ts src/lib/gmail-recovery-postgres.test.ts \
  src/lib/inbox-backend-regression.test.ts src/lib/gmail-reply.test.ts \
  src/lib/inbox-transport.test.ts src/lib/inbox/chat-send.test.ts \
  src/lib/gmail-sync-queue.test.ts src/lib/gmail-mime.test.ts \
  src/lib/unipile/client-delivery.test.ts src/lib/prospecting/sdr/service-worker.test.ts \
  src/lib/prospecting/sequences/delivery.test.ts \
  src/lib/prospecting/sequences/transport-timeout.test.ts
```

**138 testes aprovados em 12 arquivos**: 28 cenários reais do draft (11 novos de recuperação + 17 GoTrue/RLS existentes), 110 unitários. Transporte Gmail falso interno; PostgreSQL/PostgREST e `syncAccount` reais. Não houve envio externo ao Google.

Novas provas:

1. Aceite → falha da leitura de projeção → composição descartada → novo `syncAccount` → mesma mensagem e **1 first_response**, segundo ciclo mantém 1 evento e **zero segundo POST**.
2. Falha pendente, SQLSTATE e backoff; uma aceitação saudável posterior conclui sem starvation.
3. Conta desconectada, revogada/deny, membro inativo e tenant errado: claim/projeção negados, zero mensagem projetada.
4. Reserva incerta não entra na fila e não reenvia.
5. Falha após escrita de thread/filho/mensagem: rollback atômico dessas projeções, aceite permanece e tentativa auditada.
6. Espelho de histórico sem aceite não entra na fila nem vira primeira resposta; default confirmado `clock_timestamp()`.
7. Aceitação mais antiga seguida por **101** novas: a antiga não desaparece, claims concorrentes disjuntos ≤25, cauda concluída, token antigo não reprojeta.
8. ACLs de anon/authenticated negam RPCs e leitura das filas/recibos privados; lock O e zero workflows habilitados/publicados.

Outras validações:

- `bunx eslint` nos quatro arquivos TS do lote: 0 erros / 2 avisos.
- Formatação dirigida e `git diff --check`: sem erros finais.
- Diagnóstico automático da aplicação: `build OK`; não foi executado build/typecheck manual.
- `bun run permissions:check`: **falhou** por contratos atuais ausentes/desatualizados, inclusive arquivos anteriores ao lote. Contratos/baseline permanecem intocados conforme divisão com Codex; não significa autorização certificada.
- `bun run perf:check`: **não concluiu**, falta artefato de build (`ENOENT`). Não é verde.
- Playwright não executado: fluxo exclusivamente de serviço/SQL, sem alteração de UI; o teste dirige diretamente o ciclo canônico real, sem compositor artificial.

## 6. Banco, permissões, segurança e privacidade

0449–0451 registradas e aplicadas só no draft; tipos/rotinas/índices/ACLs instalados conferidos. Nenhum SQL em produção e nenhuma alteração de registro comercial anterior. Filas privadas usam RLS/default-deny e **nenhum grant direto**, inclusive para service_role; somente funções SECURITY DEFINER próprias têm acesso. RPCs públicos têm EXECUTE exclusivo de service_role. Membership/conta são travados e revalidados dentro da projeção, com gates atuais de job e conversa. Falha deixa pending e não fornece payload ao usuário.

Regressões usam exclusivamente workspaces/contas sintéticas já existentes no draft descartável, com recusa fora da identidade local. Não adicionam exemplo de QA ao seed oficial; nada desses dados vai para o app.

## 7. UX/UI, riscos e pendências

UX/UI e acessibilidade não aplicáveis: nenhuma tela/rota/compositor alterado. A UI não precisa repetir a tentativa confirmada para garantir recuperação.

**Pendências externas à implementação deste lote:** contratos/gate de permissões com Codex; gate perf sem artefato; certificação completa anterior dos 13 eventos/worker e retomadas continua no ambiente CI local do Codex. Não foi reexecutada aqui nem alegada verde. A correção `child.occurred_at` já instalada em 0448 foi auditada no código real (copia a data privada da raiz e revalida chain/cutoff); não foi reescrita/reaplicada e a prova positiva root→child/worker não foi executada neste lote.

Limites deliberados: conta desconectada/revogada permanece pendente até voltar a ser autorizada; falhas repetidas usam backoff. Se o provedor aceitou mas **o próprio aceite privado não foi persistido**, sobra apenas reserva incerta — ela não é promovida nem reenviada por esta recuperação. Não foi ampliado o escopo para campanhas/exportações ou outras mensagens externas.

## 8. Como validar e próximo passo

No draft descartável, executar os testes acima. O teste fechado é o cenário real de recuperação sem retry de composição e não requer envio externo, ativar workflow ou remover lock. O diagnóstico service-only `inbox_gmail_recovery_status` retorna tentativas/SQLSTATE para uma conta atualmente autorizada, sem payload.

Próximo passo recomendado: Codex revisar 0449–0451 e integrar os contratos/gates e a certificação local anterior. **Não publicar, aceitar, ativar nem remover lock.**
