# Fases 2, 3 e 4 — Entregas finais

## Fase 2 (concluída)
- **Self-scheduling**: `ats_interviews.self_schedule_token` + `offered_slots`. Server fns em `src/lib/ats/self-schedule.functions.ts` (createSelfScheduleLink, getSelfScheduleByToken, confirmSelfSchedule). Rota pública `/schedule/$token`.
- **Página pública de oferta**: `ats_offers.public_token` (gerado em `sendOffer`). Server fn `getOfferByToken`. Rota pública `/offer/$token` com leitura via política `TO anon`.

## Fase 3 (concluída)
- **AI Match Score**: tabela `ats_match_scores` (job × candidato, UNIQUE). `computeMatchScore` chama Gemini 2.5 Flash com JSON estruturado (score 0-100, summary, strengths, gaps). Página `/match-scores` lista e permite recalcular.
- **AI JD Generator**: `generateJobDescription` em `src/lib/ats/jd-generator.functions.ts` retorna `{description, requirements, benefits, tags}`.
- **Fraud detection**: tabela `ats_candidate_flags`. `scanCandidateFraud` detecta duplicados por email/telefone e heurística de "CV IA". Página `/fraud-flags` com botão de scan e resolução.

## Fase 4 (concluída)
- **DEI**: 4 colunas opcionais em `ats_candidates` (gender, race, disability, lgbtqia). `getDeiAnalytics` agrega contagens. Página `/dei-analytics`.
- **Webhooks**: reaproveita `outbound_webhooks` + `enqueueWebhookEvent` (eventos podem ser disparados pelas server fns existentes).
- Menu lateral ATS atualizado: grupos "Inteligência (IA)" e "DEI Analytics".

## Pendente intencional
- AI Notetaker (transcrição/sumário de entrevistas) — requer pipeline de áudio.
- Multiposting LinkedIn/Indeed/Gupy — exige credenciais de cada plataforma.
- Custom Reports builder ATS-específico.
- Admin público da página de carreiras (branding por workspace).
