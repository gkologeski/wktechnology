## Objetivo

Explicar, com base nas policies reais do banco, o que cada tipo de usuário do workspace enxerga e pode fazer nas suas tarefas e entidades. Entregar resposta no chat + arquivo `docs/visibility-matrix.md` versionado.

## Escopo confirmado

- **Núcleo CRM**: contacts, companies, deals, deal_contacts, deal_line_items, leads, quotes, quote_line_items, quote_templates, products, pipelines, deal_loss_reasons, lead_sources.
- **Atividades e tarefas**: activities, calendar_events, meetings, meeting_participants, meeting_summaries, tickets, bug_reports, task_queues, task_queue_items, notifications, timeline_pins.
- **Comunicação**: email_threads, email_messages, email_broadcasts, email_send_log, email_tracking_events, whatsapp_conversations, whatsapp_messages, whatsapp_campaigns, chat_conversations, chat_conversation_members, chat_messages, chat_message_attachments.
- **Perspectiva**: comparativo entre 5 papéis — `owner do registro`, `membro comum do workspace`, `líder de equipe / assigned_user`, `workspace admin`, `platform_admin`.
- **Fora do escopo desta tarefa**: mudar RLS, criar novas policies, refatorar `user_can_act`. Apenas documentação. Se a auditoria revelar buracos, listo em "Riscos" sem alterar código.

## Método

1. Coletar todas as policies das tabelas do escopo via `pg_policies` (SELECT/INSERT/UPDATE/DELETE + `roles` + `qual` + `with_check`).
2. Resolver as funções auxiliares: `current_user_workspaces()`, `user_can_act()`, `is_workspace_admin_of()`, `can_write_owner()`, `is_chat_member()`, `has_role()`, `is_platform_admin()`.
3. Cruzar cada tabela × cada papel × cada verbo (Ver / Criar / Editar / Excluir) e classificar em: **Todos do workspace**, **Somente dono/assigned**, **Somente membros do canal**, **Somente admin**, **Bloqueado**, **Depende de `access_profile_permissions`**.
4. Destacar casos especiais observados na coleta parcial:
   - `contacts`, `companies`, `deals`, `leads`: SELECT é **workspace inteiro** — qualquer membro vê tudo; edit/delete passam por `user_can_act` (perfis de acesso).
   - `activities`, `deal_line_items`: SELECT/UPDATE/DELETE liberados para o workspace inteiro, sem checagem de dono.
   - `calendar_events`, `email_threads`, `email_messages`: SELECT pelo workspace inteiro quando existe `contact_id`; caso contrário só o dono da conta de email/calendário.
   - `chat_conversations` / `chat_messages`: restrito a membros do canal via `is_chat_member`.
   - `bug_reports`: só o próprio autor (`owner_id = auth.uid()`), sem visibilidade cruzada.
   - `notifications`, `meetings`, `tickets`, campanhas: mapeados no doc.
5. Marcar quais tabelas dependem de `access_profiles` (perfil de acesso) — o comportamento efetivo depende da configuração do workspace, não só da RLS.

## Entregáveis

1. **Resposta no chat** — resumo executivo em português com:
   - Visão geral por papel.
   - Tabela compacta das entidades mais sensíveis (CRM, atividades, email, chat).
   - Alertas de exposição relevantes (ex.: qualquer membro do workspace vê todos os contatos/negócios/emails com contato vinculado).
2. **`docs/visibility-matrix.md`** com:
   - Legenda de papéis e verbos.
   - Uma tabela por família (CRM, Atividades, Comunicação, Suporte, Admin).
   - Coluna extra "Regra RLS (resumo)" citando a função/coluna usada.
   - Seção "Casos especiais e pegadinhas" (chamados = `bug_reports`, chat por membro, email por conta vs. contato).
   - Seção "Perfis de acesso (`access_profiles`)" explicando que edit/delete em `contacts/companies/deals/leads` é filtrado adicionalmente pelo perfil configurado.
   - Seção "Recomendações não aplicadas" listando riscos encontrados apenas para revisão futura.

## Fora do escopo

- Nenhuma migration.
- Nenhuma alteração em código, componentes ou server functions.
- Nenhuma mudança em `access_profiles` ou papéis.

## Como validar

- Abrir `docs/visibility-matrix.md` e conferir contra `pg_policies` para uma tabela amostral (ex.: `deals`, `activities`, `email_messages`, `chat_messages`, `bug_reports`).
- Confirmar que a resposta do chat bate com o doc.

## Próximo passo sugerido (não faço automaticamente)

Se aprovar, depois posso propor um plano separado para: (a) restringir SELECT de `contacts/companies/deals/leads` por perfil de acesso (hoje é workspace inteiro), e (b) unificar as policies duplicadas em `calendar_events` e `email_messages` (existem `ws_*` + `*_admin_*` + `*_team_*` coexistindo).
