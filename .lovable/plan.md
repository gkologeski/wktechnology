## Objetivo
Adicionar o campo **CNPJ** à entidade Empresa (`companies`), com validação, formatação, exposição em UI, enriquecimento automático via API pública e backfill dos CNPJs já presentes no HubSpot.

## Escopo

### 1. Banco de dados (migration)
- Adicionar coluna `cnpj text` em `public.companies` (nullable).
- Constraint `CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$')` — armazenar somente dígitos.
- Índice único parcial por workspace: `UNIQUE (owner_id, cnpj) WHERE cnpj IS NOT NULL AND deleted_at IS NULL`.
- Adicionar `cnpj_enriched_at timestamptz NULL` para controlar quando o registro foi enriquecido pela última vez (evitar re-consultas).

### 2. Validação e formatação
- `isCNPJ(v)`, `formatCNPJ(digits)` e `stripCNPJ(v)` em `src/lib/validators.ts`.
- Validação inclui dígitos verificadores oficiais (mod 11).

### 3. UI — Exibição e edição
- **PropertiesPanel** em `src/routes/_authenticated/companies.$id.tsx`: adicionar `{ key: "cnpj", label: "CNPJ", primary: true }`.
- Suportar novo tipo `cnpj` em `src/components/properties-panel.tsx` (máscara ao digitar + validação inline + botão "Enriquecer via CNPJ").
- Adicionar campo CNPJ no diálogo de criação de empresa (Quick Create + qualquer form similar).
- Coluna opcional CNPJ na lista `/companies` via editor de colunas.

### 4. Catálogo de campos (Workflows / Filtros)
- Adicionar `cnpj: "CNPJ"` no mapa `LABELS` de `src/lib/entity-fields.functions.ts`.

### 5. Enriquecimento automático via API pública (BrasilAPI)
- Nova server function `enrichCompanyByCNPJ` em `src/lib/integrations/cnpj-enrichment.functions.ts`:
  - Input: `{ companyId }` ou `{ cnpj }`.
  - Middleware: `requireSupabaseAuth`.
  - Consulta `https://brasilapi.com.br/api/cnpj/v1/{cnpj}` (pública, sem chave, com fallback para `receitaws.com.br` em caso de 5xx/timeout).
  - Rate limit local: 3 req/s por owner via bucket em memória (best-effort) + respeitar `Retry-After` em 429.
  - Sanitização: mapear resposta para colunas de `companies` (nome fantasia → `name` se vazio, `razao_social` → `description`, `logradouro/numero/complemento` → `address`, `municipio` → `city`, `uf` → `state`, `cep` → `cep`, `ddd_telefone_1` → `phone`, `cnae_fiscal_descricao` → `industry`).
  - Modo `fill_empty` (default) preserva campos já preenchidos pelo usuário; modo `overwrite` opcional via parâmetro.
  - Atualiza `cnpj_enriched_at`.
  - Persiste um item em `enrichment_jobs` + `enrichment_job_items` para aparecer no histórico em `/settings/enrichment` (reuso do padrão existente com `provider: "brasilapi"`).
- **Trigger automático**: após criar/editar empresa com CNPJ válido e `cnpj_enriched_at IS NULL`, o cliente chama a server function em background (fire-and-forget com toast de sucesso/erro).
- Ação manual "Enriquecer via CNPJ" no PropertiesPanel força re-consulta (respeita cooldown de 24h salvo `?force=true`).

### 6. Bulk enrichment por CNPJ
- Nova ação em `src/components/enrichment/bulk-enrich-dialog.tsx` (ou variante): "Enriquecer empresas por CNPJ" — processa em lote as empresas selecionadas que já possuem CNPJ preenchido, reaproveitando `enrichment_jobs`.

### 7. Migração dos CNPJs do HubSpot
- Migration SQL (com `insert` tool após aprovação):
  - Backfill: `UPDATE companies SET cnpj = regexp_replace(hs_raw->>'cnpj', '[^0-9]', '', 'g') WHERE cnpj IS NULL AND hs_raw ? 'cnpj' AND regexp_replace(hs_raw->>'cnpj', '[^0-9]', '', 'g') ~ '^[0-9]{14}$';`
  - Também tenta chaves alternativas usadas pelo HubSpot: `cnpj_da_empresa`, `tax_id`, `br_cnpj`, `documento`.
  - Empresas com dígitos inválidos vão para log auditável em `hs_raw->'_cnpj_import_error'` (não bloqueia migração).
- Ajustar `src/lib/integrations/hubspot-sync.server.ts` (e/ou o mapper equivalente) para incluir `cnpj` no mapeamento bidirecional:
  - Import HubSpot → CRM: escreve `companies.cnpj` normalizado.
  - Push CRM → HubSpot: envia como propriedade `cnpj` (mesma chave usada pelo cliente no HubSpot).
- Documentar no `docs/visibility-matrix.md` ou changelog interno.

### 8. Tipagem
- `Database` regenera após a migration; `Company` cobre `cnpj` e `cnpj_enriched_at` automaticamente via `src/lib/db-types.ts`.

## Fora do escopo
- Adicionar CNPJ em Contato ou Lead.
- Consulta de sócios / QSA (BrasilAPI retorna, mas não vamos persistir em novo schema neste ciclo).
- Enriquecimento pago (Apollo/Lusha) sobre CNPJ — mantém enriquecimento existente para leads/contatos.

## Validação final
1. Criar empresa com CNPJ válido → dados fiscais preenchidos automaticamente (fill_empty).
2. Criar empresa com CNPJ inválido → erro inline; nenhuma chamada de enriquecimento disparada.
3. Duplicidade de CNPJ no mesmo workspace → bloqueada pelo índice único.
4. Empresa vinda do HubSpot com CNPJ em `hs_raw` → aparece populada após migration.
5. Job de enriquecimento aparece em `/settings/enrichment` com `provider: brasilapi`.
6. Botão "Enriquecer via CNPJ" no detalhe da empresa força atualização respeitando cooldown.
7. Filtro/workflow por "CNPJ" com rótulo em português.
