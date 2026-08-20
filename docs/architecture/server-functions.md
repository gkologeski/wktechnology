# Lógica de servidor: server functions, rotas de API e webhooks

## 1. Escolha da ferramenta

| Necessidade | Use |
| --- | --- |
| Ler/gravar dados do app a partir da UI | `createServerFn` em `src/lib/**/*.functions.ts` |
| Endpoint HTTP para terceiros (webhook, cron, API pública) | file route em `src/routes/api/public/**` |
| Lógica puramente de banco (derivar coluna, cascata) | função/trigger SQL |
| Trabalho privilegiado (Auth Admin, backfill) | `supabaseAdmin` importado **dentro** do handler |

**Nunca** criar `supabase/functions/<name>/index.ts` (Edge Functions).

## 2. Forma canônica

```ts
// src/lib/leads.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getLead = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("leads")
      .select("id, email, status, stage_id, assigned_to, workspace_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    return row;
  });
```

Contexto injetado por `requireSupabaseAuth`: `supabase` (agindo como o usuário,
RLS aplicada), `userId`, `claims`.

No cliente:

```tsx
const fetchLead = useServerFn(getLead);
const { data } = useQuery({ queryKey: ["lead", id], queryFn: () => fetchLead({ data: { id } }) });
```

## 3. Regras de arquivo (críticas)

- Módulo `*.functions.ts` é **casca fina**: apenas imports, tipos apagáveis e
  `export const x = createServerFn(...)`. Qualquer helper, constante ou gerador
  em escopo de módulo é removido pelo splitting → `ReferenceError` em runtime
  mesmo com typecheck verde. Mova para `*.server.ts` / `*.ts` auxiliar ou para
  dentro do handler.
- `*.server.ts` é server-only por nome de arquivo — jamais importe em
  componente. Componentes importam somente `*.functions.ts`.
- Nada de código server-only sob `src/server/` importado pelo cliente.
- Em `*.functions.ts` que rotas importam, carregue módulos server-only de forma
  lazy: `const { supabaseAdmin } = await import("@/integrations/supabase/client.server")`.
- Runtime é Worker (Cloudflare): sem `child_process`, `sharp`, `puppeteer`,
  `fs.watch`, `os.cpus()`. Prefira fetch, Web APIs e libs puras.

## 4. Autenticação de server functions

- `src/start.ts` registra `functionMiddleware` que anexa o bearer do Supabase
  em toda chamada. Não remover nem substituir; apenas acrescentar.
- Server fn **sem** `requireSupabaseAuth` é pública. Só use isso para leitura
  realmente pública (páginas de carreiras, KB pública, landing pages) e com
  política `TO anon` estreita.
- Server fn protegida **não** pode ser chamada em loader de rota pública
  (prerender sem sessão → 401 e build quebrado). Chame no componente.

## 5. Mapa de server functions por domínio

Arquivos em `src/lib/` (e subpastas). Nomes abaixo são os agrupamentos, não a
lista exaustiva de exports.

**Core / CRM** — `leads.functions.ts`, `contacts.functions.ts`,
`companies.functions.ts`, `deals.functions.ts`, `activities.functions.ts`,
`tasks.functions.ts`, `meetings.functions.ts`, `notes*`, `pipelines`,
`products`, `service-catalog`, `services`, `quotes`, `proposals`,
`subscriptions`, `custom-objects`, `custom-properties`, `saved-views`,
`segments`, `goals`, `dashboards`, `reports`, `analytics`, `search`,
`files`, `import*`, `export*`, `bulk*`.

**Prospecção** — `prospecting/*.functions.ts` (buscas, campanhas, cadências,
filas, questionários, qualificação, scoring, chamadas), `lead-score.ts`,
`icp*`, `enrichment*`.

**ATS** — `ats/ats.functions.ts`, `ats/candidate-detail.functions.ts`,
`ats/stages.ts`, além de módulos para entrevistas, scorecards, ofertas,
sourcing, hunting, talent pools, referrals, compliance, briefing, copilot,
match-score, fraude, DEI. Adapters externos em
`src/lib/ats/adapters/**` (contratos em `types.ts`, catálogo em `registry.ts`),
auditoria em `src/lib/ats/audit.server.ts` (`recordAtsEvent`).

**People** — `people/*.functions.ts`: pessoas, alocações, documentos,
benefícios, incidentes, onboarding/offboarding, avaliações, 1:1,
psicossocial, billing, margem de contrato, analytics, importação de formulários.

**Contracts** — `contracts.functions.ts` (inclui regras de aninhamento),
`contracts/title-match.ts`, modelos e tokens, presets, importação por IA
(.docx/.pdf), sugestão de vínculos, padronização de títulos em lote, e-sign.

**Service** — tickets, SLA, macros, KB, chat ao vivo, playbooks, pesquisas
(NPS/CSAT/vendas/livre), sentimento, `bug-reports` (chamados internos).

**Finance** — lançamentos, recorrências, pagamentos, conciliação bancária,
NFS-e, faturas, dunning, DRE, fluxo de caixa, entidades legais, auditoria.

**Projects** — projetos, espaços/pastas/listas, tarefas, checklists,
dependências, marcos, timesheet, entregas, templates de lista, campos
customizados.

**Plataforma** — `access-control/*`, `modules/*`, `workspace*`, `invites`,
`branding`, `feature-flags`, `integrations/*`, `workflows/*`,
`copilot.functions.ts`, `ai-agent/*`, `email*`, `whatsapp*`, `calendar*`,
`voice*`, `notifications`, `audit*`, `billing/*`, `mcp/*`.

## 6. Rotas HTTP

Sob `src/routes/api/`:

- `api/public/v1/**` — API pública versionada (ATS e CRM), autenticada por
  `api_keys`.
- `api/public/hooks/**` — webhooks e ticks de cron (workflows time-based,
  reschedule de cron, provedores externos).
- Integrações inbound: e-mail, WhatsApp/Unipile, Twilio/voz, Slack, pagamentos,
  e-sign, SCIM, widget de chat, formulários e landing pages públicas.

Modelo mínimo de handler seguro:

```ts
export const Route = createFileRoute("/api/public/hooks/example")({
  server: { handlers: { POST: async ({ request }) => {
    // 1) autenticar o chamador (HMAC, CRON_SECRET, api key)
    // 2) validar payload com zod
    // 3) executar; nunca retornar PII
    return new Response("ok");
  } } },
});
```

URLs estáveis para configuração externa:
`project--<id>.lovable.app` (produção) e `project--<id>-dev.lovable.app`
(preview).

## 7. Boas práticas de dados

- Projete colunas explicitamente; `select("*")` piora typecheck e vaza campos.
- Envolva leituras sujeitas a `schema cache`/timeout em `withTransientRetry`
  (`src/lib/db/transient-retry.ts`).
- Consulta pesada → índice dedicado (ex.: `activities_deal_pending_due_idx`).
- Estado durável mora no banco; não usar variáveis globais de módulo como
  cache/estado (workers são stateless).
- Efeitos auditáveis chamam `log_audit_event` / `recordAtsEvent` /
  `emitEvent`.
