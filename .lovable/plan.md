# Modo Prospecção a partir de /leads

Hoje "Iniciar fila" em Leads só percorre os registros um a um nas telas de detalhe do lead (`/leads/$id`). A tela de prospecção (`/prospecting/queues/$queueId/play`) — com escolha de questionário, painel de qualificação, timeline, atalhos de teclado e navegação Próximo/Pular — só é acessível a partir de uma fila cadastrada em Prospecção.

Este plano adiciona um botão **Modo Prospecção** ao lado de "Iniciar fila" em Leads, que carrega exatamente esses mesmos leads na tela de prospecção, sem alterar o layout nem as funcionalidades dela.

## O que será feito

1. **Botão "Modo Prospecção" no topo da lista de Leads**, ao lado de "Iniciar fila". Usa o mesmo conjunto de leads do filtro/visualização atual (mesma consulta já usada hoje, limitada a 1.000 itens por execução).

2. **Botão "Modo Prospecção" na barra de seleção em massa**, ao lado do "Iniciar fila" que aparece quando há leads marcados — leva apenas os leads selecionados.

3. **Reaproveitamento da tela de prospecção existente**: nenhuma mudança de layout, questionário, qualificação, timeline ou atalhos. O usuário cai direto no fluxo atual (escolher questionário → trabalhar item por item).

4. **Fila rápida reutilizável**: a ação usa uma fila manual própria do usuário chamada "Modo Prospecção (rápida)". Se já existir, os itens são substituídos pelos leads atuais; se não existir, ela é criada. Isso evita poluir a lista de filas com uma fila nova a cada clique, e a fila continua visível/editável em Prospecção → Fila.

5. **Permissões e estados**: o botão só aparece para quem pode ver e criar/editar filas de prospecção (`techsales.prospecting.queue.view` + `create`/`update`), fica desabilitado enquanto a lista carrega ou quando não há leads, mostra estado "Preparando…" durante a preparação e exibe erro via toast em caso de falha. Sem permissão, nada é exibido (a tela de prospecção já tem seu próprio bloqueio de acesso).

## Detalhes técnicos

- `src/routes/_authenticated/leads.tsx`: novo handler `startProspectingMode(ids)` que
  1. chama `listQueues` e procura uma fila `entity: "lead"`, `kind: "manual"`, nome "Modo Prospecção (rápida)" do usuário atual;
  2. chama `upsertQueue` (com `id` quando existir) passando `item_ids: ids`, `kind: "manual"`, `is_shared: false`;
  3. invalida `["prospecting", "queues"]` e `["prospecting", "queue-items"]`;
  4. navega para `/prospecting/queues/$queueId/play`.
- Reuso do bloco de consulta já existente no "Iniciar fila" do topo (mesmo `applyFilters` + ordenação) para obter os IDs; teto de 1.000 por respeitar o limite do `addToQueue`/uso prático da tela.
- Gate de UI com o componente `Can` / `usePermissions` já usados no arquivo.
- Nenhuma migration, alteração de RLS, de schema ou de regra de negócio. Nenhuma mudança em `prospecting.queues.$queueId.play.tsx`.

## Validação

- `bun run typecheck` e `bunx eslint` nos arquivos alterados.
- Verificação no navegador autenticado: clicar em "Modo Prospecção" na lista de Leads e confirmar que a tela de prospecção abre com a contagem correta de leads e o fluxo de questionário funcionando; repetir com seleção em massa.
