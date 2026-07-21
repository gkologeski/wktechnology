## Contexto

- Tabela `public.contracts` já tem `parent_contract_id uuid` (FK auto-referente) e `role contract_role` com valores `provider` (nós prestamos — contrato de venda) e `client` (nós compramos — contrato de compra). O campo `parent_contract_id` **já existe** mas hoje não é usado em nenhum lugar do app (não aparece em nenhum arquivo `.tsx`/`.ts` fora dos types gerados) e nenhuma linha o utiliza (`0 rows`).
- Vou **reaproveitar** `parent_contract_id` como vínculo pai→filho: contrato **provider** (venda p/ cliente final) é o pai; contratos **client** (compra de desenvolvedor/fornecedor) são filhos. Isso modela outsourcing 1:N (uma venda pode ser executada por N compras).

Nada em `_authenticated/contracts.*.tsx`, `deal-contracts.tsx` ou `quick-create-contract-dialog.tsx` referencia `parent_contract_id` hoje — não há regressão de comportamento existente.

## Escopo

1. **Modelo (migration)**
   - Manter `parent_contract_id`. Adicionar trigger `validate_contract_parent_link()`:
     - Impede ciclos (pai não pode apontar para o próprio filho; self-reference proibida).
     - Exige `workspace_id` igual entre pai e filho (mesmo workspace).
     - Regra de papéis: se `parent_contract_id IS NOT NULL`, então `parent.role = 'provider'` e `child.role = 'client'` (outsourcing).
   - Índice `contracts_parent_contract_id_idx` para listar filhos rapidamente.
   - Sem mudança em RLS: as policies existentes já cobrem leitura/escrita por workspace.

2. **Server functions** (`src/lib/contracts.functions.ts` — arquivo já usado pelo módulo)
   - `listLinkableContracts({ role, excludeId, q })`: busca contratos do mesmo workspace filtrando por `role` oposta (para o seletor). Server-side `ilike` no título/número com debounce.
   - Estender `getContract(id)` para retornar `parent` (contrato pai resumido) e `children` (lista de contratos filhos com id, número, título, status, total_value, moeda).
   - `linkContractParent({ childId, parentId | null })`: atualiza `parent_contract_id`. Valida via trigger.

3. **UI — detalhe do contrato** (`src/routes/_authenticated/contracts.$id.tsx`)
   - Seção **"Vínculo de outsourcing"**:
     - Se `role = 'client'`: mostrar contrato de venda pai (link + resumo) com botão "Alterar/Remover vínculo" (abre combobox de contratos `provider`).
     - Se `role = 'provider'`: lista de contratos de compra filhos (tabela compacta com número, fornecedor, período, valor, status) + botão "Vincular contrato de compra" (combobox de contratos `client` do workspace).
   - Card de **Margem de outsourcing** no detalhe do provider: `total_value` do pai − soma dos `total_value` dos filhos ativos, com % e alerta quando margem < 0.

4. **UI — criação/edição** (`quick-create-contract-dialog.tsx` e formulário do detalhe)
   - Campo opcional **"Vincular a contrato de venda"** aparece só quando `role = 'client'`. Combobox usando `listLinkableContracts`.
   - No cabeçalho do detalhe do contrato filho, badge "Vinculado a #NUMERO_PAI".

5. **Timeline / eventos**
   - `contract_events` já existe: registrar eventos `parent_linked` / `parent_unlinked` quando o vínculo mudar (mesmo padrão dos eventos atuais do módulo).

## Fora de escopo

- Alterar RLS ou o enum `contract_role`.
- Vincular financial_entries / faturas às pontas da cadeia (fica para uma iteração seguinte de margem realizada).
- Suporte a N níveis (sub-sub-contratos) — trigger impede pai que já é filho.

## Como validar manualmente

1. Criar contrato `provider` (venda) com cliente final e valor R$ 20.000.
2. Criar contrato `client` (compra) para o desenvolvedor no valor R$ 12.000 e vincular ao provider acima.
3. Abrir o detalhe do provider → conferir lista de filhos + card de margem R$ 8.000 (40%).
4. Tentar vincular um provider a outro provider → erro do trigger.
5. Tentar vincular um contrato de workspace diferente → erro do trigger.

## Detalhes técnicos

- Trigger `BEFORE INSERT OR UPDATE OF parent_contract_id`:
  ```sql
  IF NEW.parent_contract_id = NEW.id THEN raise ...;
  SELECT role, workspace_id INTO p FROM contracts WHERE id = NEW.parent_contract_id;
  IF p.workspace_id <> NEW.workspace_id THEN raise ...;
  IF p.role <> 'provider' OR NEW.role <> 'client' THEN raise ...;
  -- ciclo: pai não pode ter este contrato como ancestral (WITH RECURSIVE)
  ```
- Seletor de contratos usa o mesmo padrão do `FkPicker` (combobox com busca debounce 200ms via server fn).
- Cálculo de margem no client após `getContract` retornar `children` — sem view materializada.
