## Problema

A gravação exibida na reunião do Samuel (07/06, Meet `eim-xejq-etq`) é a de outra reunião. No banco, o mesmo `recording_drive_file_id` (`1IEHHdN1ovFbI5ebJNxJzqtTLYjXsH02_`) foi vinculado a duas reuniões diferentes do mesmo dia: MOBICONN/Samuel e VIA PLANETS (17:30, Meet `yaj-hpuh-gwi`). O padrão se repete: `1fN5BafPFdakiWAmwkSVh1OEX18K0ifAy` está em 3 reuniões distintas.

Causa: `findDriveRecording` em `src/lib/calendar/engine.server.ts` procura o arquivo no Drive por fragmento de título + janela de tempo (`endMs - 1h` até `endMs + 7d`) e escolhe o mais próximo do fim. Quando duas reuniões têm títulos parecidos ("WK Technology <> ...") e horários próximos, a mesma gravação bate para as duas. A `conference_id` (código do Meet), que aparece no nome do arquivo publicado pelo Meet no Drive (ex.: `eim-xejq-etq (2026-07-06 ...).mp4`), é ignorada.

## Correção

Atuar apenas em `src/lib/calendar/engine.server.ts` e numa migration de saneamento. Sem mudanças em UI, RLS, schema, permissões ou ingest de eventos.

1. `findDriveRecording`:
  - Aceitar `conference_id` no parâmetro.
  - Nova estratégia prioritária: `name contains '<conference_id>' and <videoMime> and <baseTime>`.
  - Nas estratégias por título / sharedWithMe / meu drive, filtrar candidatos: descartar arquivos cujo nome contenha um código de Meet no formato `xxx-xxxx-xxx` diferente do `conference_id` do evento (regex `[a-z]{3}-[a-z]{4}-[a-z]{3}`). Se `conference_id` presente e nenhum candidato bater, retornar `not_found` em vez de escolher errado.
  - Reduzir janela de busca de `+7d` para `+6h` (Meet publica em minutos/horas; +7d amplia falsos positivos).
  - Ordenação continua por proximidade ao `end_at`.
2. Chamadas existentes de `findDriveRecording` (`syncPastRecordings` e o lookup manual em `refreshRecordingForEvent`): passar `ev.conference_id` — já selecionado hoje.
3. Migration de saneamento: para gravações potencialmente incorretas, limpar campos para que o cron re-tente com a nova lógica. Alvo: `calendar_events` cujo `recording_drive_file_id` aparece em mais de um evento (duplicatas confirmadas) — zera `recording_drive_file_id`, `recording_url`, `recording_mime_type`, `recording_status='pending'`, `recording_attempts=0`, `recording_last_error=null`, `recording_synced_at=null`. Não toca eventos com file_id único (assumidos corretos). Escopo por workspace atual.
4. Validação:
  - `bunx tsgo --noEmit`.
  - Query: `SELECT recording_drive_file_id, count(*) FROM calendar_events WHERE recording_drive_file_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1;` — deve ficar vazio após o cron rodar.
  - Manualmente: abrir a reunião do Samuel (`6fc9a4b2-...`), clicar em "buscar gravação" e conferir que o novo `recording_drive_file_id` bate com Meet `eim-xejq-etq`.

## Fora do escopo

- Não altero timeline, RPC `get_entity_timeline`, RLS, autenticação, permissões, `matchContactForAttendees` nem a UI do drawer.
- Não uso a Google Meet REST API v2 (`conferenceRecords`) — exigiria escopo/OAuth novo. Fica registrado como próximo passo se o match por nome ainda falhar.