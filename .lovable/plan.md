## Diagnóstico

Confirmei no banco:
- Deal `288e0f30...` (Janderson) tem 1 reunião ligada (`activity 0a6d8ea1`, calendar_event `c2124ade`, Meet `guh-vibx-qrp`, 07/07 14:30).
- `calendar_events.recording_url` está preenchido com o link do Drive (a gravação FOI encontrada).
- Porém `activities.recording_url` está `NULL` e `activities.attachments.recording_url` também.

O card de reunião na timeline (`src/components/activity-timeline.tsx` linhas 1756–1786) só considera "tem gravação" quando o link está em `attachments.recording_url` ou `external_ids.recording_url` da própria activity. Como a activity espelho dos calendar_events já existe e a deduplicação descarta o card virtual, o link do Drive nunca aparece.

## Causa raiz

`syncDriveRecordings` em `src/lib/calendar/engine.server.ts` (~L847) grava `recording_url` apenas em `calendar_events`. Nunca propaga para a activity vinculada (`related_activity_id`). Ou seja: a gravação existe no evento do calendário, mas nunca é copiada para a atividade que a timeline renderiza.

## Correção proposta

1. **Propagação no motor de sync** (`src/lib/calendar/engine.server.ts`)
   - Após atualizar `calendar_events.recording_url`, se o evento tiver `related_activity_id`, atualizar na `activities` correspondente:
     - `recording_url` (coluna direta)
     - `attachments.recording_url` (merge preservando demais chaves)
     - `external_ids.recording_url` (idem)
   - Mesmo comportamento quando a gravação vem via `ensureRecordingForEvent` (função em ~L1337) — cobre tanto o sync em lote quanto o "sincronizar agora" pontual.

2. **Backfill único** (SQL/insert)
   - Para todos os `calendar_events` com `recording_url` não-nulo e `related_activity_id` preenchido cuja activity ainda esteja sem `recording_url`, copiar o valor da gravação para a activity (coluna direta + `attachments` + `external_ids`, sem sobrescrever outros campos). Corrige imediatamente o deal do Janderson e qualquer outro caso equivalente já presente no banco.

3. **Defesa em profundidade na timeline** (`src/components/activity-timeline.tsx`)
   - No cálculo de `recordingUrl` do card de reunião (L1772), consultar também o `calendar_events.recording_url` já carregado no fetch de virtuals: manter um mapa `calendar_event_id → recording_url` construído no bloco de virtuals (L836–841) e usar como fallback quando a activity real (mesmo `calendar_event_id`) não tiver gravação preenchida. Isso protege contra qualquer futura falha de propagação e garante que a UI nunca "esconda" uma gravação existente.

Escopo restrito ao problema reportado. Nada de RLS, permissões, schema, ou lógica de negócio fora do sync de gravações.

## Como validar

- Após o build, abrir `/deals/288e0f30-edfb-474e-97f4-0432da9e6b63` → o card da reunião "WK Technology <> LUMINA/NORA TECNOLOGIA LTDA" deve exibir o botão/link "Abrir gravação" apontando para o arquivo no Drive.
- Rodar o sync de gravações novamente em outro deal recente e verificar que a activity passa a ter `recording_url` preenchido imediatamente após o `calendar_events` ser atualizado.

## Arquivos impactados

- `src/lib/calendar/engine.server.ts` (propagação → activity)
- `src/components/activity-timeline.tsx` (fallback de leitura)
- Migration/insert de backfill único das activities existentes
