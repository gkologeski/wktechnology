# Backlog de performance — próximo ciclo

> **Gate final pós-0120 (11/10/2026 14:03 UTC, informado pelo operador):** 0119 cover2 + 0120 canônica reconciliadas; 0119 de helper duplicada removida da branch local; diff zero entre raiz e main em src/scripts/drizzle. Source hash local `92e2e8752393da039690f4ab0db580be4180b77d820c031cad98a6b921d1c211`: verify 63,936 s (773 testes, 120 arquivos), build 110,460 s (exit 0); ambos complete=true, source_changed=false, mesmo hash; perf:check aprovado. Provas: `cycle14-post-0120-verify.json` / `cycle14-post-0120-build.json` (do operador, não presentes nesta cópia). Versão pública continua `cd22b29a7b665e29f30c266bc85c66e3fe802d94cbd1c6f9d8c4c082cbdb9990` (commit 458d4e1bc), validada à parte: verify 66,543 s, build 110,981 s, login HTTP 200, ATS 401. Saldo: **14 Concluídas, 2 Executadas (1 e 16)** — o aceite JWT 35/0 foi anterior à 0120; o reaceite oficial pós-0120 aguarda a solicitação interativa do usuário no editor ("Rodar o aceite QA após a migração 0120"). Nenhuma nova tentativa de emitir sessão foi feita.


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

## Matriz do plano de 16 tarefas — revisão do ciclo 14 (antes da publicação)

Concluído significa implementado e validado no escopo indicado. Conclusão local não
representa implantação no ambiente compartilhado. Executada ainda não cumpriu todo o
critério de conclusão. Os registros dos ciclos anteriores acima são históricos.

| # | Tarefa | Status | O que ainda falta / escopo da conclusão |
| --- | --- | --- | --- |
| 1 | Permissões own/team/workspace/tenant e Ver como | Executada (reteste QA pós-0120 pendente) | Aceite anterior à 0120 com JWT da conta QA em 11/10/2026: 35 PASS / 0 FAIL nas 9 lacunas de leitura, Inbox, IDs diretos de terceiros, nota própria e sinais (após 0116–0119). Ver task-1-real-user-validation.md. |
| 2 | Ambiente isolado fiel e reproduzível | Concluído | Stack local completa e reprodução limpa validadas. |
| 3 | Realtime ponta a ponta | Concluído | 76 verificações SDK e 14 cenários conciliados com evidências automáticas e manuais locais. |
| 4 | Realtime de itens, reuniões, calendário e demais trocas de workspace | Concluído | INSERT/UPDATE/DELETE, sinais opacos, isolamento e troca A/B validados localmente; migrações 0113/0114 já aplicadas no banco compartilhado. |
| 5 | Conversas: histórico, reconexão, rolagem e rascunhos | Concluído | Validação local de paginação, rascunhos independentes, âncora e recuperação após reconexão. |
| 6 | Observabilidade de build, telas e consultas | Concluído | Fases de build, medidas por família de tela/consulta, diagnóstico sem dados comerciais e fingerprint implementados e testados. |
| 7 | Verificação e build dentro de 240 segundos | Concluído | Gates finais no Lovable: verify 29,4 s e build 130,2 s; versão publicada. |
| 8 | Otimização da fase Nitro | Concluído | Hook efetivo reduziu módulos retidos de 5789 para 3104; fase Nitro 47,3 s no build final publicado. |
| 9 | Redução da carga inicial e peso das rotas | Concluído | Redução medida e build validado localmente; ganho modesto. |
| 10 | Virtualização de listas com benefício comprovado | Concluído | Otimização nativa de layout/pintura em timeline extensa; p95 34,5 → 2,5 ms. Não reduz montagem React ou memória. |
| 11 | Métricas de TechProjects, TechHire, Prospecção, Agentes e detalhes | Concluído | Cinco famílias medidas; consultas duplicadas de Vagas corrigidas. Tetos legados de Projetos/Vagas documentados como evolução adicional. |
| 12 | Planos de consulta e índices por evidência | Concluído | Planos avaliados; nenhum índice adicional justificado nas medições registradas. |
| 13 | Contratos de módulos e integridade de workspace | Concluído | Gravadores revisados; no banco compartilhado: defaults fixos 49 → 0, 7 policies SELECT restritivas, 3 tópicos publicados. |
| 14 | Carga, concorrência, filas, retry e idempotência | Concluído | Sete cenários sintéticos aprovados: lease, concorrência, quota, retry, idempotência e isolamento; p95 179,1 ms. Sem provedores externos. |
| 15 | Limites de performance e prevenção de regressões | Concluído | Metas, avisos locais e gate de regressão no CI; relatório incompleto ou de fonte diferente falha. |
| 16 | Aceite do artefato SSR/Cloudflare, rollback e publicação | Executada (reteste QA pós-0120 pendente) | Release e banco concluídos (deployment 35e01a9f-dd3d-4fec-9a5c-914cd9a36263, hash 1bae558d…0f08b, 0103–0114 COMMIT); aceite QA compartilhado 35/0 em 11/10/2026 (antes da 0120; reteste QA pós-0120 pendente). Versão pública atual cd22b29a7b665e29f30c266bc85c66e3fe802d94cbd1c6f9d8c4c082cbdb9990 (commit 458d4e1bc; informado pelo operador). Migrações 0116–0120 só de banco (regras/índices), sem novo artefato. |

Saldo desta revisão: **14 Concluídas, 2 Executadas (1 e 16), 0 Pendentes**. O aceite QA 35/0 foi anterior à 0120; o reteste oficial pós-0120 não foi executado (aprovação da sessão QA recusada em 11/10/2026 13:55 UTC: "requires user approval, which is unavailable in this context").
Detalhes e provas: `executed-tasks-closure.md`, ciclo 13. Não permanecem defaults
fixos de workspace no banco isolado validado; não extrapolar esse resultado para
produção. O relatório SDK mantém três placeholders visuais não executados, com
as provas manuais conciliadas separadamente, sem convertê-las em testes automáticos.
