## Diagnóstico

O PDF anexado (Q-202607-1717) tem 1 página A4 paisagem, foi gerado pelo **jsPDF 4.2.1** (pipeline atual: `html2canvas` → `jsPDF.addImage`) e contém **apenas** os elementos decorativos do template — retângulo rosa no topo, faixa vermelha embaixo, moldura de notebook — e o título "ITENS DA PROPOSTA". Todo o restante (dados do cliente, tabela de itens, totais, notas) sumiu.

Investiguei a cotação no banco: `template_id = 01a2c7aa-f235-4cd9-8b86-f3e7d380ebf8` ("Prosposta 001"), 22 KB de HTML, com:

- `transform: perspective(3200px) rotateX(1.8deg)` no wrapper `.nb` (o "notebook");
- várias camadas `position:absolute` com `inset` e `z-index`;
- `box-shadow` composto, `radial-gradient`/`linear-gradient` complexos;
- Google Fonts carregadas por `<link>` externo;
- todo o conteúdo dinâmico (`{{#each items}}`, dados do cliente, totais) é injetado **dentro** do elemento com `perspective + rotateX`.

Esse conjunto quebra o `html2canvas`. Ele consegue rasterizar o fundo (splits e a moldura), mas perde o conteúdo dentro do subtree transformado — exatamente o que o PDF mostra. Ajustar `useCORS`/`scale` não resolve; é limitação do próprio motor. E é frágil: qualquer template novo com `transform`, `filter`, `mask`, `backdrop-filter` ou fonte externa recai no mesmo bug.

O correto para PDF de documento com template HTML rico é renderizar no servidor via um navegador headless (Chromium) — foi assim que corrigimos casos parecidos antes e é o padrão dos concorrentes (Stripe, Ashby, HubSpot).

## O que fazer

### 1. Novo endpoint público de PDF (server-side, Chromium headless)

- Criar rota `src/routes/api/public/quotes/$token.pdf.ts` (server route, HTTP direto).
- Autorização: mesmo mecanismo do `getQuoteByToken` — o `public_token` da cotação já é o segredo; apenas exige `q.status != 'draft'` (mesma regra da página pública).
- Fluxo:
  1. Buscar cotação, itens, empresa, contato, agente e template (mesmos dados que `getQuoteByToken`).
  2. Montar o HTML **completo** aplicando `renderQuoteTemplate(template.html, ctx)` + `DOMPurify` (via `isomorphic-dompurify`, seguro em worker).
  3. Renderizar com Chromium headless em formato A4 landscape, `printBackground: true`, aguardando `networkidle0` e `document.fonts.ready` (Google Fonts).
  4. Retornar `application/pdf` com `Content-Disposition: attachment; filename="Proposta-<numero>.pdf"`.

- Runtime: o worker do Cloudflare **não** suporta Puppeteer/Chromium diretamente (é o que já está documentado em `<server-runtime>`). Opções, na ordem de preferência:
  - **A. Browserless (recomendado):** chamar API HTTPS `https://chrome.browserless.io/pdf` com o HTML montado. Requer `BROWSERLESS_TOKEN` como secret. Sem dependência nativa, funciona no worker. Custo pago; free tier baixo.
  - **B. Edge Function Supabase (Deno) usando `puppeteer` remoto ou `pdf-lib`+`playwright-aws-lambda`.** Mais operação, mais surface.
  - **C. Chromium binário no worker.** Não suportado hoje neste runtime; descartar.

  Vou seguir com a opção A e pedir o token via `secrets--add_secret` antes de codar o endpoint (não faço integração externa fake — sigo a regra "não fingir integração"). Se você preferir outra opção, me diz.

### 2. Trocar o gatilho client-side pelo download server-side

- `src/components/deals/deal-quotes.tsx`: item "Baixar PDF" passa a apontar para `/api/public/quotes/{token}.pdf` (link direto de download), em vez de `/quote/{token}?download=pdf`.
- `src/routes/quote.$token.tsx`:
  - botão "Baixar PDF" (ambos os layouts, com e sem template) chama o novo endpoint via `window.location.assign(...)` — download direto, sem passar por `html2canvas`.
  - remove o efeito de auto-download com `?download=pdf` (fica redundante).
- Manter `src/lib/quote-pdf.ts` apenas como fallback offline **ou** removê-lo. Prefiro remover para não deixar dois caminhos divergentes; se quiser manter como fallback, digo.

### 3. Higiene do template

Sem alterar a identidade visual do template "Prosposta 001", o Chromium headless renderiza tudo (transform, gradientes, sombras, fontes) fielmente. **Não** vou editar o template neste passo — o objetivo é que ele funcione como está.

### 4. Validação

- Testes automáticos existentes: `tests/e2e/quotes-smoke.spec.ts` (rodar).
- Manual (na cotação Q-202607-1717): abrir menu ⋯ → "Baixar PDF" → confirmar que o PDF baixado tem:
  - dados do destinatário (empresa, contato),
  - tabela de itens completa,
  - subtotal / descontos / impostos / total,
  - notas e termos,
  - moldura do notebook e faixas de fundo intactas,
  - fontes Inter aplicadas.
- Rodar em preview e em produção (preview usa mesmo banco / mesma cotação para reproduzir o caso real).

## Detalhes técnicos

- Endpoint como server route (`createFileRoute` + `server.handlers.GET`) sob `api/public/*` para permitir chamada direta do browser sem token de sessão; a autorização vem do `public_token` no path.
- HTML montado no servidor inclui um `<style>` extra com `@page { size: A4 landscape; margin: 0 }` e `html,body { margin:0 }` para o Chromium respeitar as bordas do template.
- Content-Type / Content-Disposition definidos manualmente. Sem cache (`Cache-Control: private, no-store`) para evitar servir PDF antigo após regeneração.
- Sem alterações em RLS/schema.
- Sem alterações em regras de negócio, permissões, autenticação, ou nos dados da cotação/template.

## Fora do escopo

- Refatorar/limpar o template "Prosposta 001".
- Adicionar seleção de layout (retrato/paisagem) ou paginação inteligente.
- Cache de PDFs.

## Pergunta antes de implementar

Confirma seguir com **Browserless** (opção A) usando um secret `BROWSERLESS_TOKEN`? Se preferir edge function Supabase (opção B) ou outro provedor (ex.: PDFShift, api2pdf, DocRaptor), me avise — a arquitetura é a mesma, só muda o cliente HTTP.
