## Objetivo

Permitir associar um **negócio (deal)** a uma **vaga (ats_jobs)** pela UI. O schema já tem a coluna `ats_jobs.deal_id` e o `saveAtsJob` já aceita esse campo — falta somente expor na interface.

## Escopo

- Adicionar seletor de negócio no diálogo **Nova vaga** (`jobs.index.tsx`).
- Adicionar campo **Negócio** no painel de propriedades da vaga (`jobs.$id.tsx` → `JobPropertiesPanel`), com busca, limpar e link para o deal.
- Exibir o nome do negócio no card da lista (hoje só mostra um ícone `Link2` sem contexto).
- Criar server function `searchDeals` para alimentar o combobox.

Fora do escopo: alterações em RLS, migrations, tabela `deals`, fluxo `createJobFromDeal`, kanban de deals.

## Alterações

**Backend** — `src/lib/ats/ats.functions.ts`

- Nova server fn `searchDeals({ q?: string, ids?: string[] })` com `requireSupabaseAuth` que faz `select id, name, value, currency, company_id from deals` (limit 20, `ilike` no nome). Confia no RLS existente. Usada para autocomplete e para hidratar o deal já selecionado ao abrir a vaga.
- Ajuste no `saveAtsJob`: quando `deal_id` for enviado e `company_id` não for, buscar `deals.company_id` e preencher automaticamente (comportamento consistente com `createJobFromDeal`, mas só quando o usuário não sobrescreveu).

**UI — Nova vaga** (`src/routes/_authenticated/(ats)/jobs.index.tsx`)

- Novo campo no `form`: `deal_id: string | null`.
- Componente `DealPicker` inline (Popover + Command + Input de busca com debounce 300ms) usado no diálogo.
- Enviar `deal_id` no `save({ data: { ... } })`.
- No card (`JobCard`) e na linha de tabela: quando `deal.name` existir na resposta de `listAtsJobs`, mostrar `Negócio · {name}` no lugar do ícone solto. Para isso, `listAtsJobs` passa a incluir `deals(id, name)` via join do PostgREST no mesmo select.

**UI — Detalhe da vaga** (`src/routes/_authenticated/(ats)/jobs.$id.tsx`)

- Em `JobPropertiesPanel`, nova seção “Negócio” logo abaixo de Pipeline:
  - Se `job.deal_id`: badge com nome + `<Link to="/deals/$id">` (ícone external) + botão “Alterar/Remover”.
  - Se vazio: botão “Vincular negócio…” que abre o mesmo `DealPicker`.
  - O nome vem de `searchDeals({ ids: [job.deal_id] })` chamado uma vez no mount.
- Adicionar `deal_id` ao `form`, ao `dirty` check, ao `persist`.
- Passar `deal_id` no `save(...)` do `RecordLayout`.

**Componente compartilhado** — `src/components/ats/deal-picker.tsx` (novo)

- Combobox controlado com props `value`, `onChange`, `disabled`.
- Usa `searchDeals` server fn com debounce, mostra `name` + valor formatado.
- Reutilizado nos dois locais.

## Detalhes técnicos

- Sem migration: `ats_jobs.deal_id` já existe e o RLS de `deals` já limita a visibilidade.
- `searchDeals` retorna `{ id, name, value, currency, company_id }` — pequenas colunas, sem risco de vazamento.
- Auto-fill de `company_id`: aplicado apenas em `saveAtsJob` quando `deal_id` estiver presente **e** `company_id` não for enviado explicitamente, para não sobrescrever escolha manual.
- Join em `listAtsJobs`: `select("..., deals:deal_id(id, name)")`. Se o PostgREST FK inferir errado, cai para hidratação via `searchDeals({ ids })` num segundo passo.
- Tipos: atualizar o `JobRow` local de `listAtsJobs` para incluir `deal: { id: string; name: string } | null`.

## Validação

- `bunx tsgo --noEmit`
- Manual: criar vaga com negócio, editar vaga adicionando/removendo negócio, verificar link para `/deals/$id`, confirmar que o nome aparece no card da lista.

## Riscos

- Se `deals(id, name)` não for aceito pelo PostgREST por falta de FK explícita, usar o fallback via `searchDeals({ ids })`.
- Nenhuma mudança em RLS/negócio; comportamento aditivo.