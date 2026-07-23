# Correções: Anexos da importação + Gestor via Alocação

## 1. Corrigir download de anexos do Google Drive

**Problema atual (`src/lib/people/import-forms.functions.ts`)**
- `downloadDriveFile` chama `https://drive.usercontent.google.com/download?...&confirm=t`. Para arquivos grandes o Drive devolve HTML de confirmação, a função retorna `null` e o documento **não é importado** (caso do comprovante do Almir).
- Quando o download funciona mas o `content-type` não está no mapa `EXT_BY_MIME`, gravamos `.bin` (203 documentos hoje). Isso inclui PDFs servidos como `application/octet-stream` e imagens `image/*` fora do mapa.
- Nome do arquivo salvo é `${label}.${ext}` — perde o nome original do Drive.

**Correções**
- Reescrever `downloadDriveFile` para:
  1. Chamar `drive.usercontent.google.com/download?id=...&export=download` seguindo redirects e reaproveitando cookies via `Set-Cookie` → parsear o form/URL de confirmação retornado no HTML (campo `uuid`/`confirm`) e refazer o GET. Padrão documentado para arquivos > ~100 MB.
  2. Extrair o nome real do arquivo do header `Content-Disposition` (`filename*=UTF-8''...` ou `filename="..."`).
  3. Derivar extensão a partir do nome do arquivo quando presente; usar o mapa MIME apenas como fallback. Ampliar o mapa: `image/heif`, `image/tiff`, `image/bmp`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (xlsx), `application/vnd.ms-excel` (xls), `text/plain`.
  4. Se ainda assim ficar `application/octet-stream` sem extensão detectável, tentar sniff pelos primeiros bytes (`%PDF`, `\xFF\xD8\xFF` jpg, `\x89PNG`, `PK\x03\x04` para docx/xlsx/zip).
  5. Retornar `{ bytes, mime, ext, original_name }`.
- No loop de anexos, gravar `file_name = original_name ?? \`${att.label}.${ext}\`` e continuar usando `att.label` como `doc_type`.

**Reimportar retroativamente**
- Adicionar server fn `reimportPersonAttachments({ person_id })` que:
  - Lê `people_documents` da pessoa com `notes ILIKE 'Importado do Google Forms (Drive ID %'` e `(file_name LIKE '%.bin' OR file_url LIKE '%.bin')`.
  - Extrai o Drive ID do `notes`, baixa novamente pelo novo `downloadDriveFile`, faz upload em novo path e atualiza `file_url`/`file_name`/`doc_type` (mantém id).
  - Remove o objeto antigo `.bin` do bucket.
- Adicionar server fn `reimportMissingAttachmentsFromSheet({ sheet_url, offset, batch_size })` que percorre novamente a planilha e, para cada pessoa já existente, insere apenas os anexos ausentes (dedupe pelo Drive ID no path — mesma lógica já usada). Isso cobre o comprovante de endereço do Almir e outros que nunca chegaram a virar linha em `people_documents`.
- Expor os dois botões em `/people/import-forms` numa seção "Manutenção da importação" (dry-run + executar).

## 2. Mover a escolha de gestor para a aba Alocações

**Modelo**
- Adicionar coluna `manager_id uuid null references public.people(id) on delete set null` em `public.people_allocations` (migration; incluir GRANT já existente).
- Manter `people.manager_id` como valor "efetivo" da pessoa (usado por `getMyTeam` e políticas). Uma trigger `people_allocations_sync_manager` roda em INSERT/UPDATE/DELETE e recalcula `people.manager_id` como o `manager_id` da alocação ativa (`status='active'`, `starts_at <= today`, `ends_at IS NULL OR ends_at >= today`) mais recente por `starts_at`. Se não houver alocação ativa com manager, seta `null`.
- Backfill: para cada pessoa com `manager_id` atual e sem alocação com `manager_id`, criar/atualizar a alocação ativa mais recente com esse `manager_id` (fallback: nada muda).

**UI**
- `AllocationsPanel` (`src/components/people/allocations-panel.tsx`):
  - No dialog de criar/editar alocação, adicionar campo **Gestor** logo abaixo de "Contrato" e "Projeto". Usa combobox de pessoas (server fn `listPeople` já existente, filtrando `archived=false` e excluindo o próprio `person_id`).
  - Na listagem de alocações, mostrar linha "Gestor: Nome" abaixo do contrato/projeto.
- `src/lib/people/allocations.functions.ts`:
  - Adicionar `manager_id` ao `allocationSchema`, ao `AllocationRow`, ao select (`, manager:people!people_allocations_manager_id_fkey(id,full_name)`) e ao payload de upsert.
- Ficha da pessoa (`src/routes/_authenticated/people.$id.tsx`):
  - Remover o campo **Gestor** do formulário/aba Perfil.
  - No cabeçalho da ficha, adicionar chip "Gestor atual: Nome" (derivado de `people.manager_id`) apontando para o link da pessoa. Se não houver, chip "Sem gestor · definir na aba Alocações".
- `updatePerson` / `createPerson` (`src/lib/people/people.functions.ts`):
  - Remover `manager_id` do schema de update no formulário (não do tipo — a coluna continua). A trigger passa a ser a única fonte de verdade para `people.manager_id`.

## 3. Verificação

- Rodar `reimportPersonAttachments` para o Almir e conferir que o comprovante de endereço vira PDF na aba Documentos.
- Contar `people_documents WHERE file_url LIKE '%.bin'` → 0 após rodar em lote.
- Criar uma alocação com gestor → conferir que `people.manager_id` atualiza e a pessoa aparece em `/people/my-team` do gestor.
- Encerrar a alocação (`status=ended`) → `people.manager_id` volta a `null` (ou para outra alocação ativa).

## Detalhes técnicos

- Reuso das mesmas RLS/GRANT de `people_allocations` para o novo campo — sem novas policies.
- A trigger é `security definer` para poder atualizar `people` sem depender do RLS do caller; `set search_path = public`.
- Nenhuma mudança em `getMyTeam` — continua lendo `people.manager_id`.
- Downloads do Drive continuam saindo do worker; sem dependência de novos pacotes.
