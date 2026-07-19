## Plano revisado — Multi-CNPJ + Import ContaAzul (WK Technology)

### Análise da necessidade multi-CNPJ

O grupo tem **7 empresas** (CNPJs distintos) identificadas nos dados:
`GM` (GM Kologeski & Cia Ltda ME) · `CW` (CW Kologeski Ltda) · `CMK` (CMK Kologeski Ltda) · `WK` · `Polo` · `Kologeski` · `Fluxo`

Elas aparecem em:
- **Nomes de contas bancárias** (`Banco Inter GM…`, `Banco Inter CW…`)
- **Prefixo dos Centros de Custo** (`GM - Diretoria`, `CW - Comercial`)
- **Fluxos financeiros distintos** — cada CNPJ emite/recebe suas próprias notas

**Estado atual do schema:** nenhuma entidade legal. `workspaces.nfse_settings` (jsonb) assume 1 emissor por workspace. Contas bancárias, categorias e lançamentos ligam apenas a `workspace_id`.

Sem multi-CNPJ o import seria plano — perderíamos a semântica de "qual empresa recebeu / pagou" e não conseguiríamos DRE por CNPJ, conciliação por empresa, ou NFS-e correta.

---

## Fases

### Fase 1 — Multi-CNPJ (schema + UI mínima)

**Migration:**
- Nova tabela `public.legal_entities`:
  - `id`, `workspace_id`, `name` (razão social), `trade_name` (fantasia), `cnpj` (unique por workspace), `code` (curto: GM, CW…), `ie`, `im`, `address_json`, `logo_url`, `nfse_settings` (jsonb, sobrescreve o do workspace), `payments_settings` (jsonb), `is_default`, `active`, timestamps.
  - GRANTs + RLS (workspace membership + admin para escrita).
  - Único `is_default=true` por workspace via trigger.
- Adicionar `legal_entity_id uuid REFERENCES public.legal_entities(id) ON DELETE SET NULL` (nullable) em:
  - `financial_bank_accounts`
  - `financial_entries`
  - `financial_cost_centers` (criada na Fase 2)
  - `customer_invoices` (já no schema)
  - `nfse_invoices`
- Índices: `(workspace_id, legal_entity_id)` nas 4 tabelas acima.
- Sem quebra: coluna nullable, código existente continua funcionando.
- Backfill não obrigatório nesta fase (dados atuais estão vazios).

**Server functions** (`src/lib/legal-entities.functions.ts`):
- `listLegalEntities`, `getLegalEntity`, `createLegalEntity`, `updateLegalEntity`, `archiveLegalEntity`, `setDefaultLegalEntity`.
- Todas via `requireSupabaseAuth` + escopo workspace do usuário.

**UI**:
- Página `/settings/legal-entities` — lista + CRUD seguindo Design Foundation (PageHeader, DataTable, EmptyState, FormSection).
- Ícone/link no menu Settings.
- Cadastro cria as 7 empresas do grupo já como parte da fase de import (ou o usuário pode ajustar antes).

**RLS/Segurança:**
- `legal_entities` visível a membros do workspace via `current_user_workspaces()`.
- Escrita apenas para admin (usar `is_workspace_admin(auth.uid(), workspace_id)` já existente).
- Todas as tabelas que ganharam `legal_entity_id` mantêm suas policies atuais — o novo campo apenas refina consultas na aplicação.

---

### Fase 2 — Schema Centros de Custo + Rateio (com legal_entity)

Migration:
- `public.financial_cost_centers` (workspace_id, legal_entity_id, name, code, parent_id, active).
- `public.financial_entry_allocations` (entry_id, cost_center_id, amount).
- RLS + GRANTs. Hierarquia: cria 7 nós pai (um por `legal_entity`) + 44 folhas.

---

### Fase 3 — Import ContaAzul (workspace WK Technology, 28.540 lançamentos)

Script Python roda no sandbox lendo `/mnt/user-uploads/contazul-19-07-2026.xls` e gera comandos SQL executados via `supabase--insert` em lotes de ~500 linhas.

Ordem de carga:
1. **Legal entities**: 7 empresas do grupo (código = GM/CW/CMK/WK/Polo/Kologeski/Fluxo). `is_default = true` para a WK. Razão social e CNPJ ficam em branco (o usuário completa depois na tela de Fase 1).
2. **Contas bancárias** (21): `legal_entity_id` inferido pelo nome (`"Banco Inter GM…"` → GM). Contas genéricas (`"Perdidos"`, `"Boletos Antigos ContaAzul"`, `"Receba Fácil"`) ficam sem `legal_entity_id`.
3. **Categorias contábeis** (103): `revenue`/`expense` deduzido pela consistência 100% dos dados.
4. **Centros de custo** (44 + 7 pais): parent_id ligado ao respectivo `legal_entity`.
5. **Lançamentos** (28.540 → `financial_entries`):
   - `direction`: Receita→receivable, Despesa→payable.
   - `status`: Conciliado/Quitado/Transferido→paid; Em aberto→open; Atrasado→overdue; Perdido→cancelled.
   - `competence_date` ← Data de competência; `due_date` ← Data prevista/vencimento; `description` ← Descrição; `notes` ← Observações.
   - `legal_entity_id` inferido pela conta bancária ou (se vazio) pelo prefixo do primeiro Centro de Custo.
   - `external_ref = "contazul:{row_idx}"` (idempotência — pode-se rodar de novo sem duplicar).
   - `metadata.contazul` guarda: `situacao`, `origem`, `nota_fiscal`, `juros`, `multa`, `desconto`, `taxas`, `saldo_conta`.
   - `origin_type = 'manual'` para tudo, com `metadata.import_source = 'contaazul'`.
6. **Pagamentos** (`financial_payments`): para linhas pagas, cria payment com `paid_at ← Data movimento`, `amount`, `bank_account_id`, `method`.
7. **Rateios** (`financial_entry_allocations`): até 3 pares Centro × Valor por lançamento (228 casos com 2 CCs, 1 com 3).
8. **Transferências** (1.510 = 755 pares): parear por `Data movimento + |valor| + contas opostas`; grava `metadata.kind='transfer'` + `metadata.transfer_pair_id` para não contaminar DRE.

Diagnósticos que o script emitirá antes de qualquer INSERT:
- Lançamentos sem CC1 (1.527) — importados sem rateio.
- Lançamentos sem conta bancária (36) — importados sem `bank_account_id`.
- Pares de transferência que não casaram — logados para revisão.
- Contagem esperada por ano/tipo/situação para o usuário confirmar antes da carga.

---

### Fase 4 — Relatório & Reconciliação
- Página `/finance/import-report` (leitura simples):
  - Totais importados por ano, tipo, situação.
  - Receita − Despesa por conta bancária vs. `saldo_conta` do arquivo.
  - Top 20 categorias e top 20 CCs por volume.
  - Divergências (sem CC1, sem conta, pares de transferência órfãos).
- Filtro **Legal Entity** na listagem de lançamentos existente (`/finance/entries`) e no dashboard `/finance`.
- Página `/finance/cost-centers` (CRUD básico com árvore).

---

## Detalhes técnicos

- Ordem obrigatória: Fase 1 (schema multi-CNPJ) → Fase 2 (schema CCs) → Fase 3 (import). Um único bloco não é possível porque o import depende das tabelas criadas.
- Migration não usa CHECK com `now()`; regras dinâmicas via trigger (ex.: único `is_default=true` por workspace).
- `owner_id` em `financial_entries` recebe `created_by` do workspace WK Technology.
- Idempotência: `UNIQUE(workspace_id, external_ref)` em `financial_entries`.
- Todas as tabelas novas: `GRANT SELECT/INSERT/UPDATE/DELETE ON … TO authenticated; GRANT ALL … TO service_role;`.
- Nenhuma alteração no fluxo de NFS-e/Contratos existentes — `legal_entity_id` opcional; produto continua funcionando com o padrão do workspace se não preenchido.

---

## Volume e desempenho
- 28.540 lançamentos + ~30.000 rateios + ~11.500 pagamentos ≈ 70k linhas.
- Carga em lotes de 500 via `supabase--insert`.
- Índices em `(workspace_id, competence_date)`, `(workspace_id, legal_entity_id)` e `(workspace_id, external_ref)`.

---

## O que fica fora deste plano (fora de escopo declarado)
- Preenchimento de CNPJ/IE/IM real das 7 empresas (usuário faz depois em `/settings/legal-entities`).
- Migração das rotinas NFS-e/Contratos para usar `legal_entity_id` — coluna existe, mas fluxos continuam com fallback para workspace default nesta entrega.
- Rateio editável na UI de criação/edição de lançamento (fase 4 mostra read-only).
