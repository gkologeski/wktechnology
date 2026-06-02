## Objetivo

Adicionar análise automática por IA aos chamados em `/admin/bug-reports`, gerando: resumo do problema, causa provável, arquivos/áreas do código suspeitos e uma proposta de correção — com opção de re-analisar sob demanda.

## Como funciona

1. **Trigger automático**: ao inserir um novo registro em `bug_reports` (via trigger no Postgres → `pg_net` → endpoint público), a IA é chamada uma vez automaticamente.
2. **Trigger manual**: botão "Analisar com IA" / "Reanalisar" em cada card no inbox admin.
3. **Transcrição opcional**: se o chamado tem gravação com áudio, transcrever via Lovable AI (Gemini multimodal aceita áudio) antes da análise — assim a IA "ouve" o que o usuário disse.
4. **Análise estruturada**: usar Lovable AI Gateway (`google/gemini-2.5-pro`) com tool-calling para retornar JSON tipado: `summary`, `severity`, `suspected_area`, `suspected_files[]`, `root_cause_hypothesis`, `proposed_fix`, `reproduction_steps[]`, `confidence`.
5. **Contexto enviado à IA**: descrição + categoria/subtipo + page_url + user_agent + transcrição (se houver) + uma lista enxuta de rotas/componentes do projeto (gerada em build) para guiar `suspected_files`.
6. **Exibição**: nova seção em cada card do inbox mostrando a análise, com badges (severidade, confiança) e bloco copiável "Prompt para o Lovable" pronto para colar — que abre o problema já formatado para você implementar a correção.

## Arquitetura técnica

```text
bug_reports INSERT
   │
   ▼ (trigger SQL → pg_net.http_post)
/api/public/hooks/bug-report-analyze  (valida CRON_SECRET)
   │
   ▼
analyzeBugReport() server fn
   ├─ baixa gravação (signed URL) → Gemini (áudio→texto) [se houver]
   ├─ monta prompt + contexto do projeto
   ├─ chama Lovable AI Gateway (tool-calling, JSON estruturado)
   └─ grava em bug_report_analyses (1:N por reanálises)
```

### Mudanças no schema

Nova tabela `bug_report_analyses`:
- `id`, `bug_report_id (fk)`, `created_at`
- `model`, `transcript` (text, nullable)
- `summary`, `severity` (low/medium/high/critical), `suspected_area`
- `suspected_files` (jsonb array), `root_cause`, `proposed_fix`
- `reproduction_steps` (jsonb), `confidence` (0–1)
- `lovable_prompt` (text, copiável)
- RLS: só platform admins leem; service_role escreve.

Trigger `AFTER INSERT ON bug_reports` → `pg_net.http_post` para o endpoint com `CRON_SECRET`.

### Server functions (TanStack)

- `src/lib/bug-report-analysis.functions.ts`
  - `analyzeBugReport({ id, force? })` — protegido por `requireSupabaseAuth` + `assertPlatformAdmin`; usado pelo botão manual.
  - `listAnalyses({ bugReportId })` — lista histórico.
- `src/lib/bug-report-analysis.server.ts` — helpers: transcrição, montagem de prompt, chamada ao Gateway, persistência.

### Endpoint público (webhook do trigger)

- `src/routes/api/public/hooks/bug-report-analyze.ts` — valida `Authorization: Bearer <CRON_SECRET>`, lê `bug_report_id` do body, chama o helper.

### UI

- `src/routes/_authenticated/admin.bug-reports.tsx`: por card, mostrar a análise mais recente (collapsible), badges, botão "Reanalisar", botão "Copiar prompt para o Lovable".

### Modelo e custo

- Texto: `google/gemini-3-flash-preview` por padrão (rápido/barato); upgrade para `gemini-2.5-pro` quando `severity=critical` ou houver transcrição longa.
- Áudio→texto: `google/gemini-2.5-pro` (multimodal).
- Reanálises ficam atrás do botão; trigger automático roda uma vez por chamado.

## Fora do escopo desta entrega

- Aplicar a correção sozinho no código (a IA só **propõe**; você cola o prompt aqui).
- Notificações por e-mail/Slack.
- Agrupamento automático de chamados duplicados (pode ser uma evolução).

Confirma que sigo por aí? Se quiser, posso já incluir também: (a) agrupamento de chamados similares por embeddings, (b) notificação no app quando uma análise “critical” chegar.