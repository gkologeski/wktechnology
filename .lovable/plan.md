
# Fase 2 — Entrevistas e Ofertas

Cinco entregas grandes. Vou propor a sequência em **3 ondas** para entregar valor incremental sem travar tudo em uma migration gigante.

---

## 🌊 Onda A — Agendamento nativo de entrevistas (item 7)

A base do ciclo. Tudo depende disso.

**Banco** (`supabase--migration`):
- Tabela `ats_interviews` com `application_id`, `job_id`, `interviewer_id`, `scheduled_at`, `duration_min`, `kind` (phone/video/onsite/async), `status` (scheduled/done/no_show/canceled/rescheduled), `meet_url`, `notes`, `owner_id`.
- Tabela `ats_interview_slots` (slots ofertados antes do candidato escolher) ou reaproveitar `bookings`.
- RLS via `can_access_ats_job(job_id)` + grants.
- Trigger `updated_at`.

**Backend** (`src/lib/ats/interviews.functions.ts`):
- `listInterviews(application_id)` / `listMyUpcomingInterviews()`
- `scheduleInterview({application_id, interviewer_id, scheduled_at, duration_min, kind})`
- `rescheduleInterview(id, new_at)` / `cancelInterview(id, reason)` / `markInterviewDone(id)`
- `createInterviewBookingLink(application_id)` → gera token público
- Eventos: `interview_scheduled`, `interview_rescheduled`, `interview_canceled`, `interview_completed` em `ats_application_events`.

**Public route** (reusa `/book/$slug` ou cria `/interview/$token`):
- Candidato vê slots, escolhe, recebe e-mail com `.ics` + link Meet.

**UI**:
- Aba "Entrevistas" no `scorecard-eval-dialog` (timeline + botão "Agendar").
- Dialog `schedule-interview-dialog` com seletor de entrevistador, data/hora, duração, kind.
- Botão "Enviar link de auto-agendamento" no card do candidato.

**Cron** (`/api/public/hooks/ats-interview-reminders-tick.ts`):
- Lembrete D-1 e 1h antes via Resend (workspace branded).

---

## 🌊 Onda B — Interview Kits + Vídeo assíncrono (itens 8 e 9)

**Item 8 — Interview Kits**:
- Tabela `ats_interview_kits` (`pipeline_id`, `stage_id`, `questions jsonb`).
- UI no editor de pipeline (`/pipelines`): aba "Kit de entrevista" por stage.
- No `scorecard-eval-dialog`, ao avaliar uma entrevista do stage X, exibir perguntas do kit acima do scorecard.

**Item 9 — Vídeo assíncrono**:
- Tabela `ats_async_video_responses` (`application_id`, `question_idx`, `storage_path`, `duration_s`).
- Bucket Supabase Storage `ats-async-videos` (privado, RLS).
- Quando `kind='async'`, candidato recebe link público `/interview-async/$token` → grava respostas com MediaRecorder API (reusa `use-screen-recorder.ts`) → upload direto pro Storage.
- Recrutador vê playlist no `scorecard-eval-dialog`.

---

## 🌊 Onda C — Ofertas + Parsing PDF server-side (itens 10 e 11)

**Item 10 — Módulo de Ofertas**:
- Tabela `ats_offers` (`application_id`, `salary`, `currency`, `benefits jsonb`, `start_date`, `status` draft/sent/accepted/rejected/expired, `signed_document_id` FK pra `esign_documents`, `expires_at`).
- Server fns: `createOffer`, `sendOffer` (gera PDF + cria `esign_documents` + envia via `/sign/$token` existente), `markOfferStatus`.
- UI: aba "Oferta" no candidato; quando aceita → muda stage automaticamente pra "Contratado".
- Evento `offer_sent`, `offer_accepted`, `offer_rejected`.

**Item 11 — Parsing PDF server-side**:
- Mover lógica de `cv-parse.functions.ts` pra rodar no Worker.
- Tentar `unpdf` ou `pdfjs-dist` (Worker-compatible). Se PDF for imagem, fallback Gemini Vision via Lovable AI Gateway.
- Endpoint `parseCvServer({storage_path})` chamado direto do upload.

---

## 📋 Sequência sugerida

1. **Agora**: Onda A completa (migration + backend + UI básica do agendamento + self-scheduling público).
2. Em seguida: Onda B (kits + vídeo).
3. Por fim: Onda C (ofertas + parsing server-side).

Cada onda termina com `.lovable/plan.md` atualizado.

---

## ❓ Pergunta antes de começar

**Onda A** envolve criar tabela + 6 server functions + 2 dialogs + cron + e-mail template. É a maior das três. Confirmo o caminho ou prefere quebrar em sub-passos (ex: só agendamento manual por recrutador agora, deixar self-scheduling pra depois)?
