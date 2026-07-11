## Objetivo

Higienizar as políticas RLS duplicadas nas famílias `calendar_events`, `email_*`, `whatsapp_*`, `quote_*` e `meetings`, **removendo apenas as policies mortas de UPDATE/DELETE** (as `ws_*` permissivas que anulam as variantes admin/team). SELECT e INSERT ficam inalterados — nenhum usuário passa a ver menos nem a enxergar mais do que hoje.

## Decisões confirmadas

- SELECT: manter workspace-wide (mantém a UX atual da timeline, inbox compartilhada, board de cotações).
- SELECT especial em `email_threads` / `email_messages` (filtro por `contact_id` ou dono da `email_account`): preservar; só remover a `*_admin_select` duplicada.
- UPDATE/DELETE: manter só uma policy consolidada = `is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid())`. Isso remove o vazamento de escrita para membros comuns hoje possível via `ws_update_*` / `ws_delete_*`.
- INSERT: nenhuma alteração — só existe `ws_insert_*` por família.

## Impacto funcional esperado

- Membros comuns do workspace **deixam de conseguir apagar/editar** eventos de calendário, reuniões, e-mails, threads, broadcasts, conversas/mensagens/campanhas de WhatsApp e cotações/itens/templates que não sejam deles (a menos que o `access_profile` os classifique como admin do workspace ou como team de quem é dono).
- Continua liberado: dono do registro, admin do workspace, líderes com `data_scope>=team` no mesmo `user_group`.
- Leitura (SELECT) e criação (INSERT) permanecem como estão hoje. Nenhuma tela esvazia. Timeline segue completa.

## Tabelas afetadas (migration única)

Para cada tabela abaixo, `DROP POLICY IF EXISTS` nas três variantes existentes (`ws_update_*`, `ws_delete_*`, `*_admin_update`, `*_admin_delete`, `*_team_update`, `*_team_delete`, `*_admin_select` quando redundante) e recriar uma UPDATE + uma DELETE consolidadas. SELECT `ws_*` e INSERT `ws_*` permanecem.

- `calendar_events`
- `meetings` (verificar variantes existentes — usar mesmo padrão)
- `meeting_participants`, `meeting_summaries` (se tiverem duplicatas equivalentes; caso só exista `ws_*`, não mexer)
- `email_threads`
- `email_messages`
- `email_broadcasts`
- `email_tracking_events` (se tiver duplicatas; senão pular)
- `whatsapp_conversations`
- `whatsapp_messages`
- `whatsapp_campaigns`
- `whatsapp_campaign_recipients` (se tiver duplicatas; senão pular)
- `quotes`
- `quote_line_items`
- `quote_templates`

Padrão aplicado por tabela:

```text
DROP POLICY IF EXISTS ws_update_<t>       ON public.<t>;
DROP POLICY IF EXISTS ws_delete_<t>       ON public.<t>;
DROP POLICY IF EXISTS <t>_admin_update    ON public.<t>;
DROP POLICY IF EXISTS <t>_admin_delete    ON public.<t>;
DROP POLICY IF EXISTS <t>_team_update     ON public.<t>;
DROP POLICY IF EXISTS <t>_team_delete     ON public.<t>;
DROP POLICY IF EXISTS <t>_admin_select    ON public.<t>;  -- só onde é redundante com ws_select_<t>

CREATE POLICY <t>_write_update ON public.<t>
  FOR UPDATE TO authenticated
  USING     (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()))
  WITH CHECK(is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));

CREATE POLICY <t>_write_delete ON public.<t>
  FOR DELETE TO authenticated
  USING (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));
```

Para `quote_line_items` (não tem `owner_id` direto), a policy será via `EXISTS` no `quotes` pai usando o mesmo predicado. Idem para `meeting_participants`/`meeting_summaries` (via `meetings`) e `whatsapp_campaign_recipients` (via `whatsapp_campaigns`) — só entram se de fato tiverem duplicatas hoje.

## Como será executado

1. Rodar `SELECT` em `pg_policies` para congelar a lista exata de duplicatas por tabela e confirmar a coluna de escopo (`owner_id` vs. FK).
2. Emitir **uma única migration** com os `DROP` + `CREATE` acima, em ordem determinística (tabela por tabela).
3. Sem toque em código de aplicação.
4. Após aprovação, rodar `supabase--linter` para conferir que nenhum aviso novo surge.

## Riscos e mitigação

- **Risco:** algum server function do produto hoje faz UPDATE em uma das tabelas usando `supabase` (com token do usuário) contando com a policy `ws_*` permissiva. Após a consolidação, esse UPDATE retorna `new row violates row-level security policy` para membros sem admin/team.
  - **Mitigação:** listar em resposta pós-migration os locais em `src/**` que fazem `.update()` / `.delete()` diretamente nessas tabelas com client autenticado, para você validar se algum precisa migrar para `supabaseAdmin`. **Não altero código** nesta fase.
- **Risco:** `quote_line_items` sem `owner_id` — a policy consolidada dependerá do join com `quotes`. Se o linter reportar problema de performance, avaliamos em fase posterior.

## Fora do escopo

- Nenhuma mudança em SELECT amplo de `contacts/companies/deals/leads` (assunto separado).
- Nenhuma mudança em `activities`, `deal_line_items` (não fazem parte do pedido).
- Nenhuma refatoração de `user_can_act`, `access_profiles` ou `can_write_owner`.
- Nenhum toque em código/UI.

## Entregáveis

1. Migration única aplicando os `DROP`/`CREATE` acima.
2. Resposta final listando: policies removidas, policies criadas, tabelas verificadas sem duplicata (skip), resultado do `supabase--linter`, e lista de call sites no código-fonte que fazem write autenticado nessas tabelas (para revisão manual, sem alteração automática).
3. Atualização do `docs/visibility-matrix.md` refletindo a nova regra de UPDATE/DELETE por família.
4. Atualização do `mem://security-memory` registrando o novo padrão "1 policy consolidada admin+team para writes; SELECT/INSERT continuam ws_*".

## Como validar manualmente após aplicar

- `psql \d+ public.calendar_events` (e afins) — deve mostrar 1 UPDATE + 1 DELETE + 1 SELECT + 1 INSERT.
- Logar como membro comum e tentar apagar um evento/reunião/e-mail alheio — deve falhar com RLS.
- Como admin do workspace, mesma ação deve suceder.
- Timeline, board de negócios e inbox compartilhada seguem exibindo o mesmo conteúdo.
