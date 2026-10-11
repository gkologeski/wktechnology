# Lançamento e recuperação — ciclo 14

> **Estado atual (11/10/2026 05:35 UTC):** versão publicada em app.wktechnology.com.br — deployment `35e01a9f-dd3d-4fec-9a5c-914cd9a36263`, hash ativo `1bae558d954f8494f6b51aaa4fc467e0835f03040de51cfecd9f5b8100a0f08b`. Migrações 0103–0114 com COMMIT (defaults fixos 0, 7 policies restritivas, 3 tópicos). Saldo: 14 Concluídas, 2 Executadas (1 e 16 aguardam aceite QA, **não executado**; nenhuma sessão QA emitida), 0 Pendentes. A regeneração automática posterior de types.ts passou typecheck local (saída 0); não é novo artefato publicado nem aceite QA. Menções a "não publicado" abaixo são históricas.


## Critérios de liberação

1. Integrar as mudanças mais recentes da branch principal, preservando ajustes concorrentes.
2. `verify` e `build` completos, sem interrupção e com fingerprint igual ao código atual; `perf:check` aprovado.
3. Backend reconstruído em stack separada: 76 verificações aprovadas, zero falhas. Três placeholders de UI continuam não executados no harness; provas manuais ficam separadas.
4. Executar o artefato Cloudflare emitido no workerd: login SSR, navegação autenticada, ausência de diagnósticos DEV e endpoint autenticado recusando requisição anônima.
5. Conferir versão servida e exercitar retorno ao artefato anterior no ambiente isolado.
6. Conferir definições reais do banco compartilhado antes de aplicar SQL. Snapshot de definições, policies, defaults e publicação preservado localmente; nenhum dado de cliente copiado.
7. Integrar pelo Lovable, repetir o gate completo, alinhar migrações 0103–0114 e publicar. Não marcar publicação por screenshot antiga ou flag `is_published` de release anterior.
8. Conferir `build-info.json`, login, assets e resposta da versão publicada.

## Sequência de banco

As migrações 0099–0102 já estão refletidas no snapshot compartilhado revisado. Aplique somente diferenças comprovadas, em transação, na ordem de dependências.

- 0103: policies SELECT restritivas em canais e históricos, sem ampliar permissões existentes.
- 0104–0111: defaults seguem a sessão; todos os escritores sem sessão devem fornecer workspace da entidade de origem. Código integrado deve anteceder essas mudanças.
- 0112: default exige membership ativa e falha fechado para workspace selecionado inacessível.
- 0113: publicação de reuniões e itens de negócio.
- 0114: sinais opacos de exclusão com RLS e escrita restrita ao trigger.

Antes/depois: contar defaults fixos, inspecionar funções/policies e presença nas publicações. Nenhuma migração deve atualizar ou apagar registros comerciais.

## Recuperação

- Referência anterior no início do lançamento: `d1dee82098b2cd30e24d7bbf9b3cc36f6939e6b0`.
- Cópia local do artefato anteriormente aceito: `.techerp-isolated.local/release-previous/`, com inventário de hashes. Serve apenas o banco sintético local.
- Se falhar antes da publicação, mantenha o release público anterior; preserve logs e corrija o pacote.
- Se falhar depois da publicação, restaure o artefato/commit anterior pelo mecanismo de versões do Lovable, mantendo a segurança do banco. Gravadores antigos incompatíveis exigem correção adiante; nunca restabeleça workspace fixo para aparentar funcionamento.
- Reverter automaticamente todas as migrações é inadequado: reintroduziria falhas de isolamento. Snapshot de DDL serve para revisão direcionada; recuperação de dados depende do backup gerenciado do provedor.
- Conferir a identidade servida, login e endpoint protegido depois de qualquer restauração.

## Evidências de lançamento

Em andamento: gates finais registrados abaixo; publicação ainda não executada. Este documento não afirma implantação.

## Fechamento do ciclo 14 (11/10/2026)

**Status:** 15 tarefas concluídas **no escopo local**; a tarefa 16 está **em lançamento** (publicação e alinhamento do banco ainda não executados). Nada foi publicado e nenhuma migração foi aplicada de forma permanente ao banco compartilhado.

### Ajuste final de código
- `src/components/workspace-realtime-signals.tsx`: `queryKeys` passa a incluir `["tasks"]` (atividades são a tabela de Tarefas), para que a exclusão opaca também reconcilie a lista de Tarefas. Validado localmente pelo operador com conta restrita: tarefa sintética excluída direto no banco local sumiu sem recarregar (lista 1→0). Nenhuma outra função ou migração alterada.

### Harness SDK × prova manual (distinção obrigatória)
Os três cenários `rt-delete-event`, `ui-event-to-screen` e `view-as-gotrue-session` **não são executados pelo runner SDK** e continuam `not_executed` → exit 3 no harness. Não viram verde automático. A prova foi feita separadamente, manualmente, pelo operador no navegador conectado ao app local:
- `rt-delete-event`: nota e tarefa excluídas fora da tela sumiram sem reload; fixtures removidas.
- `ui-event-to-screen`: 14 cenários conciliados neste checklist; troca de workspace A→B→A verificada em duas abas.
- `view-as-gotrue-session`: teste real do "Ver como" do ciclo 13 e teste específico próprio passaram.

### Outras provas locais (operador)
- Reprodução SDK isolada: 76 aprovações / 0 falhas. Carga sintética: 7/7.
- Rollback local: artefato anterior serviu login 200 e dashboard autenticado; retorno ao final com outra identidade de assets, `build-info.json` 200 e fingerprint exato; zero erros no navegador; diagnóstico DEV ausente.
- Formulário público sem sessão no worker local: lead, envio e nota gravados no workspace B correto; depois removidas apenas as fixtures.
- Migrações 0103–0114 executadas em transação de compatibilidade com `ROLLBACK`, sem dados de clientes: dentro da transação, zero defaults fixos e publicação com 3 tópicos; após o rollback, 49 defaults fixos e tabela de sinais inexistente (estado preservado). Helpers de membership/admin exigem `status = active`. Snapshot de DDL compartilhado preservado.

### Gates nesta sandbox (Lovable)
| Execução | verify | build | client | ssr | nitro | entrada gzip | módulos Nitro |
|---|---|---|---|---|---|---|---|
| Integração do pacote (antes do ajuste) | 32,5 s | 158,0 s | 40,6 s | 48,1 s | 65,8 s | 251.085 B | 3.104 |
| Após ajuste `["tasks"]` (final) | 29,4 s (tipos 21,9 · lint 1,3 · testes 6,2) | 130,2 s | 40,8 s | 38,3 s | 47,3 s | 251.106 B | 3.104 |

- verify: `complete=true`, 773 testes / 120 arquivos, 0 erros de lint. build: `complete=true`, saída 0. `bun run perf:check`: aprovado.
- Fingerprint (source_hash) final: `1bae558d954f8494f6b51aaa4fc467e0835f03040de51cfecd9f5b8100a0f08b` — idêntico em `.verification/verify.json`, `.verification/build.json` e `dist/client/build-info.json`.
- Commit no início desta rodada: `9b570ff9eed6adb3a8d0088e611044aae81153be` (o ajuste entra no próximo registro automático da plataforma).
- Tempos locais anteriores do operador (verify 26,2 s, build 100,3 s, Nitro 38,9 s) são de outra máquina e **não são SLA**.

### Próximo passo (não executado)
Publicar o código primeiro; só então aplicar defaults/policies 0103–0114 na transação validada, para não quebrar gravadores da versão pública anterior.


## Estado comprovado do lançamento (11/10/2026 05:33 UTC)

- Versão publicada em `https://app.wktechnology.com.br`: `/build-info.json` responde 200 com source_hash `1bae558d954f8494f6b51aaa4fc467e0835f03040de51cfecd9f5b8100a0f08b` (built_at 2026-10-11T05:20:15.841Z), conferido pelo operador.
- Migrações 0103–0114 aplicadas pelo operador em uma transação com COMMIT: zero defaults fixos de workspace; 7 policies SELECT restritivas; 3 tópicos publicados (meetings, deal_line_items, workspace_realtime_signals); authenticated sem INSERT em sinais e sem EXECUTE em signal_workspace_delete; nenhum registro comercial alterado.
- Tarefa 16: **Executada, aguardando aceite QA**.
- Tarefa 1: **concluída apenas no escopo local**; as 9 lacunas de leitura no banco compartilhado **ainda sem reteste**.
- Aceite QA com a conta `9b75a10a-e5bf-4346-a16e-bab3cafb1d1e`: **não executado**. O mecanismo oficial de sessão respondeu que a aprovação humana está indisponível neste contexto (sem cartão, sem awaiting_input/tool_id). Nenhuma sessão criada, nenhuma senha alterada.


## Aceite QA compartilhado — EXECUTADO (11/10/2026 05:44–05:48 UTC)

Método: sessão oficial `lovable auth-session --user 9b75a10a-…` (aprovada pelo usuário); cliente SDK com chave publicável + JWT real da QA (claims.sub = QA, role = authenticated, conferidos sem imprimir token). Só contagens HEAD/exact e formato de resposta; nenhuma conversa aberta, nada marcado como lido, nada enviado. Sessões QA revogadas (signOut global da QA) ao fim de cada rodada; arquivo de sessão apagado. Totais de referência lidos com leitura administrativa só para provar que existem dados de terceiros.

| Verificação | Total no banco | Visto pela QA | Resultado |
|---|---|---|---|
| email_threads / email_messages | 8.792 / 9.842 | 0 / 0 | PASS |
| whatsapp_conversations / messages | 8 / 62 | 0 / 0 | PASS |
| calendar_events | 6.811 | 0 | PASS |
| stage_entries | 7.665 | 0 | PASS |
| property_history | 92.460 | — | **FAIL: timeout (57014) após 8 s** |
| deals/leads/contacts/companies de terceiros | 1.795/5.915/51.136/32.041 | 0 | PASS |
| ID direto de terceiro (7 tabelas) | — | 0 | PASS |
| Nota fictícia própria | 1 | 1 | PASS |
| activities de terceiros / sem filtro | — | — | **FAIL: timeout (57014) após 8 s** |
| Inbox canal (email/whatsapp, com e sem busca) | — | 0 itens | PASS |
| Inbox unificada email/whatsapp | — | 0 itens | PASS |
| Inbox unificada "all" (com e sem busca) | 2 chats ao vivo | **2 itens (chat)** | **FAIL: vazamento** |
| Sinais: INSERT | — | recusado 42501 | PASS |
| Sinais: EXECUTE signal_workspace_delete | — | sem privilégio (has_function_privilege=false) | PASS |

Achados reais (não corrigidos; aguardam decisão):
1. **live_chat_sessions** só tem política permissiva por workspace; cargo restrito vê os 2 chats ao vivo do workspace pela Inbox unificada. Falta restrição equivalente a rep_scope_*.
2. **activities** e **property_history** sem filtro de dono estouram o statement_timeout para o cargo restrito (o filtro por dono responde em ~130 ms). Não há vazamento, mas a leitura ampla falha em vez de retornar vazio.

Saldo: 24 PASS / 10 FAIL na 1ª rodada; após corrigir a leitura da resposta jsonb da Inbox (erro do teste): 3 falhas reais (chat ao vivo visível; 2 timeouts). Tarefas 1 e 16 **não** aceitas.


## Correção 0115 e reaceite QA (11/10/2026 06:05–06:18 UTC)

Autorização do usuário: "sim" para fechar o chat ao vivo a cargos restritos e acelerar as consultas amplas, testando antes no isolado.

Migração `drizzle/migrations/0115_rep_scope_live_chat_and_hashed_policies.sql` (aplicada no banco compartilhado após A/B no isolado):
- `live_chat_sessions`: novas políticas RESTRITIVAS SELECT/UPDATE `rep_scope_*` — cargo restrito só vê chat ligado a lead/contato próprio. Demais cargos inalterados.
- `property_history`: `rep_scope_select_property_history` reescrita com a mesma regra de `rep_owns_entity`, em forma avaliada uma vez por consulta.
- `activities`: `view_as_hide_test` passa a usar `view_as_test_record_ids()` (SECURITY DEFINER, sem acesso anon), mesma semântica.

Isolado (volume fictício 120 mil atividades / 95 mil históricos, cargo restrito): histórico 10,1 s → 25,6 ms; chats de terceiros 3 → 0; positivos: chat/histórico do lead próprio visíveis, usuários sem restrição veem tudo, outro tenant 0, registro de teste segue oculto. Após recriar o isolado limpo + 0115: matriz 43/43, integridade 32 pass / 0 fail / 1 não executado (exit 3 por tempo real, nunca verde). Atividades no isolado: 107 ms antes e depois (o estouro não se reproduz lá).

Reaceite real com JWT da QA: **33 PASS / 2 FAIL**.
- Agora PASS: chat ao vivo 0; Inbox unificada "all" com e sem busca 0 itens; histórico 0 em 375 ms.
- Ainda FAIL: `activities` sem filtro de dono → 500 (statement timeout). Sem vazamento; causa no banco real não demonstrada (não reproduz no isolado). Tarefas 1 e 16 **não** aceitas.
- Atenção: `stage_entries` respondeu 0 em 7,5 s, perto do limite de 8 s.
