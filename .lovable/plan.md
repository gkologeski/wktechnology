## Problema

Hoje `calendar_events.calendar_account_id` tem FK `ON DELETE CASCADE`, então quando o usuário desconecta o calendário em `/settings/calendars` (ou se um dia limparmos contas órfãs de usuários excluídos), todos os eventos sincronizados — incluindo `recording_url`, `transcript`, `summary_text`, `hangout_link` e o vínculo com `activities`/`bookings` — são apagados. O histórico de reuniões some da timeline de contatos, deals, leads e tickets.

Objetivo: manter os eventos (e as gravações/resumos já materializados no CRM) mesmo depois que a conta de calendário for excluída ou o usuário deixar de existir.

## Alteração

### Migration — soltar cascade e permitir evento sem conta

1. `ALTER TABLE public.calendar_events ALTER COLUMN calendar_account_id DROP NOT NULL;`
2. Recriar a FK: `DROP CONSTRAINT calendar_events_calendar_account_id_fkey` → `ADD ... FOREIGN KEY (calendar_account_id) REFERENCES public.calendar_accounts(id) ON DELETE SET NULL`.
3. Nenhuma mudança em `owner_id` (continua `NOT NULL`, sem FK para `auth.users` — a exclusão de usuário no Auth já não apagava eventos, então basta garantir que a UI não filtra por owner vivo).
4. Nenhuma mudança na unique `(calendar_account_id, provider_event_id)` — Postgres já trata `NULL` como distinto, então múltiplos eventos podem ficar com `calendar_account_id = NULL` sem colisão.
5. Nenhuma mudança em RLS/GRANTs — as policies existentes já filtram por `workspace_id` e continuam válidas quando `calendar_account_id` é `NULL`.

### `src/lib/calendar.functions.ts` — desconexão preserva histórico e limpa a conta

Em `disconnectCalendarAccount`, antes de deletar a linha de `calendar_accounts`:

- Fazer `UPDATE calendar_events SET calendar_account_id = NULL, sync_token = NULL WHERE calendar_account_id = data.id AND workspace_id = ws` — redundante graças ao `SET NULL` da FK, mas explícito e à prova de futuras mudanças; e já deixa claro na leitura do server function que estamos preservando o histórico.
- Manter o `DELETE FROM calendar_accounts` como está (agora seguro, sem cascade destrutivo).

Nenhuma outra função (`syncCalendarNow`, `syncAccountRecordings`, `syncCalendarAccount`) precisa mudar; todas só operam quando a conta existe.

### `src/lib/calendar/engine.server.ts` — sem mudança de comportamento

- Inserts de novos eventos continuam com `calendar_account_id` preenchido; a coluna só fica `NULL` para eventos legados de contas desconectadas.
- A busca de gravações (`fetchRecordingForEvent`, linha ~736) já usa `.eq("id", ev.calendar_account_id as string)`; passa a retornar "conta não encontrada" para eventos órfãos, que já não vão ser sincronizados novamente — comportamento correto.

### `src/components/activity-timeline.tsx` — nenhuma alteração

O mirror de calendar_events no timeline usa apenas `workspace_id`, `related_contact_id` e `related_activity_id`; funciona igual com `calendar_account_id = NULL`. Botões "Ver gravação" e "Resumir reunião" seguem lendo `recording_url`/`summary_text` diretamente da linha do evento.

### Exclusão de usuário

Não há FK de tabelas `public.*` para `auth.users`, então excluir um usuário via Auth Admin nunca apagou `calendar_events`. Este plano não muda o fluxo de exclusão de usuário — apenas garante que, se alguém decidir apagar a conta de calendário órfã, o histórico continue no CRM.

## Validação

- Migration aplicada com sucesso.
- `bunx tsgo --noEmit`.
- Manual em `/settings/calendars`: desconectar uma conta e confirmar em `/deals/…`, `/contacts/…` e `/leads/…` que reuniões passadas + botão "Ver gravação" continuam visíveis; reconectar a mesma conta Google e verificar que novos eventos entram normalmente (os antigos permanecem órfãos e imutáveis, não são "readotados").

## Riscos

- Eventos órfãos (sem conta) não recebem mais sync incremental nem re-fetch de gravação; ficam congelados como snapshot. Aceitável — é isso que "preservar histórico" significa.
- Reconectar a mesma conta Google gera novos eventos com o mesmo `provider_event_id` mas `calendar_account_id` diferente; a unique `(calendar_account_id, provider_event_id)` permite (chave composta), então podem coexistir duas linhas para o mesmo evento do Google — uma órfã (histórica) e uma nova (viva). Este é o trade-off necessário para preservar o histórico; documentar no relatório final.
