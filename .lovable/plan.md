## Problema

O `GenericRecordForm` (usado em `create_record` / `update_record` / `delete_record`) hoje é um mapa livre chave→valor de texto puro. O usuário não sabe quais campos existem em cada tabela, não conhece os tipos e digita nomes de coluna errados.

## Objetivo

Trocar o mapa livre por um formulário tipado, com campos descobertos dinamicamente da tabela alvo, com rótulos amigáveis em pt-BR, controles corretos por tipo (texto, número, data, booleano, select) e suporte a tokens `{{campo}}` onde faz sentido.

## Escopo (somente UI + catálogo de campos)

- Não muda schema, RLS, engine de execução, nem contratos das ações. O payload continua sendo `{ table, values, target_id? }` — só a forma de montá-lo muda.
- Não altera outras ações do builder.

## Mudanças

### 1. Ampliar o catálogo de campos (`src/lib/entity-fields.functions.ts`)

- Expandir o enum `entity` do `getEntityFieldCatalog` para cobrir todas as tabelas de `WORKFLOW_WRITABLE_TABLES`: adicionar `projects`, `project_tasks`, `project_milestones`, `contracts`, `financial_entries`, `bank_payments`, `quotes`, `proposals`, `products`, `services`, `recurring_plans`, `subscription_invoices`, `customer_invoices`.
- Adicionar rótulos pt-BR no mapa `LABELS` para os campos principais dessas tabelas (nome, valor, moeda, status, data de vencimento, categoria, centro de custo, empresa, cliente, projeto, etc.). Fallback continua sendo snake_case → Title Case.
- Manter a lista `HIDDEN` (esconder `id`, `owner_id`, `workspace_id`, `deleted_at`, etc.). Em `update_record` esses continuam ocultos — o `id` do alvo já é o `target_id`.
- Sem mudanças no RPC `get_entity_field_catalog`: ele já lê `information_schema` genericamente.

### 2. Reescrever `src/components/workflows/generic-record-form.tsx`

- Ao escolher `table`, buscar o catálogo via `useQuery(['entity-fields', table], () => getEntityFieldCatalog({ data: { entity: table } }))`.
- Renderizar duas seções:
  1. **Campos conhecidos** — lista das colunas retornadas pelo catálogo, ordenadas pelo mesmo peso já usado (select → texto → data). Cada linha usa o controle certo:
     - `text` → `TokenInput` (com pills de variáveis, mesmo padrão dos outros passos).
     - `number` → `Input type="number"` com toggle "usar token" que troca para `TokenInput`.
     - `date` → `Input type="date"` com toggle "usar token".
     - `boolean` → `Switch` (grava `true`/`false`).
     - `select` (com `options`) → `Select` shadcn; para FKs (`pipeline_id`, `company_id`, `assigned_user_id`, `owner_id`) o catálogo já resolve os rótulos legíveis; adicionar opção "usar token".
     - Todos com botão para limpar/remover do payload.
  2. **Campos avançados** (colapsável, oculto por padrão) — mantém o editor livre chave/valor atual, para colunas fora do catálogo (custom fields, colunas novas). Reusa o componente atual como fallback.
- Skeleton enquanto carrega o catálogo; empty state se a tabela não tiver campos editáveis; error state com botão de retry.
- Em `update_record` e `delete_record`, o campo "ID do registro" continua igual (já aceita tokens). Em `update_record`, só grava em `values` as colunas explicitamente preenchidas — não envia todos os campos do catálogo.
- Em `create_record`, se a tabela tiver `owner_id`, seguir mostrando o aviso atual de auto-preenchimento e não expor `owner_id` no formulário.
- Mantém a API do componente (`action`, `onChange`) — sem impacto no `WorkflowBuilder`.

### 3. Sem migração

Não há mudança de banco. O `WORKFLOW_WRITABLE_TABLES` já existe e a engine já aceita esses valores.

## Validações

- `bun run tsgo` (typecheck).
- Smoke manual em `/settings/workflows`: escolher cada tabela nova, verificar labels, tipos e que o payload salvo em `actions` continua no formato `{ table, values }`.

## Fora do escopo

- Custom fields (`custom_properties`) tipados — continuam acessíveis pela seção "Campos avançados" (texto livre).
- Validação server-side de tipos além do que a engine já faz.
- Redesign visual do resto do builder.
