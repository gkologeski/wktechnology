# Corrigir "Iniciar fila" no Quadro (Kanban) de Leads

## Diagnóstico (verificado no código)

- A seleção de cards do quadro vive dentro de `LeadsBoard` (`useBoardSelection` em `src/components/leads/leads-board.tsx`) e **não é conhecida** pela página `/leads`. A barra de ações do quadro (`GridBulkBar`) não tem nenhuma ação "Iniciar fila".
- A seleção da página (`selectedIds` em `src/routes/_authenticated/leads.tsx`) só é alimentada pela tabela. Logo, no modo Quadro, o botão "Iniciar fila" que o usuário alcança é o do topo (`LeadsTopBar`), que **ignora a seleção** e monta a fila com todos os leads do filtro atual.
- Esse botão chama `fetchFilteredLeadIds(5000)`, mas a API do banco corta a resposta em **1.000 linhas** por padrão — daí a "fila de 1000 registros".
- O quadro também exibe apenas a página atual (`pageSize` = 50), então os 47 cards da coluna "Novo" são só os carregados, não necessariamente todos os leads dessa etapa.

## O que será feito

1. **Ações em massa do quadro passam a incluir "Iniciar fila" e "Modo Prospecção"**, agindo somente sobre os cards selecionados. Ficam na mesma barra inferior de ações em massa já usada pelo quadro, ao lado de editar/excluir.
2. **A seleção do quadro é comunicada à página** por callback, para que a página use exatamente esses IDs (mesma mecânica de `startFocusQueue` e `startProspectingMode` já existentes) e mostre o mesmo toast com a contagem correta.
3. **Selecionar a coluna inteira passa a significar a etapa inteira**: o checkbox do cabeçalho da coluna carrega todos os IDs daquela etapa dentro do filtro atual (busca paginada no banco, em blocos de 1.000, com teto de segurança), não apenas os cards visíveis. Enquanto carrega, o checkbox mostra estado de carregamento e fica desabilitado.
4. **Fila do topo deixa de ser truncada silenciosamente**: a busca de IDs do filtro atual passa a paginar em blocos de 1.000 até o limite pedido, e o toast informa quando o teto for atingido.
5. Sem alterações de schema, RLS, permissões ou regras de negócio. O comportamento do modo Tabela permanece igual.

## Detalhes técnicos

- `src/routes/_authenticated/leads.tsx`: `fetchFilteredLeadIds` passa a iterar com `.range(offset, offset + 999)` até o limite; novo helper `fetchStageLeadIds(stageValue)` reaproveitando `applyFilters` + a resolução de etapa (`stage_id`/`status`) de `src/lib/leads/stages.ts`; novos handlers passados ao `LeadsBoard` (`onStartQueue(ids)`, `onStartProspecting(ids)`, `onFetchStageIds(stageValue)`).
- `src/components/leads/leads-board.tsx`: novas props opcionais; `GridBulkBar` recebe ações extras (ícones `Play`/`Headphones`) com a seleção atual; checkbox de coluna usa `onFetchStageIds` quando disponível, com fallback para os IDs visíveis.
- `src/components/kanban/use-board-selection.ts`: adicionar `selectMany(ids)` (marcar um conjunto explícito) sem alterar `toggleMany`.
- Gate de permissão do "Modo Prospecção" reaproveita `canProspectingMode` já calculado na página.
- Estados obrigatórios: loading no checkbox da coluna e nas ações, disabled sem seleção, toasts de erro via sonner, rótulos em PT-BR e acessíveis.

## Como validar

1. Em `/leads`, alternar para Quadro, marcar o checkbox da coluna "Novo" e clicar em "Iniciar fila": a contagem do toast deve ser igual ao total da etapa no filtro atual (47 no cenário relatado), e a fila deve percorrer exatamente esses leads.
2. Selecionar poucos cards manualmente e iniciar fila: a fila deve conter apenas eles.
3. Sem seleção, o "Iniciar fila" do topo continua percorrendo todo o filtro, agora sem corte em 1.000.
