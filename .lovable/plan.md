## Redesign /landing-pages — Magazine clássico

Reescrever `src/routes/_authenticated/landing-pages.index.tsx` aplicando o layout magazine selecionado, mantendo TODA a lógica atual (queries, mutations, dialog de confirmação, criação de nova landing page) e usando exclusivamente tokens semânticos do sistema.

### Estrutura visual
- **Header editorial**: título serif/itálico "Landing pages" + subtítulo + botão "Nova landing page" à direita, separador `border-b border-border`.
- **Grid magazine** (`grid-cols-1 md:grid-cols-3 gap-6`):
  - **Featured card** (`md:col-span-2`): primeira landing page da lista. Hero com banner `bg-muted` (placeholder com ícone) + badge "Destaque" no canto. Bloco inferior: título + slug (`font-mono`), status à direita, métricas Views/Conversions em destaque, rodapé com "Atualizado há …" + botões "Ver pública" e "Editar".
  - **Cards secundários**: demais landing pages em cards uniformes com banner topo, badge de status (dot + label), título, slug, métricas pequenas e ações ícone (editar, deletar).
- **Estado vazio**: mantém card centralizado convidando criar a primeira.
- **Loading**: skeleton magazine (1 grande + 3 pequenos).

### Comportamento preservado
- `useQuery(listLandingPages)` e `useMutation(deleteLandingPage)`.
- `createNew()` continua igual (cria slug+template default e navega).
- Confirm dialog de delete intacto.
- Links de edição via `<Link to="/landing-pages/$id" params={{ id }}>` e "Ver pública" via `<a href="/lp/{slug}" target="_blank">`.
- Status derivado de `published_at` (se `null` → Rascunho, senão Publicado).
- Métricas: usar `views_count` / `conversions_count` se existirem em `LandingPage`; caso ausentes, exibir `—`.

### Tokens (sem hardcode)
- Cores: `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary`, `bg-accent`, `text-destructive`.
- Status "Publicado": dot e label com `text-primary` (em vez do `text-green-600` do protótipo, para respeitar o design system).
- Sem novas fontes; o "italic font-serif" do título usa a serif já disponível no Tailwind (`font-serif` é fallback nativo, aceitável; se preferir manter consistência total, posso usar `font-semibold tracking-tight` sem serif — confirmar se preferir).

### Arquivos
- Editar apenas `src/routes/_authenticated/landing-pages.index.tsx`.
- Nenhuma mudança em server functions, types, rotas ou banco.

### Verificação
- Playwright em `/landing-pages` (autenticado) → screenshot do estado com lista e do estado vazio.
