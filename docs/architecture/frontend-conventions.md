# Convenções de frontend

## 1. Roteamento

- File-based em `src/routes/`. `src/routeTree.gen.ts` é gerado — nunca editar.
- `src/routes/__root.tsx`: layout raiz, head global, `<Toaster />` (sonner),
  listener único de `supabase.auth.onAuthStateChange`, watchers globais.
- Rotas logadas em `src/routes/_authenticated/**`. O layout pathless
  (`_authenticated.tsx`) é o único gate: `ssr: false` + `beforeLoad` com
  `supabase.auth.getUser()`. Não recriar gate em rotas filhas, não usar
  `useEffect` + `navigate` para proteger rota.
- Rotas públicas na raiz, com SSR ligado e sem gate. Ação que exige login
  mostra CTA "Entrar para…", não redireciona.
- Grupos de rota entre parênteses (`(ats)/`) organizam sem afetar a URL.
- Todo `head()` de rota de conteúdo define `title`, `description`, `og:title`,
  `og:description` próprios. Rotas com loader definem `errorComponent` e
  `notFoundComponent`.
- Não criar `src/pages`, `App.tsx` como switch de páginas, nem
  `_app/index.tsx` (conflita com `/`).

## 2. Dados

Padrão: loader chama `context.queryClient.ensureQueryData(queryOptions)` e o
componente usa `useSuspenseQuery`; ou, em rota pública/protegida via
componente, `useServerFn` + `useQuery`. Não buscar dados com `useEffect`.

Invalidação: sempre invalidar as query keys afetadas após mutação. Helpers
existentes: `use-invalidate-on-close.ts`, `use-realtime-invalidate.ts`,
`use-refresh-callback.ts`, `src/lib/timeline-refresh.ts` (timeline em realtime).

## 3. Design system

Importe da fachada oficial `@/components/techhire/ui`:
`PageHeader`, `SectionHeader`, `MetricCard`, `FilterBar`, `FormSection`,
`EmptyState`, skeletons, `StatusBadge`, `MetaPill`, `AIInsightCard`.
Badges de domínio ATS (`StageBadge`, `ScoreBadge`, `SourceBadge`, `RiskBadge`)
em `@/components/ats/ui`.

Obrigatório em toda tela nova:

- `PageHeader` (ou variante do módulo) com ação primária clara;
- estados de **loading** (skeleton fiel ao layout final), **empty**, **error**
  (com próxima ação) e **disabled**;
- foco visível, labels acessíveis, `aria-label` em botões só-ícone;
- responsividade desktop/tablet/mobile (atenção a 768px: header e grupos de
  botões devem quebrar, não transbordar);
- light e dark mode validados.

Proibido: layout isolado fora do design system; `Card` shadcn genérico sem
composição padronizada; cores avulsas quando existe token; classes hardcoded
(`text-white`, `bg-black`, `bg-[#...]`); Supabase/queries/mutations dentro de
componentes puramente presentacionais.

Tema e tokens vivem em `src/styles.css` (Tailwind v4 `@theme`). White-label por
workspace/módulo: `workspace_branding`, `module_branding`,
`src/components/branding/**` (editor visual com checagem WCAG AA).

Fontes remotas entram por `<link>` no head de `__root.tsx` — nunca `@import` de
URL em `src/styles.css`.

## 4. Grids (tabelas de entidade)

Blocos reutilizáveis:

- `src/components/grid/use-grid-selection.ts` — seleção multi-linha;
- `src/components/grid/grid-bulk-bar.tsx` — barra de ações em massa;
- `src/components/bulk-assign-dialog.tsx`, `bulk-edit-dialog.tsx`,
  `bulk-create-activity-dialog.tsx`, `bulk-action-bar.tsx`;
- `src/components/entity/assignee-cell.tsx`, `assignee-field.tsx`,
  `assignee-filter.tsx`, `owner-field.tsx`;
- `src/hooks/use-grid-columns.tsx` + `user_grid_preferences` (colunas por
  usuário), `column-editor-dialog.tsx`, `filter-builder-dialog.tsx`,
  `table-pagination.tsx`, `date-range-filter.tsx`, `owner-filter.tsx`.

Regra de consistência: **coluna do grid e campo do detalhe devem ler o mesmo
dado**. O caso histórico (grid mostrando `assigned_to` vazio e detalhe mostrando
`owner_id`) foi resolvido padronizando em `assigned_to` + backfill.

## 5. Kanban

- `src/components/kanban/kanban-board.tsx` — board genérico com @dnd-kit,
  suporta `onMove` customizado e `readOnly`.
- `view-mode-toggle.tsx` + `use-view-mode.ts` — alternância Tabela|Kanban
  persistida em search param (a rota precisa de `validateSearch`).
- `kanban-scroll-container.tsx`, `kanban-signal-indicator.tsx`.
- Editáveis (drag-and-drop grava): Negócios, Leads, Candidaturas, Projetos,
  Incidentes, Propostas, Pessoas, Ofertas, Serviços, Chamados internos,
  Tickets. Somente leitura: Contratos, Contas a pagar/receber, NFS-e, Faturas.
- Movimento sempre passa por server fn com RBAC/RLS; falha reverte a coluna.
- Atenção a volume: acima de ~500 cards, reduzir página ou virtualizar.

## 6. Formulários

`react-hook-form` + `zod`. Envolver seções em `FormSection`. Todo campo tem
label. Ação destrutiva exige confirmação (`confirm-count-dialog.tsx` para
operações em massa). Campos monetários usam `CurrencyInput` /
`src/lib/money-fields.ts` (máscara BRL). Datas úteis em
`src/lib/date-business.ts`. Erros de validação traduzidos por
`src/lib/validation-message.ts`.

Rascunhos automáticos de e-mail/WhatsApp: `message_drafts` +
`use-message-draft.ts` + indicador `MessageDraftPin` na timeline.

## 7. Modais

`DialogContent` já tem ajuste global de altura/scroll — não recriar limites
próprios que cortem conteúdo. Diálogos e menus usam primitivos Radix
(acessibilidade e foco garantidos).

## 8. Timeline e associações

- `src/components/record/record-layout.tsx`, `associations-panel.tsx`,
  `add-association.tsx` — layout padrão de detalhe com painéis de associação
  (inclui `RecordLeadsCard`).
- Timeline atualiza em realtime (`timeline-refresh.ts`); itens de e-mail exibem
  aberturas/cliques; pesquisas aparecem como `SurveyTimelineCard`.

## 9. Internacionalização e rótulos

Interface em PT-BR. Valores de enum são humanizados na UI (ex.:
`caixa_de_entrada` → "Caixa de entrada" via `stageLabel()`); dados importados
(HubSpot, Apollo) são traduzidos na exibição. Termos técnicos padronizados
(pipeline, start, stop, SLA, NPS) permanecem como são.

## 10. Performance

- Code-splitting por rota; imports pesados (editor de documento, gráficos,
  Workflow Builder) são lazy: `word-editor-lazy.tsx`, `charts/lazy-chart.tsx`.
- Bibliotecas browser-only (mapas, gravação de tela) só via `React.lazy` +
  `<ClientOnly>`; nunca import estático em rota SSR.
- Ler `localStorage` em `useEffect`/`useHydrated`, não em inicializador de
  `useState` (hydration mismatch).
- Listas grandes: paginação, filtro server-side ou virtualização.
