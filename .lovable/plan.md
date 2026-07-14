# Corrigir "Falha ao gerar PDF" na proposta pública

## Diagnóstico

O download usa `html2canvas` sobre o `paperRef`. O `styles.css` do projeto (Tailwind v4) e o CSS do template de cotação usam funções de cor modernas — `oklch(...)`, `color-mix(...)`, `lab(...)` — que o parser CSS do `html2canvas` não entende. Basta um único utilitário compilado com essas cores dentro do nó capturado para o `html2canvas(...)` rejeitar com um erro do tipo "Attempting to parse an unsupported color function", caindo no `catch` que exibe o toast.

O override atual em `src/lib/quote-pdf.ts` só redefine `--background`, `--foreground`, etc. Isso não ajuda porque as classes Tailwind v4 já foram resolvidas para strings `oklch(...)` no CSS emitido, não para `var(--token)`.

## Estratégia

Antes de chamar `html2canvas`, percorrer o subtree do elemento e converter cores/backgrounds/bordas modernas para `rgb()`/`rgba()` — o `getComputedStyle` do próprio navegador já expõe o valor resolvido em `rgb(...)` em Chromium/Firefox atuais para propriedades diretas; onde o valor ainda vier como `oklch(...)`/`color-mix(...)`, converter via um sanitizador leve baseado em canvas (pintar 1px, ler `getImageData`) como fallback determinístico.

Ao terminar a captura, restaurar os estilos inline originais.

## Alterações

### `src/lib/quote-pdf.ts`

1. Nova função `sanitizeModernColors(root: HTMLElement): () => void`:
   - Percorre `root` e todos os descendentes.
   - Para cada elemento, lê `getComputedStyle(el)` das propriedades: `color`, `background-color`, `border-top-color`, `border-right-color`, `border-bottom-color`, `border-left-color`, `outline-color`, `text-decoration-color`, `fill`, `stroke`, `caret-color`, `column-rule-color`, `-webkit-text-fill-color`.
   - Se o valor computado contiver `oklch`, `oklab`, `lch`, `lab` ou `color-mix`, resolve para `rgb()` via helper `toRgb(value)`:
     - Cria (uma vez) um `<div>` off-screen; aplica `style.color = value`; lê `getComputedStyle().color`. Se sair como `rgb(...)`/`rgba(...)`, retorna. Se ainda contiver função moderna (browsers antigos), pinta em canvas 1×1 com esse `fillStyle` e lê o pixel.
   - Aplica o valor RGB como `style.setProperty(prop, rgb, "important")` no próprio elemento e guarda o valor original para restauração.
   - Também trata `background-image` quando contém `linear-gradient(... oklch ...)` substituindo com regex os trechos de cor por RGB.
   - Retorna uma função `restore()` que reverte todos os `setProperty` aplicados.

2. Em `downloadQuotePdf`:
   - Manter `injectCaptureStyles()` e `setAttribute("data-quote-capturing", "true")` (esconde botões).
   - Após aguardar fonts + rAF, chamar `const restore = sanitizeModernColors(el)`.
   - Envolver o `html2canvas` em `try/finally` que chama `restore()` e remove o `data-quote-capturing`.
   - Adicionar opções extras ao `html2canvas`: `foreignObjectRendering: false`, `imageTimeout: 15000`, `onclone: (doc) => sanitizeModernColors(doc.body)` como camada extra (o clone do html2canvas herda os inline styles já reescritos, mas o `onclone` cobre pseudo-elementos e reforça a limpeza).

3. Endurecer o `catch` do consumidor: log já existe; nenhum change no `quote.$token.tsx` além de opcionalmente exibir `e.message` no `toast.error` para diagnóstico caso reincida.

### `src/routes/quote.$token.tsx`

- Ajustar apenas o handler `triggerDownload` para incluir a mensagem original no toast: `toast.error(`Falha ao gerar PDF: ${e instanceof Error ? e.message : "erro desconhecido"}`)`. Nada mais.

## Validação manual

1. Abrir `/quote/<token>` de uma cotação existente, clicar em "Baixar PDF" — deve baixar o `.pdf` sem toast de erro.
2. Repetir num template com CSS custom que use gradientes/oklch — o PDF ainda deve gerar (cores podem sair aproximadas via rgb, mas sem falha).
3. Repetir na rota interna que dispara download automático via `?download=pdf`.

## Fora do escopo

- Não trocar a biblioteca (`html2canvas` + `jspdf` permanecem).
- Não alterar layout, tokens Tailwind, nem o template de cotação.
- Não mexer em RLS, migrations, permissões ou lógica de negócio.
