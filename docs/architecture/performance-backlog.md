# Backlog de performance — próximo ciclo

Cada item precisa de um endpoint com cursor e ordenação estável, além de testes próprios. Não
pode cortar histórico nem contagens.

1. [Feito no ciclo 3 A] Timeline paginada no servidor (0087–0089, 0094) em atividades, histórico e calendário.
2. A timeline renderiza `entries.map` com tudo de uma vez. Avaliar virtualização sem quebrar
   âncoras e rascunhos.
3. [Feito no ciclo 3 B] O dashboard baixava milhares de linhas e agregava em JS. Mover a agregação para uma função SQL com
   RLS, mantendo as contagens exatas onde a exatidão comercial importa.
4. [Feito nos ciclos 4 e 5] Inbox unificada (0095/0096) e telas por canal (0097) paginadas no servidor;
   último remetente por `LIMIT 1` só nas linhas da página.
5. A fase nitro do build repete a transformação de cerca de 5.700 módulos (46–71 s, maior fase no
   ciclo 7). Investigar a configuração do plugin Cloudflare/nitro antes de mexer, com medição.
6. [Feito no ciclo 8] Dívida de prettier (503 erros/43 arquivos) corrigida só por formatação.
7. Assinaturas de `deal_line_items` e `meetings` estão fora da publicação de tempo real. Decidir
   entre incluí-las na publicação (exige migração) ou remover a assinatura.
8. Índices: criar só a partir de um EXPLAIN de consultas interativas reais. Nada de índices
   genéricos.

## Ciclo 3

- Ciclo 3 A: feed paginado em 3 origens (0088), e-mail sob demanda, recarga silenciosa sem reset — ver performance-cycle-3.md.
- Ciclo 3 B: dashboard sem tetos (0090–0092). Ciclo 4 C: Inbox unificada paginada (0095/0096), validada em banco isolado; pendente RLS não-admin no banco real e telas por canal — ver performance-cycle-4-inbox.md.
- Ciclo 5: telas Email/WhatsApp/Chat paginadas (0097) e tempo real de e-mail filtrado por caixa — ver
  performance-cycle-5-channels.md. Pendente: RLS não-admin no banco real (requisito de publicação),
  paginação do histórico de mensagens dentro da conversa e entrega real do evento de e-mail.
- Ciclo 6: histórico de mensagens paginado (Email/WhatsApp/Chat), corpo de e-mail sob demanda, âncora de rolagem,
  tempo real por conversa e detecção de recusa silenciosa — ver performance-cycle-6-message-history.md.
  Pendente: RLS não-admin real, evento ponta a ponta do tempo real, abertura de conversa WhatsApp no navegador
  (marca como lida na Meta), assinatura `branding` recusada pelo servidor (fora do escopo, ver ciclo 6).
- Ciclo 7: histórico sem teto que perca novas/apague itens fora da amostra; entrada do cliente −40 KB gzip
  (export que bloqueava o code-splitting da Prospecção); `bun run verify:changed` como feedback (gate segue
  `verify` + `build`) — ver performance-cycle-7-build-verification.md. Pendente: timeout 240 s sem comando
  acessível, fase nitro, `settings.tsx`/`getSettingsForScope` na entrada, assinatura `branding` recusada
  (prioridade), RLS não-admin real, evento realtime ponta a ponta.
- Ciclo 8: gate `bun run verify` verde (503 erros de prettier corrigidos só por formatação); dois experimentos
  de carga inicial medidos e revertidos (sem ganho real); tempo real do White Label em `workspace_branding`/
  `module_branding` (0098), assinatura aceita, evento ponta a ponta não comprovado — ver
  performance-cycle-8-entry-quality-branding.md. Próximo ciclo: observabilidade de build, ambiente isolado
  com tempo real, contratos por módulo (zod em `validateSearch`), RLS não-admin real.
- Ciclo 9: harness isolado reproduzível (`bun run test:isolated`, `scripts/isolated-db/`) com estrutura
  extraída do catálogo real (divergência zero em 11 categorias), matriz de permissões 43/43, camada WAL do
  tempo real 4/4 e 14 asserções SDK/UI **não executadas** (sem serviço Realtime local). Bugs corrigidos:
  0099 (etapa/histórico gravando o tenant fixo — criar lead fora do tenant original falhava) e 0100 (admin
  desativado seguia admin) — ver performance-cycle-9-isolated-validation.md.

## Matriz do plano de 16 frentes (estado após o fechamento — ver executed-tasks-closure.md)

| #   | Frente                                                                                            | Estado                                                                             | Falta                                                                       |
| --- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | Permissões reais own/team/workspace/tenant/Ver como                                               | Parcial: banco real com conta QA 29/9 (lacuna Inbox/histórico em cargo restrito); isolado 43/43; SDK/GoTrue 26/0                              | Sessão não-admin autorizada no banco real; "Ver como" modo usuário (GoTrue) |
| 2   | Ambiente isolado fiel                                                                             | Concluído (PostgreSQL + GoTrue + PostgREST, manifesto); Realtime bloqueado             | Stack de serviço autorizada                                                 |
| 3   | Realtime ponta a ponta                                                                            | Bloqueado: WAL 4/4; 14 SDK/UI não executados                                       | Serviço Realtime                                                            |
| 4   | Realtime pendente (deal_line_items, meetings, calendário, troca de workspace por outros caminhos) | Não iniciado                                                                       | Decidir publicação vs remover assinatura                                    |
| 5   | UX de conversas (reconexão, rolagem, rascunhos) em testes seguros                                 | Bloqueado: fixtures verdes; real depende do 3                                      | Serviço Realtime                                                            |
| 6   | Observabilidade de build/telas/queries                                                            | Não iniciado                                                                       | Próximo ciclo                                                               |
| 7   | Diagnóstico do timeout 240 s                                                                      | Investigação encerrada: tsc precisa de 5,1 GB (OOM com heap padrão); não corrigido | Reduzir tipos/instanciações                                                 |
| 8   | Fase Nitro do build                                                                               | Pendente: medido 53,3 s (total 2:13,5)                                             | Experimento medido compatível com cloudflare-module                         |
| 9   | Carga inicial (zod/rotas/componentes pesados)                                                     | Pendente: medido por rota (entrada 270 KB gz)                                      | Experimento zod/validateSearch                                              |
| 10  | Virtualização só com benefício                                                                    | Não iniciado                                                                       | Medição primeiro                                                            |
| 11  | Métricas TechProjects/TechHire/Prospecção/Agentes/detalhes                                        | Não iniciado                                                                       | —                                                                           |
| 12  | Query plans/índices por evidência                                                                 | Concluído: planos ≤ 52 ms; nenhum índice justificado                               | Repetir como não-admin real                                                 |
| 13  | Contratos de módulos Platform/Sales/Projects/Hire/Agents                                          | Parcial: 0101/0102 (32 de 81 DEFAULTs), contratos estáticos                        | 49 DEFAULTs com chamadores a corrigir                                       |
| 14  | Carga isolada/concorrência/filas/retry/idempotência                                               | Pré-requisito: idempotência de faturas (0101)                                      | Carga no isolado                                                            |
| 15  | Budgets de performance e regressão                                                                | Não iniciado                                                                       | —                                                                           |
| 16  | Validação de artefato SSR Cloudflare/verify/rollback/publicação                                   | Não iniciado                                                                       | Só com autorização futura de publicação                                     |

Riscos abertos: 49 DEFAULTs fixos de `workspace_id` (inventário em
`performance-cycle-10-workspace-integrity.md`); DELETE com filtro por workspace não chega pelo tempo real.
