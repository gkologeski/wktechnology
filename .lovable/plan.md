## Diagnóstico

O PDF ainda falha no Chrome porque o template padrão "Prosposta 001" (22 KB de HTML) usa recursos que o PDFium renderiza mal mesmo após o achatamento atual:

- Blocos `.stage` com `100vh`, `position: absolute/fixed`, sobreposições e grids que dependem de altura de viewport — no PDF viram áreas em branco no topo (visível no screenshot: só a barra de metadados aparece).
- `backdrop-filter`, `filter`, gradientes com `oklch` e camadas com `mix-blend-mode` que já sanitizamos, mas ainda deixam áreas invisíveis quando combinadas com transformações internas do template.
- Layout pensado para tela (scroll + animações) e não para uma página A4 paisagem impressa.

Preservação (Quartz/Preview) funciona porque é tolerante a esses operadores; PDFium não.

## Objetivo

Manter o "desenho" (cabeçalho vermelho, faixa de metadados, tabela de itens, blocos de totais/observações/termos/assinatura) mas em um layout print-first que renderize idêntico em Chrome, Preview, Adobe e navegadores móveis, em 1 página A4 paisagem.

## Escopo

Alterações ficam restritas a apresentação/print:

1. Novo template `Proposta Print` (system, `is_default: true`) — HTML e CSS reescritos com foco em impressão:
   - `@page { size: A4 landscape; margin: 12mm }`, sem `100vh`, sem `position: absolute` para o layout principal.
   - Cabeçalho com faixa vermelha, número da cotação, título, cliente e status em `flex` simples.
   - Barra de metadados (Emitida / Válida até / Referência) em linha única.
   - Tabela `<table>` semântica para itens (ITEM/DESCRIÇÃO, QTD, PREÇO UNIT., DESC., IMP., TOTAL) com `border-collapse` e `page-break-inside: avoid` por linha.
   - Blocos de Totais, Observações, Termos e Assinatura em grid de 2 colunas usando `display: table` (mais estável no PDFium que `grid`).
   - Tipografia system-ui, cores em `rgb()` direto (sem `oklch`/`color-mix`), sem `backdrop-filter`, `filter`, `mask`, animações ou transições.
   - Mesma paleta vermelha atual e mesma hierarquia visual do template Prosposta 001.

2. Migration para inserir o novo template como padrão do sistema e desmarcar `is_default` dos anteriores. Não deleta templates existentes — usuários que já customizaram continuam com o deles.

3. Endpoint `GET /api/public/quotes/$token/pdf` (`src/routes/api/public/quotes/$token.pdf.ts`):
   - Mantém sanitização `oklch → rgb` e overrides defensivos (para templates legados).
   - Remove o script de `zoom` dinâmico quando o template já cabe em uma página (o novo template é dimensionado para caber por construção).
   - Continua chamando Browserless com `A4 landscape`, `printBackground: true`, `emulateMediaType: "screen"`.

4. Renderer `src/lib/quote-template-renderer.ts` — sem mudança de contrato; apenas confirma que todos os campos usados pelo novo HTML (`{{quote.number}}`, `{{#each items}}`, totais, etc.) já são suportados. Adiciono os que faltarem, se algum.

## Fora de escopo

- Wizard de edição, permissões, RLS, envio por e-mail, link público, status da cotação.
- Templates customizados dos usuários (permanecem como estão; só o padrão do sistema muda).
- Geração client-side de PDF (já removida).

## Validação

- Gerar PDF de `Q-202607-1717` e `Q-202607-2416` via Browserless em preview.
- Rasterizar com `pdftoppm` e conferir visualmente: sem faixa branca no topo, tabela completa, 1 página, cores corretas.
- Abrir o PDF gerado no Chrome (via curl + `file://`) e no Preview do macOS — ambos devem exibir o mesmo conteúdo.
- Rodar `bunx vitest run` e `bunx tsgo` para garantir que renderer/endpoint continuam tipados.

## Riscos

- Cotações que já usam explicitamente o template "Prosposta 001" continuam com o problema no Chrome. Mitigação: manter os overrides CSS atuais no endpoint para esses casos e documentar no relatório final.
- Pequenas diferenças visuais entre o template antigo e o novo (mesma identidade, mas sem os efeitos decorativos que quebram no PDFium).
