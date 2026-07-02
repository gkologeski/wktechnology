# Busca Global TechERP (estilo HubSpot) — escopo completo

## Referência
HubSpot Global Search (*knowledge.hubspot.com/account/use-the-search-in-your-hubspot-account*): input único, resultados enquanto digita, grupos por tipo, chips de filtro, navegação por teclado, atalho "/" para comandos, recentes/pinned, escape hatch para IA.

## Estado atual
- `global-search-trigger.tsx` abre `copilot-cmdk.tsx`, que é **apenas Q&A** via `askCopilot`. Não há busca cross-entity nem índice full-text.

## Escopo (tudo incluído)

### Backend

**Extensões e índices** (`supabase/migrations/<ts>_global_search.sql`)
- `create extension if not exists pg_trgm;`
- Índices GIN `gin_trgm_ops` em: `contacts(name,email)`, `companies(name)`, `deals(title)`, `tickets(subject)`, `activities(title)`, `ats_candidates(name,email)`, `ats_jobs(title)`, `notes(body)`, `messages(body)`, `emails(subject,body)`.
- Coluna `search_tsv tsvector` gerada + índice GIN nas entidades de texto longo (`notes`, `messages`, `emails`) para ranking BM25 via `ts_rank_cd`.
- Tabela `search_recent (user_id, entity_type, entity_id, title, url, opened_at)` e `search_pinned (user_id, entity_type, entity_id, title, url, pinned_at)` com RLS por `auth.uid()` e GRANTs para `authenticated`/`service_role`.

**Server functions** (`src/lib/search/*.functions.ts`)
- `globalSearch({ q, types?, limit })` — protegido por `requireSupabaseAuth`; consulta paralela por entidade (`ilike` + `pg_trgm` similarity para ranking curto; `ts_rank_cd` em textos longos); respeita `user_data_scope` e RLS; retorna `{ groups, took_ms }`.
- `recordRecent({ entity_type, entity_id, title, url })` — upsert em `search_recent`, mantém 20 mais recentes por usuário (trigger de poda).
- `listRecent()` / `listPinned()` — lê recentes e pinned.
- `togglePin({ entity_type, entity_id, title, url })` — insert/delete em `search_pinned` (limite 10).

### Frontend

**Componente principal** `src/components/global-search/global-search.tsx`
- `CommandDialog` (`cmdk` do `src/components/ui/command.tsx`).
- Input com debounce 150 ms → `useQuery(['global-search', q, types], globalSearch, { staleTime: 30_000 })`.
- Chips de filtro por tipo (multi-toggle) alimentando `types`.
- Grupos com `<CommandGroup heading=...>`, ícone por tipo, título com destaque via `<mark>` (helper `highlight.tsx`), subtítulo com metadados (email, empresa, dono).
- Ao abrir sem query: mostra **Fixados** e **Recentes** (via `listPinned` + `listRecent`).
- Ao selecionar item: chama `recordRecent` e navega para `url` do tipo (contato→`/contacts/$id`, empresa→`/companies/$id`, negócio→`/deals/$id`, ticket→`/tickets/$id`, tarefa→drawer via evento, candidato→`/candidates/$id`, vaga→`/jobs/$id`, config→rota de settings).
- Ação **📌 Fixar/Desafixar** por item (hover) via `togglePin`.
- **Modo "/" (comandos)**: se query começa com `/`, filtra ações rápidas (criar contato, criar negócio, ir para dashboard, abrir configurações, etc.) definidas em `src/components/global-search/commands.ts`.
- **Escape hatch IA**: botão fixo no rodapé "Perguntar ao Copilot" e sugestão inline "Perguntar ao Copilot: '<q>'" quando não há resultados; alterna o painel para o Q&A atual (reaproveita `askCopilot`).
- Rodapé com dicas de teclado (`↑↓ navegar`, `↵ abrir`, `/ comandos`, `esc fechar`).
- Estados: loading (skeletons por grupo), empty com CTA IA, erro com retry.

**Highlight** `src/components/global-search/highlight.tsx` — quebra a string por termo e envolve em `<mark>` (escape HTML seguro).

**Trigger** `src/components/global-search-trigger.tsx` — atualizar `dispatchEvent` para `global-search:open` (manter `⌘K`).

**Root** `src/routes/_authenticated.tsx` — substituir `<CopilotCmdK />` por `<GlobalSearch />`.

### Entidades cobertas
CRM: `contacts`, `companies`, `deals`, `tickets`, `activities`.
ATS: `ats_candidates`, `ats_jobs`.
Conteúdo longo (com ranking BM25): `notes`, `messages`, `emails`.
TechERP: itens de **Configurações** e **Controle de Acesso** (catálogo estático client-side com `keywords`).

### Segurança
- Todas as consultas via `requireSupabaseAuth` + RLS existente; sem service_role.
- `sanitizeRecord`/`user_data_scope` aplicados por entidade.
- `search_recent`/`search_pinned` restritas ao próprio `auth.uid()`.

## Arquivos

**Criar**
- `supabase/migrations/<ts>_global_search.sql`
- `src/lib/search/global-search.functions.ts`
- `src/lib/search/recent-pinned.functions.ts`
- `src/components/global-search/global-search.tsx`
- `src/components/global-search/highlight.tsx`
- `src/components/global-search/commands.ts`

**Alterar**
- `src/components/global-search-trigger.tsx`
- `src/routes/_authenticated.tsx`

**Remover (após validação)**
- `src/components/copilot-cmdk.tsx` (Q&A migra para dentro do `GlobalSearch`).

**Manter**
- `src/lib/copilot.functions.ts` — usado pelo modo IA.

## Validação
- Type-check + build automáticos.
- Manual: digitar "cite" mostra grupos em <300 ms; ⌘K abre com Recentes/Fixados; chips filtram; teclado navega; `/` mostra comandos; sem resultado abre CTA Copilot; abrir item registra em Recentes; fixar aparece em Fixados; usuário com escopo `own` só vê próprios.

## Riscos
- Sem `pg_trgm`, `ilike '%q%'` faz seq-scan → mitigado pelos índices GIN.
- 10 entidades paralelas: mantido `LIMIT 5` por grupo + cache 30 s.
- `search_tsv` gerado requer reindex inicial em bases grandes — migration usa `CREATE INDEX CONCURRENTLY` quando possível.