Plano para corrigir o preview de PDF em Pessoas:

1. Ajustar o modal de documentos
- Em `src/components/people/document-viewer-dialog.tsx`, impedir que PDFs sejam renderizados no `<iframe>` usando diretamente a URL assinada.
- Para PDF, usar somente `blob:` URL criada via `fetch(url).blob()`.
- Enquanto o blob estiver sendo preparado, mostrar estado de carregamento dentro do modal.
- Se o carregamento do blob falhar, mostrar uma mensagem com ação manual de baixar/abrir, sem tentar embutir a URL assinada no iframe.

2. Corrigir ciclo de vida do blob
- Revogar corretamente `URL.createObjectURL` ao fechar o modal ou trocar de documento.
- Evitar estado antigo de PDF aparecendo ao abrir outro arquivo.
- Usar controle de cancelamento para não atualizar estado após fechar o modal.

3. Manter o backend como está, salvo se a validação mostrar necessidade
- O server function `getDocumentDownloadUrl` já retorna URL válida e o request do preview respondeu `200` com conteúdo `%PDF`.
- O problema confirmado está no frontend: o modal ainda pode apontar o iframe para a URL assinada antes do blob estar pronto, o que permite o Chrome tratar o arquivo como download/bloqueio.

4. Validar no preview
- Abrir a pessoa atual em `/people/41a4be1c-4901-4c2d-b69d-2122af7854b3`.
- Clicar em visualizar um PDF.
- Confirmar que o PDF aparece dentro do modal, sem download automático e sem mensagem de bloqueio do Chrome.
- Conferir console/network para garantir ausência de erro relevante.

Escopo restrito: somente a visualização inline de PDFs no modal de documentos de Pessoas; sem alterar storage, permissões, imports ou lógica de documentos fora desse fluxo.