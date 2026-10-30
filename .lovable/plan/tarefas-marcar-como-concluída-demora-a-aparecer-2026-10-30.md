# Tarefas: marcar como concluída demora a aparecer

## O que foi visto
Ao marcar uma tarefa, a tela espera duas coisas antes de mostrar o risco de "Concluída": o banco gravar a mudança e depois recarregar a lista inteira. Se qualquer uma for lenta, a marcação demora a aparecer. Ainda não medi qual das duas pesa mais.

## O que farei
1. **Marcação imediata:** a tarefa aparece concluída na hora do clique. Se o banco recusar, a marcação volta e aparece o aviso de erro. Vale para concluir ou reabrir uma tarefa e para concluir várias de uma vez.
2. **Medir a gravação:** cronometrar com a sua conta quanto o banco leva para gravar a conclusão de uma tarefa (reabrindo em seguida). Se passar de cerca de 1 s, identificar a automação do banco responsável e propor a correção à parte, sem mexer em regras.
3. Testar no navegador: concluir, reabrir e concluir em lote.

## Fora do escopo
Visual, permissões e regras das tarefas.

## Estimativa
Porte P, 20 a 40 min. Nada é publicado sem seu aceite.

## Detalhes técnicos
- `markComplete` e a conclusão em lote em `src/routes/_authenticated/tasks.tsx` fazem `update` e depois `invalidateQueries(["tasks"])`.
- Mudança: `onMutate` otimista com `setQueriesData` nas chaves `["tasks","hubspot-list",…]`, rollback no erro, invalidação em segundo plano.
- Medição: `update` cronometrado via REST com a sessão do usuário numa tarefa própria, revertido em seguida; se lento, inspecionar os gatilhos de `activities`.
