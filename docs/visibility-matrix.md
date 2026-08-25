# Matriz de Visibilidade por Papel

Auditoria das políticas RLS ativas no schema `public` para responder: **o que outros usuários enxergam e podem fazer sobre as minhas tarefas e entidades?**

> Fonte: `pg_policies` do banco de produção (consultado nesta auditoria).
> Escopo: núcleo CRM, atividades/tarefas, comunicação e ATS/TechHire.
> Esta auditoria não altera nenhuma policy — é apenas descritiva.

## Resumo executivo (jul/2026)

Estado após as Ondas 3–8 de endurecimento RBAC.

**O que mudou no que "os outros veem/podem sobre você":**

- **RLS restrictive por permissão granular.** Núcleo CRM (`contacts`, `companies`, `deals`, `leads`, `tickets`) e módulos operacionais (`activities`, `meetings`, `quotes`, `quote_line_items`, `deal_line_items`) só aceitam INSERT/UPDATE/DELETE quando o usuário tem a chave de permissão correspondente (`user_can_act(<módulo>, <ação>, owner, assigned)`) **e** está no workspace. Sem a permissão, a operação falha no banco — não só na UI.
- **ATS/TechHire endurecido (Onda 5).** `ats_jobs`, `ats_candidates`, `ats_applications`, `ats_interviews`, `ats_offers`, `ats_job_postings`, `ats_sourcing_sequences` e `ats_sourcing_enrollments` usam `techhire_rbac_gate` como policy RESTRICTIVE. Membro sem chave `techhire.*` não escreve, mesmo estando no workspace.
- **Settings / Integrações / Webhooks (Onda 6).** Server functions críticas (`updateWorkspaceSecurity`, `updateDataRegion`, `upsertWebhook`, `deleteWebhook`, `retryWebhookDelivery`, `upsertIntegration`, `disconnectIntegration`, `setCreditLimit`) chamam `assertPermission` antes de qualquer efeito colateral. Nenhum atalho via cliente burla o gate.
- **Consolidação de policies duplicadas.** UPDATE/DELETE em `calendar_events`, `meetings`, `email_threads`, `email_messages`, `email_broadcasts`, `whatsapp_conversations/messages/campaigns`, `quote_line_items` e `quote_templates` foram unificados em `is_workspace_admin_of(owner, uid) OR can_write_owner(owner, uid)`. Membro comum não edita/apaga registro alheio nessas tabelas.
- **Bug reports (chamado interno)** permanecem estritamente privados ao autor; admins acessam só via server function com `supabaseAdmin`.

**Novas funcionalidades de transparência (Ondas 7–8):**

- **Tela "Minhas permissões"** (`/settings/my-permissions`) — lista, agrupada por módulo e pesquisável, tudo o que o cargo atual permite fazer, com labels em PT-BR, descrição e escopo (`own`/`team`/`workspace`). Server function: `getMyPermissionsDetailed`.
- **Auditoria de bloqueios** — todo `assertPermission` que nega registra em `access_audit_log` (workspace_id, actor_id, chave da permissão). Base para relatório "quem tentou fazer o quê".
- **Toast amigável** — `handlePermissionError` intercepta o erro do servidor e mostra mensagem orientando a procurar o administrador, em vez do erro cru.
- **Governança em `/home/access`** — CRUD completo de cargos customizados, pacotes de permissões, matriz cargos × permissões e atribuição por usuário. Cargos padrão (Super Admin, Admin, Workspace Owner/Admin, TechSales/TechHire Admin/Manager, Membro, Somente leitura) já vêm provisionados com as 56+ chaves granulares.

**Riscos remanescentes** (detalhe na seção 6): SELECT amplo em núcleo CRM (leitura ainda é workspace-inteiro; escrita não é), `activities` com UPDATE/DELETE amplo, e alguns policies marcadas como `public` por herança (sem risco anônimo real, mas convém padronizar em `authenticated`).

---

## Papéis considerados

| Sigla | Papel                                                                                       | Como é identificado                                                                       |
| ----- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **P** | Platform admin                                                                              | `is_platform_admin(auth.uid())` — equipe WK Technology                                    |
| **A** | Workspace admin                                                                             | `is_workspace_admin_of(owner, uid)` — dono do workspace ou admin definido em `user_roles` |
| **L** | Líder de time / com escopo team/workspace/custom                                            | `can_write_owner(owner, uid)` — mesmo grupo em `user_groups` + `data_scope` ≥ team        |
| **M** | Membro comum do workspace                                                                   | `is_workspace_member(ws, uid)` / `current_user_workspaces()`                              |
| **O** | Dono do registro (`owner_id = auth.uid()`) ou responsável (`assigned_user_id = auth.uid()`) |                                                                                           |

## Legenda dos verbos

- **Ver** = SELECT
- **Criar** = INSERT
- **Editar** = UPDATE
- **Excluir** = DELETE

Marcações:

- ✅ liberado sem restrição além do próprio papel.
- 🔐 liberado somente quando a policy `user_can_act(<módulo>, <ação>, owner, assigned)` retorna verdadeiro. `user_can_act` consulta `access_profile_permissions` do perfil de acesso vinculado ao usuário no workspace — portanto o comportamento efetivo depende da configuração de perfis (default costuma permitir "own", "team" ou "all" conforme o módulo).
- ⛔ negado.
- 🟡 condicional — leia a coluna "Regra".

Onde existiam policies duplicadas (`ws_*` + `*_admin_*` + `*_team_*`) em UPDATE/DELETE, elas foram consolidadas (jul/2026) em uma única regra `*_write_update` / `*_write_delete` que exige `is_workspace_admin_of(owner_id, uid) OR can_write_owner(owner_id, uid)`. SELECT e INSERT permaneceram como `ws_*` (workspace inteiro). Isso vale para: `calendar_events`, `meetings`, `email_threads`, `email_messages`, `email_broadcasts`, `whatsapp_conversations`, `whatsapp_messages`, `whatsapp_campaigns`, `quote_line_items`, `quote_templates`.

---

## 1. Núcleo CRM

Todas as tabelas abaixo são filtradas por `workspace_id IN current_user_workspaces()`. Nenhum usuário fora do workspace enxerga qualquer coisa.

### 1.1 Contatos, Empresas, Negócios, Leads

| Tabela          | Verbo            | O   | M   | L   | A   | P   | Regra RLS resumida                                                |
| --------------- | ---------------- | --- | --- | --- | --- | --- | ----------------------------------------------------------------- |
| `contacts`      | Ver              | ✅  | ✅  | ✅  | ✅  | ✅  | Todo membro do workspace vê **todos** os contatos.                |
| `contacts`      | Criar            | ✅  | ✅  | ✅  | ✅  | ✅  | Basta pertencer ao workspace.                                     |
| `contacts`      | Editar           | 🔐  | 🔐  | 🔐  | 🔐  | 🔐  | Workspace + `user_can_act('contacts','edit', owner, assigned)`.   |
| `contacts`      | Excluir          | 🔐  | 🔐  | 🔐  | 🔐  | 🔐  | Workspace + `user_can_act('contacts','delete', owner, assigned)`. |
| `companies`     | Ver              | ✅  | ✅  | ✅  | ✅  | ✅  | Todo membro vê tudo.                                              |
| `companies`     | Editar / Excluir | 🔐  | 🔐  | 🔐  | 🔐  | 🔐  | `user_can_act('companies', ...)`.                                 |
| `deals`         | Ver              | ✅  | ✅  | ✅  | ✅  | ✅  | Todo membro vê tudo.                                              |
| `deals`         | Editar / Excluir | 🔐  | 🔐  | 🔐  | 🔐  | 🔐  | `user_can_act('deals', ...)`.                                     |
| `leads`         | Ver              | ✅  | ✅  | ✅  | ✅  | ✅  | Todo membro vê tudo.                                              |
| `leads`         | Editar / Excluir | 🔐  | 🔐  | 🔐  | 🔐  | 🔐  | `user_can_act('leads', ...)`.                                     |
| `deal_contacts` | Todos            | ✅  | ✅  | ✅  | ✅  | ✅  | Herda visibilidade do `deal` (workspace inteiro).                 |

**Alerta 1** — SELECT dos 4 objetos centrais do CRM (`contacts`, `companies`, `deals`, `leads`) **não** passa por `user_can_act`. Qualquer membro do workspace vê todos os registros, mesmo os de outros donos. Só a **escrita** é filtrada pelo perfil de acesso.

### 1.2 Cotações, itens, produtos, pipeline

| Tabela              | Verbo                | O   | M   | L   | A   | P   | Regra                                                                        |
| ------------------- | -------------------- | --- | --- | --- | --- | --- | ---------------------------------------------------------------------------- |
| `quotes`            | Todos                | ✅  | ✅  | ✅  | ✅  | ✅  | Workspace inteiro.                                                           |
| `quote_line_items`  | Todos                | ✅  | ✅  | ✅  | ✅  | ✅  | Workspace inteiro (duplicado com `*_admin_*` e `*_team_*`, mas o OR libera). |
| `quote_templates`   | Todos                | ✅  | ✅  | ✅  | ✅  | ✅  | Workspace inteiro.                                                           |
| `deal_line_items`   | Todos                | ✅  | ✅  | ✅  | ✅  | ✅  | Workspace inteiro.                                                           |
| `products`          | Todos                | ✅  | ✅  | ✅  | ✅  | ✅  | Workspace inteiro.                                                           |
| `pipelines`         | Todos                | ✅  | ✅  | ✅  | ✅  | ✅  | Workspace inteiro.                                                           |
| `deal_loss_reasons` | Ver                  | ✅  | ✅  | ✅  | ✅  | ✅  | Qualquer membro.                                                             |
| `deal_loss_reasons` | Criar/Editar/Excluir | ✅  | ⛔  | ⛔  | ✅  | ✅  | Só dono do workspace, admin ou platform admin.                               |
| `lead_sources`      | Todos                | ✅  | ✅  | ✅  | ✅  | ✅  | `owner_id = uid` OU `shares_workspace_with(owner_id)`.                       |

---

## 2. Atividades e Tarefas

| Tabela                          | Verbo            | O   | M   | L   | A   | P   | Regra                                                                                                                   |
| ------------------------------- | ---------------- | --- | --- | --- | --- | --- | ----------------------------------------------------------------------------------------------------------------------- |
| `activities`                    | Todos            | ✅  | ✅  | ✅  | ✅  | ✅  | Workspace inteiro. **Não há filtro por dono ou assigned.**                                                              |
| `calendar_events`               | Ver              | ✅  | ✅  | ✅  | ✅  | ✅  | Workspace inteiro (via `ws_select_calendar_events`).                                                                    |
| `calendar_events`               | Editar / Excluir | ✅  | ⛔  | 🟡  | ✅  | ✅  | Consolidado: admin do workspace **ou** `can_write_owner` (dono / mesmo `user_group` com `data_scope`≥team).             |
| `meetings`                      | Ver / Criar      | ✅  | ✅  | ✅  | ✅  | ✅  | Workspace inteiro.                                                                                                      |
| `meetings`                      | Editar / Excluir | ✅  | ⛔  | 🟡  | ✅  | ✅  | Consolidado admin+team.                                                                                                 |
| `meeting_participants`          | Todos            | ✅  | ✅  | ✅  | ✅  | ✅  | Workspace inteiro.                                                                                                      |
| `meeting_summaries`             | Todos            | ✅  | ✅  | ✅  | ✅  | ✅  | Workspace inteiro.                                                                                                      |
| `task_queues`                   | Todos            | ✅  | ✅  | ✅  | ✅  | ✅  | Workspace inteiro.                                                                                                      |
| `task_queue_items`              | Todos            | ✅  | ✅  | ✅  | ✅  | ✅  | Workspace inteiro.                                                                                                      |
| `tickets`                       | Ver              | ✅  | ✅  | ✅  | ✅  | ✅  | Workspace inteiro.                                                                                                      |
| `tickets`                       | Editar / Excluir | 🔐  | 🔐  | 🔐  | 🔐  | 🔐  | Workspace + `user_can_act('tickets', ..., owner_id, assignee_id)`.                                                      |
| `bug_reports` (chamado interno) | Ver / Editar     | ✅  | ⛔  | ⛔  | ⛔  | ⛔  | **Só o autor** (`owner_id = uid`). Ninguém mais vê. Página `/admin/bug-reports` usa `supabaseAdmin` no server function. |
| `bug_reports`                   | Criar            | ✅  | ✅  | ✅  | ✅  | ✅  | Qualquer autenticado cria o **próprio** chamado.                                                                        |
| `notifications`                 | Todos            | ✅  | ⛔  | ⛔  | ⛔  | ⛔  | Só o destinatário (`user_id = uid`).                                                                                    |
| `timeline_pins`                 | Todos            | ✅  | ✅  | ✅  | ✅  | ✅  | Qualquer membro do workspace.                                                                                           |

**Alerta 2** — `activities` continua liberando **UPDATE/DELETE** para qualquer membro do workspace (fora do escopo desta consolidação). `calendar_events` foi ajustado (jul/2026): só dono, admin ou líder de time editam/apagam.

---

## 3. Comunicação

### 3.1 E-mail

| Tabela                  | Verbo            | O   | M   | L   | A   | P   | Regra                                                                                                                        |
| ----------------------- | ---------------- | --- | --- | --- | --- | --- | ---------------------------------------------------------------------------------------------------------------------------- |
| `email_threads`         | Ver              | ✅  | 🟡  | 🟡  | ✅  | ✅  | Membro do workspace vê **apenas** threads com `contact_id` preenchido. Threads sem contato só o dono da `email_accounts` vê. |
| `email_threads`         | Editar / Excluir | ✅  | ⛔  | 🟡  | ✅  | ✅  | Consolidado admin+team (jul/2026).                                                                                           |
| `email_messages`        | Ver              | ✅  | 🟡  | 🟡  | ✅  | ✅  | Herda do thread: com `contact_id` vazam para o workspace; sem contato só o dono da conta.                                    |
| `email_messages`        | Editar / Excluir | ✅  | ⛔  | 🟡  | ✅  | ✅  | Consolidado admin+team.                                                                                                      |
| `email_broadcasts`      | Ver / Criar      | ✅  | ✅  | ✅  | ✅  | ✅  | Workspace inteiro.                                                                                                           |
| `email_broadcasts`      | Editar / Excluir | ✅  | ⛔  | 🟡  | ✅  | ✅  | Consolidado admin+team.                                                                                                      |
| `email_tracking_events` | Todos            | ✅  | ✅  | ✅  | ✅  | ✅  | Workspace inteiro (abertos, cliques).                                                                                        |
| `email_send_log`        | Todos            | ⛔  | ⛔  | ⛔  | ⛔  | ⛔  | Só `service_role` (jobs internos).                                                                                           |

**Alerta 3** — Todo e-mail vinculado a um contato (inbound ou outbound) fica visível para o workspace inteiro na timeline. Isso é intencional para CRM, mas convém deixar claro para o usuário que os colegas veem o corpo do e-mail.

### 3.2 WhatsApp

| Tabela                   | Verbo            | O   | M   | L   | A   | P   | Regra                              |
| ------------------------ | ---------------- | --- | --- | --- | --- | --- | ---------------------------------- |
| `whatsapp_conversations` | Ver / Criar      | ✅  | ✅  | ✅  | ✅  | ✅  | Workspace inteiro.                 |
| `whatsapp_conversations` | Editar / Excluir | ✅  | ⛔  | 🟡  | ✅  | ✅  | Consolidado admin+team (jul/2026). |
| `whatsapp_messages`      | Ver / Criar      | ✅  | ✅  | ✅  | ✅  | ✅  | Workspace inteiro.                 |
| `whatsapp_messages`      | Editar / Excluir | ✅  | ⛔  | 🟡  | ✅  | ✅  | Consolidado admin+team.            |
| `whatsapp_campaigns`     | Ver / Criar      | ✅  | ✅  | ✅  | ✅  | ✅  | Workspace inteiro.                 |
| `whatsapp_campaigns`     | Editar / Excluir | ✅  | ⛔  | 🟡  | ✅  | ✅  | Consolidado admin+team.            |

### 3.3 Chat interno

| Tabela                      | Verbo               | O   | M   | L   | A   | P   | Regra                                                                                                                                                                            |
| --------------------------- | ------------------- | --- | --- | --- | --- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chat_conversations`        | Ver / Editar        | ✅  | 🟡  | 🟡  | 🟡  | 🟡  | Só membros da conversa (`is_chat_member`). Admin do workspace **não** vê o chat se não for adicionado.                                                                           |
| `chat_conversations`        | Criar               | ✅  | ✅  | ✅  | ✅  | ✅  | Precisa ser membro do workspace e ficar como `created_by`.                                                                                                                       |
| `chat_conversation_members` | Ver                 | ✅  | 🟡  | 🟡  | 🟡  | 🟡  | Só quem já é membro da conversa.                                                                                                                                                 |
| `chat_conversation_members` | Adicionar           | ✅  | ⛔  | ⛔  | ⛔  | ⛔  | Só o `created_by` da conversa pode adicionar (e só se adicionar quem seria o próprio user? — a policy exige `user_id = auth.uid()`; o convite real é feito por server function). |
| `chat_conversation_members` | Remover / Atualizar | ✅  | ⛔  | ⛔  | ⛔  | ⛔  | Só o próprio usuário se remove/atualiza.                                                                                                                                         |
| `chat_messages`             | Ver                 | ✅  | 🟡  | 🟡  | 🟡  | 🟡  | Só membros da conversa.                                                                                                                                                          |
| `chat_messages`             | Enviar              | ✅  | 🟡  | 🟡  | 🟡  | 🟡  | Precisa ser membro e `sender_user_id = uid`.                                                                                                                                     |
| `chat_messages`             | Editar              | ✅  | ⛔  | ⛔  | ⛔  | ⛔  | Só o autor da mensagem.                                                                                                                                                          |
| `chat_message_attachments`  | Ver / Enviar        | ✅  | 🟡  | 🟡  | 🟡  | 🟡  | Herda de `chat_messages`.                                                                                                                                                        |

**Ponto positivo** — Chat é o único fluxo com isolamento efetivo por participante. Admin do workspace precisa ser adicionado à conversa para lê-la.

---

## 4. Casos especiais e pegadinhas

1. **`bug_reports` ≠ `tickets`.** "Chamado interno" no menu (`/my-bug-reports`) é `bug_reports` — cada usuário só vê o próprio. Já `tickets` é o módulo de Suporte com visibilidade total no workspace.
2. **`activities` e `calendar_events`** liberam escrita para o workspace inteiro. Se dois vendedores compartilham workspace, um pode apagar tarefa do outro.
3. **E-mails sem `contact_id`** (ex.: mensagens de sistema não vinculadas) ficam privadas para o dono da `email_accounts`. Assim que um contato é vinculado, o thread fica visível para todo o workspace.
4. **Chat** é o único canal onde o admin do workspace **não** enxerga tudo. Ele precisa ser adicionado como membro.
5. **`notifications`** são estritamente pessoais — não há vazamento cruzado.
6. **`platform_admin`** não recebe SELECT automático em todas as tabelas via RLS; a bypass acontece via `supabaseAdmin` (server function) nas telas de administração da plataforma.
7. **`user_can_act`** é o único ponto onde `access_profiles` influenciam RLS. Ele só é chamado nas escritas de `contacts`, `companies`, `deals`, `leads` e `tickets`. Nos demais módulos o perfil de acesso é aplicado **apenas** na camada de aplicação (server functions/UI).

## 5. Perfis de acesso (`access_profiles`)

Cada usuário no workspace pode ter um `access_profile_id`. O perfil declara, por módulo (`contacts`, `deals`, ...) e por ação (`view`, `edit`, `delete`, ...), o **escopo**: `own`, `team`, `workspace`, `custom` ou nenhum.

- **Onde tem efeito no banco:** `contacts`, `companies`, `deals`, `leads`, `tickets` (via `user_can_act` em UPDATE/DELETE).
- **Onde NÃO tem efeito no banco:** todas as demais tabelas — o perfil só filtra na aplicação. Uma query direta ao PostgREST ignora o perfil.

## 6. Riscos remanescentes (não corrigidos nesta auditoria)

Registrados para revisão futura, sem alterações agora:

1. **SELECT amplo em `contacts`/`companies`/`deals`/`leads`.** Um membro sem privilégios enxerga toda a base do workspace via Data API. Se o produto quer respeitar o escopo `own`/`team` também em leitura, é preciso adicionar `user_can_act` ou nova função em `ws_select_*`.
2. **UPDATE/DELETE amplo em `activities`, `calendar_events`, `deal_line_items`, `quotes` e derivados.** Qualquer membro pode modificar/apagar registros de colegas. Sugerido gate por dono ou `user_can_act`.
3. **Policies duplicadas** em `calendar_events`, `email_messages`, `email_threads`, `email_broadcasts`, `whatsapp_conversations/messages/campaigns`, `quote_line_items`, `quote_templates`, `meetings`: existem 3 policies do mesmo verbo (`ws_*` + `*_admin_*` + `*_team_*`). Como o Postgres aplica OR, as restrições estritas ficam mortas. Sugestão: consolidar em uma única policy que expresse a intenção real (por dono, por equipe ou por workspace).
4. **`ws_update_companies`** e **`ws_update_deals`** estão marcadas para o role `public` no `pg_policies` (herança). Não abre acesso anônimo porque `user_can_act` exige `auth.uid()`, mas convém padronizar em `authenticated` como o restante.

## 7. Funções auxiliares referenciadas

- `current_user_workspaces()` → workspace ativo no `profiles.active_workspace_id` do usuário, com fallback para todos os workspaces em `workspace_members`.
- `is_workspace_member(ws, uid)` → existe linha em `workspace_members`.
- `is_workspace_admin_of(owner, uid)` → `has_role(_workspace=owner, uid, 'admin')` ou dono direto do workspace.
- `can_write_owner(owner, uid)` → admin do workspace **ou** mesmo `user_group` + `data_scope` ≥ team.
- `user_can_act(module, action, owner, assigned)` → consulta `access_profile_permissions` do usuário para decidir se a ação é permitida no dono/assigned indicados.
- `is_chat_member(conv, uid)` → existe linha em `chat_conversation_members`.
- `has_role(workspace, uid, role)` → checa `user_roles`.
- `is_platform_admin(uid)` → existe linha em `platform_admins`.
