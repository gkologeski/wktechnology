# Onda 0 + piloto da Onda 1 no `/insights` — Execução controlada

Escopo desta entrega (aprovado): fundação visual do ATS + redesign apenas do Dashboard/Insights como piloto. Nenhuma outra rota é tocada nesta etapa.

## 1. Onda 0 — Fundação

### Tokens semânticos em `src/styles.css`
Adicionar (sem remover os existentes) — versões `:root` e `.dark`, e mapear no bloco `@theme inline` para virarem classes Tailwind:

- Superfícies: `--surface-1`, `--surface-2`, `--surface-3`, `--surface-sunken`
- Bordas: `--border-subtle`, `--border-default`, `--border-strong`
- Texto: `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-disabled`
- Status de vaga: `--status-open`, `--status-onhold`, `--status-closed`, `--status-draft`
- Etapas de pipeline: `--stage-sourced`, `--stage-screen`, `--stage-interview`, `--stage-offer`, `--stage-hired`, `--stage-rejected`
- Score: `--score-strong`, `--score-good`, `--score-mixed`, `--score-weak`
- Risco/Fraude: `--risk-low`, `--risk-medium`, `--risk-high`
- IA: `--ai-accent`, `--ai-surface`, `--ai-border`
- DEI: `--dei-accent`, `--dei-surface`

Sem mexer em `--primary`, `--background`, `--card`, `--border` etc. existentes. Sem novas dependências.

### Pasta `src/components/ats/ui/` (presentacional, sem Supabase/queries/mutations)

Shells autorizados nesta etapa:
- `page-header.tsx` — `PageHeader` (title, eyebrow, description, primaryAction, secondaryActions, tabs opcionais)
- `section-header.tsx` — `SectionHeader` (title, description, action)
- `metric-card.tsx` — `MetricCard` (label, value, delta opcional, hint, icon, tone, loading)
- `badges.tsx` — `StatusBadge`, `StageBadge`, `ScoreBadge`, `SourceBadge`, `RiskBadge`
- `empty-state.tsx` — `EmptyState` (icon, title, description, action)
- `loading-skeleton.tsx` — `Skeletons` (variantes: metric, card, row, funnel)
- `filter-bar.tsx` — `FilterBar` shell (criado, **não aplicado** ainda — `/insights` não precisa)
- `ai-insight-card.tsx` — `AIInsightCard` (criado, **só aplicado** se já houver bloco IA na tela atual)
- `form-section.tsx` — `FormSection` shell (criado, **não aplicado**)
- `index.ts` — barril de exports

### Documentação
`docs/ats-design-system.md` com: filosofia "quiet premium", tabela de tokens, escala de espaçamento/raios/sombras, e quando usar cada componente.

## 2. Piloto — `/insights` (`src/routes/_authenticated/(ats)/insights.tsx`)

- Substituir cabeçalho ad-hoc por `PageHeader` da nova lib.
- Grid de KPIs com `MetricCard` (mesmos dados: vagas publicadas, candidaturas 30d, contratados, taxa de conversão).
- Funil mantém `Progress` shadcn, embrulhado por `SectionHeader` e `LoadingSkeleton`.
- Fontes: badges com `SourceBadge`; vazio usa `EmptyState` ("Sem candidaturas ainda — publique uma vaga para começar").
- Tempo médio para fechar com `ScoreBadge`/`StatusBadge` apenas se semântico.
- `LoadingSkeleton` fiel ao layout final (substitui "Carregando…").
- Estado de erro: mensagem clara + ação "Tentar novamente".
- Apenas dados já retornados por `getAtsAnalytics`. Nenhuma query/mutation nova.

## 3. Regras técnicas

- Zero alteração: schema, auth, RLS, server functions, permissões, rotas, lógica.
- Componentes em `ats/ui` **não** importam Supabase nem `*.functions`.
- Componente global existente `src/components/page-header.tsx` permanece intacto — o novo vive em `ats/ui/page-header.tsx` para evitar regressão em outras 50+ telas.
- Preservar `data-testid`, roles ARIA e textos de botão.
- Dark mode validado: cada token novo tem variante `.dark`.
- Sem libs novas (Tailwind v4 + shadcn + lucide).

## 4. Critérios de aceite

1. Build verde.
2. `/insights` carrega e mostra os mesmos números.
3. Dark mode OK.
4. Nenhuma feature removida.
5. Tokens documentados.
6. Componentes reutilizáveis e isolados de dados.
7. `/insights` visivelmente mais premium e consistente.

## 5. Riscos & mitigação

| Risco | Mitigação |
|---|---|
| Token novo conflita com classe existente | Prefixos `surface-*`, `text-*`, `stage-*` não colidem com tokens shadcn atuais |
| Quebrar a única rota tocada | Manter exatamente as mesmas queries e dados; só camada visual muda |
| Regressão dark mode | Cada novo token tem par `.dark`, validado visualmente |
| Confusão com `PageHeader` global | Novo componente é `@/components/ats/ui` — escopo claro |

## 6. Próximo passo (não nesta etapa)

Após sua validação visual do `/insights`, aplicar Onda 1 (PageHeader + Empty/Loading + badges) em `jobs.tsx` e `candidates.tsx`.
