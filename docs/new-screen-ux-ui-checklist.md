# Checklist de Aceite — Nova Tela TechHire

Use este checklist em **toda** PR que cria ou redesenha uma tela. Cada item é obrigatório, salvo exceção justificada na descrição da PR.

> Referência: [`techhire-design-system.md`](./techhire-design-system.md)
> Template: [`examples/new-standard-page.md`](./examples/new-standard-page.md)

---

## Estrutura

- [ ] Usa `PageHeader` (de `@/components/techhire/ui`) com título claro.
- [ ] `PageHeader` tem **uma** ação primária (ou nenhuma), e ações secundárias agrupadas.
- [ ] Eyebrow usado quando há contexto pai (breadcrumb implícito).
- [ ] Descrição curta (≤ 1 linha em desktop). Se for dinâmica, usa `descriptionLive`.
- [ ] Se a tela tem KPIs → `MetricCard` em grid responsivo (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`).
- [ ] Se a tela tem lista → `FilterBar` (busca com debounce 300ms + chips de filtro).
- [ ] Conteúdo principal usa um padrão definido: tabela, card grid, kanban ou layout de detalhe.

## Estados

- [ ] **Loading**: `Skeletons.*` com o mesmo grid do conteúdo final.
- [ ] **Empty**: `EmptyState` com ícone, título, descrição e **CTA acionável**. Diferenciar "sem dados" de "filtro vazio".
- [ ] **Error**: mensagem clara + botão "Tentar novamente" chamando `router.invalidate()` ou `refetch()`.
- [ ] Refresh silencioso (refetch após mutation): manter conteúdo, mostrar indicador discreto.

## Badges e cores

- [ ] Nenhuma cor hardcoded (`text-gray-*`, `bg-[#...]`, `text-white`, `bg-black`). Apenas tokens.
- [ ] Status de domínio via `StatusBadge` / `StageBadge` / `ScoreBadge` / `RiskBadge`.
- [ ] Metadado neutro via `MetaPill`.

## Formulários

- [ ] Agrupados em `FormSection` quando há múltiplas seções.
- [ ] Todo `Label` tem `htmlFor` apontando para `id` do Input/Textarea/SelectTrigger.
- [ ] Validação inline com mensagem clara.
- [ ] Ação primária à direita, secundária à esquerda; destrutiva isolada.

## Responsividade

- [ ] Testado em 360, 768, 1024, 1280.
- [ ] Headers colapsam ações para baixo em `< sm`.
- [ ] Listas viram cards verticais em mobile; tabelas densas só `≥ md`.
- [ ] Nenhum `h-screen` (usar `h-dvh`).

## Acessibilidade

- [ ] Contraste AA validado em light e dark.
- [ ] Botões ícone-only têm `aria-label`.
- [ ] `Progress`, `Slider`, ícones interativos com `aria-label` descritivo.
- [ ] Navegação por teclado funcional (Tab, Enter, Esc fecha drawers).
- [ ] Foco visível em todos os interativos.
- [ ] Tap targets ≥ 44px em mobile.

## Dark mode

- [ ] Validado visualmente em dark (toggle no menu de conta).
- [ ] Nenhum vazamento de cor clara em dark (ex: `bg-white` esquecido).

## Camadas e arquitetura

- [ ] Componentes de UI são **presentacionais** (não importam Supabase, server functions, queries, mutations).
- [ ] Telas (rotas) fazem o fetch via `useSuspenseQuery` + `queryOptions`; loader chama `ensureQueryData` quando possível.
- [ ] Componentes globais importados de `@/components/techhire/ui`.
- [ ] Componentes ATS-específicos importados de `@/components/ats/ui`.
- [ ] Nada novo em `@/components/ats/ui` que seja claramente global — promova para `techhire/ui` desde o início.

## Compatibilidade

- [ ] Build passa (`bun run build` / typecheck).
- [ ] `data-testid`, roles ARIA e textos críticos usados em testes E2E preservados.
- [ ] Nenhuma rota, RLS, server function, permissão ou regra de negócio alterada sem solicitação explícita.

## Documentação

- [ ] PR menciona quais componentes do design system foram usados.
- [ ] Se introduzir padrão novo: atualizar `techhire-design-system.md` na mesma PR.

---

**Critério de bloqueio:** qualquer item de "Estados", "Acessibilidade" ou "Dark mode" não atendido bloqueia o merge.
