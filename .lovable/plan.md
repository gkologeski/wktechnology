# Image Input unificado (URL + Upload) — estilo HubSpot

## Objetivo
Substituir os campos "somente URL" de imagem por um controle único com duas abas: **Upload** (arquivo local) e **URL** (link externo), além de um botão "Escolher da biblioteca" que abre a Media Library compartilhada do workspace.

## 1. Storage: bucket `media`

Criar novo bucket **público** `media` (compatível com logos/favicons/OG images que precisam ser servidos por URL pública para terceiros — e-mails, navegador, redes sociais).
- Caminho: `media/{workspace_id}/{yyyy}/{mm}/{uuid}-{filename}`
- Tipos aceitos: imagens (png, jpg, jpeg, webp, gif, svg, ico), PDF, e documentos comuns (docx, xlsx, pptx, txt, csv).
- Limite por arquivo: 10 MB (validado no cliente + no server fn).
- Políticas RLS em `storage.objects`:
  - SELECT público (`anon` + `authenticated`) no bucket `media` — necessário para servir logos em e-mails/landing pages.
  - INSERT/UPDATE/DELETE: `authenticated` apenas quando o primeiro segmento do path == workspace do usuário (via `has_workspace_access`/owner check do projeto).

Tabela auxiliar `public.media_assets` (opcional, mas recomendada para a biblioteca):
```
id uuid pk, workspace_id uuid, owner_id uuid,
bucket text default 'media', path text,
filename text, mime text, size_bytes int,
public_url text, width int, height int,
created_at timestamptz default now()
```
+ GRANT padrão (`authenticated` CRUD, `service_role` ALL), RLS por workspace, índice em `(workspace_id, created_at desc)`.

## 2. Server functions (`src/lib/media.functions.ts`)
- `uploadMedia({ filename, mime, base64 | signed-upload })` → grava no bucket, insere em `media_assets`, retorna `{ id, public_url }`.
  - Preferir fluxo de **signed upload URL** (`createSignedUploadUrl`) para evitar trafegar bytes pelo server fn.
- `listMedia({ q?, type?, limit, cursor })` — paginado por workspace.
- `deleteMedia({ id })` — remove do storage + tabela.

## 3. Componente `<ImageInput>` (`src/components/ui/image-input.tsx`)
Props: `value: string | null`, `onChange(url)`, `accept?`, `aspect?`, `label?`, `recommendedSize?`.

UI (estilo HubSpot):
- Preview à esquerda (thumb 96×96) + botões "Substituir" / "Remover".
- Popover/Dialog com 3 abas: **Upload** (drag-and-drop + click), **URL** (input + validação), **Biblioteca** (grid de `listMedia`).
- Aba Upload: progress bar, validação de mime/tamanho, após sucesso preenche `onChange(publicUrl)`.
- Aba URL: textbox + "Aplicar".
- Aba Biblioteca: busca + grid clicável.

Variante `<FileInput>` (mesmo controle, sem restrição a imagem) para PDFs/anexos.

## 4. Página Media Library (`/settings/media`)
- Lista grid de `media_assets`, filtros por tipo, busca, ações copiar URL/excluir, upload em massa.
- Item no menu Settings.

## 5. Pontos de substituição (varredura concluída)
Trocar `<Input>` URL atual por `<ImageInput>`:
- `src/components/branding/controls-panel.tsx` — `logo_url`, `favicon_url`.
- `src/components/branding/branding-builder.tsx` — mesmo state.
- `src/lib/platform-admin.functions.ts` consumers — workspace `logo_url` (admin workspaces form).
- `src/components/landing-pages/blocks.tsx` (linha 235) — bloco Image `src` + também blocos Hero/Logos/Testimonial que tenham imagem.
- Landing page Settings → OG image.
- `src/components/quote-templates/visual-editor.tsx` (linha 694) — bloco imagem.
- `src/components/word-editor.tsx` (linha 270) — substituir `window.prompt` por abrir o ImageInput.
- Avatares/upload de perfil se existirem URLs manuais (verificar `profiles`).

Manter inalterado: `whatsapp-catalogs` (imagens vêm sincronizadas da Meta), webhooks e mídia recebida via Twilio/WhatsApp (já têm fluxo próprio).

## 6. Telemetria/segurança
- Sanitizar filename (slug + uuid).
- Rejeitar SVG com `<script>` (regex no server fn) ou servir SVG com `Content-Disposition: attachment`.
- Bucket público → não armazenar nada sensível; documento privado continua em `notes-attachments` (já existente).

## Fora de escopo
- Edição de imagem (crop/resize) — pode entrar em fase 2.
- CDN/transformações on-the-fly.
- Migração retroativa de URLs existentes (continuam funcionando).

## Detalhes técnicos
- Bucket criado via `supabase--storage_create_bucket` (não SQL).
- Políticas e tabela `media_assets` via migration única com GRANTs.
- Upload usa `supabase.storage.from('media').uploadToSignedUrl(...)` no cliente após server fn devolver token, evitando passar bytes pelo TanStack server fn (limite de payload).
