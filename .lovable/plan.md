## Contexto

A Onda 5 do roadmap já está parcialmente entregue (Slice 1 multi-posting com adapters mock, Slice 2 Talent CRM/pools/sequences/inbox, Hunter v0.3, programa de referrals básico). Faltam quatro frentes: **5.3 Referrals 2.0** (portal público + gamificação), **5.4 Multi-posting (operação)**, **5.5 Talent CRM avançado** (silver medalist + nurture automation), **5.6 Hunter v0.4** (bulk + enriquecimento IA).

Restrição honesta: integração real LinkedIn/Indeed/Vagas.com depende de credenciais que **não temos** (App OAuth, contratos RSC/ATS partners). Os adapters permanecem em modo mock — o que entrego no Slice 5.4 é **operação e UX em torno do mock**, deixando o caminho pronto para credenciais futuras. Sinalizo isso claramente na UI.

## Escopo (uma fase única, sem parar no meio)

### Slice 5.3 — Referrals 2.0
- **Migration**: adicionar `public_slug` (text unique), `landing_headline`, `landing_body`, `enable_public_form` em `ats_referral_programs`. Adicionar `referrer_name`/`referrer_email`/`referrer_user_id` opcional em `ats_referrals` (já existe `referrer_user_id`; permitir nulo + tracking de externo). GRANTs + RLS para `SELECT TO anon` apenas dos campos públicos do programa (`name, landing_headline, landing_body, terms_url`) via view `ats_referral_programs_public`.
- **Server route público**: `src/routes/api/public/refer/$slug.ts` (GET retorna view pública) e `src/routes/api/public/refer/$slug.submit.ts` (POST grava referral com `referrer_user_id=null`). Validação Zod, rate limit best-effort por IP (`ip_access_log`).
- **Página pública** `src/routes/refer.$slug.tsx`: Quiet Premium, branding workspace, form simples.
- **Leaderboard** `src/lib/ats/referrals-leaderboard.functions.ts`: top indicadores por programa (count + hired count) com agregação SQL.
- **UI admin** em `/sourcing/referrals`: nova aba "Programas" para editar slug/headline/body + copiar link público; nova aba "Leaderboard"; filtro "Pagamentos pendentes" (status=hired AND bonus_status in (pending,eligible,approved)). Usar `AtsPageHeader`, `MetricCard`, `EmptyState`.

### Slice 5.4 — Multi-posting (operação)
- **Painel** `src/routes/_authenticated/(ats)/sourcing/multi-posting.tsx`: dashboard por provider (postagens ativas, mocks, falhas, última sync), lista por job com ação republicar/despublicar. Consumir `listJobPostings` agregado novo (`listAllJobPostings`).
- **Server fn nova** `listAllJobPostings` em `job-postings.functions.ts`: lista paginada filtrável por provider/status com join leve em `ats_jobs(title, status)`.
- **Banner de credenciais**: componente `JobBoardCredentialsBanner` que mostra para cada provider: status (live/mock), env vars esperadas, link para `/settings/integrations`. Nada de pedir secret aqui — apenas instruir.
- **Re-emitir mocks com tag visível**: aprimorar `MockBadge` em postings.

### Slice 5.5 — Talent CRM avançado
- **Silver Medalist automático**: trigger SQL `on ats_applications` quando `status` muda para `rejected` e `stage_value in ('interview','onsite','offer')` → função `public.ensure_silver_medalist_pool(owner_id)` cria/recupera pool `system_key='silver_medalists'` e insere em `ats_talent_pool_members` com `source='silver_medalist'`. Idempotente. Emite `ats.candidate.silver_medalist`.
- **Nurture re-engage**: server fn `enqueueReEngageNurture` em `talent-crm.functions.ts` para enrolar membros de um pool em uma sequence existente (chama `sourcing-sequences.enrollCandidate` em loop com cap 200). Botão na página do pool: "Enviar para nurture".
- **Cron sourcing-tick já existe**: confirmar que executa step log; nada novo no cron.

### Slice 5.6 — Hunter v0.4
- **Bulk capture**: servidor `POST /api/public/hunting/bulk-capture` aceitando array (máx 50) → grava em `ats_hunting_captures` + cria/dedup candidates por `linkedin_url`/email. Resposta com `{ created, deduped, errors }`.
- **Enriquecimento IA**: `src/lib/ats/hunting-enrich.functions.ts` server fn `enrichCapture({ capture_id })` que chama Lovable AI Gateway (Gemini 2.5 Flash) com a raw_html/text do capture para extrair `skills[]`, `seniority`, `headline_normalizado`. Atualiza candidate. Registra `credits_used` no `credit_ledger`.
- **Botão UI** em `/hunting/captures`: "Enriquecer com IA" por linha + bulk select. Loading skeleton, toast.
- **Extension**: nota no `extension/README.md` que a v0.4 endpoint de bulk existe; bump versão não é necessário (cliente envia 1 por vez ainda).

## Não-escopo (explícito)
- Não implementar OAuth real LinkedIn/Indeed/Vagas.com (depende de App + contratos).
- Não tocar RLS de tabelas fora das adicionadas.
- Não redesenhar telas existentes além das novas/áreas tocadas.
- Não mexer em schema de `ats_candidates` além dos campos já existentes (`relationship_status`, `next_action_at`, `last_touch_at`).
- Sem novas dependências npm.

## Detalhes técnicos

### Migrations (3 arquivos)
1. `ats_referral_programs`: ADD `public_slug`, `landing_headline`, `landing_body`, `enable_public_form`. Unique index parcial em `public_slug WHERE public_slug IS NOT NULL`. Função `generate_referral_slug()` para slug curto. View `ats_referral_programs_public` (SECURITY INVOKER) + GRANT SELECT TO anon.
2. `ats_referrals`: ADD `referrer_name`, `referrer_email`, `source` ('internal'|'public_form'). Relaxar `referrer_user_id` para nullable se não estiver.
3. Trigger silver-medalist + função `ensure_silver_medalist_pool`.

### Server functions/routes novas
- `src/lib/ats/referrals-leaderboard.functions.ts`
- `src/lib/ats/hunting-enrich.functions.ts`
- `src/routes/api/public/refer/$slug.ts` (GET)
- `src/routes/api/public/refer/$slug.submit.ts` (POST)
- `src/routes/api/public/hunting/bulk-capture.ts` (POST)
- Funções adicionais em `talent-crm.functions.ts` (`enqueueReEngageNurture`) e `job-postings.functions.ts` (`listAllJobPostings`, `updateProgramSlug`).

### UI novas
- `src/routes/refer.$slug.tsx` (público)
- `src/routes/_authenticated/(ats)/sourcing/multi-posting.tsx`
- Refatorar `src/routes/_authenticated/(ats)/sourcing/referrals.tsx` em tabs (Indicações | Programas | Leaderboard | Pagamentos)
- `src/components/ats/job-board-credentials-banner.tsx`
- Botões de bulk e enrich em `src/routes/_authenticated/(ats)/hunting/captures.tsx`

### IA (5.6)
- Lovable AI Gateway, modelo `google/gemini-2.5-flash`. Prompt curto: extrair `skills` (array), `seniority` (junior|pleno|senior|staff|principal|null), `headline`. JSON estrito. Fallback seguro em falha.

### Sidebar
Adicionar entrada "Multi-posting" em ATS → Sourcing.

## Validação manual
1. `/sourcing/referrals` → aba Programas: criar programa, copiar link, abrir `/refer/<slug>` em janela anônima e submeter. Conferir aparece em Indicações.
2. Leaderboard com 2+ referrers mostra ordem correta.
3. Em uma vaga, publicar nos 3 providers; abrir `/sourcing/multi-posting`: contagens + flag mock visíveis.
4. Rejeitar um candidato no estágio "interview" → conferir pool "Silver Medalists" criado e candidate dentro.
5. `/hunting/captures` → selecionar 2 → "Enriquecer com IA" → skills/seniority aparecem.
6. `POST /api/public/hunting/bulk-capture` com 3 itens (curl) → retorno OK e candidates criados/dedupados.

## Riscos / Pendências
- Slug público sem captcha: rate-limit por IP só mitiga; usuário pode adicionar hCaptcha depois.
- Multi-posting permanece mock até credenciais reais — banner deixa claro.
- Custo IA do enrich é por capture (1 chamada Gemini Flash); medido no `credit_ledger`.