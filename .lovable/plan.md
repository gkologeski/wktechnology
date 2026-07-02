## Objetivo

Após uma vaga ser publicada no LinkedIn via TechHire, sincronizar automaticamente (de hora em hora) os candidatos que se aplicaram, criando-os na aba **Candidatos** da vaga, e permitir agendar entrevistas para eles diretamente pela aba **Entrevistas**.

## Escopo

1. Sync automático de aplicantes LinkedIn → `ats_applications` da vaga.
2. Ação "Agendar entrevista" na aba Entrevistas (`/jobs/:id`).

Fora do escopo: mudanças em RLS, publicação de vagas, hunting, sequences.

---

## 1. Sync horário de aplicantes LinkedIn

### 1.1 Adapter (backend, servidor)
- Adicionar método `listApplicants(ctx, { externalId, since })` ao `JobBoardAdapter` (`src/lib/ats/adapters/types.ts`).
- Implementar em `src/lib/ats/adapters/linkedin/job-board.ts` chamando Unipile `GET /api/v1/linkedin/jobs/{external_id}/applicants` (paginado por cursor). Retorna: `provider_applicant_id`, `full_name`, `headline`, `linkedin_url`, `profile_public_id`, `applied_at`, `email?`, `phone?`, `resume_url?`.
- Adicionar wrapper no `src/lib/unipile/client.server.ts`: `listLinkedinJobApplicants(accountId, jobExternalId, cursor?)`.
- Se workspace não tem conta Unipile conectada → retorna `{ ok: false, reason: "no_account" }` (não quebra cron).

### 1.2 Schema (migration)
- `ats_applications`: adicionar `provider` (text), `provider_applicant_id` (text), unique `(job_id, provider, provider_applicant_id)`.
- `ats_job_postings`: adicionar `last_applicants_sync_at` (timestamptz), `applicants_sync_cursor` (text), `applicants_synced_count` (int default 0).

### 1.3 Server function de sync
- Criar `src/lib/ats/linkedin-applicants-sync.server.ts` com `syncPostingApplicants(postingId)`:
  1. Carrega `ats_job_postings` + `ats_jobs` (owner_id, external_id, provider='linkedin', status='posted').
  2. Chama adapter `listApplicants` com cursor incremental.
  3. Para cada aplicante:
     - Dedupe candidato via `linkedin_url` no `ats_candidates` (mesmo padrão do hunting). Se não existir, cria com `source='linkedin_apply'`.
     - Upsert `ats_applications` por `(job_id, provider, provider_applicant_id)`. Se novo → stage inicial do pipeline da vaga, dispara `domain_events` `ats.application.received`.
  4. Atualiza `last_applicants_sync_at`, cursor e `applicants_synced_count`.
- Erros por posting isolados (try/catch) para não afetar demais postings.

### 1.4 Cron hook
- Criar `src/routes/api/public/hooks/linkedin-applicants-sync.ts` (padrão `/api/public/hooks/*` com verificação `apikey`).
- Busca postings ativos: `provider='linkedin'`, `status='posted'`, `is_mock=false`, `last_applicants_sync_at IS NULL OR < now() - interval '55 minutes'`, limite 100 por execução.
- Chama `syncPostingApplicants` sequencial (respeitando rate limit Unipile).
- Agendar `pg_cron` `linkedin-applicants-sync-hourly` a cada hora chamando a URL estável do projeto.

### 1.5 UX na vaga
- Em `src/components/ats/job-postings-panel.tsx`: mostrar chip "Última sync de aplicantes: há Xm" + botão "Sincronizar agora" (chama a mesma função server pontualmente).
- Aba **Candidatos** já lista `ats_applications` → aplicantes novos aparecem automaticamente com badge de origem `LinkedIn`.

---

## 2. Agendar entrevista na aba Entrevistas

Hoje `interviewsSection` (linhas 543–570 de `jobs.$id.tsx`) é read-only. Precisa de ação de criação restrita aos candidatos aplicados na vaga.

### 2.1 UI
- Adicionar botão primário "Agendar entrevista" no header da aba Entrevistas.
- Reaproveitar `ScheduleInterviewDialog` (já existente em `src/components/ats/`). Passar `jobId` fixo e `candidateOptions` = lista de `ats_applications` da vaga (ativas, não hired/rejected).
- Ao concluir → invalida `listJobInterviews` e refetch.

### 2.2 Server function
- Se `ScheduleInterviewDialog` já usa `createInterview({ jobId, candidateId, ... })`, apenas garantir que aceita `jobId` pré-preenchido; caso contrário, adicionar variante `createJobInterview` reutilizando a mesma pipeline (kit, painel, calendário).

### 2.3 Fallback
- Se a vaga não tem candidatos aplicados → botão desabilitado com tooltip "Adicione ou sincronize candidatos primeiro".

---

## Arquivos previstos

**Novos**
- `src/lib/ats/linkedin-applicants-sync.server.ts`
- `src/routes/api/public/hooks/linkedin-applicants-sync.ts`
- migration `add_linkedin_applicants_sync`

**Alterados**
- `src/lib/ats/adapters/types.ts` (+ `listApplicants`)
- `src/lib/ats/adapters/linkedin/job-board.ts`
- `src/lib/unipile/client.server.ts`
- `src/components/ats/job-postings-panel.tsx`
- `src/routes/_authenticated/(ats)/jobs.$id.tsx` (botão agendar)
- `src/components/ats/schedule-interview-dialog.tsx` (se preciso aceitar `jobId` fixo)

---

## Riscos / pendências

- Endpoint exato de aplicantes na Unipile precisa confirmação (assumindo `GET /linkedin/jobs/{id}/applicants`; se indisponível, adapter fica `no_account`-like e logamos aviso, sem quebrar).
- Rate limit Unipile: cron sequencial + cursor mitigam.
- Deduplicação de candidato: por `linkedin_url` (fallback `email`), padrão já usado no hunting.

## Validação manual

1. Publicar vaga LinkedIn real → esperar ≤ 1h ou clicar "Sincronizar agora".
2. Ver candidatos aplicados aparecerem na aba Candidatos com origem `LinkedIn`.
3. Na aba Entrevistas, clicar "Agendar entrevista", selecionar um aplicante, confirmar e ver a entrevista listada.