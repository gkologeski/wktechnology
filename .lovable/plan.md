## Objetivo

Tirar o botão "Buscar gravação" do card individual de reunião na timeline e disponibilizar uma ação por **conta de calendário conectada**, em `/settings/calendars`, que varre as gravações pendentes daquele usuário.

## Mudanças

### 1. Remover botão da timeline
- `src/components/activity-timeline.tsx`
  - Remover `canSearchRecording`, `calendarEventId`, `refreshingRecId`, `refreshRecordingFn`, `onRefreshRecording` e o JSX do botão "Buscar gravação".
  - Remover o import `refreshEventRecording`.
- `src/lib/calendar/recordings.functions.ts` deixa de ser usado pela UI; manter apenas se quisermos endpoint avulso. Plano: **remover** para evitar superfície morta.

### 2. Nova ação por conta em `/settings/calendars`
- Nova server function `syncAccountRecordings` em `src/lib/calendar.functions.ts`:
  - Middleware `requireSupabaseAuth`.
  - Input: `{ account_id: string }`.
  - Valida que a conta pertence ao `userId` autenticado (via `context.supabase`).
  - Dentro do handler, importa dinamicamente `@/lib/calendar/engine.server` e chama a função já existente `syncPastRecordings(account)` (a mesma usada pelo cron `calendar-recordings-tick`).
  - Retorna `{ scanned, found, missing, errors }`.
- `src/routes/_authenticated/settings.calendars.tsx`:
  - Adicionar mutation `syncRecordings` chamando a nova função.
  - Adicionar botão "Sincronizar gravações" (ícone `Video` ou `Film`) ao lado de "Testar"/sync, por linha de conta.
  - Toast com resultado: "X gravações vinculadas, Y ainda não publicadas".
  - Invalida `calendar_events`.

### 3. Backend (engine)
- `syncPastRecordings` já existe e está exportada; nenhum schema novo. Apenas precisamos exportá-la se ainda não estiver: confirmar e ajustar.

## Resultado para o usuário

- Timeline volta a mostrar apenas "Acessar reunião", "Ver gravação" e "Resumir reunião" (sem botão de busca).
- Em **Configurações → Calendários**, cada conta Google conectada ganha um botão **"Sincronizar gravações"** que processa os eventos pendentes da conta inteira (mesma rotina do cron, sob demanda).

## Detalhes técnicos

- Não há alterações de schema nem de cron.
- A função roda na mesma janela do cron (`now - 10min` até 30 dias atrás, máx. 20 eventos, com backoff após 12 tentativas).
- Autorização: a conta precisa pertencer ao `auth.uid()` que disparou a chamada.
