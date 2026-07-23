# Plano: Visualização de documentos em modal

## Contexto
Na aba **Documentos** da ficha de pessoa (`/people/:id`), cada documento com arquivo anexado atualmente possui apenas as ações **Baixar**, **Editar** e **Remover**. O objetivo é adicionar uma ação de **visualização** que abra um modal sem sair da ficha.

## O que será implementado

1. **Novo componente `PersonDocumentViewerDialog`**
   - Local: `src/components/people/document-viewer-dialog.tsx`
   - Recebe o documento (`PeopleDocumentRow`) e controla `open/onOpenChange`.
   - Busca URL assinada de 5 minutos via server function existente `getDocumentDownloadUrl`.
   - Renderiza o arquivo conforme tipo:
     - **PDF**: iframe com Blob URL (evita `Content-Disposition: attachment`).
     - **Imagem**: `<img>` com a signed URL.
     - **Áudio/Video**: players nativos.
     - **Office** (.doc/.docx): visualizador embedado do Office Online.
     - **Texto**: pré-visualização do conteúdo.
     - **Outros**: link para abrir/download.
   - Estados de loading, erro e arquivo ausente.
   - Botões no header: **Baixar** (usando a signed URL) e **Fechar**.
   - Acessível: `aria-label`, foco no Dialog, ESC fecha.

2. **Adicionar botão de visualização na lista**
   - Local: `src/routes/_authenticated/people.$id.tsx` na função `DocumentsPanel`.
   - Ícone `Eye` (Lucide) ao lado do botão de download, apenas quando `d.file_url` existir.
   - Clique abre `PersonDocumentViewerDialog` com o documento selecionado.
   - `aria-label="Visualizar"` no botão ícone-only.

3. **Ajustes de UX/UI**
   - Manter consistência visual com os botões ghost/icon já existentes.
   - Usar tokens semânticos do projeto (`bg-muted`, `border-border`, etc.).
   - Modal com largura adequada (`max-w-4xl` para PDFs/imagens, `max-w-2xl` para fallback).

## O que NÃO será alterado
- Nenhuma migration, tabela, RLS, server function de negócio ou permissão.
- O fluxo de upload/download/editar/remover existente permanece inalterado.
- Não haverá alteração no `PersonDocumentDialog` de edição.

## Validação
- Typecheck/build (`bun run build` ou equivalente disponível).
- Verificar na preview que:
  - Documentos sem arquivo não exibem o botão de visualização.
  - PDFs e imagens abrem corretamente no modal.
  - Botão de download dentro do modal funciona.
  - Estados de erro são exibidos quando a URL assinada falha.