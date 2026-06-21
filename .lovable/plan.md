
## Diagnóstico

O editor atual (`src/routes/_authenticated/landing-pages.$id.tsx`) é um formulário linear: lista de blocos com JSON cru, sem preview, sem drag-and-drop, sem edição inline. Para um usuário comum é incompreensível.

O HubSpot Landing Page Editor tem uma estrutura clara e replicável:

```text
┌──────────────────────────────────────────────────────────────┐
│ ← Voltar  | Nome da página     [Desktop|Tablet|Mobile]  ⤺ ⤻  │  TOPBAR
│                                       Preview  Configurações  Publicar │
├──────────┬──────────────────────────────────────┬────────────┤
│          │                                      │            │
│ Módulos  │         CANVAS (WYSIWYG)             │  Painel    │
│ ──────   │   ┌────────────────────────────┐    │  de Edição │
│ ▣ Hero   │   │  Hero — clique para editar │    │            │
│ ¶ Texto  │   ├────────────────────────────┤    │  (campos   │
│ 🖼 Imagem│   │  Features 3 colunas        │    │  do bloco  │
│ ▭ Botão  │   ├────────────────────────────┤    │  selecio-  │
│ ☐ Form   │   │  Formulário                │    │  nado:     │
│ ⫶⫶ Colunas│  │  ...                       │    │  textos,   │
│ ─ Divisor│   └────────────────────────────┘    │  cores,    │
│ ⬚ Espaço │   [+ Adicionar seção]               │  imagens)  │
│ 💬 Depo. │                                      │            │
│ ❓ FAQ    │                                      │            │
│ 🎬 Vídeo │                                      │            │
└──────────┴──────────────────────────────────────┴────────────┘
```

## Plano de execução (fases)

### Fase 1 — Estrutura do editor (shell + canvas + sidebars)
- Substituir `landing-pages.$id.tsx` por um shell em 3 colunas (módulos | canvas | propriedades) ocupando tela cheia, sem `PageHeader`.
- Topbar com: voltar, nome editável inline, seletor de dispositivo (desktop 100% / tablet 768px / mobile 375px aplicado via largura do canvas), undo/redo (histórico em memória), botão Preview (abre `/lp/$slug` em nova aba), botão Configurações (abre drawer com SEO/slug/status), botão Publicar (muda status + salva).
- Auto-save com debounce (2s) + indicador "Salvando…/Salvo".

### Fase 2 — Sistema de módulos (paridade com HubSpot)
Cada módulo = um bloco no array `blocks` já persistido. Adicionar tipos novos preservando os existentes (hero/features/form/testimonial/cta) e introduzindo:
- `richtext` (texto formatado), `image`, `button`, `divider`, `spacer`, `columns` (2/3 colunas com blocos aninhados), `video` (URL YouTube/Vimeo), `faq`, `logos` (faixa de logos), `stats`.
- Cada módulo tem: schema de campos, componente de render no canvas, componente de propriedades, valores default, ícone na sidebar.
- Sidebar esquerda: lista de módulos arrastáveis + clicáveis. Click no canvas em "+ Adicionar seção" abre seletor.

### Fase 3 — Interações WYSIWYG
- Hover em qualquer bloco no canvas mostra toolbar flutuante: mover ↑↓, duplicar, deletar, drag handle.
- Click no bloco → seleciona (borda azul) e abre o painel direito com os campos daquele bloco.
- Edição inline de textos (headline, subheadline, parágrafos) com `contentEditable` — alteração reflete imediatamente no estado.
- Drag-and-drop para reordenar usando `@dnd-kit/core` + `@dnd-kit/sortable` (já é o padrão moderno e acessível).
- Drag de módulo da sidebar para posição no canvas.

### Fase 4 — Configurações da página (drawer)
- Aba SEO: título, descrição, slug, imagem OG.
- Aba Tema: cor primária, fonte (presets), cor de fundo — gravadas em `theme` JSON, aplicadas como CSS vars no canvas e no `/lp/$slug`.
- Aba Avançado: status (rascunho/publicada/arquivada), domínio, scripts de tracking.

### Fase 5 — Renderer público alinhado
- Refatorar `src/routes/lp.$slug.tsx` para compartilhar os mesmos componentes de render do canvas (extrair `src/components/landing-pages/blocks/*`), garantindo paridade visual editor ↔ página publicada.
- Aplicar `theme` (cor/fonte) via CSS vars no `<section>` raiz.

## Detalhes técnicos

- **Pasta nova**: `src/components/landing-pages/` com:
  - `editor-shell.tsx`, `topbar.tsx`, `module-sidebar.tsx`, `properties-panel.tsx`, `canvas.tsx`, `block-toolbar.tsx`, `settings-drawer.tsx`.
  - `blocks/registry.ts` — registro central `{ type, label, icon, defaults, RenderComponent, PropertiesComponent }`.
  - `blocks/hero.tsx`, `features.tsx`, `form.tsx`, `richtext.tsx`, `image.tsx`, `button.tsx`, `columns.tsx`, `divider.tsx`, `spacer.tsx`, `video.tsx`, `faq.tsx`, `logos.tsx`, `testimonial.tsx`, `cta.tsx`, `stats.tsx`.
- **Estado**: hook `useEditorState` com histórico (stack de até 50 estados para undo/redo).
- **Dependência nova**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (instalar via `bun add`).
- **Schema do banco**: nenhuma migração necessária — `blocks`, `theme`, `seo` já são `jsonb` flexíveis. Blocos antigos continuam renderizando.
- **Tokens**: usar `bg-background`, `border-border`, `text-foreground`, `primary` — nada de cores hardcoded.
- **Mobile**: editor é desktop-only (HubSpot também é); preview mobile é só largura do canvas.

## Fora de escopo (não nesta entrega)
- Smart content / personalização por persona.
- A/B testing UI (campo `variant_id` já existe no tracking; pode vir depois).
- Editor visual de tema com seletor de fonte do Google Fonts em runtime — usaremos 4 presets.
- Templates pré-prontos de página (pode ser fase 6).

## Resultado esperado
Um editor que um usuário comum entende em segundos: arrasta módulos da esquerda, vê o resultado no centro, clica para editar à direita, escolhe dispositivo no topo, publica em um botão. Visual e fluxo idênticos ao HubSpot.
