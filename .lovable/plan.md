## Problema

Erro `Rendered more hooks than during the previous render` ao abrir `/deals/:id`.

Causa (arquivo `src/routes/_authenticated/deals.$id.tsx`): há um early return `if (!deal) return ...` na linha 91, mas os hooks `usePermissions()` e `useAuth()` são chamados nas linhas 127-128, depois do return. No primeiro render (sem `deal`) esses hooks nunca executam; no render seguinte executam — violando a regra dos hooks.

## Correção

Mover `usePermissions()` e `useAuth()` para o topo do componente (junto com os demais hooks, antes do `if (!deal)`), preservando o mesmo cálculo de `canDelete`. Nenhuma outra alteração.

## Validação

- Abrir `/deals/8da84ad6-…` e confirmar que a página renderiza sem o erro.
- Confirmar que o botão de excluir continua desabilitando conforme a permissão.
