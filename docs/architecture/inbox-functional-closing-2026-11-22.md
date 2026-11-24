# INBOX-FECHAMENTO — backend e regressões, sem liberação

Porte G; previsão inicial 2–3 h. Backend preparado; 0447/0448 aplicadas **somente neste draft**. Sem aceitar, publicar, ativar ou executar SQL em produção. Lock permanece `O`.

## Resultado e escopo confirmado

1. `notification_business_resume_capture` agora copia `root_proof.occurred_at` somente para Inbox. Revalida a cadeia do pai antes do INSERT: versão, autorização e cutoff continuam obrigatórios. Captura legada fora da Inbox permanece com os mesmos controles e valores, incluindo hora nula. Nenhum registro antigo foi alterado/backfilled.
2. A auditoria encontrou outro bloqueio concreto em 0424: a comparação exigia que a chave única da retomada fosse igual à chave da raiz, incompatível com UNIQUE existente. 0447 mantém essa unicidade e valida separadamente a chave determinística `resume:parent:workflow:version:cursor`, sem remover a comparação do restante da linhagem, data privada ou hash.
3. `sendGmailEmail` aceita `conversation_id` opcional. Resolve pelo cliente do usuário/RLS e workspace ativo; exige view+create do registro e conta Gmail própria autorizada, rejeitando conta explícita divergente. Encaminha provider_thread_id ao adaptador Gmail. Message-ID/References vêm de metadata confirmada no provedor, não de cabeçalhos editáveis do espelho; id/thread divergentes e cabeçalhos inválidos são recusados antes do envio.
4. Retry mantém os cabeçalhos privados da tentativa aceita, mesmo após novas mensagens na thread. Fingerprint integral continua recusando conteúdo, destinatário, assunto, conta e anexos divergentes. Aceite permanece antes da projeção; timestamps de novos aceites usam `clock_timestamp()` do banco, e conciliação herda a data original privada.
5. 0448 restaura exatamente WITH CHECK de 0122, com OID/roles/restrictiveness preservados. Handler não inclui create.team. Team-only negado inclusive na própria conversa; own somente própria; workspace permitido; deny, estrangeiro e inativo negados sob INSERT real/RLS. Aceites antigos com team permitido foram explicitamente retirados do relatório anterior — os testes históricos não foram apagados.

## Arquivos e revisão

**Criados:** `src/lib/gmail-reply.server.ts`, `gmail-reply.test.ts`, `inbox-backend-regression.test.ts`, `inbox-resume-postgres.test.ts`, migrations 0447/0448 e seus snapshots, este relatório.

**Alterados:** `src/lib/email-send.functions.ts`, `inbox-transport.server.ts`, `live-chat.functions.ts`, `src/lib/inbox/AGENTS.md`, journal gerenciado, `roadmap.md`, `docs/architecture/inbox-response-review-2026-11-22.md`.

**Removidos:** nenhum. UI/Ajuda/harness/contratos locais/baseline e migrations antigas não foram editados. A nota de arquitetura para Gmail no AGENTS raiz não coube no limite; as decisões de chat/retomada foram registradas no AGENTS da Inbox.

Problemas corrigidos na revisão: chave de retomada incompatível com comparação raiz; retry que recalcularia cabeçalhos após envio; timestamp no relógio do processo; ampliação indevida de team; formatação/TypeScript de testes; colisão de e-mail estático entre execuções da nova fixture. A fixture passou a gerar e-mail exclusivo, sem relaxar assertions. Login legado sintético 1 não era admitido pelo GoTrue; não foi reparado: os testes reais Gmail usam perfil 11 já válido e conta de teste própria.

## Validações executadas

| Comando/sinal                                                               | Resultado                                                                                                                                            |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INBOX_BACKEND_REGRESSIONS=1 bunx vitest run` com os dez arquivos dirigidos | **124 testes aprovados**, incluindo 17 verificações reais GoTrue/PostgREST/RLS. Os demais validam lógica e adaptador com transporte simulado.        |
| `bun scripts/isolated-db/inbox-gmail-transport-local.ts --disposable-draft` | **123 verificações reais PostgreSQL/PostgREST aprovadas**, transporte callback local; nenhum envio Google.                                           |
| `bunx vitest run src/lib/inbox-resume-postgres.test.ts`                     | **Não executou os seis casos**: fixture Docker indisponível (`spawnSync docker ENOENT`). Uma tentativa apenas; não conta como verde.                 |
| SQL nas duas migrations + leitura do catálogo instalado                     | Preservação OID/ACL/dependências/security metadata e identidade da policy passou transacionalmente; confirmed copy e regra own/workspace conferidas. |
| ESLint dirigido                                                             | 0 erros; 2 avisos existentes (console de atividade e tamanho do adaptador).                                                                          |
| `bun run permissions:check`                                                 | Falhou: contratos/baseline mantidos intocados conforme divisão com Codex. Não certifica liberação.                                                   |
| `git diff --check`                                                          | Sem erros.                                                                                                                                           |
| Compilação automática                                                       | Consultada após correções; tipos/build não foram executados manualmente. Resultado final informado no fechamento.                                    |

Os dez arquivos de testes: `inbox-backend-regression`, `gmail-reply`, `inbox/chat-send`, `inbox-transport`, `unipile/client-delivery`, `prospecting/sdr/service-worker`, `gmail-sync-queue`, `prospecting/sequences/delivery`, `prospecting/sequences/transport-timeout`, `gmail-mime` (todos `.test.ts` sob `src/lib`).

## Banco, segurança, UX e limites

- Não há grants novos, remoção de policy, mudança em configurações ou registros reais enviados/fechados. Testes locais usam exclusivamente este draft descartável, contas/conversas sintéticas e logins de fixture; não entram no seed oficial. Nenhum e-mail/token do owner foi persistido ou exibido.
- Leitura de conversa/conta/mensagem Gmail usa usuário/RLS, não admin; o admin permanece restrito ao transporte/recibo após gates e ao preparo explícito dos testes. Nenhum segredo em código/logs.
- Sem UI/Ajuda, redesign ou alteração de acessibilidade. Playwright e envio externo real não foram executados neste lote: testes centrais são backend/RLS, não certificação visual dos compositores.
- A matriz local das 13 chaves e worker, wrongversion/missing/deny/foreign/inactive/pause/reactivate-cutoff, foi **informada como aprovada pelo Codex**, não reexecutada aqui. Essa evidência não cobre automaticamente a nova retomada root→child de 0447/0448.

## Riscos, pendências e validação manual

Backend dos três pontos está implementado. A **prova positiva executada de root→child no worker após 0447/0448 permanece pendente**, assim como payload forjado, revogação e cutoff desse novo ciclo na cópia CI; os seis testes concretos estão em `inbox-resume-postgres.test.ts`. No draft bloqueado, a negação de parent forjado 42501/atomicidade foi executada, mas nenhum workflow foi ativado para fabricar um positivo.

Próximo passo recomendado: Codex executar esses seis testes com o harness local já corrigido, preservar team-only negado e fechar contratos/gates. Validar a Inbox com `conversation_id` e request_id estável nos compositores reservados ao Codex, provando mesma thread, retry sem reenvio e nova tentativa explícita independente. Não executar envio real nem retirar o lock antes dessa revisão. Nada dessa próxima etapa foi iniciado automaticamente.

## Execução autossuficiente na CI — 24/11/2026

`inbox-backend-regression.test.ts` executa os mesmos 17 casos por padrão, sem
`skip`: a fixture cria PostgreSQL/PostgREST e um GoTrue 2.180.0 descartáveis,
com imagem fixada por digest, portas somente em loopback, credenciais aleatórias
e limpeza ao terminar. O GoTrue mantém sua base de autenticação separada da
base de autorização da fixture e emite os JWTs reais dos sete usuários de teste.
Não usa credenciais, URLs, contas ou dados de produção.

A preparação mantém `inbox_runtime_release_guard` ativo; não habilita workflows.
As escritas que são objeto do teste continuam pelo cliente autenticado e RLS.
A criação das conversas sintéticas pertence somente à preparação SQL da cópia.
A opção `INBOX_BACKEND_REGRESSIONS=1` preserva o caminho anterior do draft
instalado, ainda sujeito às verificações explícitas de destino descartável.

Comando autossuficiente: `bunx vitest run src/lib/inbox-backend-regression.test.ts`.
Validação dirigida: **17/17 executados e aprovados**, com login GoTrue real,
permissões own/workspace, recusa de create.team, deny, outro workspace, membro
inativo e bloqueio de retomada forjada. A CI integral e seu agregador continuam
exigindo zero casos pendentes, falhos ou não executados; nenhum limite foi relaxado.
