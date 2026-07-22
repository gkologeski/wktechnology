## 1. Empresa/contato não aparecem nos detalhes do lead

**Causa:** o `CreateLeadDialog` salva apenas `company_name` (texto), nunca `company_id`. Sem `company_id`, o `CompanyCard` em `AssociationsPanel` fica vazio na ficha do lead.

**Correção:** persistir `company_id: company.id ?? null` no insert de `leads` em `src/components/leads/create-lead-dialog.tsx`. Fazer o mesmo em `src/components/leads/quick-create-lead-*` se existir. Backfill opcional via SQL (ligar `leads.company_id` por `company_name` idêntico) — só depois de confirmar com o usuário.

## 2. Botão "Adicionar contato" ausente no lead

**Causa:** `LeadContactsCard` (em `src/components/record/associations-panel.tsx`) exibe somente `leads.converted_contact_id` e não oferece ação de vincular.

**Correção:** adicionar ação **Adicionar contato** no header do card (usando `AssocCard` padrão do arquivo) que abra o `ContactPickerPopover` (existente) para escolher um contato existente ou criar um novo via `CreateContactDialog`. Ao confirmar, atualiza `leads.converted_contact_id` e refaz o fetch. Adicionar também opção **Remover** no item quando houver contato vinculado.

## 3. Novo módulo global: Arquivos (TechERP)

Área global de arquivos com 100 MB por usuário e link público de leitura.

### Backend (migration)

- Storage bucket `user-files` (privado) via `storage_create_bucket`.
- Tabela `public.user_files`:
  - `id`, `owner_id` (auth.users), `folder_id` (nullable → `public.user_file_folders`), `name`, `storage_path` (`<owner_id>/<uuid>-<name>`), `size_bytes` (bigint), `mime_type`, `is_public` (bool), `public_token` (text unique nullable), `created_at`, `updated_at`.
- Tabela `public.user_file_folders`: `id`, `owner_id`, `parent_id` (self-fk), `name`, `created_at`.
- GRANTs para `authenticated` + `service_role`. RLS: `owner_id = auth.uid()`.
- Function `public.user_files_used_bytes(uid uuid)` retornando `sum(size_bytes)`.
- Trigger `BEFORE INSERT` em `user_files` que rejeita se `used + NEW.size_bytes > 100 * 1024 * 1024`.
- RLS em `storage.objects` para o bucket `user-files`: permitir CRUD apenas quando `bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text`.

### Server routes / functions

- `src/lib/files.functions.ts` (createServerFn, `requireSupabaseAuth`):
  - `listUserFiles({ folderId })`
  - `createFolder({ name, parentId })`
  - `renameFile({ id, name })` / `renameFolder`
  - `deleteFile({ id })` / `deleteFolder` (remove no storage + na tabela)
  - `togglePublicLink({ id, enable })` gera/revoga `public_token` (nanoid).
- `src/routes/api/public/files/$token.ts` (server route): busca `user_files` por `public_token`, se `is_public` verdadeiro cria signed URL no bucket privado via `supabaseAdmin` e redireciona.

### Frontend

- Rota `src/routes/_authenticated/files.tsx` (novo layout):
  - Header padrão (`PageHeader`).
  - Coluna esquerda: árvore de pastas.
  - Área central: grid/list de arquivos, breadcrumbs, uploader (drag-and-drop), barra de quota (KB/100MB).
  - Ações por arquivo (menu): Baixar, Renomear, Excluir, Compartilhar link (toggle público + copiar URL).
  - Diálogos de renomear / criar pasta / confirmar exclusão via `AlertDialog`.
  - Estados: `LoadingSkeleton`, `EmptyState`, `ErrorState`.
- Upload: chunked via `supabase.storage.from('user-files').upload(path, file)`, validando quota do lado cliente (chamando a server fn para saber uso atual) e o trigger garante do lado servidor.
- Entrada no sidebar: adicionar `{ title: "Arquivos", url: "/files", icon: FolderIcon }` no grupo **ERP** de `src/lib/menu-config-erp.ts`.

### Segurança

- Nunca expor `storage_path` sem passar pelo signed URL (60s).
- `public_token` é 32 chars, único, revogável.
- Sem PII no path; apenas UUID + nome sanitizado.
- Auditoria: registro em `access_audit_log` opcional em delete/share.

### Validação

- `tsgo` + `eslint`.
- Teste manual: upload → cota atualiza → gerar link → abrir aba anônima → revogar link → 404.
- Verificar `supabase--linter` após migration.

## Fora do escopo

- Preview de PDF/imagem in-app (fica para próxima iteração).
- Compartilhamento com usuários específicos do workspace.
- Versionamento.
