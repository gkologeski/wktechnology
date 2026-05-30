
# Seletor de colunas em todos os grids

## Objetivo
Permitir que cada usuário escolha quais colunas aparecem em cada grid do app (padrão + custom properties), salvando a preferência no banco e sincronizando entre dispositivos.

## Arquitetura

### 1. Backend — preferências por usuário
Nova tabela `public.user_grid_preferences`:

```text
id              uuid PK
user_id         uuid (auth.uid())
workspace_id    uuid
grid_key        text         -- ex: "leads", "contacts", "deals", "tickets"...
visible_columns text[]       -- ordem + visibilidade
updated_at      timestamptz
UNIQUE (user_id, workspace_id, grid_key)
```
RLS: usuário só lê/escreve as próprias linhas. GRANTs para `authenticated` + `service_role`.

### 2. Server functions (`src/lib/grid-preferences.functions.ts`)
- `getGridPreference({ gridKey })` — retorna array de chaves ou null
- `saveGridPreference({ gridKey, visibleColumns })` — upsert

Ambas protegidas com `requireSupabaseAuth`.

### 3. Hook unificado (`src/hooks/use-grid-columns.ts`)
```ts
useGridColumns(gridKey, allColumns, defaults)
  → { columns, openEditor, ColumnEditor }
```
- Faz fetch via TanStack Query
- Faz fallback para `defaults` enquanto carrega
- Mutation com optimistic update + invalidate
- Inclui custom properties da entidade automaticamente (consulta `custom_properties` por `entity_key`)

### 4. Componente `<GridColumnsButton gridKey={...} allColumns={...} defaults={...} />`
Botão padrão "Colunas" + dialog. Reutiliza o `ColumnEditorDialog` já existente (que aceita reorder e toggle).

### 5. Integração nos grids

| Grid | Arquivo | gridKey | Custom props entity |
|---|---|---|---|
| Leads | `leads.tsx` | `leads` | `lead` |
| Contatos | `contacts.tsx` | `contacts` | `contact` |
| Empresas | `companies.tsx` | `companies` | `company` |
| Negócios | `deals.tsx` | `deals` | `deal` |
| Tarefas | `tasks` (board+list) | `tasks` | `task` |
| Tickets | `tickets.tsx` | `tickets` | `ticket` |
| Produtos | `settings.products.tsx` | `products` | `product` |
| Cotações | `settings.quotes.tsx` | `quotes` | `quote` |
| Segmentos, Times, Surveys, Portal, Enrichment, Exports, Campanhas Email | respectivos `settings.*.tsx` / `campaigns.email.tsx` | slug por tela | — (sem custom props) |

Em cada grid:
1. Definir `ALL_COLUMNS: { key, label, render }` 
2. Trocar render fixo do `<thead>`/`<tbody>` por loop dinâmico baseado em `columns`
3. Adicionar `<GridColumnsButton>` na barra de ações

Para grids com custom-properties (CRM), o hook concatena automaticamente:
```ts
[...standard, ...customProps.map(p => ({ key: `custom:${p.key}`, label: p.label, render: r => r.properties?.[p.key] }))]
```

## Entrega faseada (mesmo PR, ordem de implementação)

**Fase 1 — base**
- Migration `user_grid_preferences`
- Server functions + hook + componente
- Refactor mínimo do `ColumnEditorDialog` (já existe, só adiciona "restaurar padrão")

**Fase 2 — CRM principal (com custom props)**
- Leads, Contatos, Empresas, Negócios

**Fase 3 — Operacional**
- Tarefas (lista), Tickets

**Fase 4 — Settings/secundário**
- Produtos, Cotações, Times, Surveys, Portal, Enrichment, Exports, Segmentos, Campanhas Email

## Detalhes técnicos relevantes
- Sem mudança no `EntityList` interno (já tem column editor); só passar a persistir via novo hook em vez do estado em memória.
- Loading: render com `defaults` para evitar flash; substitui quando query resolver.
- Reset: botão "Restaurar padrão" no dialog → `saveGridPreference({ visibleColumns: defaults })`.
- Performance: 1 query por grid, cache compartilhado entre montagens (queryKey `["grid-pref", gridKey]`).

## Fora do escopo
- Múltiplas "views" salvas por grid (só 1 preferência por usuário/grid). Pode virar evolução futura.
- Reordenar via drag-and-drop (mantém setas ↑↓ atuais).
- Largura de coluna personalizada.
