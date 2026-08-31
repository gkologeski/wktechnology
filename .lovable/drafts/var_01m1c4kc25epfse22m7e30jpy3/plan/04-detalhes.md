## Detalhes técnicos e riscos

**Nada é removido nem renomeado.** `owner_id` continua existindo e continua sendo lido pelas 536 políticas RLS; só passa a significar "criador" na interface. `assigned_user_id` e `hubspot_owner_id` continuam populados (espelho), para não quebrar workflows, Zapier (`src/routes/api/public/zapier/triggers.$event.ts`), MCP e o sincronizador HubSpot.

**Pontos de código já mapeados**

- `src/components/entity/{assignee-cell,assignee-field,assignee-filter,owner-field}.tsx` — passam a usar o helper; `owner-field` fica marcado como "Criado por".
- `src/components/owner-filter.tsx` — `applyOwnerFilter` hoje monta `owner_id.in.(...)`; passa a considerar `assigned_to` com fallback.
- `src/lib/grid/{bulk-edit-fields,bulk-edit-dependencies}.ts` e `src/components/bulk-assign-dialog.tsx` — gravar apenas `assigned_to`.
- `src/lib/access-control/scope.server.ts`, `scope.functions.ts`, `resource-scope.functions.ts`, `use-can-delete.tsx` — escopo próprio passa a ser responsável **ou** criador.
- `src/routes/_authenticated/deals.tsx`, `src/components/deals/{deals-board,deals-list,deals-hubspot-table}.tsx`, e os equivalentes de Leads/Contatos/Empresas — filtro e coluna de responsável.
- `src/lib/entity-fields-meta.ts` / `entity-fields-refs.ts` / `workflows/entity-field-order.ts` — rótulos e catálogo de campos ("Responsável" vs "Criado por").

**Riscos**

- Volume alto de arquivos; por isso a Fase 1 é só leitura e reversível, e cada fase é validada antes da seguinte.
- Fase 3 mexe em RLS: será feita em lotes por módulo, sempre ampliando o escopo próprio (responsável **ou** criador), nunca liberando registros de terceiros. Após cada lote, roda o linter de segurança do banco.
- Como esta é uma variação (draft), as mudanças de schema das Fases 2 e 3 ficam preparadas e só entram em vigor quando você aceitar a variação. As alterações de interface da Fase 1 já podem ser conferidas no preview.

**Validação**

- `bun run typecheck:inc`, `bun run lint`, `bun run test`.
- Manual: em Negócios, Leads, Contatos e Empresas — trocar o responsável (detalhe, grid e em massa) e confirmar que card, coluna, filtro e timeline refletem a mesma pessoa; confirmar que "Criado por" não muda; conferir com um usuário de escopo restrito que ele vê os registros de que é responsável.
- Após cada lote de RLS: linter de segurança + conferência de contagens por usuário.
