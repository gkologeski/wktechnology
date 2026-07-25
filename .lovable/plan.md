
# Dashboard: Export, Drill-down e Persistência do Período

Três melhorias no `/home` (dashboard consolidado) e `/modules`, mantendo o escopo em frontend + uma pequena adição server-side para o PDF.

---

## 1. Exportação em PDF e CSV

### CSV (client-side)
- Reutilizar `src/lib/csv-export.ts` (`toCsv` + `downloadCsv`).
- Criar `src/lib/home/dashboard-export.ts` com:
  - `buildDashboardCsv(data, range, modules)` — monta seções (KPIs por módulo) em um único CSV com blocos separados por linha em branco (padrão Excel/BR, `;`).
  - Cada módulo contratado gera um bloco: cabeçalho do módulo + tabela `Métrica;Valor`.
  - Inclui metadados no topo: workspace, usuário, intervalo (dd/MM/yyyy – dd/MM/yyyy), gerado em.

### PDF (client-side, sem dependência nova)
- Usar `window.print()` com uma rota dedicada de impressão: `src/routes/_authenticated/home.print.tsx`.
  - Renderiza o mesmo dashboard em layout otimizado para A4 (sem sidebar/topbar, `@media print` em `src/styles.css`).
  - Aceita `?from=...&to=...` na URL.
  - Botão "Exportar PDF" abre a rota em nova aba e dispara `print()` no mount.
- Racional: evita adicionar `jspdf`/`pdfmake` ao bundle; o navegador gera PDF nativo com fidelidade visual do dashboard.

### UI
- Botão "Exportar" no `PageHeader` de `/home` com menu (`DropdownMenu`): "Exportar CSV" / "Exportar PDF".
- Respeita módulos visíveis (mesma filtragem por permissões já usada no dashboard).

---

## 2. Drill-down nos KPIs

- Cada `MetricCard` ganha `href` opcional (já suportado ou adicionar prop).
- Mapeamento por KPI → rota do módulo, preservando o intervalo via query params `?from=YYYY-MM-DD&to=YYYY-MM-DD`:
  - CRM: Leads abertos → `/leads?from&to`; Negócios ativos / Pipeline → `/deals?from&to`; Ganhos → `/deals?stage=won&from&to`.
  - ATS: Vagas ativas → `/ats/jobs?from&to`; Candidatos → `/ats/candidates?from&to`.
  - Contratos: Ativos → `/contracts?status=active&from&to`.
  - Projetos: Ativos → `/projects?from&to`.
  - Financeiro: A receber/A pagar → `/finance/entries?direction=...&from&to`.
  - Pessoas: Ativos → `/people?from&to`.
- Nas telas de destino que já têm filtro de data (ex.: `deals.tsx`), ler `from`/`to` da URL e hidratar o `DateRangePicker`/filtro local (`CustomRange`). Onde não houver filtro, apenas navegar (sem quebrar).
- Card fica clicável inteiro (hover + `focus-visible`), com `aria-label` descritivo. Se não houver `href`, comportamento atual.

---

## 3. Persistência do DateRangePicker por usuário

- Chave de armazenamento por escopo:
  - `techerp:date-range:home`
  - `techerp:date-range:modules`
- Persistência em `localStorage` (por usuário local via `auth.uid()` no prefixo: `techerp:${uid}:date-range:home`).
- Formato salvo: `{ preset: PresetKey | "custom", from: ISO, to: ISO }`.
- Criar hook `src/hooks/use-persisted-date-range.ts`:
  - Assinatura: `usePersistedDateRange(scope: "home" | "modules", defaultPreset = "last30")`.
  - Retorna `[range, setRange, presetKey]`.
  - Ao montar: se preset ≠ "custom", recomputa `getPresetRange(preset)` (para "Últimos 30 dias" continuar dinâmico). Se "custom", usa `from`/`to` salvos.
  - SSR-safe (checa `typeof window`).
- Integrar em `home.index.tsx` e `modules.index.tsx` (adicionar o `DateRangePicker` também em `/modules`, conforme pedido).

---

## Arquivos

**Criar:**
- `src/lib/home/dashboard-export.ts` — CSV builder.
- `src/routes/_authenticated/home.print.tsx` — rota de impressão.
- `src/hooks/use-persisted-date-range.ts` — hook de persistência.

**Editar:**
- `src/routes/_authenticated/home.index.tsx` — botão Exportar, hook de persistência, `href` nos MetricCards.
- `src/routes/_authenticated/modules.index.tsx` — adicionar `DateRangePicker` com persistência.
- `src/components/techhire/ui/metric-card.tsx` (se necessário) — suportar `href`/`onClick`.
- `src/styles.css` — regras `@media print` para o layout PDF.
- Rotas de destino do drill-down (leve, apenas leitura de `from`/`to` da URL) — priorizar `/deals`, `/leads`, `/contracts`, `/finance/entries`.

**Não altera:** RLS, schema, server functions existentes de dashboard, lógica de permissões.

---

## Validação manual
1. Selecionar "Últimos 7 dias" no dashboard, recarregar → período persistido.
2. Clicar em "Pipeline" → abre `/deals` filtrado pelo mesmo intervalo.
3. Exportar CSV → abre no Excel com blocos por módulo, acentos OK.
4. Exportar PDF → nova aba, `print()` dispara, layout A4 limpo.
5. Repetir em `/modules` para persistência independente.
