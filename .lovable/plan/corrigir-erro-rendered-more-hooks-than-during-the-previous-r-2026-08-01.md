# Corrigir erro "Rendered more hooks than during the previous render" no construtor de workflows

## Diagnóstico (confirmado no código)

Em `src/components/workflows/workflow-builder.tsx`, o componente do construtor tem um retorno antecipado na linha 550 (`if (!open) return null;`) e, depois dele, na linha 571, um `useMemo` (`priorStepFields`, adicionado na implementação de "Passos anteriores").

Com o modal fechado, o componente renderiza 7 hooks e sai antes do `useMemo`. Ao abrir (criar/editar workflow), passa a renderizar 8 hooks — o React aborta com "Rendered more hooks than during the previous render", caindo no `errorComponent` do root ("Algo deu errado").

## Correção

- Mover o `useMemo` de `priorStepFields` para antes do `if (!open) return null;`, junto dos demais hooks, mantendo a mesma lógica (usa `selection` e `state.actions`, ambos já disponíveis). Como `selectedAction` é calculado sem hook, ele permanece onde está ou é reposicionado sem alteração de comportamento.
- Remover a linha final `void useMemo;` (gambiarra para silenciar import não usado), que deixa de ser necessária.

Nenhuma mudança de comportamento, layout, schema, RLS ou regra de negócio: apenas a ordem dos hooks.

## Validação

1. `tsgo --noEmit` e lint no arquivo alterado.
2. Manual: `/settings/workflows` → "Novo workflow" (abre sem erro) → escolher entidade, adicionar 2 passos, selecionar o segundo e conferir o grupo "Passos anteriores" nas condições → fechar e reabrir o modal várias vezes → editar um workflow existente.
