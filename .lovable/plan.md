
## Objetivo

Permitir visualizar o arquivo original de um contrato importado (PDF/DOCX salvo no bucket `contract-imports`, referenciado em `contracts.source_file_path`) em um modal, seguindo o mesmo padrão do visualizador já usado em `people/documents` (`PersonDocumentViewerDialog`): PDF renderizado via `blob:` URL, DOCX via Office Online Viewer, imagens/áudio/vídeo/texto inline e fallback com "Baixar".

## Escopo

1. **Server function** para gerar URL assinada do arquivo do contrato.
2. **Componente de visualização** dedicado a contratos.
3. **Botão "Visualizar"** na tela de detalhe do contrato quando existir `source_file_path`.

Não altera schema, RLS, upload nem lógica de importação.

## Passos

### 1. Server function `getContractSourceFileUrl`

Arquivo: `src/lib/contracts/import.functions.ts` (append).

- `createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])`.
- Input: `{ id: uuid }`.
- Handler:
  - Lê `contracts` (`id, source_file_path, imported_from, title, number`) sob RLS do usuário; se sem linha ou sem `source_file_path` → erro "Arquivo não disponível".
  - Chama `supabase.storage.from("contract-imports").createSignedUrl(source_file_path, 60 * 10)`.
  - Retorna `{ url, fileName, kind }` (fileName = basename do path; kind = `imported_from`).

### 2. Componente `ContractFileViewerDialog`

Arquivo novo: `src/components/contracts/contract-file-viewer-dialog.tsx`.

- Estrutura idêntica a `PersonDocumentViewerDialog`: mesmos estados (`url`, `pdfBlobUrl`, `pdfLoading/Error`, `textPreview`, `loading`, `error`), mesmo `kindOf`, mesmo header com "Baixar"/"Fechar", mesmo `DialogContent max-w-4xl p-0`.
- Diferenças mínimas:
  - `useServerFn(getContractSourceFileUrl)` no lugar de `getDocumentDownloadUrl`.
  - Props: `{ open, onOpenChange, contractId, fileName }`.
  - `DialogTitle` "Visualizar contrato" (sr-only).
- Mantém a estratégia PDF via `fetch → Blob → URL.createObjectURL` (mesma justificativa: contorna bloqueio do Chrome / força-download).
- Mantém Office Viewer para `.docx`.

### 3. Botão na tela de detalhe

Arquivo: `src/routes/_authenticated/contracts.$id.tsx`.

- Adicionar botão `Visualizar` (ícone `Eye`) no `PageHeader` de ações do contrato, exibido apenas quando `contract.source_file_path` estiver preenchido.
- Estado local `viewerOpen` controla o modal.
- Renderizar `<ContractFileViewerDialog open={viewerOpen} onOpenChange={setViewerOpen} contractId={contract.id} fileName={basename(contract.source_file_path)} />` no fim do componente.
- Na linha "Arquivo original" do card `Detalhes extraídos`, tornar o valor clicável (link que chama `setViewerOpen(true)`) para acesso rápido, mantendo o texto atual.

## Testes / Validação manual

1. Importar um `.pdf` → em `/contracts/$id`, clicar "Visualizar" → modal abre e renderiza o PDF inline; botão "Baixar" funciona.
2. Importar um `.docx` → visualizador abre via Office Online Viewer.
3. Contrato sem `source_file_path` → botão "Visualizar" não aparece.
4. Rodar `bunx tsgo --noEmit`.

## Detalhes técnicos

- Bucket já existente: `contract-imports` (privado). Não requer nova migration.
- RLS já cobre `contracts` — a server function apenas gera URL assinada quando o usuário tem acesso à linha.
- Não altera `updateContract`, `createContract`, nem o wizard de importação.
- Fora de escopo: viewer para contratos criados manualmente (sem `source_file_path`), edição inline do arquivo, versão nova via upload.
