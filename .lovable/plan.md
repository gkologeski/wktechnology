## Objetivo
Gerar o PDF da cotação em orientação **paisagem** (A4 landscape) em vez de retrato.

## Alteração
- `src/lib/quote-pdf.ts`:
  - Trocar `new jsPDF({ orientation: "portrait", ... })` por `orientation: "landscape"`.
  - Como agora `pageWidthMm=297` e `pageHeightMm=210`, a lógica de multi-página existente (baseada em `pageWidthMm`/`pageHeightMm` do próprio PDF) continua válida sem outras mudanças.
  - A imagem continuará sendo ajustada à largura da página (297mm); páginas adicionais serão adicionadas se o conteúdo for mais alto que 210mm.

## Fora de escopo
- Não altero o layout da página pública da cotação (`quote.$token.tsx`) — apenas a orientação do arquivo PDF gerado.
- Não altero o fluxo de impressão nem outros exports.
