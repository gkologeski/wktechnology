# INBOX-EXECUCAO — execução e produtores do pacote 2

## Estado real

**Parcial, não certificado.** Porte G, previsão inicial 6–10 horas; a previsão de
aceite fica suspensa pela ausência de Docker neste ambiente. Não há tarefa
continuando em segundo plano após esta entrega. UI/Ajuda não foram alteradas.
O lock do draft permanece habilitado e nenhum workflow multicanal foi ativado.
Não houve aceite, publicação, SQL em produção ou transporte externo.

O usuário autorizou em 22/11/2026 uma **cópia exclusivamente descartável da CI**
com fixtures publicadas e sem o lock nessa cópia. Isso não autoriza remover o
lock do draft. A preparação fica vinculada à identidade da conexão criada pelo
fixture Docker existente, ao nome do banco descartável e à API local desse
fixture; não aceita conexão configurada por PG\*, Supabase ou URL do draft.

### Revisão adicional — 22/11, lock e envio confirmado

Preparado em `tests/fixtures/inbox/runtime.ts`: a retirada do **único** gatilho
de disponibilidade compara antes/depois o catálogo real de funções (corpo,
owner, ACL, SECURITY DEFINER, configuração), RLS/ACL das relações, todas as
políticas, demais gatilhos, papéis e memberships. Qualquer diferença falha o
preparo. A identidade da conexão descartável continua obrigatória.

Preparado em `src/lib/inbox-execution-postgres.test.ts`: restaura a definição
canônica exata do lock apenas na cópia CI, tenta ativar como usuário autorizado,
exige `42501` **e a mensagem específica do lock**, confere que o workflow ficou
inalterado e depois exige produtor/dispatch positivo com só disponibilidade
retirada. A comparação de controles também roda após esse teste. Não basta
uma recusa genérica por falta de autorização.

**Execução desta revisão:** ESLint dirigido passou sem avisos; Prettier aplicado.
A consulta de catálogo foi analisada por PostgreSQL com `EXPLAIN`, sem mudar
dados. O lock real do draft foi consultado e continua `O`. A tentativa
`bunx vitest run src/lib/inbox-execution-postgres.test.ts` saiu **1** por
`spawnSync docker ENOENT`: os **12 casos não executaram**. Isso não comprova a
recusa/ativação nem a invariância no ambiente CI. `permissions:check` continua
falhando; nenhum contrato foi fechado, baseline/gates/orçamento intactos.

**Primeira resposta continua pendente**, não foi implementada nesta revisão.
Contrato de aceite para os três produtores canônicos (Gmail/chat/Unipile):

- Exigir recibo privado persistido pelo envio canônico confirmado, vinculado
  à conta/conversa/mensagem corretas; `direction`/`status` editáveis pelo cliente
  jamais são prova de confirmação.
- Pendente, erro, resultado incerto, self e backfill não produzem ocorrência.
- Retry depois da confirmação reconcilia exatamente uma ocorrência; retry não
  pode reenviar cegamente um transporte cujo resultado ficou incerto.
- Testar positivo e cada negativa por provedor, além da reconciliação; não
  certificar só testes negativos de uma funcionalidade ainda ausente.

Nenhuma migration nova, conta QA, alteração de UI/Ajuda, autorização de negócio,
consentimento, limite ou integração externa nesta revisão. Arquivos alterados:
os dois arquivos TS acima, este relatório e `roadmap.md`; removidos: nenhum.
Próximo passo continua sendo executar/corrigir a cópia CI e concluir as cadeias;
não há trabalho em segundo plano nem liberação do draft.

## Implementado e aplicado somente no draft

- `0432_inbox_scheduled_proof_and_legacy_reuse.sql`: o resolvedor privado do
  agendamento confere evento, run, workspace, origem, executor e cadeia atual de
  prova para Inbox antes de retornar destinatários. Demais fontes mantêm o
  algoritmo anterior. **O caso positivo ainda não foi executado.**
- O produtor legado de e-mail/chat adquire a mesma trava transacional por
  conversa/destinatário utilizada pelo reuso de Workflow; verifica membership
  ativo e RLS da conversa, sem acesso às configurações da conta. Procura também
  avisos de Workflow não lidos da mesma conversa, conta e contexto.
- Os links legados de e-mail/chat incluem `?conversation=<uuid>`.
- `0433_inbox_legacy_subject_bridge_name.sql` corrigiu uma chamada inicialmente
  escrita com nome inexistente. O fluxo real falhou no INSERT da mensagem; após
  a correção foi reexecutado com sucesso. A migration anterior não foi editada.
- `0432` compara transacionalmente OID, owner, ACL e dependências de entrada/saída
  das duas funções alteradas antes/depois. A comparação passou durante a aplicação.
  Isso **não** certifica equivalência funcional de todas as fontes antigas.

- `0434_inbox_message_parent_lock_order.sql`: a repetição dos testes revelou
  `40P01`: FK KEY SHARE da conversa → trava de aviso → FOR UPDATE do efeito
  posterior `service_agent_enqueue`. A conversa exata (workspace/conta) passa a
  ser travada antes do INSERT, FKs e efeitos posteriores. Não foram desligados
  gatilhos nem acrescentados retries para esconder a falha. Após a correção, os
  22 checks passaram em **três execuções consecutivas**.

## Provas executadas

`bun scripts/isolated-db/inbox-central-local.ts --disposable-draft`: **22 checks**.

- 11 verificações existentes de Gmail incremental/existing-on-retry,
  conversa/central, cinco perfis, desconexão, reatribuição e lock.
- 15 chamadas aos três dispatches reais, com cinco sessões reais GoTrue:
  todas recusadas pelo ACL do motor e nenhum efeito novo. O contrato exige
  `42501`/`permission denied for function`; erro de workflow inexistente não
  pode passar como prova de isolamento do chamador.
- Cinco perfis no produtor legado real de mensagem: autorizado gera um aviso;
  sem chave, deny, outro workspace e inativo geram zero. Seis mensagens
  concorrentes para o autorizado geram exatamente um aviso e um contexto.
- Conversa sem responsável gera zero aviso; não há fallback para criador/CEO
  nesse caminho de e-mail exercitado.

**Importante:** a matriz de chamadas acima comprova isolamento de chamadores,
não a matriz positiva de executor/destinatário no dispatch do serviço.
Concorrência entre mensagens legadas não equivale a concorrência entre todos os
produtores legados e Workflows publicados.

## Testes portáveis preparados, ainda não executados

- `src/lib/inbox-dispatch-caller-postgres.test.ts`: cinco cenários de chamador,
  cada um com os três RPCs reais, sobre o PostgreSQL/PostgREST descartável existente.
- `src/lib/inbox-execution-postgres.test.ts`: 11 cenários preparados: produtor
  widget real → ocorrência/prova/evento → dispatch; cinco destinatários nas duas
  vias de notificação; v2/replay/href/intenção; reuso legado; revogação; dois runs
  concorrentes; resolvedor privado; Slack/queue/replay.
- `tests/fixtures/inbox/runtime.ts`: shapes físicos para os RPCs, políticas
  canônicas de Inbox e migrations reais na cópia da CI. Não substitui controles
  de autorização por mocks permissivos. A cópia ainda precisa ser exercitada;
  não é uma certificação de todas as políticas do catálogo real.
- `tests/fixtures/inbox/dispatch-caller.ts`: mesmo contrato executado com as
  sessões GoTrue do draft e usado pelos testes portáveis.

Tentativas locais dos dois arquivos Vitest portáveis: **saída 1**,
`spawnSync docker ENOENT`; os hooks de preparação falharam e os 16 casos não
executaram. Não foram transformados em skip verde ou aprovação da CI.

## Demais validações

| Validação                                                                   | Resultado real                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Vitest: Gmail provider time, Gmail queue, catálogo Inbox, Unipile envelopes | 45/45 passaram                                                           |
| ESLint dirigido nos cinco arquivos TS criados/alterados                     | 0 erros; 2 avisos `any` existentes no harness                            |
| `bun run permissions:check`                                                 | Falha: 49 findings; baseline e contratos intactos                        |
| Compilação automática observada                                             | `build OK`; não é verify/CI/perf integral                                |
| OIDs/ACLs consultados                                                       | Dispatches 19560/19562/19564; visibilidade 20498/20407; resolvedor 20484 |
| Lock do draft                                                               | Habilitado (`O`); zero workflows multicanal ativados                     |
| UI/Ajuda/seed oficial/baseline                                              | Diff vazio                                                               |

Não foram executados build/typecheck manuais, verify completo, CI remota,
perf:check ou Playwright; este lote não altera páginas e a barreira relevante é
a execução PostgreSQL/PostgREST. Nenhum contrato foi fechado usando só os
testes negativos do chamador.

## Arquivos e escopo

Criados: as três migrations 0432–0434 e snapshots nativos correspondentes,
os dois testes Vitest, os dois auxiliares em `tests/fixtures/inbox` e este relatório.
Alterados: `scripts/isolated-db/inbox-central-local.ts`, `roadmap.md` e journal
nativo. Tipos Supabase regenerados pela ferramenta, sem diff. Removidos: nenhum.
Não houve novos grants de negócio, chaves, consentimentos, limites ou contas QA
no seed oficial. Fixtures permanecem carregadas apenas pelo harness descartável.

## Pendências que impedem a conclusão

1. Executar/corrigir os testes portáveis na cópia Docker autorizada; completar
   external queue/preflight e matriz de executor/destinatário das três vias.
2. Completar retomadas root/child/cursor/hash/revision/cutoff e reativação/
   republicação/executor; agendamento completo, não só o resolvedor.
3. Concorrência/reuso entre todos os produtores legados e dispatches, incluindo
   reatribuição durante a execução e revalidação depois da trava.
4. Equivalência funcional de todas as fontes anteriores e WhatsApp; inventário
   de dependências textual + catálogo, não apenas OIDs. O ramo legado WhatsApp
   ficou preservado e **não foi certificado** neste lote.
5. Produtores reais restantes das 13 chaves: atribuição/status, primeira resposta
   confirmada e criação Gmail atestada. Não foram implementados nesta entrega;
   nenhum INSERT artificial de evidência foi criado para fingir suporte.
6. Contratos completos somente com controles reais e cinco cenários executados;
   resolver os 49 findings sem regenerar baseline ou relaxar gates/orçamento.

## Como validar e próximo passo

Em ambiente com Docker local, executar:

```bash
bun run permissions:check
bunx vitest run src/lib/inbox-dispatch-caller-postgres.test.ts src/lib/inbox-execution-postgres.test.ts
```

No draft descartável, o comando do harness acima reproduz os 22 checks reais.
Os testes da CI ainda podem revelar falhas de preparo/runtime: corrigi-las é
parte do pedido pendente, não trabalho já concluído. Manter o lock até a cadeia
integral e os gates passarem; não aceitar/publicar este estado.
