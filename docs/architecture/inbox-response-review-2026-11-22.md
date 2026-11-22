# INBOX-RESPOSTA — correções de 0437, sem liberação

Porte M/G; estimativa inicial 2–4 h. Resultado deste lote: código preparado,
0442–0444 aplicadas **somente no draft**, testes locais executados. Não publicado,
não aceito, não ativado; lock `inbox_runtime_release_guard` permanece `O`.

**Aceite corrigido por INBOX-FECHAMENTO (0448):** a ramificação team de 0442
ampliava indevidamente a política publicada 0122. Foi restaurado exatamente
o WITH CHECK original, sem DROP ou grant, e removido create.team do handler.
Team-only permanece negado, inclusive na própria conversa; own só na própria,
workspace permitido, com todas as demais restritivas/deny. Os resultados team
abaixo são históricos, não certificação de preservação nem aceite atual.
17 testes reais de backend do lote novo confirmaram esses escopos e o vínculo Gmail.

## 1. Implementado e escopo

- `sendChatMessage` mantém autenticação, somente-leitura e gate de área, limitado
  a `create.own`/`create.workspace` após 0448. O envio é o INSERT de `live_chat_messages` pelo cliente real do
  usuário: 0223, restritivas, visibilidade, membership e deny executam juntos.
- RPC privilegiada antiga foi aposentada, sem ampliar ACL. `inbox_chat_request`
  só nasce em INSERT autenticado, com autor real, ID estável e hora do servidor.
  AFTER INSERT cria recibo privado atomicamente, após aprovação da RLS. UPDATE
  não pode promover espelho; retry lê o mesmo registro sob RLS, sem upsert.
- A ramificação de equipe acrescentada em 0442 foi indevida e revertida em 0448;
  demais políticas não mudaram. A restritiva original 0122 está preservada.
- Primeira resposta compara recibos **elegíveis**, com inbound/projeção/fonte
  atuais; abertura sem inbound, reserva, fonte divergente e espelho não ocupam
  a primeira. Lock transacional e UNIQUE por conversa preservam uma ocorrência.
- Histórico pré-implantação incerto é colocado em barreira privada negativa,
  não em recibo de confirmação/evento. A barreira não desaparece ao apagar/editar
  o espelho. Abertura privada comprovada antes de qualquer inbound não bloqueia.
  Histórico atrasado invalida a prova de uma nova primeira antes do dispatch.
- Revisão detectou marcador humano indevidamente exigido de resposta SDR chat;
  0444 preserva a fonte privada do job, sem alterar quotas/gates/consentimento.

## 2. Arquivos

**Criados:** migrations 0442–0444 e snapshots gerados pela ferramenta;
`src/lib/inbox/chat-send.server.ts`, `src/lib/inbox/chat-send.test.ts`,
`tests/fixtures/inbox/chat-response-checks.ts`, `chat-response.sql`,
`gmail-response.sql`, este relatório.

**Alterados:** `src/lib/live-chat.functions.ts`, `src/lib/inbox/AGENTS.md`,
`tests/fixtures/inbox/gmail-transport-checks.ts`,
`scripts/isolated-db/inbox-guard-local.ts`, `inbox-gmail-transport-local.ts`,
`roadmap.md`, relatório anterior, journal e tipos regenerados pela ferramenta.
**Removidos:** nenhum. Migrations 0437–0441 permanecem byte-exact.

## 3. Problemas e correções da revisão

1. INSERT privilegiado alargava own: substituído por INSERT real.
2. Restritiva histórica não tinha team por definição: ampliação em 0442 foi
   um erro de escopo, revertido aditivamente em 0448. Todas as demais
   restritivas/deny e a política permissiva 0223 permaneceram intactas.
3. Falha Gmail 0/1 reproduzida: fixture remetente não possuía `email.create.own`.
   Permissão adicionada **só na fixture explícita descartável**; controles e
   asserção 1 preservados, nenhum grant de cargo/workspace do app.
4. Recibo anterior inelegível podia bloquear primeira: comparação agora verifica
   fonte, inbound e projeção. Histórico confirmado/sem prova não vira nova primeira.
5. Teste PATCH inicial retornou 200 com zero linhas por RLS (não alteração).
   Teste de imutabilidade foi repetido pelo serviço, realmente alcançando a linha
   e obtendo 403, sem considerar exclusão silenciosa como prova de execução.
6. Erros de formatação corrigidos pelo ESLint; restou aviso de tamanho da fixture.

## 4. Validações executadas

| Comando/sinal                                                                                                                                                                                                                                                                                                    | Resultado                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `bun scripts/isolated-db/inbox-gmail-transport-local.ts --disposable-draft`                                                                                                                                                                                                                                      | 87 comparações reais PostgreSQL/PostgREST passaram; transporte callback, não Google                                                    |
| `bun scripts/isolated-db/inbox-guard-local.ts --disposable-draft`                                                                                                                                                                                                                                                | 60 guard + 32 chat/RLS passaram, tokens emitidos por GoTrue                                                                            |
| `bunx vitest run src/lib/inbox/chat-send.test.ts src/lib/inbox-transport.test.ts src/lib/unipile/client-delivery.test.ts src/lib/prospecting/sdr/service-worker.test.ts src/lib/gmail-sync-queue.test.ts src/lib/prospecting/sequences/delivery.test.ts src/lib/prospecting/sequences/transport-timeout.test.ts` | 69 testes passaram                                                                                                                     |
| ESLint dirigido com `--fix`                                                                                                                                                                                                                                                                                      | 0 erros; 1 aviso de tamanho da fixture Gmail                                                                                           |
| `git diff --check`                                                                                                                                                                                                                                                                                               | Sem erros                                                                                                                              |
| Compilação automática                                                                                                                                                                                                                                                                                            | Último sinal consultado: build OK; sem execução manual                                                                                 |
| `bun run permissions:check`                                                                                                                                                                                                                                                                                      | Falhou: 72 achados; contratos do lote ainda não certificados, baseline intacto                                                         |
| `bun run perf:check`                                                                                                                                                                                                                                                                                             | Falhou: `.verification/build.json` ausente                                                                                             |
| Playwright Chromium, 1280×1800                                                                                                                                                                                                                                                                                   | Sessão QA real abriu chat, enviou via `sendChatMessage`, texto apareceu, rascunho esvaziou e consulta retornou **1** primeira resposta |

Não executados: verify global/manual build/typecheck (compilação automática do
ambiente); CI portátil completa, provedor externo real e cinco perfis no worker
para todas as 13 chaves. Asserções locais não equivalem à certificação desses itens.

## 5. Testes e cenários

Chat: own na própria conversa permitido/fora negado apesar de view.workspace;
team-only negado (resultado anterior permitido foi superado por 0448); workspace permitido; sem chave, deny,
outro workspace e inativo negados. Autor falsificado, serviço com marcador e RPC
antiga negados. Espelho sem marcador não gera evento; promoção por UPDATE negada.
Segunda resposta/retry/concor­rência de duas mensagens mantêm um evento.

Gmail: cadeia original 0/1 agora passa; abertura outbound→inbound incremental
atestado→resposta=1; segunda=1 total; resposta histórica confirmada→novo inbound
→resposta=0, inclusive após apagar a projeção histórica. Self/sync/erro/incerto
sem aceite=0; retry incerto não reenvia; recibo anterior de corpo divergente não
bloqueia um aceite real. Sete testes novos do adaptador; regressões existentes
preservadas. Fixtures reutilizáveis recebem serviços reais do alvo descartável.

## 6. Banco, segurança, UX e riscos

- Migrations novas somente draft, sem novos GRANTs. Tabelas novas em schema
  privado, sem acesso PUBLIC/anon/authenticated/service_role; recibos já privados.
- Nenhum segredo/token no código ou evidências. Fixtures explicitamente carregadas
  somente após preflight local descartável, fora de `db/seed.sql`.
- UI/Ajuda não alteradas conforme divisão com Codex; tela existente conferida
  no navegador. Nenhum redesign, alteração de metadata ou escopo visual.
- **Limitação conservadora:** histórico pré-implantação sem comprovação de abertura
  antes de inbound bloqueia primeira resposta futura, inclusive espelho antigo.
  Isso é quarentena negativa, não alegação de assinatura/entrega confirmada.
- Não há certificação integral de SDR/Unipile/13 chaves/worker/revogação/dispatches.
  Contratos e gate global permanecem pendentes; não liberar o lock.

## 7. Como validar e próximo passo

No alvo descartável explícito, executar os dois scripts acima e os sete arquivos
Vitest. Na tela, criar sessão QA com inbound canônico, enviar uma resposta e
confirmar mensagem/ocorrência; repetir com own fora/team fora/deny/inativo.
Não usar conta, workspace ou destinatário de produção.

Próximo passo recomendado: Codex conectar estas fixtures à cópia CI de catálogo
real, completar contratos/evidências das 13 chaves e worker/dispatches antes de
qualquer liberação. Nenhuma dessas etapas foi publicada ou simulada como concluída.
