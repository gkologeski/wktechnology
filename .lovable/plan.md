# Réplica fiel HubSpot na tela de Leads

Reescrevo `/leads` para reproduzir o layout do CRM Index do HubSpot. O `EntityList` genérico permanece intacto (continua servindo Contatos, Empresas, Negócios, Tarefas etc.) — só a tela de Leads ganha esta versão dedicada.

## Layout final

```text
┌───────────────────────────────────────────────────────────────────┐
│ Leads                          [Importar HubSpot] [Exportar] [+ Criar lead] │
├───────────────────────────────────────────────────────────────────┤
│ [All leads] [My leads] [Unassigned] [New this week] [+ Add view] │  ← abas
├──────────────┬────────────────────────────────────────────────────┤
│ FILTERS      │ 🔍 Buscar nome, email...    [Actions ▾]            │
│              ├────────────────────────────────────────────────────┤
│ ▾ Status     │ ☐ │ NAME │ EMAIL │ PHONE │ COMPANY │ STATUS │ ... │
│   ☐ New      ├────────────────────────────────────────────────────┤
│   ☐ Qualified│ ☐ │ João  │ ...   │ ...   │ Acme    │ ● New  │ ... │
│ ▾ Owner      │ ☐ │ Maria │ ...   │ ...   │ Beta    │ ● Qual │ ... │
│ ▾ Source     │ ...                                                │
│ ▾ Score      ├────────────────────────────────────────────────────┤
│ ▾ Create date│ 50 per page  ◀ 1 2 3 4 ▶          1–50 of 1,234   │
└──────────────┴────────────────────────────────────────────────────┘
```

Hero atual, KPIs, "Distribuição por status" e "Top fontes" saem da tela `/leads` para casar com a estética HubSpot (densa, focada na tabela). Esses widgets continuam disponíveis no Dashboard.

## Arquivos

- `src/routes/_authenticated/leads.tsx` — substitui a tela atual pela nova UI HubSpot. Mantém o `<Outlet />` quando `pathname !== "/leads"` para preservar `/leads/:id` e `/leads/import-hubspot`. Mantém `convert(lead)` movida para um menu de ações por linha.
- `src/components/leads/leads-filters-sidebar.tsx` — sidebar esquerda fixa (~260px), grupos colapsáveis (`Collapsible` do shadcn).
- `src/components/leads/leads-views-tabs.tsx` — abas das views padrão + "+ Add view".
- `src/components/leads/leads-table.tsx` — tabela densa: header sticky `bg-muted/50`, linhas `h-12 hover:bg-primary/5`, divisores finos, coluna Name em link azul.
- `src/components/leads/leads-pagination.tsx` — rodapé com page size (25/50/100) e paginação numérica.

Reutiliza `Table`, `Checkbox`, `Button`, `Input`, `Badge`, `DropdownMenu`, `BulkActionBar`, `BulkEnrichDialog` já existentes, e o cliente Supabase atual.

## Views padrão (client-side)

| View | Filtro |
|---|---|
| All leads | nenhum |
| My leads | `owner_id = auth.uid()` |
| Unassigned | `owner_id is null` |
| New this week | `created_at >= now() - 7d` |

A view ativa controla a query do Supabase.

## Colunas (Padrão HubSpot)

Ordem fixa nesta primeira versão:

1. ☐ checkbox
2. **Name** (link azul para `/leads/:id`, com avatar circular pequeno à esquerda)
3. Email (com ícone)
4. Phone
5. Company name
6. Lead Status (pill colorida)
7. Owner (placeholder enquanto não houver join real)
8. Create Date (formato relativo "3 days ago")

## Filtros (sidebar esquerda)

- Cada grupo colapsável.
- Multi-select com checkbox (Status, Owner, Source).
- Score: slider 0–100.
- Create date: presets (Today / Last 7d / Last 30d / Custom).
- Estado em React local; aplicado via `.in()`, `.gte()`, `.eq()` na query.
- Botão "Clear all" no topo quando há filtro ativo.

## Tabela

- Container `border rounded-md overflow-hidden`.
- Header: `bg-muted/50`, texto `text-xs font-semibold uppercase tracking-wide`.
- Linhas `h-12 hover:bg-primary/5`, divisor `border-b border-border/50`.
- Sort por Name e Create Date no header.
- Seleção em massa reaproveita `BulkActionBar` (Editar / Excluir / Enriquecer / Converter).

## Paginação

- Page size 25 / 50 / 100 (default 50).
- Paginação numérica + setas + "X–Y of N".
- Via `.range()` do Supabase.

## Detalhes técnicos

- `useQuery` com chave `["leads", "hubspot-list", view, filters, sort, page, search]`.
- `search` aplica `.or("first_name.ilike.%x%,last_name.ilike.%x%,email.ilike.%x%,company_name.ilike.%x%")` com debounce 300ms.
- Sem mudanças de schema.

## Fora do escopo desta entrega

- Persistir views customizadas do usuário (precisaria de tabela `lead_views`).
- Editor de colunas drag-and-drop.
- Hover-card / preview lateral ao clicar em linha.
- Owner real (depende de join com `profiles`).
