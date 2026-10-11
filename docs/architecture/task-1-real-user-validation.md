# Tarefa 1 — validação de permissões com usuário real (10/10/2026)

> **Estado atual (11/10/2026 05:35 UTC):** versão publicada em app.wktechnology.com.br — deployment `35e01a9f-dd3d-4fec-9a5c-914cd9a36263`, hash ativo `1bae558d954f8494f6b51aaa4fc467e0835f03040de51cfecd9f5b8100a0f08b`. Migrações 0103–0114 com COMMIT (defaults fixos 0, 7 policies restritivas, 3 tópicos). Saldo: 14 Concluídas, 2 Executadas (1 e 16 aguardam aceite QA, **não executado**; nenhuma sessão QA emitida), 0 Pendentes. A regeneração automática posterior de types.ts passou typecheck local (saída 0); não é novo artefato publicado nem aceite QA. Menções a "não publicado" abaixo são históricas.


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
