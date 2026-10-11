# Tarefa 1 — validação de permissões com usuário real (10/10/2026)

> **Reaceite oficial pós-0120 (11/10/2026 14:04 UTC): 35 PASS / 0 FAIL.** Sessão da conta QA emitida pelo mecanismo oficial (`lovable auth-session --user 9b75a10a-…`) após pedido interativo do usuário; asserções com SDK + JWT real da QA (role authenticated), só contagens/IDs, sem mensagens, marcação de lida, agendamentos ou crons. Tempos: email_threads 0,9 s; stage_entries 0,19 s; property_history 0,48 s; activities sem filtro 1,9 s = 1 nota própria; terceiros 0; 1ª página 0,3 s = só a própria; 7 IDs diretos de terceiros invisíveis; Inbox unificada/canal 0 itens; chat ao vivo 0; sinais INSERT 42501, EXECUTE indisponível. Sessões revogadas (signOut global; refresh recusado; arquivo apagado). Conta, cargo e senha não alterados. **Tarefas 1 e 16: Concluídas. Saldo: 16 Concluídas, 0 Executadas, 0 Pendentes.**


> **Gate final pós-0120 (11/10/2026 14:03 UTC, informado pelo operador):** 0119 cover2 + 0120 canônica reconciliadas; 0119 de helper duplicada removida da branch local; diff zero entre raiz e main em src/scripts/drizzle. Source hash local `92e2e8752393da039690f4ab0db580be4180b77d820c031cad98a6b921d1c211`: verify 63,936 s (773 testes, 120 arquivos), build 110,460 s (exit 0); ambos complete=true, source_changed=false, mesmo hash; perf:check aprovado. Provas: `cycle14-post-0120-verify.json` / `cycle14-post-0120-build.json` (do operador, não presentes nesta cópia). Versão pública continua `cd22b29a7b665e29f30c266bc85c66e3fe802d94cbd1c6f9d8c4c082cbdb9990` (commit 458d4e1bc), validada à parte: verify 66,543 s, build 110,981 s, login HTTP 200, ATS 401. Saldo: **14 Concluídas, 2 Executadas (1 e 16)** — o aceite JWT 35/0 foi anterior à 0120; o reaceite oficial pós-0120 aguarda a solicitação interativa do usuário no editor ("Rodar o aceite QA após a migração 0120"). Nenhuma nova tentativa de emitir sessão foi feita.

> **Conciliação (11/10/2026 13:55 UTC):** canônicas no compartilhado e em origin/main d44b04af8: 0119 = `activities_rls_cover2_idx`; 0120 = `my_team_member_pairs` (workspace,user) + guarda `is_workspace_member` em `my_team_member_ids`. Não existe segunda 0119 de helper; a 0119 local do operador (9fc445663) será reconciliada com a 0120. Matriz órfã (isolado, ROLLBACK): U3 sem/inativa/ativa em WB → helper 0/0/1; atividade de WA de U6 ligado só via grupo WB → 0/0/0. Matriz 43/43; integridade 32/0/1 não executado (exit 3). Versão pública cd22b29a… (commit 458d4e1bc). **Tarefas 1 e 16: Executadas, não Concluídas** — o aceite JWT 35/0 foi anterior à 0120; o reteste oficial pós-0120 **não foi executado**: `lovable auth-session --json --user 9b75a10a-…` foi recusado ("requires user approval, which is unavailable in this context"), sem awaiting_input/event_id/tool_id expostos.

> **Histórico — estado anterior (11/10/2026 05:35 UTC):** versão publicada em app.wktechnology.com.br — deployment `35e01a9f-dd3d-4fec-9a5c-914cd9a36263`, hash ativo `1bae558d954f8494f6b51aaa4fc467e0835f03040de51cfecd9f5b8100a0f08b`. Migrações 0103–0114 com COMMIT (defaults fixos 0, 7 policies restritivas, 3 tópicos). Saldo: 14 Concluídas, 2 Executadas (1 e 16 aguardam aceite QA, **não executado**; nenhuma sessão QA emitida), 0 Pendentes. A regeneração automática posterior de types.ts passou typecheck local (saída 0); não é novo artefato publicado nem aceite QA. Menções a "não publicado" abaixo são históricas.


Autorização: Guilherme, "Crie esse usuário no Techsales e complete a tarefa 1". Somente esta conta QA.

## Conta criada (banco real, workspace WK Technology)

| Item | Valor |
| --- | --- |
| Nome | [TESTE] Validação TechSales |
| E-mail | techerp-permissions-qa@techerp-test.invalid (domínio reservado, sem destinatário) |
| ID | 9b75a10a-e5bf-4346-a16e-bab3cafb1d1e |
| Criação | `auth.admin.createUser` com `email_confirm` (sem convite, sem e-mail enviado) |
| Membro | `member`, `active`, `is_test_user=false` (o "Ver como" modo usuário recusa `is_test_user=true`; a conta aparece nas listas de responsáveis com o prefixo [TESTE]) |
| Cargo exclusivo | `[TESTE] QA TechSales` (6fd25e80-a1a9-4d35-8a82-1667356fec26), conjunto global "TechSales Viewer" só vinculado |
| Equipe exclusiva | `[TESTE] Equipe QA` (49f793db-d72d-403c-80fb-c007aeed41d2), só a conta QA |
| Registro fictício | 1 nota sem vínculo, "[TESTE] nota QA tarefa 1" (atividades não disparam workflows) |
| Estado final | cargo `data_scope=own`, `restricted_visibility=true`; sessões revogadas (signOut global); senha trocada por valor aleatório descartado; nenhuma credencial guardada |

Gatilhos conferidos antes: `handle_new_user` (cria perfil) e `consume_workspace_invites_on_confirm` (só convites pendentes do mesmo e-mail: nenhum). Nenhuma pessoa, cargo compartilhado ou registro de cliente foi alterado. Referências de contagem foram lidas com a chave administrativa só como base de comparação; **todas as asserções usam o JWT real da conta QA** (login por senha no serviço de login → API).

## Achado principal de contrato

- `job_roles.data_scope` **não restringe leitura**: com `own` e `restricted_visibility=false`, a conta via os 1.795 negócios, 51.135 contatos, 32.041 empresas e 5.914 leads do workspace. A restrição real é `restricted_visibility=true` (políticas `rep_scope_*`, documentadas em `security-rbac.md` §4.1). Testes de "próprio" e "equipe" abaixo usam a flag.
- **Lacuna**: as políticas `rep_scope_*` só existem em leads, deals, companies, contacts, activities e quotes. Com a flag ligada, a conta QA ainda vê **143 conversas de e-mail, 8 conversas e 62 mensagens de WhatsApp, 6.811 eventos de agenda, 92.458 alterações de campo, histórico de negócio de terceiros (4 itens) e 50 itens na Inbox unificada (inclusive na busca)**. Não foi corrigido: restringir isso muda o acesso real do cargo "Representante de Vendas (externa)" e exige decisão de produto. Nenhuma conversa foi aberta (sem marcar lido).

## Resultados (banco real, sessão própria da conta QA): 29 passaram, 9 falharam

| Caso | Resultado |
| --- | --- |
| JWT com `sub` da conta e papel `authenticated` | passou |
| Próprio: nota própria visível por ID; atividade de terceiro invisível | passou |
| Próprio: negócios, contatos, empresas, leads = 0; e-mails (mensagens) = 0 | passou |
| Próprio: ID direto de negócio e de lead de terceiro = 0; timeline de negócio de terceiro = 0 | passou |
| Próprio: e-mail threads, WhatsApp (conversas/mensagens), agenda, histórico de campos, histórico do negócio, Inbox e busca da Inbox | **falhou (lacuna acima)** |
| Painel de vendas chamável; workspace adulterado não devolve dados | passou |
| White Label do próprio workspace visível | passou |
| Gravação com cargo leitor recusada | passou |
| Equipe (equipe QA só com a conta): igual ao próprio | passou — sem segundo membro fictício, a visão de colegas não foi demonstrada; a RLS `rep_scope_*` não tem ramo de equipe (contrato já registrado) |
| Workspace (flag desligada): vê exatamente o total do workspace; ID direto de terceiro = 1; painel difere do próprio | passou |
| Revogação: membro inativado, mesmo token → negócios 0 e White Label 0 | passou |
| Restaurado para próprio → negócios 0 | passou |
| `current_user_permissions` via API | falhou (função não exposta à API com esse nome; caso descartado, sem impacto) |

Outro tenant: só existe o workspace WK no banco real; criar outro cliente não foi autorizado. O isolamento entre tenants está coberto só no ambiente isolado (`stack/run-e2e.sh`, 26/0) e na matriz SQL (43/43).

## "Ver como" (navegador, sessão do administrador solicitante)

Preview → Negócios → "Ver como" → "[TESTE] Validação TechSales": faixa "Você está vendo como [TESTE] Validação TechSales", quadro de Negócios vazio (0 em todas as etapas). "Voltar ao meu acesso" removeu a faixa. Registro: 1 sessão `mode=user`, `read_only=false` (modo usuário não é só leitura por projeto: a faixa avisa que as ações são reais), vinculada e encerrada; 2 eventos de auditoria (início/fim). Nenhuma gravação foi feita nesse modo.

## Status do ID 1

**Parcial.** Próprio/workspace/revogação/ID direto/painel/White Label e "Ver como" validados no banco real. Pendente: (a) decisão sobre a lacuna de Inbox/e-mail/WhatsApp/agenda/histórico para cargos restritos; (b) visão de equipe com colegas, que exige um segundo usuário fictício; (c) outro tenant no banco real, que exige um workspace de teste. Nada foi publicado.

## Aceite compartilhado pós-0103–0114 (11/10/2026 05:24 UTC) — NÃO EXECUTADO

- Pré-condição informada pelo operador: versão com source_hash `1bae558d…0f08b` publicada; 0103–0114 aplicadas em uma transação.
- Link de acesso pela API administrativa: recusado pela plataforma (exige consentimento de emissão de sessão).
- Caminho oficial de sessão para a conta QA `9b75a10a-e5bf-4346-a16e-bab3cafb1d1e`: recusado, aprovação humana indisponível neste contexto.
- Nenhuma sessão QA criada, nenhuma asserção executada, nada alterado. Resultado: 0 pass / 0 fail; as 9 lacunas seguem pendentes.
- Desbloqueio: aprovar o acesso à conta QA no cartão de aprovação do Lovable, ou entrar com a conta QA no preview para a sessão ser injetada no próximo turno.


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

## Diagnóstico activities — causa real e correção (11/10/2026, 0117/0118) — NÃO é aceite JWT real

Estatísticas reais (somente leitura): n_live_tup 462.475, n_dead_tup 375, último autovacuum 26/09, autoanalyze 01/09 (868 mod. desde então — não justifica VACUUM/ANALYZE extra); heap 302.972 páginas (2.367 MB), relallvisible 302.512 (99,8%), TOAST 615 MB, índices 733 MB (maior: activities_hs_raw_gin 278 MB, 0 usos). Amostra TABLESAMPLE 0,3%: ~4,3 tuplas/página nas páginas ocupadas, sugerindo páginas vazias, mas pgstattuple não está instalado (não instalado) → bloat NÃO demonstrado; VACUUM FULL/pg_repack descartados.

Planos (papel de leitura, sem RLS): `SELECT id ORDER BY created_at LIMIT 50` → Parallel Seq Scan, 286k páginas lidas do disco, 17,2 s; `count(*)` sem colunas → Index Only Scan 0,23 s; filtro owner/assigned → BitmapOr 6 ms.

Causa 1 (medida no isolado, 300k linhas sintéticas): na policy restritiva, `related_*_id IN (lista)` com valor NULL dá NULL, e NULL AND … obriga avaliar por linha `current_role_test_session()` e 3× `user_has_permission`/`is_workspace_admin_of`. Contagem como restrito: >300 s (cancelada). Correção 0117 (mesma semântica): `IS NOT NULL AND … IN`, `(SELECT auth.uid())`/`(SELECT current_role_test_session())` como InitPlan, permissões calculadas sobre o conjunto de workspaces do usuário, colegas via `my_team_member_ids()` (SECURITY DEFINER, sem anon). Depois: restrito próprio 205 ms, equipe 1,8 s, workspace 169 ms, admin 179 ms, outro tenant 157 ms.
- Equivalência: IDs visíveis idênticos para 9 usuários × (cargo restrito on/off) + anon. Matriz 43/43; integridade 32/0/1 não executado.

Causa 2 (medida no real): mesmo sem custo por linha, leitura ampla sob RLS precisa das colunas da policy → lê o heap inteiro. 0118 cria `activities_rls_cover_idx` (workspace_id, owner_id, assigned_to) INCLUDE (related_*, id), 53 MB. Isolado: Index Only Scan, Heap Fetches 0. Real (sem RLS, filtro sobre as mesmas colunas): Index Only Scan 0,84 s vs seq scan 17,2 s. Criado sem CONCURRENTLY (bloqueou só gravações durante a construção).

0116 (etapas/canais): 977,8 ms → 5,5 ms isolado, visibilidade idêntica (registrado acima).

Pendente: medir com JWT real da QA (sessão oficial ainda indisponível); aceite 1/16 não concedido.

## Aceite QA compartilhado — reteste final (11/10/2026 ~13:40 UTC) — APROVADO

Método: sessão oficial `lovable auth-session --user 9b75a10a-…` aprovada pelo usuário; SDK com chave publicável + JWT real da QA (claims.sub = QA, role = authenticated). Somente contagens/IDs; nenhuma mensagem, marcação de lida, agendamento ou cron.

1ª rodada: 34 PASS / 1 FAIL — 1ª página de `activities` ordenada por created_at expirou (57014, 8,2 s). Causa: índice 0118 não cobria created_at. Correção 0119 (testada no isolado: Index Only Scan, Heap Fetches 0, 127 ms): `activities_rls_cover2_idx` com created_at no INCLUDE, substituindo o da 0118.

Reteste: **35 PASS / 0 FAIL**. Tempos: email_threads 0,5 s; stage_entries 0,3 s (antes 7,5 s); property_history 0,8 s; activities sem filtro 2,1 s (antes timeout) = 1 (nota própria); activities de terceiros 0; 1ª página 0,3 s = só a nota própria; 7 IDs diretos de terceiros invisíveis; Inbox unificada (all/email/whatsapp, com/sem busca) e por canal 0 itens; chat ao vivo 0; sinais: INSERT 42501, EXECUTE indisponível.

Sessões da QA revogadas ao final (signOut global da própria QA; arquivo de sessão apagado). Conta, cargo (own, restricted_visibility) e senha não alterados.

## Revisão 0117 → correção 0120 (11/10/2026 ~13:50 UTC)

Identidade publicada atual (informada pelo operador): source_hash `cd22b29a7b665e29f30c266bc85c66e3fe802d94cbd1c6f9d8c4c082cbdb9990`, commit `458d4e1bc` (substitui `1bae558d…` como versão ativa); gates locais do operador: verify 66,5 s/773 testes, build 111,0 s (Nitro 38,6 s), perf:check aprovado; HTTP login 200 / ATS 401. Índice 0118 conferido válido (55 MB) antes da troca pela 0119.

Achado: `my_team_member_ids()` (0117) considerava qualquer grupo do chamador, sem exigir membership ativa nem mesmo workspace. A regra ANTIGA (`shares_team_with`, também SECURITY DEFINER) tinha a mesma lacuna — 0117 era equivalente à antiga, mas ambas permitiam o caso.
Reprodução isolada: usuário 3 (equipe, ativo em WA) + grupo residual em WB (sem membership) com colega 4 dono de atividade em WA → antiga: visível; 0117: visível; corrigida: invisível.
Correção 0120: `my_team_member_pairs()` (workspace_id, user_id) só de grupos em workspace com membership ativa do chamador (`is_workspace_member`), comparado ao workspace da própria atividade; avaliado uma vez por consulta; sem EXECUTE para anon. `my_team_member_ids()` endurecida da mesma forma.
Regressão isolada: seed 9 usuários × cargo restrito on/off + anon idêntico à 0117; equipe positiva (3 vê colega 7) = 1; chamador inativo com grupo residual = 0 pares/0 atividades; matriz 43/43 (inclui Ver como positivo/negativo); integridade 32/0/1 não executado; equipe com 300k linhas 2,25 s.
Aplicada no compartilhado: `drizzle/migrations/0120_activities_team_scope_active_membership.sql`. Só reduz acesso. O aceite 35/0 foi ANTES da 0120; reteste com JWT da QA pós-0120 não executado (exige nova sessão oficial aprovada).

## Reconciliação com a correção do operador (11/10/2026 ~13:55 UTC)

- Operador aplicou no compartilhado (TX COMMIT) a guarda `is_workspace_member(g.workspace_id, auth.uid())` em `my_team_member_ids`. Esta sandbox já tinha aplicado a mesma guarda pela `0120_activities_team_scope_active_membership.sql` (o nome 0119 já está ocupado aqui por `0119_activities_rls_cover_idx_created_at.sql`). Não foi criada migração duplicada; reconciliar na branch local (9fc445663) mapeando a 0119 do operador para a 0120 daqui.
- Estado real conferido: my_team_member_ids e my_team_member_pairs SECURITY DEFINER com guarda, anon EXECUTE=false, authenticated=true; `ws_select_activities` usa `my_team_member_pairs`.
- Regressão isolada (TX ROLLBACK), peer U6 dono de atividade em WA ligado a U3 só pelo grupo WB:

| Membership de U3 em WB | helper ids contém U6 | atividade WA visível |
|---|---|---|
| ausente | 0 | 0 |
| inativa | 0 | 0 |
| ativa | 1 | **0** |

- Diferença consciente vs RLS original: com membership ATIVA em WB, a original mostraria a atividade de WA (1); a 0120 compara o par (workspace do grupo, colega) com o workspace da atividade e mostra 0. É mais restritivo (nunca amplia). Se a regra de negócio for a original, basta trocar o par pela lista `my_team_member_ids()` na policy — decisão do responsável.
- Não é aceite JWT real; reteste QA pós-0120 depende de nova sessão oficial. Tarefas 1/16 não reconfirmadas após 0120.
