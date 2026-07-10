## Diagnóstico

Vínculo cruzado de gravações **não é caso isolado**. Varredura no banco:

```sql
SELECT recording_drive_file_id, COUNT(*), array_agg(conference_id), array_agg(title)
FROM calendar_events
WHERE recording_drive_file_id IS NOT NULL
GROUP BY recording_drive_file_id
HAVING COUNT(*) > 1;
```

Resultado: **6 arquivos do Drive vinculados a mais de um evento com códigos de Meet diferentes**, cobrindo **20 eventos** ao total:

| file_id | eventos | reuniões envolvidas |
|---|---|---|
| `1fN5BafPFdakiWAmwkSVh1OEX18K0ifAy` | **8** | Reunião WK/NotExt, IN FORMA, LRB Solution, LRB SOLUTIONS (2x), captação wk studio, Brooks/Solver, MAYA TECH |
| `1OTxl5DzGsZokYjB5HJiJbwMG5UrvxF0U` | 4 | Adv Integra, Mateus Brooks, Programação Diária, Guilherme/Hugo |
| `13MT1gAZ1R-pmVhCz3J-fuYvvwueR6MwH` | 2 | Reposicionamento WK, LUMINA/NORA |
| `19fjP2o7mEKLuPLqPLbP4zunPD7TGCQZT` | 2 | Teste de Reunião, WK & ADV Integra |
| `1d9LIv-PGkazvgjEq2b2qLVkxcUjKd9ub` | 2 | **GRALHA, NEXID** (caso reportado) |
| `1vQbwHQQfy2bCtniw0yu68p-vNKUQse3K` | 2 | MOBICONN, Primo |

**Causa raiz** — `findDriveRecording` em `src/lib/calendar/engine.server.ts` (linhas 300-313): quando o evento tem `conference_id`, o filtro só rejeita candidatos cujo nome contém um código de Meet **diferente**. Arquivos sem código no nome (renomeados, exportados manualmente, ou de eventos sem código detectado) passam livremente, e o candidato mais próximo em tempo vence. Reuniões próximas no mesmo dia acabam competindo pelo mesmo MP4.

## Correção

### 1. `src/lib/calendar/engine.server.ts` (linhas 300-313) — endurecer o filtro

Quando `conference_id` do evento está definido, exigir que o nome do arquivo contenha exatamente esse código. Sem código no nome → rejeitar. Eventos sem `conference_id` (sem Meet) continuam fora do auto-scan (`syncPastRecordings` já filtra em linha 355).

```ts
if (conferenceId && candidates.length > 0) {
  const filtered = candidates.filter((f) => {
    const name = (f.name ?? "").toLowerCase();
    const codes = name.match(meetCodeRe);
    if (!codes || codes.length === 0) return false; // sem código: rejeitar
    return codes.includes(conferenceId);
  });
  if (filtered.length === 0) {
    return { ok: false, reason: `nenhuma gravação com o código do Meet '${conferenceId}' na janela de busca` };
  }
  candidates = filtered;
}
```

### 2. Limpeza em massa (SQL pontual, sem migration)

Zerar recording em **todos os eventos que compartilham file_id com outro evento**, e resetar `recording_attempts` para permitir reprocessamento pelo tick:

```sql
UPDATE calendar_events
SET recording_drive_file_id = NULL,
    recording_url            = NULL,
    recording_mime_type      = NULL,
    recording_status         = NULL,
    recording_last_error     = NULL,
    recording_attempts       = 0,
    recording_synced_at      = NULL
WHERE recording_drive_file_id IN (
  SELECT recording_drive_file_id
  FROM calendar_events
  WHERE recording_drive_file_id IS NOT NULL
  GROUP BY recording_drive_file_id
  HAVING COUNT(*) > 1
);
```

Isso desvincula os 20 eventos afetados. Em seguida, o `calendar-recordings-tick` (cron) — ou o botão "Sincronizar gravações" — reexecuta `syncPastRecordings` com o filtro corrigido. Só o evento cujo `conference_id` bate com o código no nome do arquivo será revinculado; os demais ficarão como `not_found` (correto — a gravação nunca foi daquela reunião) e o botão manual da timeline permanece disponível para casos legítimos de arquivo renomeado.

### 3. Rodar o tick de gravações uma vez após a correção

Após deploy do fix e limpeza dos dados, disparar `POST /api/public/hooks/calendar-recordings-tick` (via `curl` autenticado com `CRON_SECRET`) para reprocessar imediatamente em vez de esperar o próximo ciclo do pg_cron.

### 4. Validação

- Rerodar o `SELECT ... GROUP BY recording_drive_file_id HAVING COUNT(*) > 1` — deve retornar 0 linhas.
- Abrir deal NEXID (`f6c61100-…`) — gravação da Gralha sumiu.
- Abrir deal da Gralha — gravação continua vinculada ao evento `b02e2726` (o filtro corrigido aceita `uqz-jgsx-qww` no nome do arquivo).
- Amostrar 2-3 dos outros deals afetados (LUMINA, MOBICONN, LRB) e confirmar que só o evento correto ficou com a gravação.
- `typecheck`.

## Fora do escopo

- Não vou mexer no matcher de contatos (`matchContactForAttendees`).
- Não vou mexer no `get_entity_timeline`.
- Não vou criar migration — é dado, não schema. Fica em `supabase--insert` (UPDATE).
- Não vou tentar identificar programaticamente "qual evento é o dono correto" quando o nome do arquivo não tem código de Meet: sem sinal confiável, deixar como `not_found` e permitir vínculo manual é mais seguro do que adivinhar.

## Risco

Baixo, mas com efeito colateral consciente: eventos legítimos cuja gravação foi renomeada removendo o meet-code deixam de auto-vincular. Como não temos como distinguir esses do caso ruim, o custo é usar o botão manual da timeline para revincular quando o usuário identificar. Nenhum dado do Drive é apagado — só a referência no `calendar_events`.
