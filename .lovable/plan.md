## Objetivo

Permitir anexar documentos ao enviar e-mails a partir das entidades (contato, lead, negócio, empresa) via `SendEmailDialog`, mantendo o restante do fluxo intacto.

## Escopo

- Somente o dialog de envio de e-mail (`src/components/email/send-email-dialog.tsx`) e a cadeia server-side que ele usa (`sendGmailEmail` + `buildRawMime`).
- Sem mudanças em templates, workflows, ATS emails ou outras superfícies de envio.

## UX

No `SendEmailDialog`, abaixo do editor de mensagem, adicionar:

- Botão "Anexar arquivo" (ícone `Paperclip`) que abre `<input type="file" multiple>`.
- Lista dos anexos selecionados com nome, tamanho formatado e botão remover.
- Limites: até 10 arquivos, 20 MB por arquivo, 25 MB no total (limite do Gmail). Validação client-side com toast em caso de erro.
- Estado de upload por arquivo (enviando / pronto / erro) enquanto sobe para o Storage.
- Botão "Enviar" desabilitado enquanto houver upload pendente.

## Armazenamento

- Novo bucket privado `email-attachments` (via `supabase--storage_create_bucket`).
- Path: `{owner_id}/{yyyy}/{mm}/{uuid}-{filename-sanitizado}`.
- Upload feito no cliente com o Supabase client autenticado (RLS: `owner_id = auth.uid()` para insert/select/delete no `storage.objects` do bucket).
- Os anexos são temporários para envio; sem UI de gerenciamento nesta fase.

## Server function

Estender `sendGmailEmail` (`src/lib/email-send.functions.ts`):

- Novo campo opcional `attachments: { path: string; filename: string; content_type: string; size: number }[]` (Zod: max 10, size total ≤ 25 MB).
- Antes de montar o MIME, baixar cada arquivo do bucket via `supabaseAdmin.storage.from("email-attachments").download(path)`, validando que o path começa com `${context.userId}/` (defesa em profundidade contra path forjado).
- Passar os buffers para `buildRawMime`.
- Após envio bem-sucedido, best-effort remove os arquivos do bucket (não bloqueia o retorno em caso de falha).
- Persistir metadados dos anexos em `email_messages.attachments` (JSONB `[{ filename, content_type, size }]`) — nova coluna via migration; RLS/GRANT já existentes na tabela.

## MIME

Refatorar `buildRawMime` em `src/lib/gmail.server.ts` para suportar anexos:

- Quando houver anexos, envelope externo `multipart/mixed` contendo:
  - parte `multipart/alternative` (text + html — igual hoje);
  - uma parte por anexo com `Content-Type: {mime}; name="..."`, `Content-Disposition: attachment; filename="..."`, `Content-Transfer-Encoding: base64` e payload base64 quebrado em linhas de 76 chars.
- Sem anexos, comportamento atual permanece (multipart/alternative direto).
- Sanitização básica do filename no header (RFC 2047 encoded-word para não-ASCII, reuso do `encodeHeader`).

## Detalhes técnicos

Arquivos a alterar:
- `src/components/email/send-email-dialog.tsx` — UI, upload, validação, envio dos paths.
- `src/lib/email-send.functions.ts` — schema Zod + download dos anexos + persistência.
- `src/lib/gmail.server.ts` — `buildRawMime` com suporte a `attachments: { filename; contentType; data: Buffer }[]`.

Migrations:
- Criar bucket privado `email-attachments` (via tool) + policies em `storage.objects` para `authenticated` restritas a `bucket_id = 'email-attachments' AND (storage.foldername(name))[1] = auth.uid()::text`.
- `ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;`

Fora do escopo:
- Preview/download de anexos recebidos (inbound) na timeline.
- Reuso de arquivos entre múltiplos envios.
- Anexos em envios ATS/workflow/templates.

## Validação manual

1. Abrir um contato → botão E-mail → anexar 1–3 arquivos (PDF/imagem) → enviar → verificar caixa de saída do Gmail com anexos íntegros.
2. Tentar anexar >25 MB total → erro amigável; envio bloqueado.
3. Anexar, remover antes de enviar → arquivo removido do bucket (ou expira sem lixo).
4. Enviar sem anexos → fluxo atual inalterado.
