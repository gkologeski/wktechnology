## Contexto

Na tela `/dashboard` (screenshot enviado), com o viewport reduzido, aparecem dois defeitos de responsividade típicos:

1. **KPI "Valor do pipeline"** — o valor `R$ 1.345.300,00` é cortado pela caixa do ícone à direita. Causa: em `StatCard` (`src/routes/_authenticated/dashboard.tsx`, linhas 195-211) o texto `text-2xl` não tem `truncate`/`min-w-0`, e o container do ícone não tem `shrink-0`. Em telas estreitas o ícone empurra o texto e o overflow é escondido.
2. **Gráfico "Valor por estágio"** — o eixo Y renderiza `0000000` cortado. Causa: `<YAxis>` sem `width` explícito nem `tickFormatter`; com valores em reais o rótulo fica largo demais para o espaço padrão do Recharts em containers estreitos.

Esses padrões (KPI com ícone à direita + gráfico Recharts sem `width`/`tickFormatter`) se repetem em várias telas que usam `MetricCard` do TechHire e componentes locais equivalentes.

## Escopo

Somente UI/responsividade. Sem mudanças em dados, RLS, permissões, server functions ou regras de negócio.

### 1. Corrigir os dois defeitos da `/dashboard`

- `StatCard` (`dashboard.tsx`): aplicar o padrão do workspace responsive-layout — wrapper com `min-w-0`, `truncate` no valor, `shrink-0` no ícone. Manter o mesmo visual.
- Ambos gráficos: adicionar `width={64}` (ou similar) e `tickFormatter` ao `<YAxis>` — no "Valor por estágio" formatar como moeda compacta (`R$ 1,3M`, `R$ 340k`) usando um helper local baseado em `Intl.NumberFormat` com `notation: "compact"`. Manter o tooltip com valor completo.

### 2. Reforçar `MetricCard` do TechHire

`src/components/ats/ui/metric-card.tsx` é usado em ~15 telas. A linha 75 renderiza o valor com `text-2xl` sem `truncate`, e o container do ícone em `flex items-start justify-between` já usa `shrink-0` (linha 69) mas o bloco do valor não protege `min-w-0`. Ajustar:

- adicionar `min-w-0` ao container do valor;
- adicionar `truncate` na `<span>` do valor (linha 75);
- manter tudo o mais igual (tokens, tone, delta).

Esse único ajuste corrige simultaneamente os KPIs de: `/home`, `/modules`, `ats-dashboard`, `insights`, `scheduling`, `sourcing/analytics`, `sourcing/multi-posting`, `hunting/index`, `hunting/observability`, `briefing`, `compliance`, `projects.my-work`, `finance.banking.reconciliation`, `people.$id`, `settings.recurring`, `qa.test-cases`, `people/allocations-panel`.

### 3. Varredura de gráficos Recharts com YAxis financeiro

Localizar `YAxis` em componentes de dashboard/analytics e, onde o `dataKey` for monetário, aplicar `width` + `tickFormatter` compacto. Alvos prováveis (a confirmar por leitura no build):

- `src/routes/_authenticated/dashboard.tsx` (dois gráficos)
- `src/routes/_authenticated/(ats)/ats-dashboard.tsx`
- `src/routes/_authenticated/(ats)/insights.tsx`
- `src/routes/_authenticated/(ats)/sourcing/analytics.tsx`
- `src/routes/_authenticated/finance.dre.tsx`, `finance.cash-flow.tsx`, `finance.banking.reconciliation.tsx`
- `src/routes/_authenticated/analytics.tsx`, `dashboards.tsx`

Cada arquivo será lido antes do ajuste; onde já houver `tickFormatter` adequado, nada muda.

### 4. Varredura de outros KPIs locais (não usam MetricCard)

`src/components/people/timesheet-panel.tsx` e `benefits-panel.tsx` têm `text-2xl` com valor financeiro/percentual dentro de flex rows. Aplicar `min-w-0` + `truncate` onde houver ícone/ação ao lado.

### 5. Validação

- Rodar `bun run lint` e `bun run typecheck` (ou equivalentes descobertos em `package.json`).
- Verificar visualmente a `/dashboard` em viewport mobile (375px) e no viewport reportado (~1052px com sidebar): valor completo visível, gráficos com eixo Y legível, sem overflow horizontal.
- Verificar amostralmente 2-3 telas do MetricCard em mobile para confirmar que o `truncate` não corta valores curtos indevidamente.

## Fora do escopo

- Reescrever `StatCard` para usar `MetricCard` (mudança maior, fica para outra passada).
- Redesenhar gráficos (mudar tipo, cores, unidade).
- Ajustar responsividade de tabelas, filtros, headers — se surgirem no caminho, listar como pendências no relatório final, sem alterar.

## Detalhes técnicos

Padrão aplicado (do workspace `responsive-layout-patterns`):

```tsx
// StatCard corrigido
<div className="flex items-center justify-between gap-3">
  <div className="min-w-0">
    <p className="text-xs uppercase ...">{label}</p>
    <p className="mt-1 truncate text-2xl font-semibold">{value}</p>
  </div>
  <div className="h-10 w-10 shrink-0 rounded-md ...">{icon}</div>
</div>
```

```tsx
// Formatter compacto para YAxis financeiro
const compactBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
    currency: "BRL",
  }).format(v);

<YAxis width={64} tickFormatter={compactBRL} ... />
```

## Entregáveis

- `src/routes/_authenticated/dashboard.tsx` corrigido (StatCard + YAxis dos dois gráficos).
- `src/components/ats/ui/metric-card.tsx` com `min-w-0` + `truncate`.
- Ajustes pontuais nos demais arquivos listados na varredura (§3, §4).
- Relatório final conforme padrão do workspace com arquivos alterados, validações executadas e pendências (se houver).
