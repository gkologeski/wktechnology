## Diagnóstico

Deal `f6c61100…` (NEXID) exibe 2 eventos com gravação:

| Meet code | Data | Drive file | Tentativas |
|---|---|---|---|
| `fwd-kvmw-mmj` | 08/07 16:00 | `1d9LIv-…` | 13 |
| `jyd-jhce-jut` | 09/07 14:00 | `17i6r9n_…` | 13 |

`recording_attempts = 13` em ambos indica que a estratégia estrita ("nome contém o código do Meet") falhou repetidas vezes e o match final veio de um fallback mais permissivo. O engine em `src/lib/calendar/engine.server.ts` ainda tem 3 fallbacks depois do meet-code:

1. **dual-signal** — arquivo do organizador + 1 token do título.
2. **permissivo** — nome contém ≥2 tokens do título (independe de dono).
3. **organizador (fallback amplo)** — qualquer vídeo do organizador na janela de tempo.

Como o título é genérico (`WK Technology <> NEXID LTDA`), qualquer gravação de outra reunião do Guilherme na janela que contenha "wk" + "technology" no nome (padrão default do Meet) é aceita. Foi exatamente esse padrão que gerou os cross-links já corrigidos no deal do Samuel e do Janderson — a solução anterior tratou casos pontuais mas manteve os fallbacks vivos.

## Correção

### 1. Endurecer o matcher (`src/lib/calendar/engine.server.ts`)

- Remover as estratégias **dual-signal** e **permissivo (título ≥2 tokens)** do filtro em cascata.
- Remover o **fallback amplo por organizador** (fase 2).
- Manter apenas: buscar candidatos por `name contains <conference_id>` e aceitar somente arquivos cujo nome contenha o `conference_id` (regex `meetCodeRe`). Sem código do Meet no nome ⇒ não há match — grava `recording_status = 'not_found'` e mantém o evento sem gravação. Isso alinha o comportamento com a decisão já tomada em conversas anteriores ("não usar janelas de horário como chave, use código ou título" — na prática, só código).
- Reduzir a janela de `createdTime` para `[start − 15min, start + 6h]`, suficiente pra Meet publicar e evita colidir com reuniões próximas.

### 2. Rastreabilidade

- Ao vincular gravação, gravar `recording_matched_by = 'meet-code'` (novo campo em `calendar_events`) para termos auditoria futura. Qualquer registro histórico com `recording_matched_by IS NULL` fica marcado como "legado, revisar".

### 3. Backfill / limpeza

- Migration + script único que zera `recording_url`, `recording_drive_file_id`, `recording_mime_type`, `recording_synced_at`, define `recording_status = 'pending'` e `recording_attempts = 0` em todos os `calendar_events` onde o nome do arquivo do Drive **não** contém o `conference_id`. Como não temos o nome do arquivo salvo, o critério prático será: `recording_attempts >= 3 AND recording_status = 'available' AND recording_matched_by IS NULL` — assume-se legado incerto. Depois, o próximo tick do cron tenta novamente com o matcher estrito; se o arquivo real do Meet estiver no Drive ele será encontrado, senão fica sem gravação (comportamento correto).
- Corrigir manualmente os 2 eventos NEXID (`a3197b39…`, `44f7cb9e…`) no mesmo migration.
- Propagar a limpeza para `activities` via helper `propagateRecordingToActivity` (mesmo caminho já existente).

### 4. Prevenção de regressão

- Teste unitário em `src/lib/calendar/__tests__/engine.matcher.test.ts` cobrindo: (a) arquivo com meet-code correto casa; (b) arquivo sem meet-code nunca casa, mesmo com título idêntico e organizador correto; (c) arquivo com outro meet-code nunca casa.
- Comentário `// DO NOT reintroduce dual-signal/permissive fallback — cross-links (ver deals NEXID, Samuel, Janderson)` acima da função `findRecordingForEvent`.
- Atualizar `mem://security-memory` não se aplica; criar `mem://calendar/recording-matcher` documentando a regra "somente meet-code, sem fallback".

## Fora do escopo

- Reunião do meet-code = null (agendas sem Meet): continuam sem gravação automática, como hoje.
- UI da timeline: sem alterações; a mudança é 100% server-side + backfill.
