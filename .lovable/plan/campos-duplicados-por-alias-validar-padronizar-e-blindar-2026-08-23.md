# Campos duplicados por alias: validar, padronizar e blindar

## O que foi verificado agora

Consulta ao banco nas 24 entidades do catálogo (`get_entity_field_catalog`):

- `leads` e `contacts` têm as quatro colunas: `company_id`, `company_name`, `assigned_to`, `assigned_user_id`.
- `companies` e `deals` têm `assigned_to` + `assigned_user_id` (par "Responsável").
- `deals` tem `company_id` (sem `company_name`); demais entidades não têm par duplicado.
- `tickets` e `project_tasks` usam `assignee_id` (rótulo "Responsável"), coluna única — sem conflito.

A correção anterior (`LABELS` + `legacySystemFields` em `src/lib/entity-fields.functions.ts`) é
global, não por entidade, então Leads, Empresas e Negócios já herdam os rótulos distintos. O que
falta é: (a) garantia automatizada de que não volte, (b) mesmo tratamento de "campo de sistema"
nos outros consumidores do catálogo, (c) trava de UI contra colisão por alias.

## O que muda

### 1. Registro único de rótulos e aliases (testável)

Extrair para um novo módulo sem UI e sem Supabase — `src/lib/entity-fields-meta.ts`:

- `LABELS` e `ENTITY_LABEL_OVERRIDES` (hoje em escopo de módulo do `*.functions.ts`, o que
  contraria a regra de "server function fina");
- `FIELD_ALIASES`: mapa de coluna legada → coluna canônica
  (`company_name → company_id`, `assigned_user_id → assigned_to`), fonte única da verdade;
- `LEGACY_SYSTEM_FIELDS` derivado das chaves de `FIELD_ALIASES`;
- helpers `toLabel(col, entity)`, `isLegacyAlias(col)` e `canonicalOf(col)`.

`entity-fields.functions.ts` passa a importar esse módulo (sem mudança de comportamento nem de
contrato de retorno).

### 2. Teste automatizado anti-regressão

Novo `src/lib/__tests__/entity-fields-meta.test.ts`:

- para cada entidade do catálogo, com a lista real de colunas fixada no teste (Leads, Contatos,
  Empresas, Negócios, Chamados, Tarefas de projeto, Propostas, Cotações, Contratos), nenhum par
  de campos **não-sistema** pode ter o mesmo rótulo;
- todo alias declarado em `FIELD_ALIASES` tem rótulo diferente do canônico e é marcado como
  campo de sistema;
- rótulo canônico permanece o "limpo" ("Empresa", "Responsável").

### 3. Padronização dos "campos de sistema" nos demais consumidores

Mesma semântica visual do modal de edição em massa (bloco recolhido / grupo separado):

- **Seletor de colunas** (`src/hooks/use-auto-grid-columns.tsx` +
  `src/components/column-editor-dialog.tsx`): campos com `system: true` recebem o grupo
  "Campos de sistema" em vez de "Outros campos", ficando no fim da lista. O editor já renderiza
  `group`; nenhuma coluna deixa de estar disponível.
- **Exportação CSV** (`src/lib/csv-export.ts` / callers de grid): o cabeçalho passa a usar o
  rótulo do catálogo já distinto; colunas de sistema só entram quando estiverem visíveis no grid
  (comportamento atual preservado, apenas o rótulo deixa de ser ambíguo).
- **Construtor de workflows** (`use-entity-field-options.ts`): já propaga `system`; validar que
  o agrupamento existente respeita a flag.

### 4. Trava de UI contra duplicidade por alias

Em `src/components/grid/bulk-edit-fields-dialog.tsx`, antes de renderizar:

- deduplicação por rótulo: se dois campos chegarem com o mesmo rótulo, mantém o canônico
  (`canonicalOf`) na lista principal e empurra o alias para o bloco de campos de sistema;
- se o alias e o canônico forem marcados ao mesmo tempo, o diálogo bloqueia o envio com aviso
  ("Empresa e Empresa (texto livre) apontam para o mesmo dado"), evitando update conflitante;
- a trava é derivada de `FIELD_ALIASES`, logo vale para qualquer entidade futura, mesmo se o
  catálogo voltar a devolver rótulos iguais.

## Fora de escopo

Remover ou migrar dados das colunas legadas (`company_name`, `assigned_user_id`), mudanças de
schema, RLS, permissões ou regras de negócio.

## Validação

- `bun run test` (novo teste + suíte atual), `bunx tsgo --noEmit`, `bun run lint`.
- Manual: em /leads, /contacts, /companies e /deals — abrir "Editar em massa" e confirmar
  "Empresa" e "Responsável" uma única vez; abrir "Colunas" e confirmar o grupo
  "Campos de sistema"; exportar CSV e conferir cabeçalhos; validar dark mode e foco visível.
