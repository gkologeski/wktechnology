# TechHire ATS — Plataforma Base (Fase 0)

Fundação transversal para as Ondas 5–8 do roadmap. Tudo aqui é
infraestrutura: nenhuma funcionalidade de usuário final é entregue na
Fase 0 — ela apenas habilita as próximas ondas serem feitas com
velocidade, segurança e consistência.

## 1. Feature Flags

Tabela `public.feature_flags` (workspace-scoped) com `key`, `enabled`,
`rollout_percentage`, `description`, `metadata`. RLS: owner-only.

API:

- `listFeatureFlags()` / `getFeatureFlag({ key })`
- `upsertFeatureFlag({ key, enabled, rollout_percentage, description?, metadata? })`
- `deleteFeatureFlag({ key })`

Cliente:

```tsx
import { useFeatureFlag } from "@/lib/use-feature-flag";

const { enabled, loading } = useFeatureFlag("ats.sourcing.multi_posting");
if (loading) return <Skeleton />;
if (!enabled) return null;
```

Rollout gradual: hash determinístico sobre `user.id` → bucket 0–99
comparado a `rollout_percentage`. Mesmo usuário recebe a mesma decisão
entre sessões.

Convenção de chaves: `ats.<área>.<feature>`
(`ats.sourcing.multi_posting`, `ats.scheduling.round_robin`,
`ats.compliance.lgpd_dsar`, `ats.ai.copilot`, …).

## 2. Adapter Pattern para integrações externas

Contratos em `src/lib/ats/adapters/types.ts`:

- `JobBoardAdapter` — postJob / updateJob / closeJob / pullCandidates
- `AssessmentAdapter` — invite / fetchResult
- `BackgroundCheckAdapter` — start / fetchResult
- `HrisAdapter` — handoffHire

Descritores e categorias em `src/lib/ats/adapters/registry.ts` (já lista
LinkedIn, Indeed, Vagas.com, HackerRank, Codility, Checkr, BambooHR
como `comingSoon` com feature flags associadas).

Regras obrigatórias para qualquer adapter futuro:

1. Implementação real fica em `src/lib/ats/adapters/<slug>/<area>.server.ts`.
2. Import sempre **lazy** (`await import(...)`) dentro do server-fn que usa.
3. Sem segredos no código: credenciais via `integrations.credentials_secret_ref`.
4. Retorno sempre `AdapterResult<T>` (nunca lança para o caller — devolve `ok: false, error`).
5. Auditoria: todo efeito externo (post, invite, start) chama `recordAtsEvent`.
6. Custo: quando consome créditos, devolver `credits_used` para o `core.functions.ts` registrar no `credit_ledger`.

## 3. Eventos de domínio padronizados

Helper `recordAtsEvent` em `src/lib/ats/audit.server.ts` envolve o bus
existente (`emitEvent` → `domain_events`). Convenção:
`ats.<área>.<verbo_passado>`.

Catálogo inicial (a ser expandido por onda): `ats.job.posted`,
`ats.candidate.sourced`, `ats.assessment.completed`,
`ats.background_check.completed`, `ats.interview.scheduled`,
`ats.offer.signed`, `ats.candidate.hired`, `ats.dsar.requested`,
`ats.consent.revoked`, `ats.quality_of_hire.recorded`.

Use SEMPRE no servidor (server functions / server routes). Os workflows
v2 e relatórios de funil consomem `domain_events`.

## 4. Sequenciamento das Ondas

Ordem recomendada por ROI × risco:

1. **Fase 0** (esta) — feature flags, adapter contracts, eventos. ✅
2. **Onda 7.5** — API pública + webhooks (`/api/public/v1/ats/*`).
3. **Onda 7.3/7.4** — LGPD/Compliance + vagas confidenciais.
4. **Onda 5.3/5.5** — Talent CRM + Referrals.
5. **Onda 6.2/7.1/7.2** — Knockout + cadeias de aprovação.
6. **Onda 8.3/8.2** — Custom reports + quality-of-hire.
7. **Integrações externas reais** — LinkedIn / Indeed / HackerRank /
   Checkr / BambooHR usando os adapters da Fase 0.

Cada onda deve, antes de mergear:

- registrar/atualizar sua flag em `feature_flags` (rollout 0 → 10 → 100);
- emitir os eventos novos via `recordAtsEvent` (e documentá-los aqui);
- atualizar `docs/ats-design-system.md` se introduzir novo componente.
