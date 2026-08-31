## Detalhes técnicos

**Novo arquivo** `src/lib/deals/responsible.ts`

```ts
export function dealResponsibleId(deal: {
  assigned_to?: string | null;
  owner_id?: string | null;
}): string | null {
  return deal.assigned_to ?? deal.owner_id ?? null;
}
```

**`src/routes/_authenticated/deals.tsx`**

- `filtered`: trocar `d.owner_id !== filters.ownerId` por `dealResponsibleId(d) !== filters.ownerId`.
- `ownerOptions`: alimentar o conjunto de ids com `dealResponsibleId(d)` em vez de `d.owner_id`, para o dropdown listar quem realmente aparece nos cards.

**`src/components/deals/deals-board.tsx`**

- `ownerName={lookups.owners.get(dealResponsibleId(d) ?? "") ?? "—"}`.

**`src/components/deals/deals-list.tsx`**

- Coluna "Responsável" usando o mesmo helper.

**Fora do escopo (não será alterado agora)**

- Nenhuma migration, RLS, GRANT ou backfill; `owner_id` permanece como está.
- A consulta de `/deals` carrega `range(0, 999)` de 2.050 negócios — limitação separada, não tocada nesta correção.

**Validação**

- `bun run typecheck:inc` e `bun run lint`.
- Manual: em `/deals` (Quadro), alterar o responsável de um negócio por edição em massa e confirmar que o card e o filtro "Responsável" passam a refletir a nova pessoa; conferir também Tabela e Lista.
