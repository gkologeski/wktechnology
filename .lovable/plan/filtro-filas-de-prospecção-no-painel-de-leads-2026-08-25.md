# Filtro "Filas de prospecção" no painel de Leads

Adicionar, no painel de filtros à esquerda de `/leads`, um grupo **Filas de prospecção** com multi-seleção (checkboxes, igual aos grupos Etapa/Origem). Ao marcar uma ou mais filas, o grid passa a mostrar somente os leads pertencentes a essas filas, e um botão abre esses leads direto no **modo prospecção** para qualificá-los.

## O que será feito

1. **Novo grupo de filtro "Filas de prospecção"** no painel esquerdo, listando as filas de prospecção de leads visíveis ao usuário (nome + contagem de itens quando disponível). Multi-seleção via checkbox; entra em "Limpar tudo" e no contador de filtros ativos.

2. **Grid filtrado pelas filas selecionadas**: a lista de leads passa a restringir aos IDs resolvidos das filas marcadas (união das filas). Fila manual usa seus `item_ids`; fila dinâmica é resolvida aplicando os filtros salvos dela.

3. **Botão "Abrir no modo prospecção"** dentro do grupo do filtro (visível quando há pelo menos uma fila marcada):
   - com **uma** fila marcada, navega direto para `/prospecting/queues/$queueId/play` dessa fila (sem criar nada);
   - com **duas ou mais** filas marcadas, reutiliza o atalho já existente "Modo Prospecção": grava a união dos leads na fila manual reutilizável "Modo Prospecção (rápida)" e abre a tela de play dela.
   - Nada muda na tela de prospecção (questionário, qualificação, timeline, atalhos permanecem iguais).

4. **Estados e permissões**: o grupo só aparece para quem tem permissão de ver filas de prospecção; mostra "Nenhuma fila ainda" quando vazio, skeleton enquanto carrega e toast de erro em falha. O botão fica desabilitado durante a preparação ("Preparando…") e quando a união não retorna leads.

## Detalhes técnicos

- `src/lib/prospecting/queues.functions.ts`: nova server fn `resolveQueueLeadIds({ queue_ids })` — reaproveita a lógica de filtros/`item_ids` já usada por `listQueueItems`, restrita a `entity: "lead"`, retornando IDs únicos (teto de `PROSPECTING_MODE_LIMIT`). Permissão `QUEUE_VIEW`, RLS/workspace inalterados.
- `src/components/leads/leads-filters-sidebar.tsx`: novo `FilterGroup` "Filas de prospecção" recebendo por props a lista de filas, `selectedQueueIds`, `onToggleQueue` e `onOpenProspecting` (componente segue presentacional, sem chamadas de dados).
- `src/routes/_authenticated/leads.tsx`: `Filters` ganha `queueIds: string[]` (default `[]`); `useQuery` de `listQueues` filtrando `entity === "lead"`; `useQuery` de `resolveQueueLeadIds` quando há filas marcadas, aplicando `.in("id", ids)` na consulta do grid (e no `fetchFilteredLeadIds`); handler `openProspectingFromQueues()` usando o `startProspectingMode` já existente ou navegação direta quando há só uma fila.
- Sem migration, sem mudança de schema, RLS, permissões ou regra de negócio. Nenhuma alteração em `prospecting.queues.$queueId.play.tsx`.

## Validação

- `bun run typecheck` e `bun run lint` nos arquivos alterados.
- Verificação manual em `/leads`: marcar uma fila (grid reduz, botão abre a fila), marcar duas (grid mostra a união, botão abre a fila rápida), limpar filtros e conferir retorno ao estado inicial; conferir empty/erro e dark mode.
