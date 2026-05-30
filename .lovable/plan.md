## Construtor de Marca — Split Studio em /settings/branding

Substituir o formulário simples atual por um construtor visual em 3 zonas: cabeçalho, painel de controles (esquerda) + preview interativo (direita), e rodapé sticky com ações.

### Layout

```
┌─ Header: "Construtor de Marca · WK Technology" ────────── [Editor | Variáveis] ─┐
│                                                                                   │
│  ┌─ Controles (320px) ───────┐  ┌─ Preview ao vivo (flex) ──────────────────┐  │
│  │ IDENTIDADE VISUAL          │  │ ● Visualização em tempo real  [☀ | 🌙]   │  │
│  │  · Logo (upload + URL)     │  │                                            │  │
│  │  · Favicon                 │  │  ┌─ Mini-CRM mock ─────────────────────┐  │  │
│  │  · Nome da marca           │  │  │ Sidebar │ Header + Botão primário   │  │  │
│  │                            │  │  │ (logo)  │ ─────────────────────────  │  │  │
│  │ SISTEMA DE CORES           │  │  │ Nav     │ Cards (border-radius)     │  │  │
│  │  · Primária [picker+hex]   │  │  │  · Item │  · Badge (primary)        │  │  │
│  │  · Accent   [picker+hex]   │  │  │  · Item │  · Badge (accent)         │  │  │
│  │  · Paletas sugeridas (8)   │  │  │         │  Texto na tipografia atual│  │  │
│  │                            │  │  └────────────────────────────────────┘  │  │
│  │ ESTILO & FORMAS            │  │                                            │  │
│  │  · Raio (slider 0–20px)    │  │                                            │  │
│  │  · Densidade (compact/cozy)│  │                                            │  │
│  │  · Fonte (heading/body)    │  │                                            │  │
│  │                            │  │                                            │  │
│  │ CONTATO & DOMÍNIO          │  │                                            │  │
│  │  · Domínio · Email · Rodapé│  │                                            │  │
│  └────────────────────────────┘  └────────────────────────────────────────────┘  │
│                                                                                   │
├─ Footer sticky ── ● Alterações não aplicadas · Resetar ── [Descartar] [Salvar] ─┤
```

### Funcionalidades

- **Color pickers visuais** (nativo `<input type="color">` + campo hex sincronizado) substituem os inputs HSL/OKLCH crus. Conversão automática hex → `oklch()` na hora de salvar, mantendo compatibilidade com o `BrandingProvider` (que já aplica `--primary` e `--accent` em `document.documentElement`).
- **Paletas pré-prontas** (8 presets: Indigo, Emerald, Slate, Rose, Amber, Violet, Teal, Crimson) — clicar aplica primária + accent imediatamente.
- **Preview ao vivo**: mini-mock do CRM (sidebar com logo, header com botão primário, 3 cards com badges) que reage em tempo real à medida que o usuário muda cor / raio / fonte. As mudanças só são aplicadas ao app real depois de "Salvar".
- **Toggle Claro / Escuro** no preview para verificar contraste em ambos os modos.
- **Slider de raio** (0–20px) controlando `--radius` apenas no preview até salvar.
- **Densidade** (Compact / Cozy) e **fonte** (Inter, Outfit, Plus Jakarta, Geist) — variáveis CSS extras (`--font-heading`, `--font-body`, `--density-scale`) adicionadas ao `:root` e aplicadas pelo `BrandingProvider`.
- **Upload de logo/favicon**: bucket de storage privado existente não tem um para branding — manter por ora os campos URL (com preview imediato do `<img>`) e marcar TODO para upload futuro.
- **Estado "dirty"** com indicador laranja pulsante no rodapé; botão Descartar reverte para os valores salvos.
- **Botão Salvar sticky** chama o `saveBranding` existente, normalizando cores para formato compatível com `oklch()`.

### Implementação técnica

1. **Schema**: adicionar 4 colunas opcionais em `workspace_branding` via migration:
   - `radius` (text), `density` (text), `heading_font` (text), `body_font` (text)
2. **`saveBranding` / `getBranding`**: estender o validador e o select para incluir os 4 novos campos.
3. **`BrandingProvider`** (`src/lib/branding.tsx`): aplicar também `--radius`, `--font-heading`, `--font-body`, e `[data-density]` no `<html>`.
4. **`src/styles.css`**: declarar variáveis-fallback `--font-heading`, `--font-body`, `--density-scale` e usá-las em `body`. Pré-carregar Google Fonts (Inter, Outfit, Plus Jakarta, Geist) via `<link>` no `__root.tsx`.
5. **Reescrita de `src/routes/_authenticated/settings.branding.tsx`** seguindo o protótipo Split Studio:
   - `src/components/branding/branding-builder.tsx` — orquestrador (controles + preview + dirty state)
   - `src/components/branding/controls-panel.tsx` — todos os controles agrupados
   - `src/components/branding/color-control.tsx` — picker + hex + slider
   - `src/components/branding/palette-presets.tsx` — 8 paletas clicáveis
   - `src/components/branding/live-preview.tsx` — mini-mock CRM com toggle claro/escuro
6. **Utilitário `src/lib/color-utils.ts`**: conversões hex ↔ oklch ↔ hsl e cálculo de foreground (preto/branco) por contraste.
7. **Tradução PT-BR** mantida em toda a UI nova.

### Fora de escopo

- Upload real de arquivo (logo/favicon) — manter URL apenas; criar bucket vira tarefa futura.
- Editor de paleta inteira (somente primária + accent neste momento).
- Persistência de modo claro/escuro no preview (apenas estado local da página).
