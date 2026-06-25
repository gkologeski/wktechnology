# Por que a gravação não apareceu

A reunião "WK Technology <> FLOWER MARKET SOLUTIONS LTDA" (Meet `ndt-mkkh-ccv`, encerrada 18:30 UTC) está no calendário do `guilherme@wktechnology.com.br`, que tem escopo `drive.readonly` — então a busca no Drive funcionaria. Mas o registro está com `recording_attempts = 0`, `recording_status = NULL` e `recording_last_error = NULL`: o vinculador nunca rodou para este evento.

Causas, em ordem:

1. **O cron de gravações não está agendado.** O endpoint `/api/public/hooks/calendar-recordings-tick` existe e funciona (chama `tickAllRecordings → syncPastRecordings`), porém não há migration registrando-o em `cron.job` (`grep` em `supabase/migrations/` não retorna nada). Sem agendamento, nada chama o tick, e o `recording_drive_file_id` nunca é preenchido.
2. **Latência natural do Meet → Drive.** Mesmo com o cron ativo, o Meet leva tipicamente 10–30 min após o fim para publicar o MP4 no Drive do organizador. A janela atual `end_at ≤ now − 5 min` busca cedo demais; se cair em "not_found" precisa esperar a próxima execução.
3. **Sem ação manual no UI.** Hoje não há como o usuário forçar a busca da gravação a partir do timeline; ele só pode esperar.

# O que vou implementar

## 1. Agendar o cron `calendar-recordings-tick`

Nova migration que cria um `cron.job` rodando a cada 5 minutos contra `https://wktechnology.lovable.app/api/public/hooks/calendar-recordings-tick` com `Authorization: Bearer <CRON_SECRET>` (mesmo padrão dos outros ticks do projeto). Inclui `unschedule` defensivo antes do `schedule` para ser idempotente.

## 2. Ajustar a janela de varredura

Em `src/lib/calendar/engine.server.ts → syncPastRecordings`:

- Mudar `until = now − 5 min` para `now − 10 min` (alinhar com o tempo mínimo de publicação no Drive e evitar gastar tentativas em vão).
- Aumentar `since` de 14 para 30 dias (cobre reuniões antigas re-importadas).
- Adicionar backoff: se `recording_attempts ≥ 12` (≈ 1 h tentando) e status `not_found`, pular nas próximas execuções automáticas — ainda processável via botão manual.

## 3. Botão "Buscar gravação agora" em /settings/calendar

- Nova server function `refreshEventRecording({ event_id })` em `src/lib/calendar/recordings.functions.ts` (protegida com `requireSupabaseAuth`, valida que `owner_id = userId`, importa `supabaseAdmin` dentro do handler, reusa `findDriveRecording` do engine).
- Em `src/components/activity-timeline.tsx`, no card de reunião do Google Calendar, mostrar:
  - Link de "Abrir gravação" quando `recording_url` existir.
  - Botão "Buscar gravação" quando não existir, que chama a server fn e invalida a query do timeline. Mostrar tooltip com o último erro (`recording_last_error`) quando houver.

## 4. Forçar a busca para o evento atual

Após deploy, disparar uma vez o tick (via curl autenticado) para vincular o evento `cba435e8-…` e demais reuniões pendentes do workspace.

# Arquivos tocados

- `supabase/migrations/<timestamp>_schedule_calendar_recordings_tick.sql` (novo)
- `src/lib/calendar/engine.server.ts` (janela + backoff)
- `src/lib/calendar/recordings.functions.ts` (novo)
- `src/components/activity-timeline.tsx` (botão + link de gravação)

Sem mudanças em RLS, schemas de tabela ou rotas existentes.