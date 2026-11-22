# GMAIL-FILA — complemento CANAIS-ATENDIMENTO

## Resultado e escopo

Implementado o complemento do Gmail: todos os IDs paginados são persistidos antes de avançar `history_id`. O limite de 25 passou a valer para a **reserva da fila**, não para a descoberta. O pacote 2 inteiro continua incompleto e bloqueado para ativação, conforme o checkpoint anterior.

Porte M; estimativa inicial 60–90 minutos. Código no branch isolado `thr_szy0c51n71kd`. Não houve aceite do draft ou publicação.

## Funcionamento auditado

- Paginação percorre todas as páginas; erro intermediário ou token repetido impede retornar um checkpoint completo. Eliminados os cortes silenciosos de 25 mensagens e 10 páginas.
- `gmail_sync_enqueue` insere todos os IDs e avança o cursor na mesma transação, sob lock da conta e comparação do cursor esperado. Conflito concorrente falha com `40001`, sem sobrescrever o cursor de outro worker.
- Reserva de até 25 itens com `FOR UPDATE SKIP LOCKED`, token e lease de cinco minutos. Nenhum timeout/budget da aplicação foi aumentado.
- Falha de busca/gravação/ack mantém a mensagem pendente. Falha na liberação do lease é recuperável após expiração. Erro de insert deixou de retornar falso como se fosse descarte válido.
- Cópia já persistida é relida e não reinserida. A conclusão de insert/existing exige a mensagem canônica da mesma conta/workspace.
- `seed`, `expired_history`, origem incremental, limite original de histórico, descoberta e indicador `preexisting` são imutáveis. Reenfileirar o mesmo ID não altera esses campos, mesmo quando encontrado por um retry incremental.
- A recuperação captura `/profile` **antes** de buscar a carga inicial, evitando mover a fronteira para depois de mensagens recebidas durante a busca. Bootstrap/recovery continuam conservadores: não constituem autorização para gerar evento novo.
- O sincronizador lê o cursor real do banco, não o valor de uma cópia manual que tenha sido zerada por diagnóstico antigo.

## Arquivos criados

- `src/lib/gmail-sync-queue.ts`: orquestração sem tokens, coleta paginada, classificação e drain.
- `src/lib/gmail-sync-queue.test.ts`: 13 testes unitários, incluindo o controle real delegado de autorização de jobs.
- `scripts/isolated-db/gmail-queue-local.ts`: teste real das RPCs por PostgREST local, sem chamar o Google.
- `drizzle/migrations/0410_gmail_durable_sync_queue.sql` e snapshot nativo `meta/0410_snapshot.json`.
- Este relatório.

## Arquivos alterados

- `src/lib/gmail-sync.server.ts`.
- `docs/security/permission-contracts.json`: contratos legítimos e hashes atuais do Gmail; hash dos tipos nativos atualizado. Baseline intocado.
- `src/integrations/supabase/types.ts`: regenerado **automaticamente pela ferramenta nativa** após 0410; não houve reconstrução manual dos tipos herdados revisados pelo Codex.
- Journal nativo das migrações: uma nova entrada, sem reaplicar históricas.
- `docs/help/crm/conectar-sincronizar-gmail.md`, catálogo oficial em `src/lib/help/official-catalogue.json`, `db/seed.sql` e `roadmap.md`.
- Nenhum arquivo removido; nenhuma UI, rota ou configuração de canal alterada.

## SQL, ACL, permissões e privacidade

0410 foi aplicada apenas ao banco descartável deste draft. Fila privada sem corpo/anexos/telefone/cookies/credenciais; RLS habilitada, SELECT apenas de serviço, sem acesso authenticated/anon. RPCs de enqueue/claim/finish/retry são service-only e revalidam workspace, provedor, estado da conta, modo readonly e `sales_account_job_authorize` com permissões atuais do proprietário. Nenhuma chave nova ou grant global.

Os exemplos de teste têm IDs reservados, e-mails `example.invalid`, nenhum login ou token Gmail. O e-mail do dono não foi inserido. Memberships/cargo de deny e quatro definições canônicas do catálogo existem apenas nos exemplos do draft; não foram concedidos acessos a cargos ou canais da WK. Os exemplos foram escritos em `db/seed.sql` e aplicados em transação única.

## Validações executadas

- `bun run permissions:check`: executado antes dos testes. Global **falhou**, com 22 findings anteriores no pacote multicanal; **zero findings nos arquivos deste complemento Gmail/tipos novos** no fechamento. Não equivale a gate global aprovado.
- `bunx vitest run src/lib/gmail-sync-queue.test.ts`: **13/13 passaram**.
- `bun scripts/isolated-db/gmail-queue-local.ts`: **29/29 verificações reais passaram**, repetidas após os ajustes. Incluem 55 IDs, replay, CAS stale, rollback de enqueue inválido, workers concorrentes, falha intermediária/retry, UUID de lease alterado, prova de mensagem ausente, seed/recovery imutáveis, mensagem preexistente e os quatro RPCs negando sem chave/deny/workspace estrangeiro/inativo. Conta desconectada e ACL privada também verificadas.
- Testes reais usam a credencial de serviço e o PostgREST deste draft, com autorização canônica do proprietário sintético. Não são testes de login/JWT de usuários humanos nem requisições ao Gmail real.
- `bun run verify:changed`: escolheu modo full; typecheck nativo passou em 50,3 s, mas o comando terminou por SIGTERM durante lint ao atingir o limite externo da execução. **Loop incompleto**, sem relaxar budgets/timeouts.
- ESLint direcionado: **zero erros, um aviso** `quality/max-lines` no sincronizador.
- `bun run help:coverage`: **256/256 telas cobertas**, 442 artigos.
- `git diff --check`: sem problemas no fechamento.
- Compilação automática: últimas entradas **build OK**. Não foi executado build manual, performance ou CI integral; a plataforma compila automaticamente.

## Problemas encontrados e corrigidos

Cortes silenciosos da paginação, avanço sobre mensagens não tratadas, erros de insert tratados como descarte, risco de perder a fronteira durante bootstrap e reclassificação por cursor manual foram corrigidos. Nas fixtures, faltavam catálogo/autor obrigatório e o papel shell não podia atualizar contas: os testes passaram a usar a API local de serviço sem ampliar grants.

## Limites e pendências

1. O pacote CANAIS-ATENDIMENTO ainda precisa dos produtores/eventos comprovados, destinatários, dedupe de avisos legados e contratos/testes restantes. O release lock de 0409 foi preservado.
2. A fila guarda a proveniência necessária, mas este complemento **não** conectou ocorrências de Gmail à execução de workflows; não afirmar eventos novos ativos.
3. Ajuda v3 está preparada no Markdown e catálogo oficial. O upsert editorial no banco foi recusado por ACL de `help_articles`; ele foi retirado, sem ampliar permissões. A versão já existente no banco não foi sobrescrita. Publicação editorial continua pelo mecanismo autorizado do produto.
4. Sem teste de OAuth/Gmail real, navegador ou mensagens externas; nenhuma regra real ativada. CI/global verify/performance continuam pendentes e não foram declarados verdes.

## Revisão manual e próximo passo

Codex deve revisar o diff de 0410 e do sincronizador, conferir os 13 testes e executar novamente `bun scripts/isolated-db/gmail-queue-local.ts` com o backend local do draft. Continuar as lacunas do pacote anterior e a publicação editorial autorizada, depois CI integral. Não aceitar/publicar este draft enquanto o pacote completo estiver bloqueado.
