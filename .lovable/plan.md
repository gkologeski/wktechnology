## Problema

Ao clicar em "Excluir" um negócio, a Cristiane vê o toast "Excluído" e o drawer fecha, mas o card reaparece no kanban ao invalidar as queries. Além disso, botões de ações sem permissão hoje ficam habilitados, dando falsa impressão de que a ação vai funcionar.

Causa técnica: a policy `ws_delete_deals` exige `techsales.deals.delete.workspace`. Sem essa permissão, o RLS silencia o DELETE (0 linhas afetadas, sem erro), e o client trata como sucesso. Somado a isso, a UI não consulta as permissões efetivas do usuário para desabilitar preventivamente o botão.

## Escopo

### 1. Desabilitar botões/ações sem permissão (padrão global)

- Criar/usar um hook `usePermission(key)` (ou `useHasPermission`) baseado nas permissões efetivas do usuário no workspace ativo (já expostas por `user_effective_permissions` / bundle de acesso do client).
- Padrão de uso nos botões sensíveis:
  - `disabled` quando o usuário não tem nenhum tier da ação;
  - `Tooltip` explicando "Você não tem permissão para esta ação";
  - manter o layout — nunca esconder o botão silenciosamente, para não confundir.
- Aplicar imediatamente no botão **Excluir negócio** do `deal-detail-drawer.tsx` e da rota `deals.$id.tsx` (foco do bug reportado).
- Estender o mesmo padrão para as demais ações críticas de deals já presentes nesses arquivos (mudança de estágio, edição de campos, envio de proposta) usando as chaves `techsales.deals.update.*` que já existem.
- Fora do escopo desta entrega: varrer todos os outros módulos. Apenas documentar o padrão em `docs/rbac-mvp.md` para ser adotado incrementalmente.

### 2. Corrigir o feedback do client no delete

- Encadear `.select("id")` no `delete` para detectar DELETE bloqueado por RLS.
- Se `data.length === 0`: reverter cache otimista, manter o drawer aberto e exibir toast "Você não tem permissão para excluir este negócio."
- Manter fluxo atual (invalidação + toast de sucesso) quando ao menos uma linha for removida.
- Aplicar em `src/components/deals/deal-detail-drawer.tsx` e `src/routes/_authenticated/deals.$id.tsx`.

### 3. Granularidade de permissão de exclusão de deals (migration)

- Inserir em `public.permissions` as chaves `techsales.deals.delete.own` e `techsales.deals.delete.team` (padrão já usado em `update`).
- Substituir `ws_delete_deals` para aceitar os três tiers:
  - `delete.workspace` → qualquer deal do workspace;
  - `delete.team` → mesma expressão usada em `update.team`;
  - `delete.own` → `owner_id = auth.uid()`.
- Semear (`job_role_default_permissions` + bundles ativos) o tier correspondente nos cargos que hoje têm `update.own` / `update.team` de deals, para que gerentes/vendedores possam excluir seus próprios negócios.

## Detalhes técnicos

- Hook de permissão (esqueleto):
  ```ts
  const canDelete = useHasAnyPermission([
    "techsales.deals.delete.workspace",
    "techsales.deals.delete.team",
    "techsales.deals.delete.own",
  ], { ownerId: deal.owner_id });
  ```
  O helper considera o tier `.own` só quando `ownerId === auth.uid()` e `.team` conforme o mesmo helper usado no RLS. Reutilizar o `AccessBundle` já carregado pelo `access.functions.ts`.

- Delete com detecção de RLS:
  ```ts
  const { data, error } = await supabase.from("deals").delete().eq("id", id).select("id");
  if (error) { /* revert + toast(error) */ return; }
  if (!data || data.length === 0) { /* revert + toast permissão negada */ return; }
  ```

- A nova policy segue o shape de `ws_update_deals`, trocando `update` por `delete` e acrescentando o ramo `owner_id = auth.uid()` para `.own`.

## Validação manual

1. Como Cristiane, sem permissão de delete: botão "Excluir" aparece desabilitado com tooltip; cliques via atalho/API resultam em toast de permissão negada e o card permanece.
2. Após seed de `delete.own`: Cristiane consegue excluir negócios próprios; negócios de outros donos continuam bloqueados.
3. Como admin: exclusão funciona como antes.
4. Recarregar o kanban após cada tentativa para confirmar a persistência real.

## Fora do escopo

- Aplicar o padrão de "botão desabilitado por permissão" em todos os módulos (será feito incrementalmente, guiado pelo doc).
- Redesenho do drawer, kanban, wizard, engine de workflows ou permissões de outras entidades.
