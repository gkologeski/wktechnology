## Por que Chrome mostra em branco e Preview mostra certo

Chrome usa **PDFium**; Preview usa **Quartz**. Quando o Chromium (Browserless) gera o PDF, ele traduz certos recursos CSS para operadores PDF que o Quartz interpreta mas o PDFium renderiza como vazio. No template atual da cotação os culpados prováveis são:

1. `transform: scale(...)` no wrapper `#__pdf_scale__` (o endpoint aplica hoje) — vira um Form XObject com matriz; combinado com `overflow:hidden` no body, PDFium clipa para fora do MediaBox.
2. `mix-blend-mode`, `filter: blur()`, `backdrop-filter`, `mask-image` no template — viram transparency groups / soft masks que PDFium não rasteriza corretamente.
3. Cores `oklch()` / `color-mix()` — escritas como DeviceN no PDF; algumas builds do PDFium renderizam sem cor.

## Plano — Achatar o CSS problemático

Alterar **somente** o endpoint `src/routes/api/public/quotes/$token.pdf.ts`. Zero mudança no template público, no visual da página `/quote/$token` ou em qualquer outra tela.

### Passos

1. **Trocar a estratégia de encaixe em 1 página**: em vez de `transform: scale()` num wrapper, usar **zoom CSS + ajuste de viewport** no Browserless.
   - Medir a altura do conteúdo com script injetado.
   - Se estourar 794px, aplicar `document.body.style.zoom = ratio` (zoom não gera Form XObject no PDF do Chromium — o layout é reflowed antes da impressão).
   - Manter fallback: se `zoom` não reduzir o suficiente em 3 iterações, aí sim aplicar `transform: scale` como último recurso.

2. **Injetar CSS de "flatten" no fim do `<head>`** (só no PDF, não afeta a página web):
   ```css
   *, *::before, *::after {
     mix-blend-mode: normal !important;
     backdrop-filter: none !important;
     filter: none !important;
     mask: none !important;
     -webkit-mask: none !important;
     animation: none !important;
     transition: none !important;
   }
   ```
   Isso remove os operadores que geram transparency groups/soft masks no PDF.

3. **Converter cores modernas para rgb** antes de enviar ao Browserless: rodar um passo de sanitização no HTML renderizado que substitui `oklch(...)`, `oklab(...)`, `color(...)` e `color-mix(...)` por `rgb(...)` equivalente. Usa uma pequena tabela + `culori`-like conversion inline (sem dependência nova — implemento em ~40 linhas).

4. **Remover `overflow: hidden` do body no override** e manter `@page` como fonte única de tamanho, para evitar clipping fora do MediaBox no PDFium.

5. **Ajustar chamada Browserless**: manter `emulateMediaType: "screen"`, viewport 1400×900, mas passar `waitForFunction` esperando um flag `window.__pdfReady = true` que o script de encaixe seta ao terminar. Substitui o `waitForTimeout` fixo.

### Validação

- Gerar PDF da **Q-202607-1717** (a do screenshot) via `curl` para `/api/public/quotes/<token>/pdf`.
- Salvar em `/tmp/browser/`, converter com `pdftoppm -jpeg -r 150` e inspecionar visualmente com `code--view` — confirmar que **conteúdo aparece** no rasterizado (equivalente a como Chrome renderiza) e que o PDF tem **1 página**.
- Repetir com uma segunda cotação recente para evitar regressão.
- Se ainda aparecer em branco na inspeção, aplicar o fallback de rasterização (screenshot PNG embutido) só para essa rota — mas não como default.

### Arquivos alterados

- `src/routes/api/public/quotes/$token.pdf.ts` — único arquivo tocado.

### Riscos

- `zoom` no Chromium tem quirks com `position: fixed` — mitigado pelo template não usar fixed no conteúdo principal.
- Conversão `oklch→rgb` pode gerar cores levemente diferentes (delta perceptual pequeno). Aceitável no PDF; a página web continua em `oklch`.
- Se o template usar sombras/blur decorativas, elas somem no PDF (mas o conteúdo passa a aparecer no Chrome — que é a prioridade).

### Fora do escopo

- Template público `quote_templates.html` — não alterado.
- Página `/quote/$token` — não alterada.
- Fluxo de download client-side — não alterado.
