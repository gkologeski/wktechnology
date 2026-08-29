# Concluir as três correções em andamento

Retomada do plano já aprovado. Parte já foi aplicada; abaixo o que falta.

## Já aplicado

- `src/lib/leads/stage-query.ts` criado: traduz uma etapa em predicado de banco espelhando exatamente a resolução usada no cliente (`stage_id`, status legado equivalente e status nulo na primeira etapa aberta).
- `src/routes/_authenticated/leads.tsx`: filtro lateral passou a usar esse predicado; busca de IDs paginada em blocos de 1.000 (fim do truncamento silencioso da fila); nova consulta por etapa com contagem exata para o quadro.
- `src/components/kanban/use-board-selection.ts`: ganhou `selectMany` e `deselectMany`.
- `src/components/leads/leads-board.tsx`: colunas com total real da etapa ("X de N" quando há mais leads do que os carregados), checkbox de coluna selecionando a etapa inteira do filtro atual, e ações "Iniciar fila" e "Modo Prospecção" na barra de ações em massa.

## Falta fazer

1. Ligar o quadro à página: passar `columns`, `onFetchStageIds`, `onStartQueue`, `onStartProspecting`, `canProspectingMode` e `prospectingBusy` em `leads.tsx`, e esconder a paginação do rodapé no modo Quadro.
2. Configurações que saltam para fora: remover o `beforeLoad` com redirect para `/prospecting` em `settings.scoring.tsx`, `settings.playbooks.tsx` e `settings.enrichment.tsx`, renderizando as páginas dentro do shell de Configurações.
3. Nota do formulário na timeline: em `src/routes/api/public/forms/$slug.submit.ts`, após criar lead/contato, inserir atividade `type: "note"` com os campos preenchidos na ordem do formulário, associada ao lead/contato; falha ao gravar a nota apenas registra log e não invalida o envio.

## Detalhes técnicos

- Nenhuma mudança de schema, RLS, permissões ou regra de negócio.
- A nota usa o cliente administrativo já presente no endpoint público; o insert do lead passa a devolver `workspace_id`.
- Validações: `bunx tsgo --noEmit`, ESLint nos arquivos alterados, `bun run test` e verificação no navegador autenticado em `/leads` (Tabela e Quadro) e nas três telas de Configurações.

## Como validar

1. `/leads` no modo Quadro: total de cada coluna igual ao que o filtro lateral retorna para a mesma etapa.
2. Selecionar a coluna "Em Contato" e clicar em "Iniciar fila": a fila tem exatamente a quantidade da etapa.
3. Configurações → Pontuação, Playbooks e Enriquecimento abrem dentro de Configurações.
4. Enviar um formulário público e abrir o lead criado: a timeline mostra a nota com os campos preenchidos.
