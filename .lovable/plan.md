# Onda B — Interview Kits + Vídeo Assíncrono (concluída)

## Entregas

### Schema (migration aplicada)
- `ats_interview_kits` (owner, name, pipeline_id, stage_value, questions jsonb, is_default) + RLS.
- `ats_async_video_responses` (interview_id, question_id, storage_path, duration_sec, mime_type, size_bytes) + RLS.
- `ats_interviews`: novas colunas `interview_kit_id` (FK) e `async_questions_snapshot` (jsonb).
- Bucket privado `ats-async-videos` + políticas (owner full-access no próprio prefixo; anon insert/select via token de entrevista).

### Server functions
- `src/lib/ats/interview-kits.functions.ts`: list/get/save/delete + `resolveKitForStage`.
- `src/lib/ats/async-video.functions.ts`: `listAsyncVideoResponses` (com signed URL), `deleteAsyncVideoResponse`.
- `interviews.functions.ts`: `scheduleInterview` e `createSelfScheduleLink` aceitam `interview_kit_id` e congelam snapshot das perguntas.

### Rotas públicas
- `src/routes/api/public/interview/$token.ts`: GET retorna perguntas + respostas já enviadas; POST aceita multipart com `question_id + file` para upload de vídeo (valida token, kind=async, expira, tamanho ≤ 100MB).
- `src/routes/interview.$token.tsx`: detecta `kind=async`, renderiza `AsyncInterviewView` com gravador MediaRecorder por pergunta (start câmera → gravar com timer → review → upload). Suporta retomada (perguntas já enviadas aparecem como ✓).

### UI Admin
- `src/routes/_authenticated/(ats)/interview-kits.tsx`: CRUD visual de kits (nome, padrão, perguntas com tipo texto/vídeo e time_limit_sec).
- Menu ATS ganhou item "Kits de Entrevista" → `/interview-kits`.

### Integração no fluxo de recrutador
- `schedule-interview-dialog`: novo seletor "Kit de perguntas" carregado on-open; obrigatório em alerta para `async`; slots opcionais quando async (não há horário).
- `scorecard-eval-dialog`: para cada entrevista async, exibe `<AsyncVideoResponses>` (toggle "Ver vídeos") com player + duração baseado em signed URL de 5min.

## Validação
- `tsgo --noEmit`: OK
- Migration: OK (apenas warnings pré-existentes do linter Supabase)

## Próximo passo (Onda C)
- Item 10: `ats_offers` + envio com eSign + auto-promoção da etapa.
- Item 11: parser de CV server-side via `unpdf` ou Gemini Vision.
