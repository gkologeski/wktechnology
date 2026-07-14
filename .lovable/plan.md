## Objetivo

Trocar o fluxo "Baixar PDF" para gerar e baixar um **arquivo PDF real** (sem abrir diálogo de impressão) mantendo **fielmente o design da proposta** exibida na página pública `/quote/:token` (o mesmo layout do primeiro anexo).

## Diagnóstico

- Hoje `deal-quotes.tsx` abre `/quote/{token}?print=1`, e `quote.$token.tsx` chama `window.print()` → o navegador abre "Salvar como PDF" do sistema, que aplica as regras de `@media print`, remove backgrounds vermelhos (por padrão o Chrome não imprime background-colors), reflowa o layout e é o motivo da divergência do PDF anexado.
- Precisamos rasterizar o próprio DOM da proposta (com estilos reais, incluindo o cabeçalho vermelho e o card do total) e empacotar em um `.pdf`.

## Abordagem

Renderização client-side do DOM já pintado, via `html2canvas` + `jsPDF`, capturando o **contêiner do template** (ou do fallback) e baixando `Proposta-<numero>.pdf`.

### Passos

1. **Dependências**
   - `bun add html2canvas jspdf`.

2. **Novo utilitário** `src/lib/quote-pdf.ts`
   - Função `downloadQuotePdf(el: HTMLElement, filename: string)`:
     - `html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: el.scrollWidth })`.
     - Cria `jsPDF("p","mm","a4")`, calcula proporção pela largura da página (210mm) e pagina verticalmente quando `pdfHeight > 297mm` (loop `addPage` deslocando `position` — mesmo padrão do snippet de referência).
     - `pdf.save(filename)`.

3. **Página pública `src/routes/quote.$token.tsx`**
   - Envolver o conteúdo renderizado (ambos os caminhos: `TemplatedQuote` e fallback `Card`) num `<div ref={paperRef} data-quote-paper>` que já contém todo o visual final.
   - Substituir a lógica de `?print=1`:
     - Ler `params.get("download") === "pdf"` (mantendo compat com `print=1` como alias para download).
     - Após dados carregados + `requestAnimationFrame` duplo (aguardar fontes/imagens), chamar `downloadQuotePdf(paperRef.current, \`Proposta-\${quote.number}.pdf\`)`.
     - Usar `document.fonts.ready` antes do capture para evitar fallback de fonte.
   - Trocar os dois botões "Imprimir / PDF" por "Baixar PDF" que chamam a mesma função (mantém utilidade quando aberto manualmente).

4. **Menu do deal** `src/components/deals/deal-quotes.tsx`
   - Trocar `?print=1` por `?download=pdf` na abertura da nova aba (a aba fecha sozinha? não — deixamos aberta; o download dispara automaticamente). Label continua "Baixar PDF".

5. **Ajustes de fidelidade visual**
   - Remover regras `@media print` que escondiam elementos (garantir que o capture seja idêntico ao que o cliente vê online) — mas manter `print:hidden` nos botões e no rodapé de ações **antes** de rasterizar, adicionando classe temporária `data-capturing` durante `downloadQuotePdf` para forçar `.print\\:hidden { display:none }` via um `<style>` injetado apenas durante a captura. Isso evita que os botões e badges de status apareçam no PDF.
   - Forçar `background-color` e cores exatas garantindo que `html2canvas` capture (o red header já é `background-color`, então funcionará sem a limitação do print do Chrome).

6. **Fallback / erros**
   - Se `html2canvas` falhar, `toast.error` e permanecer na página.
   - Sem alteração no backend, no template renderer, ou em qualquer regra de negócio/RLS.

## Detalhes técnicos

- `html2canvas` tem limitações conhecidas: `oklch()` e `color-mix()` do Tailwind v4 podem quebrar. O template principal (o do anexo vermelho) usa cores fixas em `#...`, então ok. Para o fallback (que usa tokens shadcn/oklch), aplicaremos um wrapper com `style="color-scheme: light"` e um `<style>` temporário que sobrescreve `--background:#fff;--foreground:#111;--muted:#f3f4f6;--muted-foreground:#6b7280;--border:#e5e7eb` durante a captura, evitando parse de `oklch()`.
- Paginação: reutilizar o padrão referenciado (calcula `imgHeight` proporcional, cria páginas A4 sucessivas deslocando `position` negativamente em `addImage`).
- Nome do arquivo: `Proposta-<quote.number>.pdf` (fallback `Proposta-<token>.pdf`).

## Arquivos afetados

- `package.json` (novas deps)
- `src/lib/quote-pdf.ts` (novo)
- `src/routes/quote.$token.tsx` (troca do fluxo print → download; ref no wrapper)
- `src/components/deals/deal-quotes.tsx` (troca de `print=1` para `download=pdf`)

## Fora de escopo

- Geração server-side (Puppeteer/Chromium em Worker) — inviável no runtime atual e desnecessário para este caso.
- Reestilizar o template ou alterar o renderer.

## Validação manual

1. Deal → Cotações → menu **⋯** → **Baixar PDF** → nova aba abre, dispara download `Proposta-Q-....pdf`.
2. Abrir o PDF: cabeçalho vermelho, card de total vermelho, tabela de itens, observações/termos com HTML formatado — idêntico ao print anexo do usuário.
3. Página pública aberta manualmente: botão "Baixar PDF" também gera o arquivo.
4. Proposta longa (várias páginas) → PDF com múltiplas páginas A4 sem cortar linhas ao meio de forma severa.
