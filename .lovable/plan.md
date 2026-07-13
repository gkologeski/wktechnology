## Objetivo

Trocar o casamento atual (busca no Drive com **janela de tempo** + filtro do meet-code) por uma associação **determinística baseada apenas no `conference_id`** (código do Meet). Sem janela, sem heurística temporal, sem fallback por título/organizador.

## Por que abandonar a janela

A janela `[start−15min, start+6h]` foi introduzida para reduzir o custo da busca no Drive, mas gera dois problemas:

- **Falsos negativos**: Meet publica o MP4 até 24h depois; reprocessamentos tardios / re-imports caem fora da janela e ficam como `not_found`.
- **Falsos positivos históricos**: qualquer relaxamento do filtro dentro da janela volta a cruzar reuniões distintas do mesmo organizador (NEXID, Samuel, Janderson).

O `conference_id` (formato `xxx-xxxx-xxx`) é único por reunião e o Meet **sempre** grava com esse código no nome do arquivo. Basta usá-lo como chave.

## Abordagem: índice reverso `meet_code → drive_file`

Em vez de perguntar ao Drive "quais gravações combinam com este evento?", perguntamos "quais gravações Meet existem?" uma vez e mantemos um índice. O evento então faz um **lookup O(1) pelo `conference_id`**.

### 1. Nova tabela `meet_recording_index`

```
meet_recording_index
  meet_code          text  primary key (parte central: xxx-xxxx-xxx, lowercase)
  drive_file_id      text  not null
  drive_url          text  not null
  mime_type          text
  file_name          text
  file_created_at    timestamptz
  discovered_by      uuid  references calendar_accounts(id)  -- quem viu o arquivo
  owner_id           uuid  not null                          -- workspace owner
  created_at, updated_at
```

- RLS `owner_id = auth.uid()` (leitura) + `service_role` (escrita).
- Constraint única em `(owner_id, meet_code)` para permitir a mesma gravação vista por múltiplas contas do mesmo workspace sem duplicar.

### 2. Novo passo no sync: `indexMeetRecordings(account)`

Executado no mesmo tick do `syncPastRecordings`, uma vez por `calendar_account`:

- Lista arquivos no Drive do usuário com `mimeType contains 'video/'` **e** `name matches` regex do meet-code (`[a-z]{3}-[a-z]{4}-[a-z]{3}`).
- Sem filtro de tempo. Usa `pageToken` + `modifiedTime > last_indexed_at` (armazenado em `calendar_accounts.meet_index_cursor`) para varredura incremental — só re-lê arquivos novos/modificados desde a última passada.
- Para cada arquivo, extrai o meet-code do nome via regex e faz `upsert` em `meet_recording_index`.
- Custo: 1 chamada Drive por conta por tick, paginada; após o backfill inicial só traz deltas.

### 3. Novo matcher `matchRecordingByCode(event)`

Substitui `findDriveRecording`:

```
if (!event.conference_id) → not_found ("evento sem código")
row = SELECT * FROM meet_recording_index
      WHERE owner_id = event.owner_id
        AND meet_code = event.conference_id
      LIMIT 1
if (row) → vincula (recording_matched_by = "meet-code-index")
else     → not_found ("gravação ainda não indexada")
```

Sem janela, sem `driveSearch` por evento, sem conflito por arquivo (a constraint da tabela já garante 1 arquivo por meet-code por workspace).

### 4. Ciclo de reconciliação

- `syncPastRecordings` passa a ser: (a) `indexMeetRecordings` → (b) para cada `calendar_event` sem gravação, roda `matchRecordingByCode`.
- Eventos com `recording_status = 'not_found'` **não** ganham mais o corte de tentativas (`RECORDING_MAX_AUTO_ATTEMPTS`): como o lookup é O(1) no banco, tentar de novo é barato e cobre o caso "Meet publicou o MP4 depois". Mantém-se `recording_attempts` só para telemetria.
- Botão "Buscar gravação" existente na timeline continua funcionando; passa a chamar o mesmo matcher.

### 5. Backfill único

Migration + script one-shot:

- Reset de `recording_status='not_found'` para reprocessar após primeiro index.
- Não mexe em eventos já com `recording_drive_file_id` válido.

### 6. Guarda-corpo (não regride)

- Regex do meet-code continua a única regra de vínculo.
- `findRecordingFileConflict` é substituído pela `UNIQUE(owner_id, meet_code)` da tabela — impossível duas reuniões diferentes reclamarem o mesmo arquivo.
- Comentários no `engine.server.ts` proibindo reintrodução de dual-signal/título/organizador permanecem.

## Detalhes técnicos

- **Nova coluna** `calendar_accounts.meet_index_cursor timestamptz` (nullable) para paginação incremental.
- **Regex** para extrair o code: `/(?<![a-z])([a-z]{3}-[a-z]{4}-[a-z]{3})(?![a-z])/i` sobre `file.name`.
- Drive query da varredura: `mimeType contains 'video/' and trashed=false and (modifiedTime > 'cursor' or 'cursor' is null)` — o filtro por regex do code é feito **em memória** após a listagem, evitando `name contains` frágil.
- `matched_by` = `"meet-code-index"` (novo valor) para distinguir dos vínculos legados.
- Sem alteração de scopes OAuth (usa o `drive.readonly` já concedido).

## Arquivos afetados (previsão)

- `supabase/migrations/*_meet_recording_index.sql` (nova)
- `src/lib/calendar/engine.server.ts`: remove `findDriveRecording` / `findRecordingFileConflict` e janela; adiciona `indexMeetRecordings` + `matchRecordingByCode`.
- `src/integrations/supabase/types.ts`: regen após migration.

## Fora de escopo

- Google Meet REST API v2 (`meet.googleapis.com/v2/conferenceRecords`) — exigiria novo scope `meetings.space.readonly` e reconsent de todas as contas. Fica registrado como evolução futura se um dia quisermos eliminar o Drive do caminho.
- UI de vincular gravação manualmente (colar link do Drive).
- Reprocessamento em lote sob demanda por deal.

## Validação manual

1. Rodar migration; conferir tabela vazia.
2. Disparar `syncPastRecordings` em uma conta → conferir `meet_recording_index` populado.
3. Escolher 3 eventos que hoje estão `not_found` mas cuja gravação existe no Drive → confirmar vínculo após o próximo tick.
4. Conferir NEXID (deal `f6c61100`) → gravações permanecem apenas nos eventos com meet-code correspondente.
5. Renomear (no Drive) um arquivo removendo o code → próximo re-index deve remover a linha e o evento volta a `not_found` (sem vínculo espúrio).