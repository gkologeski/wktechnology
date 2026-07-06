## Problema

Em `/settings/calendars`, o botão **Sincronizar gravações** chama o server function `syncAccountRecordings` (`src/lib/calendar.functions.ts:273-286`). O handler procura o `calendar_accounts` usando o cliente Supabase do usuário (`context.supabase`), cujas policies exigem `owner_id = auth.uid()`. Quando o calendário exibido pertence a outro membro do workspace (ex.: uma conta corporativa conectada por outra pessoa), o `maybeSingle()` retorna `null` e o handler lança "Calendário não encontrado". O mesmo problema silenciosamente afeta `syncCalendarNow`, `disconnectCalendarAccount`, `setCalendarSyncEnabled`, `setCalendarMeetEnabled` e `pushActivityToCalendar`, além de `listCalendarAccounts` (que só lista os do próprio usuário).

## Objetivo

Permitir que qualquer membro do workspace enxergue e opere as contas de calendário conectadas ao workspace, mantendo isolamento entre workspaces.

## Alterações

### 1. `src/lib/calendar.functions.ts`
- Em `listCalendarAccounts`: passar a buscar via `supabaseAdmin` filtrando por `workspace_id = resolveActiveWorkspace(userId)`, para listar todas as contas do workspace ativo.
- Em `syncAccountRecordings`, `syncCalendarNow`, `disconnectCalendarAccount`, `setCalendarSyncEnabled`, `setCalendarMeetEnabled` e `pushActivityToCalendar`:
  - resolver o workspace ativo do usuário;
  - fazer o SELECT/UPDATE/DELETE via `supabaseAdmin` com `.eq("workspace_id", ws)` (e `.eq("id", …)`), garantindo que apenas contas do próprio workspace sejam alcançadas;
  - manter o erro "Calendário não encontrado" para tentativas fora do workspace.
- Nenhuma alteração de RLS, de schema ou de comportamento do provider.

### 2. Nada mais muda
- UI de `src/routes/_authenticated/settings.calendars.tsx` continua igual (mesma assinatura dos server functions).
- `syncPastRecordings`, `syncCalendarAccount` e `pushSingleActivity` do `engine.server.ts` continuam operando com admin, como já fazem.
- Segurança: continuamos escopados por workspace do usuário autenticado; nenhuma exposição a outros workspaces.

## Validação
- `bunx tsgo --noEmit`.
- Manual: usuário do mesmo workspace que não é dono da conta clica em **Sincronizar gravações**, **Sincronizar agora**, **Testar** e alterna switches — todas devem funcionar sem "Calendário não encontrado". Usuário de outro workspace não deve ver a conta na listagem.
