# Onda 5 — Slice 2: Sourcing Ativo & Talent CRM

Transforma o TechHire de "espera candidatura" para "busca proativa + cultivo de relacionamento + indicações internas". Não altera RLS existente, autenticação, integrações ativas nem regras de negócio das ondas anteriores. Tudo novo é aditivo e protegido por feature flag.

---

## Fase 1 — Talent CRM (núcleo)

### Banco (migration única)

- `ats_talent_pools` — pools de candidatos: `id`, `owner_id`, `name`, `description`, `type` (`static` | `smart`), `filters` (jsonb, smart lists), `color`, timestamps. RLS owner-scoped + team via padrão existente. GRANTs padrão.
- `ats_talent_pool_members` — N:N candidato↔pool: `pool_id`, `candidate_id`, `added_by`, `added_at`, `source` (`manual` | `auto` | `referral` | `silver_medalist`). RLS herdada do pool.
- Em `ats_candidates`: adicionar colunas (não destrutivo) `relationship_status` (`cold|engaged|nurturing|do_not_contact`, default `cold`), `last_touch_at`, `next_action_at`, `relationship_owner_id`. Defaults seguros, sem reescrever dados.
- Trigger: ao mudar `ats_applications.stage` para "rejeitado em finalista", inserir automaticamente no pool sistema `Silver Medalists` (criado por workspace on-demand).
- Eventos: `ats.candidate.added_to_pool`, `ats.candidate.relationship_changed`, `ats.candidate.silver_medalist` via `recordAtsEvent`.

### Server functions (`src/lib/ats/talent-crm.functions.ts`)

- `listPools()`, `createPool()`, `updatePool()`, `deletePool()`
- `addToPool({ poolId, candidateIds })`, `removeFromPool()`
- `listPoolMembers({ poolId, filters })` — para smart pools, resolve filtros via SQL parametrizada (skills, score mínimo, último contato, estágio de saída).
- `updateRelationshipStatus({ candidateId, status, ownerId? })`

### UI

- `/sourcing/pools` — lista (cards) com badge de tipo, contagem, ação rápida "Adicionar candidatos".
- `/sourcing/pools/$id` — detalhe com `DataTable` de membros, `FilterBar` (smart), botão "Iniciar sequência" e "Mover de status".
- No detalhe do candidato: nova seção `RelationshipPanel` (status + owner + último toque + próxima ação + pools).

Tudo usando componentes Quiet Premium oficiais (`AtsPageHeader`, `MetricCard`, `StatusBadge`, `EmptyState`, `LoadingSkeleton`).

---

## Fase 2 — Sourcing Sequences (cadências multi-canal)

### Banco

- `ats_sourcing_sequences` — `id`, `owner_id`, `name`, `description`, `pool_id` (opcional, default audience), `enabled`, timestamps.
- `ats_sourcing_sequence_steps` — `sequence_id`, `step_order`, `channel` (`email|whatsapp|linkedin_task`), `delay_days`, `template_id` (FK email/wa template), `subject`, `body`, `task_instructions`.
- `ats_sourcing_enrollments` — `sequence_id`, `candidate_id`, `status` (`active|paused|replied|completed|stopped`), `current_step`, `next_run_at`, `started_by`, timestamps. Unique `(sequence_id, candidate_id)`.
- `ats_sourcing_step_log` — execução por step: canal, status, error, sent_at, opened_at, replied_at.
- Eventos: `ats.sequence.started`, `ats.sequence.step_sent`, `ats.sequence.replied`, `ats.sequence.stopped`.

### Execução (sem novas credenciais)

- Cron `pg_cron` a cada 5 min chama `/api/public/hooks/sourcing-tick` (auth via `apikey` anon).
- Tick processa `next_run_at <= now()` em lotes:
  - `email` → enfileira via `enqueue_email` (infra existente).
  - `whatsapp` → cria mensagem outbound usando integração WhatsApp já ativa do workspace (se ausente, marca step como `skipped_no_channel`).
  - `linkedin_task` → cria `activities` tipo `task` atribuída ao owner com `task_instructions` (sem API LinkedIn — recruiter executa manualmente). Quando a task é concluída, avança o step.
- Pausa automática: reply detectado em email/WA → enrollment vai para `replied` e `recordAtsEvent('ats.sequence.replied')`.

### UI

- `/sourcing/sequences` — lista com métricas resumo (open/reply/interview rate).
- `/sourcing/sequences/$id` — editor de steps drag-and-drop (reusa `Pipeline Editor` patterns), preview por canal, lista de enrollments com filtros.
- No candidato/pool: botão "Iniciar sequência" → modal de seleção.

---

## Fase 3 — Sourcing Inbox

Tela `/sourcing` — dashboard diário do recruiter, sem novas tabelas.

- `MetricCard`s: A contatar hoje, Aguardando resposta, Silver medalists novos, Indicações pendentes.
- Tabs: **Hoje** (tasks de sequence vencidas hoje + LinkedIn tasks), **Aguardando reply** (enrollments `active` sem resposta há 3+ dias), **Re-engagement** (silver medalists elegíveis para vagas abertas via match score), **Sem owner**.
- Cada linha: ação rápida "Marcar enviado", "Pausar", "Pular step", "Abrir candidato".

---

## Fase 4 — Referrals (indicações com bônus)

### Banco

- `ats_referral_programs` — `id`, `owner_id`, `name`, `enabled`, `default_bonus_cents`, `currency` (default `BRL`), `eligibility_rules` (jsonb: ex. "contratado deve permanecer 90 dias"), `terms_url`, timestamps.
- `ats_referrals` — `id`, `program_id`, `referrer_user_id` (colaborador), `candidate_id` (criado se ainda não existir), `job_id` (opcional), `status` (`submitted|under_review|accepted|interviewing|hired|rejected|paid|expired`), `submitted_at`, `decided_at`, `hired_at`, `bonus_cents`, `bonus_status` (`pending|eligible|approved|paid|forfeited`), `bonus_paid_at`, `notes`. RLS: referrer vê o próprio + admins workspace veem tudo.
- Eventos: `ats.referral.submitted`, `ats.referral.accepted`, `ats.referral.hired`, `ats.referral.bonus_paid`.
- Trigger: quando `ats_applications.stage` muda para `hired` e há `ats_referrals` ligada (via candidate_id), marca `status='hired'`, `hired_at=now()`, `bonus_status='eligible'`.

### UI

- `/refer` — página interna para colaboradores (qualquer membro workspace), formulário: vaga, dados do candidato, upload CV opcional, relação com o candidato, observações. Submissão cria `ats_referrals` + `ats_candidates` (se novo).
- `/refer/me` — minhas indicações com status e bônus.
- `/sourcing/referrals` (admin/recruiter) — fila de aprovação, botões `Aceitar/Rejeitar`, painel de bônus elegíveis com workflow `Aprovar pagamento` → `Marcar como pago`. Sem integração financeira automática — apenas tracking lógico do ciclo (status + data + valor).

---

## Fase 5 — Feature flags, observabilidade e docs

- Registrar via `upsertFeatureFlag` (rollout 0):
  - `ats.sourcing.talent_crm`
  - `ats.sourcing.sequences`
  - `ats.sourcing.referrals`
- `useFeatureFlag` guarda todas as rotas novas; itens de menu só aparecem quando habilitados.
- Atualizar `docs/ats-platform-foundation.md` com catálogo de eventos novos.
- Atualizar `docs/techhire-design-system.md` se introduzirmos `RelationshipPanel` como componente oficial.
- Documento novo `docs/ats-sourcing-slice2.md` resumindo fluxos, RLS e como ativar flags.

---

## Fora de escopo (próximo slice)

- Chrome Extension de sourcing (Slice 3).
- Enrichment via Clearbit/Apollo (depende de credenciais — standby).
- AI Sourcing Copilot (boolean query, sugestão de perfis) — Onda 8.
- Integração real LinkedIn Recruiter/InMail — standby.

---

## Riscos e mitigações

- **Volume de tasks LinkedIn manuais**: limitar default por recruiter/dia (cap configurável); UI mostra "tasks vencidas hoje" priorizadas.
- **Compliance WhatsApp outreach**: enviar somente quando candidato deu opt-in (campo já existe em `contact_subscriptions`); checar antes do enqueue, marcar `skipped_no_consent` caso contrário.
- **Smart pools custosos**: filtros SQL parametrizados com `LIMIT` server-side; refresh on-demand, não em loop.
- **Bônus financeiro**: sistema só rastreia status, não move dinheiro — texto explícito na UI: "marque como pago após processar fora do sistema".

---

## Detalhes técnicos

- Migrations: 4 (uma por fase 1, 2, 4, mais ajuste de seed de `feature_flags`). Cada `CREATE TABLE public.*` segue GRANT → ENABLE RLS → CREATE POLICY.
- Server functions em `src/lib/ats/talent-crm.functions.ts`, `src/lib/ats/sourcing-sequences.functions.ts`, `src/lib/ats/referrals.functions.ts`. Server route único `/api/public/hooks/sourcing-tick.ts` autenticado por `apikey` anon.
- Cron: `cron.schedule('sourcing-tick','*/5 * * * *', net.http_post(...))`.
- Reuso: `recordAtsEvent`, `enqueue_email`, integração WhatsApp existente, `activities` para tasks, `Pipeline Editor` patterns para o editor de steps.
- Sem novas dependências npm.

```text
/sourcing
├── /                  Inbox (Hoje, Aguardando, Re-engagement, Sem owner)
├── /pools             Lista de Talent Pools
│   └── /$id           Detalhe + ações
├── /sequences         Lista de Sequences
│   └── /$id           Editor de steps + enrollments
└── /referrals         Aprovação + bônus (admin)
/refer                 Página de colaborador
/refer/me              Minhas indicações
```

## Validação manual

1. Ativar flag `ats.sourcing.talent_crm` (rollout 100) → criar pool, adicionar candidatos, ver no painel do candidato.
2. Ativar `ats.sourcing.sequences` → criar sequência 3 steps (email→wait→linkedin task), enrollar candidato, esperar tick, conferir log.
3. Mover candidato finalista para "rejeitado" → conferir entrada automática em Silver Medalists.
4. Ativar `ats.sourcing.referrals` → submeter indicação como colaborador, aprovar como admin, marcar como contratado via app fluxo normal → ver bônus elegível → marcar pago.
5. Confirmar light/dark, responsividade desktop/tablet/mobile, loading/empty/error states em todas as telas novas.
