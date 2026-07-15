## Diagnóstico

Rodei `pdftotext` e `pdftoppm` nos 3 PDFs anexados. Eles **não** estão totalmente vazios: os cabeçalhos ("PROPOSTA COMERCIAL", número, vendedor, status, destinatário, "ITENS DA PROPOSTA") aparecem. O que some é tudo o que vem depois: tabela de itens, totais, observações, termos, footer. Página 2 é só a faixa vermelha e a base do notebook.

Duas causas somadas, ambas no lado da renderização — o template está OK, quem está errado é o pipeline em `src/routes/api/public/quotes/$token.pdf.ts`:

1. **Animações CSS ainda em `opacity:0` no momento do PDF.** O template `Prosposta 001` aplica `animation: fadeUp .Xs .Ys ease both` em quase todo o conteúdo (`.prop-cards` 0.8s total, `.tbl-outer` 0.9s, `.totals-section` 0.9s, `.notes-grid` 0.95s, `.prop-footer` 1.0s). O `both` mantém o estado inicial (`opacity:0; translateY(12px)`) até a animação rodar. Hoje o handler chama Browserless com `waitUntil: networkidle0` + `waitForTimeout: 300` — não sobra tempo pras animações completarem, então o Chromium tira o "snapshot" com metade dos blocos ainda invisíveis. É exatamente o padrão do que sumiu.
2. **`.stage { min-height: 100vh }` + `@page A4 landscape margin:0`.** Em modo print o viewport tem ~794px de altura; o `.stage` fica travado nisso e centraliza o notebook, jogando o resto (tabela + totais + notas + footer) para além do primeiro `@page`. A página 2 herda os `absolute` splits vermelhos mas o conteúdo não flui — daí a segunda página "toda vermelha e vazia".

Confirmado inspecionando o HTML do template `01a2c7aa-f235-4cd9-8b86-f3e7d380ebf8` (linhas 424–438 são as animações; linhas 22–36 são o `.stage` com `min-height:100vh` e os splits `absolute`).

## Correção

Sem editar o template (que é do usuário e está correto para a página pública), reforçar o `wrapForPrint()` em `src/routes/api/public/quotes/$token.pdf.ts` para neutralizar os dois problemas apenas no PDF:

1. Injetar CSS de print, **depois** de qualquer `<style>` do template, dentro de `@media print` e como fallback global:
   ```css
   *, *::before, *::after {
     animation: none !important;
     transition: none !important;
   }
   .stage { min-height: 0 !important; padding: 24px 16px !important; }
   /* Deixa a tabela quebrar de forma limpa se passar de uma página */
   .tbl-outer, table, tr, td, th { break-inside: avoid; page-break-inside: avoid; }
   ```
   Colocar num `<style>` no fim do `<head>` (não no início) para vencer especificidade sem reescrever o template.

2. Ajustar a chamada ao Browserless em `renderPdfViaBrowserless`:
   - Setar `viewport: { width: 1400, height: 900, deviceScaleFactor: 2 }` (o template foi desenhado para desktop; assim os grids `.prop-cards` e a tabela ficam com o layout de tela).
   - `waitForTimeout: 1200` (folga acima dos ~1.0s de animação total, redundante já que o CSS acima zera as animações — cinto e suspensórios).
   - Adicionar `emulateMediaType: "screen"` para o Chromium não trocar o media query e o layout do template continuar idêntico à visualização.
   - Manter `printBackground:true`, `landscape:true`, `preferCSSPageSize:true`.

3. Nada mais muda: `deal-quotes.tsx`, `quote.$token.tsx`, template no banco, secret `BROWSERLESS_TOKEN`, RLS e schema ficam intactos.

## Validação

- Typecheck do arquivo alterado.
- Após o rebuild da preview: baixar o PDF da Q-202607-1717 pelo menu ⋯ → "Baixar PDF" e conferir com `pdftotext -layout` + `pdftoppm` que aparecem: cards de destinatário/responsável/referência preenchidos, tabela de itens completa, subtotal / descontos / impostos / total, notas, termos e footer com selo.
- Rodar `tests/e2e/quotes-smoke.spec.ts` se aplicável.

## Fora do escopo

- Editar o template `Prosposta 001`.
- Trocar de provedor de headless.
- Cache de PDFs.
- Retirar as animações da página pública em `/quote/$token`.

## Riscos

- Se o template do usuário passar a depender de `@media print` explicitamente, o override de animação ainda vai valer (o CSS injetado é o último a entrar).
- `emulateMediaType:"screen"` é o comportamento que o template já assume; nada regride.
