## Problema

Na timeline, anexos PDF aparecem com o cabeçalho do card mas o conteúdo do PDF não é renderizado dentro do `<iframe>` — fica em branco, mostra "salvar como" ou tela cinza.

## Causa provável

`src/components/timeline/attachment-preview.tsx` (caso `kind === "pdf"`) carrega o PDF via signed URL do Supabase Storage diretamente em um `<iframe>`. Signed URLs do Supabase costumam vir com `Content-Disposition: attachment; filename=...` — vários navegadores (Chrome em especial) tratam isso como download e não renderizam o PDF inline no iframe. Para áudio/vídeo/imagem isso não afeta, mas para PDF inline sim.

Confirmação rápida (ao abrir a tela): no DevTools → Network, a resposta do PDF tem `Content-Disposition: attachment`.

## Correção (1 arquivo, escopo mínimo)

`src/components/timeline/attachment-preview.tsx`:

1. Para `kind === "pdf"`, **buscar o arquivo via `fetch(url)`**, transformar em `Blob` e gerar um `URL.createObjectURL(blob)` com `type: "application/pdf"`. O blob é local e ignora o header `Content-Disposition`, então o iframe renderiza inline em qualquer navegador.
2. Usar esse blob URL no `<iframe src=...#toolbar=1&navpanes=0>`.
3. Revogar o blob URL no cleanup do efeito (`URL.revokeObjectURL`) para não vazar memória.
4. Manter fallback: se o fetch falhar (CORS/rede), cair de volta para a signed URL atual + link "Baixar" no header.
5. Manter loading state ("Carregando PDF…") enquanto o blob é montado.

Sem mudanças no botão "Baixar" (continua usando a signed URL com `download`), sem mexer no header do card, no comportamento de outros tipos (imagem/áudio/vídeo/office/texto), em RLS, buckets, server functions ou regra de negócio.

## Fora do escopo

- Não alterar buckets, policies, server functions, schema ou outros componentes.
- Não trocar o visualizador por PDF.js/biblioteca externa (mantém solução nativa do navegador).
- Não mexer no caso `office` (Office Online já depende de URL pública, comportamento atual).

## Validação manual

1. Abrir um deal/lead/ticket com nota contendo PDF anexado.
2. PDF deve renderizar inline no card da timeline (1ª página visível, com toolbar do navegador).
3. Botão "Expandir" deve aumentar o iframe (h-80vh) sem quebrar.
4. Botão "Baixar" deve continuar baixando com o nome correto.
5. Trocar de aba/desmontar o componente: nenhum vazamento (blob revogado).

## Risco

Baixo. Mudança restrita ao branch `kind === "pdf"`. Fallback preservado para o comportamento atual.
