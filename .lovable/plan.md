## Objetivo

Permitir que cada ação `create_*` do builder de workflows exponha **todos os campos da entidade alvo**, não apenas o subconjunto atualmente hardcoded (ex.: em "Criar negócio" só há Nome, Valor, Moeda).

## Escopo

As 6 ações `create_*`: `create_lead`, `create_contact`, `create_company`, `create_deal`, `create_ticket`, `create_task`.

## Mudanças

### 1. Tipos e schemas (`src/lib/workflows/types.ts`, `schemas.ts`)
- Adicionar `extra_fields?: Record<string, unknown>` em cada uma das 6 ações `create_*`.
- Zod: `extra_fields: z.record(z.string(), z.unknown()).optional()`.

### 2. Engine (`src/lib/workflows/engine.server.ts`)
- Em cada `case "create_*"`, montar payload principal, resolver tokens `{{campo}}` em `extra_fields` (recursivo para strings) e mesclar antes do `insert`.
- Precedência: chaves do payload principal ganham de `extra_fields`, evitando sobrescrita acidental.
- Se `extra_fields` contiver `custom_fields` (objeto), fazer merge com o `custom_fields` já existente do payload principal em vez de sobrescrever.
- Erros do banco (coluna inexistente, tipo inválido) ficam no `run_log` normalmente.

### 3. Catálogo de entidade (`src/lib/entity-fields.functions.ts`)
- Estender `getEntityFieldCatalog` para aceitar a entidade sintética `activities` (usada por `create_task`). Ela chama o mesmo RPC `get_entity_field_catalog` com `p_table = 'activities'`.
- Manter HIDDEN existente; adicionar `custom_fields` como visível (renderizado como editor JSON no builder — ver abaixo).

### 4. Builder (`src/components/workflows/workflow-builder.tsx`)
- Novo componente `ExtraFieldsEditor({ entity, action, onChange, hiddenKeys })`:
  - Carrega catálogo via TanStack Query (`queryKey: ['entity-field-catalog', entity]`).
  - `hiddenKeys` = chaves já cobertas pelo formulário principal da ação (ex.: `create_deal` → `name`, `value`, `currency`, `pipeline_id`, `stage_id`, `owner_id`).
  - Lista de linhas: seletor de campo (Combobox agrupado por tipo) + input tipado:
    - `text` → Input (aceita tokens `{{campo}}`)
    - `text` longo (description/notes/body) → Textarea
    - `number` → Input numérico
    - `date` → DatePicker (mantém string ISO; aceita tokens)
    - `boolean` → Switch
    - `select` → Select com `options` do catálogo
    - `custom_fields` → editor de pares chave/valor (mini-tabela) que persiste como objeto
  - Botão "Adicionar campo" abre popover com campos ainda não usados.
  - Botão lixeira remove a chave.
  - Dica visível sobre uso de tokens.
- Seção colapsável **"Mais campos"** ao final de cada `case "create_*"` do `ActionEditor`, passando `entity` correspondente:
  - `create_lead` → `leads`
  - `create_contact` → `contacts`
  - `create_company` → `companies`
  - `create_deal` → `deals`
  - `create_ticket` → `tickets`
  - `create_task` → `activities`

### 5. Validação de tipo no cliente
- Coerção mínima ao gravar em `extra_fields`:
  - `number` → `Number(v)` ou `undefined` se vazio.
  - `boolean` → `true`/`false`.
  - `date` → string ISO ou token literal.
  - `select` → string exata do `options[].value`.
  - `text` → string bruta (preserva tokens).
- Sem bloqueios agressivos: se o usuário quer usar um token em campo numérico, ok — o engine tenta e o erro aparece no log.

## Validação

- `bunx tsgo --noEmit`.
- Preview manual: em cada uma das 6 ações, abrir "Mais campos", adicionar 2-3 campos (um com literal, um com token, um select/boolean/date quando disponível), salvar e disparar workflow de teste; conferir no registro criado que os campos extras foram preenchidos.

## Fora do escopo

Nada — os 3 itens antes excluídos foram incorporados (catálogo de `activities`, editor de `custom_fields`, coerção de tipo no cliente).
