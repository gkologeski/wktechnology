## Problema

A auditoria anterior focou nos dashboards principais (`/dashboard`, `/home`, `/ats`, relatórios) e reforçou o `MetricCard` compartilhado. Porém várias telas — incluindo **`/finance`** que o usuário está vendo agora — usam **componentes `Metric` locais** que replicam o padrão antigo (sem `min-w-0`, sem `truncate`, sem valor compacto) e por isso continuam cortando valores monetários como `R$ 250.000,00` e `R$ 196.853,65`.

## Escopo do plano

Varredura sistemática de **todas as telas com KPIs/valores grandes** para eliminar overflow em viewports estreitos (~600–1000px).

### 1. Correção do padrão local `Metric` (raiz do problema)

Cada tela abaixo define seu próprio card de KPI. Aplicar em todos o mesmo padrão do `MetricCard`: `min-w-0` no container, `truncate` no valor, `shrink-0` no ícone, layout `flex items-baseline gap-2`:

- `src/routes/_authenticated/finance.index.tsx` — componente `Metric` (o da print)
- `src/routes/_authenticated/finance.dre.tsx`
- `src/routes/_authenticated/finance.cash-flow.tsx`
- `src/routes/_authenticated/finance.cost-centers.tsx`
- `src/routes/_authenticated/finance.banking.tsx`
- `src/routes/_authenticated/finance.banking.reconciliation.tsx`
- `src/routes/_authenticated/finance.audit.tsx`
- `src/routes/_authenticated/finance.entries.$id.tsx`
- `src/routes/_authenticated/tasks.tsx`, `tasks.queues.tsx`
- `src/routes/_authenticated/campaigns.email.tsx`, `campaigns.whatsapp.tsx`
- `src/routes/_authenticated/admin.status.tsx`, `admin.quotas.tsx`, `admin.bug-reports.tsx`, `admin.alerts.tsx`, `admin.security-scans.tsx`, `admin.sandbox.tsx`
- `src/routes/_authenticated/settings.workflow-subscriptions.tsx`, `settings.whatsapp*.tsx`
- `src/routes/_authenticated/workspace.modules.tsx`
- `src/routes/_authenticated/files.tsx`, `contacts.tsx`, `contracts.$id.tsx`, `tickets.$id.tsx`, `tasks.$id.tsx`
- `src/routes/_authenticated/(ats)/candidates.$id.tsx`
- `src/components/people/benefits-panel.tsx`, `timesheet-panel.tsx`
- `src/components/access-control/governance-tabs.tsx`

### 2. Formatador compacto para valores monetários

Onde o KPI mostra moeda BRL (financeiro sobretudo), aplicar `compactBRL` (ex.: `R$ 3,7M`, `R$ 250k`) com o valor completo em `title=` para acessibilidade. Centralizar em um helper existente em `src/lib/date-presets.ts`/`src/lib/format.ts` (ou criar `src/lib/format-compact.ts` se não houver).

### 3. Recharts YAxis

Auditar rapidamente cada tela acima que renderiza Recharts e garantir `<YAxis width={...} tickFormatter={compactBRL|compactNumber} />` — mesmo padrão já aplicado em dashboard/reports/analytics.

### 4. Validação

- `bun run typecheck` (ou equivalente do projeto).
- Playwright em viewport 768×900 varrendo `/finance`, `/finance/dre`, `/finance/cash-flow`, `/tasks`, `/campaigns/email`, `/admin/status` — captura de screenshot de cada; conferir que nenhum valor está cortado.

### Fora de escopo
- Lógica de negócio, RLS, dados, permissões.
- Refatorar telas para usar o `MetricCard` compartilhado (mudança maior; fica como pendência recomendada).

### Riscos
- Truncar valor esconde parte da informação. Mitigação: `title` com valor completo + `compactBRL` para exibição legível.

## Detalhes técnicos

Padrão a aplicar em cada `Metric` local:

```tsx
<Card className="min-w-0">
  <CardHeader className="pb-2 flex-row items-center justify-between gap-2">
    <CardTitle className="min-w-0 truncate text-sm font-medium text-muted-foreground">{title}</CardTitle>
    <Icon className="h-4 w-4 shrink-0 ..." />
  </CardHeader>
  <CardContent className="min-w-0">
    <div title={fullValue} className="truncate text-2xl font-semibold tabular-nums ...">
      {compactBRL(value)}
    </div>
    {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
  </CardContent>
</Card>
```
