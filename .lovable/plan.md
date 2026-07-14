## Objetivo
Permitir ao usuário gerar/baixar a cotação em PDF a partir do card de cotações no detalhe do negócio.

## Abordagem
Reaproveitar a página pública `/quote/$token` (já otimizada para impressão com classes `print:*` e botão "Imprimir / PDF"). Vamos:

1. Aceitar um query param `?print=1` na rota `src/routes/quote.$token.tsx` que, após o carregamento do conteúdo, dispara `window.print()` automaticamente (uma única vez, com pequeno delay para garantir render de imagens/estilos).
2. Adicionar item **"Baixar PDF"** no `DropdownMenu` de cada cotação em `src/components/deals/deal-quotes.tsx`. A ação abre `${origin}/quote/{token}?print=1` em nova aba — o navegador exibe o diálogo de impressão, permitindo salvar como PDF.

## Por que essa abordagem
- Zero dependências novas (sem `jspdf`/`html2pdf`/servidor headless).
- Fidelidade visual garantida: usa o mesmo template já validado com o cliente, incluindo a correção recente de HTML formatado em notes/terms.
- Funciona igual para cotações em qualquer status (draft, sent, accepted…).

## Arquivos a alterar
- `src/routes/quote.$token.tsx` — ler `print` do `useSearch`/`URLSearchParams`; efeito que chama `window.print()` uma vez quando a cotação estiver carregada.
- `src/components/deals/deal-quotes.tsx` — adicionar item "Baixar PDF" no menu (entre "Copiar link" e "Editar"), abrindo `publicUrl(token) + "?print=1"` em nova aba.

## Fora do escopo
- Geração server-side de PDF (Puppeteer/wkhtmltopdf) — não necessária para o pedido e incompatível com o runtime Worker.
- Anexar PDF automaticamente ao e-mail — pode ser proposto depois.

## Validação
- Typecheck.
- Manual: abrir um deal com cotação → menu "Baixar PDF" → nova aba abre com diálogo de impressão pronto para salvar como PDF. Verificar que ao abrir a página pública sem `?print=1` o diálogo não dispara.