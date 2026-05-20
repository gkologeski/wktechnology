## Objetivo

Aplicar a mesma estratégia de réplica fiel do HubSpot (já feita em Leads) nas telas de **Contatos, Empresas, Negócios e Tarefas**, mantendo consistência visual e de UX entre os módulos.

## Layout base (igual ao Leads)

Cada tela terá três áreas:

```text
┌──────────────────────────────────────────────────────────┐
│  Header: título + busca (debounce 300ms) + "Criar"       │
├────────────┬─────────────────────────────────────────────┤
│  Sidebar   │  Tabs de views                              │
│  filtros   │  ──────────────────────────────────────     │
│  esquerda  │  Tabela densa (sticky header, h-12 rows,    │
│  ~260px    │  hover bg-primary/5, checkbox, bulk         │
│  colapsável│  actions, paginação 25/50/100)              │
└────────────┴─────────────────────────────────────────────┘
```

Componentes reutilizados do Leads: estrutura do shell, paginação, tabs de view, sidebar de filtros — refatorados para receber configuração por módulo.

## Módulos

### Contatos (`/contacts`)

- **Views padrão:** All contacts · My contacts · Unassigned · Created this week
- **Colunas:** checkbox · Name (link azul + avatar) · Email · Phone · Job title · Company · Lifecycle stage (pill) · Owner · Last activity · Create date
- **Filtros (sidebar):** Lifecycle stage, Owner, Tags, Create date (preset), Last activity (preset)
- **Busca:** `.or()` em first_name, last_name, email, phone
- **Row actions:** Open, Send email, Add to sequence, Delete

### Empresas (`/companies`)

- **Views padrão:** All companies · My companies · Unassigned · Created this week
- **Colunas:** checkbox · Name (link azul + logo) · Domain · Industry · Employees · City · Country · Owner · Create date
- **Filtros:** Industry, Size (range), Owner, Country, Create date
- **Busca:** `.or()` em name, domain, website
- **Row actions:** Open, View contacts, Delete

### Negócios (`/deals`)

- Tela com **dois modos** (toggle no header, como HubSpot): **Board** (Kanban por pipeline stage — manter o existente) e **Table** (novo, padrão HubSpot)
- **Views padrão (Table):** All deals · My deals · Closing this month · Won this quarter
- **Colunas Table:** checkbox · Deal name (link) · Stage (pill colorida) · Amount (BRL) · Close date · Pipeline · Owner · Associated company · Create date
- **Filtros:** Pipeline, Stage, Owner, Amount (range), Close date (preset), Create date
- **Busca:** `.or()` em name + associated company
- **Row actions:** Open, Mark won/lost, Delete

### Tarefas (`/tasks`)

- **Views padrão:** All tasks · My open tasks · Due today · Overdue · Completed
- **Colunas:** checkbox · Title (link) · Type (pill: call/email/todo) · Priority (pill) · Status · Due date · Associated record · Assignee · Create date
- **Filtros:** Type, Priority, Status, Assignee, Due date (preset)
- **Busca:** `.or()` em title, description
- **Row actions:** Mark complete, Reschedule, Delete
- A área `/tasks/queues` existente permanece intocada

## Arquivos

Por módulo: substituir a tela atual (`contacts.tsx`, `companies.tsx`, `deals.tsx`, `tasks.tsx`) por um shell HubSpot-style, mantendo `<Outlet />` quando há rotas filhas (contacts/$id, companies/$id, tasks/$id, tasks/queues).

Componentes compartilhados novos em `src/components/crm/`:
- `crm-filters-sidebar.tsx` — sidebar genérica controlada por config
- `crm-views-tabs.tsx` — tabs de views
- `crm-pagination.tsx` — paginação
- `crm-table-shell.tsx` — wrapper de tabela densa

Cada tela define localmente: colunas, views padrão, schema de filtros, lógica de busca/sort/paginação via Supabase (`.range()`, `.in()`, `.or()`, `.order()`).

## Detalhes técnicos

- Paginação e filtros server-side em todas as telas
- Busca com debounce 300ms
- Bulk delete e bulk actions específicas por módulo
- Pills de status reutilizam o padrão `STATUS_TONE` do Leads (sky/violet/emerald/rose/amber)
- Navegação via `Link to="/contacts/$id"` etc., preservando rotas detalhe
- Sem alteração em RLS, schema ou business logic — apenas reescrita de UI/presentation

## Fora de escopo

- Persistência de views customizadas
- Editor drag-and-drop de colunas
- Hover-card de preview na linha
- Refatoração do Kanban de Deals existente (apenas adicionar o modo Table ao lado)
