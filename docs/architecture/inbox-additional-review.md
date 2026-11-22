# INBOX-REVISAO — revisão adicional antes dos gates

## 1. Resumo e status

Porte M; previsão inicial 2–3 horas. **Preparado e aplicado somente ao draft; testes direcionados executados; pacote integral ainda não validado.** Não houve aceite, publicação, SQL em produção ou envio a terceiros. O lock de 0409 e `INBOX_CHANNEL_RUNTIME_READY=false` permanecem. Esta entrega não certifica os gates finais.

## 2. Escopo confirmado

- Fixtures QA retirados do seed oficial; `db/seed.sql` contém somente INSERTs de Ajuda. Carga de QA explícita em `tests/fixtures/inbox`, com destino local fixo, contexto de draft, opt-in `--disposable-draft`, identidade do servidor e ausência de workspaces não-fixture. O script recusa antes da carga e do `finally` quando essas condições não valem.
- Conta indisponível permanece selecionada até remoção explícita. Remover a última conta, disponível ou indisponível, pede confirmação por ampliar um filtro vazio. Trocas de usuário/workspace e desconexão não substituem seleções.
- Responsável de ocorrência vem de `email_threads.assigned_to`, `live_chat_sessions.assignee_id` ou `linkedin_conversations.assigned_to`, com vínculo exato workspace/conta e membership ativo. Não usa o responsável antigo do snapshot, `workspaces.created_by`, proprietário ou CEO como alternativa. Ligado às três rotinas existentes: dispatch no app, dispatch v2 e resolução agendada.
- Reuso do aviso exige usuário ativo, visibilidade atual da origem/canal, responsável atual, contexto exato da conversa e aviso não lido do mesmo usuário/workspace. Validações anteriores de versão/prova, executor, preferências e canais permanecem.
- Unipile usa timestamp da mensagem confirmado pelo provedor; `created_at`/timestamp do envelope não são fallback. Hidratação pelo endpoint da mensagem exata pode fornecer seu timestamp e direção; direção desconhecida falha fechado. V1 compara `account_info.user_id` e `sender.attendee_provider_id`; V2 usa `is_sender`. Self não entra como resposta. Histórico não inicia atendimento/cadência e não ganha proveniência live em replay. Projeção não troca a última mensagem por backlog anterior.

## 3–5. Arquivos

Criados: `tests/fixtures/inbox/{data.sql,unipile.sql,load.ts,README.md}`; `src/lib/workflows/{inbox-channel-filters.test.ts,inbox-fixtures.test.ts}`; `scripts/isolated-db/inbox-review-local.ts`; este relatório; migrations `0415`–`0421` e respectivos snapshots nativos.

Alterados: `db/seed.sql`; `scripts/isolated-db/{gmail-queue-local.ts,inbox-producers-local.ts,AGENTS.md}`; `src/components/workflows/builder/inbox-channel-filters.tsx`; `src/lib/unipile/{webhook-events.server.ts,webhook-events.test.ts}`; `src/routes/api/public/unipile/webhook.ts`; `src/lib/workflows/AGENTS.md`; `docs/help/crm/criar-publicar-workflows.md` (v14); `src/lib/help/official-catalogue.json` (somente esse artigo); `docs/security/permission-contracts.json` (somente contrato do webhook); journal nativo e `roadmap.md`.

Removidos: nenhum arquivo pré-existente; os INSERTs de QA foram movidos para fixtures, não apagados da cobertura de testes. Tipos foram regenerados pela ferramenta nativa sem diferença final no arquivo gerado.

## 6–7. Revisão e correções

- Revisão independente somente leitura confirmou preservação de seleção e achou falta de confirmação no checkbox da última conta disponível; corrigida e coberta por teste.
- Adicionados testes de recusa do loader quando `psql` falha, retorna `f` ou não retorna identidade. `host(inet_server_addr())` evita confundir o sufixo `/32` com um destino diferente.
- A ferramenta nativa rejeitou SQL dinâmico nas primeiras tentativas; **essas tentativas não aplicaram migração**. As versões aplicadas usam SQL explícito/estático, `record` e `CREATE OR REPLACE`, sem renomear objetos canônicos ou editar migrations antigas.
- 0421 evita acessar campos LinkedIn em registros de E-mail/Chat. A regressão real do widget passou depois da correção.
- A fixture Unipile inicialmente não tinha as chaves de catálogo necessárias e usava `allow` em vez do valor canônico `grant`; corrigida somente no fixture descartável. A recusa original foi preservada como falha, não contabilizada como sucesso.
- Formatação corrigida; seis avisos `any` existentes nos arquivos revisados permanecem, sem erros de lint.

## 8–9. Validações efetivamente executadas

- `bunx vitest run src/lib/workflows/inbox-fixtures.test.ts src/lib/workflows/inbox-channel-filters.test.ts src/lib/unipile/webhook-events.test.ts src/lib/unipile/webhook-signature.test.ts src/lib/workflows/inbox-channel-events.test.ts src/lib/gmail-sync-queue.test.ts`: **66/66**, seis arquivos.
- `bun scripts/isolated-db/gmail-queue-local.ts --disposable-draft`: **29/29**, PostgREST/JWT de serviço e PostgreSQL locais. Execução sem o flag recusada antes de qualquer carga.
- `bun scripts/isolated-db/inbox-producers-local.ts --disposable-draft`: **9/9**, replay/concorrência, provas e fronteiras do widget, OIDs/owners/ACL e lock.
- `bun scripts/isolated-db/inbox-review-local.ts --disposable-draft`: **6/6**, uma mensagem/ocorrência em replay concorrente, datas anteriores/posteriores ao cutoff proposto preservadas, histórico não promovido, nenhum job de atendimento para histórico, self excluído e backlog sem sobrescrever data recente. **Não é prova de dispatch no cutoff**, nem de destinatários com JWT de usuário.
- ESLint dirigido: **0 erros, 6 avisos**. `git diff --check`: aprovado.
- `bun run help:coverage`: **256/256** telas, 442 artigos. Ajuda v14 preparada no catálogo e no seed oficial. Tentativa de atualizar a linha existente por psql falhou por permissão; leitura confirmou versão 2, portanto aplicação editorial está pendente. O seed replay foi corrigido para INSERT/DO NOTHING, sem exigir UPDATE; em banco vazio v14 é a primeira definição.
- `bun run permissions:check`: **falhou, 33 findings**. Baseline, budgets, timeouts e asserções não foram relaxados. Os controles SQL novos e o lote anterior ainda exigem contratos/evidências integrais legítimas.
- Compilação automática observada: `build OK`. `verify`, build manual, `perf:check` e Playwright autenticado **não executados nesta revisão**; não são reportados como verdes.

## 10–12. Banco, segurança e UX

0415–0421 aplicadas por migração nativa somente ao banco isolado do draft e registradas no journal. Nenhuma alteração em produção. Helpers permanecem privados; dispatch mantém execução exclusiva pelo serviço e RLS em contexto de destinatário. Leitura estática oferece exatamente as 27 fontes antigas mais WhatsApp e ocorrências Inbox, sem expor uma nova RPC pública. OIDs de visibilidade lidos: `20498`/`20407`, mesmos da revisão anterior; owners/ACL conferidos. Isso **não comprova equivalência RLS completa**.

QA existe apenas porque os testes o carregaram explicitamente neste banco descartável. Não está no seed oficial. A identidade de teste é sem senha, não usa e-mail do proprietário e não contém credenciais reais de canal. Segredos não foram impressos ou versionados. Nada foi enviado a provedores.

Botões de remoção usam o Button oficial, ícone, nome acessível e estado desabilitado durante consulta. As seleções são preservadas durante recusa/erro/troca de contexto; nenhum redraw fora do escopo.

## 13–14. Riscos e pendências materiais

**Não considerar o pacote completo:** falta aplicação editorial da Ajuda v14; prova de dispatch real nas três vias com transferência do responsável, sem chave, deny, outro workspace, inativo e reuso de aviso não lido; execução efetiva do cutoff/versão, readonly e primeira resposta; equivalência RLS das entidades antigas; fechar as 33 lacunas de contratos; 15 regressões de catálogo anteriores; cadeia Gmail/transições/provas ainda registrada no relatório do pacote. O lock não foi removido para fabricar evidência de execução. Os testes desta revisão não suprem essas lacunas.

O lote teve correções aplicadas, mas o aceite integral de autorização e o navegador continuam **pendentes**, não concluídos. Aceitar o draft levaria as mudanças de estrutura ao app; os dados do draft não seriam transferidos. Não aceitar este estado.

## 15–16. Como validar e próximo passo

Repetir os comandos acima somente no backend descartável explicitamente identificado; conferir ausência de QA no seed e artigo v14. Revisar 0415–0421 e comparar todas as regras não-Inbox dos dispatchers com as definições anteriores. Antes dos gates finais, executar a matriz JWT/dispatch/cutoff e as regressões pendentes, regularizar contratos com evidência executável, depois verify/performance/CI e aceite visual. Não habilitar, aceitar ou publicar automaticamente.
