# Eliminar o gate legado de ferramentas (useMyTools) no frontend

## Resultado da auditoria (verificado agora)

- `useMyTools` **não é mais usado por nenhuma tela ou componente**: a única
  ocorrência no código é a própria definição em `src/lib/use-my-tools.ts`
  (busca em todo `src/`). A migração das ações de exportar/importar/excluir
  já foi concluída nas ondas anteriores.
- O modelo legado de "tool matrix" continua vivo em dois lugares:
  - `src/lib/permissions.server.ts` (`requireTool`, `userHasTool`,
    `getUserScope`, `assertCanAct`), lendo `access_profile_tools` /
    `access_profile_permissions` e usando `supabaseAdmin`.
  - Consumidores server-side: `src/lib/workflows.functions.ts`
    (6 chamadas de `manage_workflows`), `src/lib/csv-import.functions.ts`
    (`import`) e `src/lib/scheduled-exports.functions.ts` (`export`).
- As telas administrativas equivalentes às chaves legadas **não têm gate
  nenhum** hoje: `settings.workflows.tsx`, `settings.pipelines.tsx`,
  `settings.billing.tsx`, `integrations.tsx` (nenhum `<Can>`/`usePermissions`).
- O catálogo granular já cobre os recursos necessários no módulo `system`:
  `workflows`, `integrations`, `billing`, `pipelines`, `custom_properties`,
  `audit`, `members` (com `view/create/update/delete/export` e `manage` onde
  aplicável). Não é preciso criar permissão nova nem migration.

## O que será feito

1. **Gate granular nas telas administrativas** (substituindo o que o gate
   legado cobria conceitualmente), usando `<Can>` / `usePermissions`:
   - Workflows: CTAs de criar/editar/ativar → `system.workflows.*`
   - Pipelines: criar/editar/excluir estágio e pipeline → `system.pipelines.*`
   - Propriedades e grupos de propriedades → `system.custom_properties.*`
   - Integrações (lista e detalhe) → `system.integrations.*`
   - Billing/assinaturas → `system.billing.*`
   - Log de auditoria e exportação de auditoria → `system.audit.view.*`
     (substitui `access_logs`)
   - Times/usuários/convites → `system.members.*`
   Apenas visibilidade/disabled de CTA; nenhuma regra de negócio muda.

2. **Trocar o gate legado server-side por RBAC granular**:
   - `workflows.functions.ts`: `requireTool(..., "manage_workflows")` →
     `assertAnyPermission` com `system.workflows.update.workspace` /
     `.manage.workspace` (create nas funções de criação).
   - `csv-import.functions.ts` e `scheduled-exports.functions.ts`: as chaves
     `import`/`export` passam a usar as chaves granulares de export/import do
     recurso alvo (`*.export.workspace`), mantendo o comportamento atual para
     quem já tem acesso total.

3. **Remover código morto**: excluir `src/lib/use-my-tools.ts` e as funções de
   tool matrix de `src/lib/permissions.server.ts` que ficarem sem consumidor.
   `access-profiles.constants.ts` continua, pois alimenta a tela de perfis de
   acesso legado.

4. **Validação**: `bun run typecheck`, `bun run lint`, `bun run test`
   (inclui `action-matrix.test.ts` e testes de enforcement) e verificação
   manual em preview: usuário admin vê os CTAs; usuário sem as chaves
   `system.*` não vê, e a chamada direta da server function é negada.

## Observações técnicas

- `assertAnyPermission` de `src/lib/access-control/enforce.server.ts` é o
  ponto único de enforcement server-side; nenhuma RLS, schema ou policy é
  alterada neste trabalho.
- Como as telas hoje não têm gate, o efeito visível para membros restritos é
  ocultar CTAs administrativos — é uma restrição, não remoção de
  funcionalidade para quem tem permissão.
