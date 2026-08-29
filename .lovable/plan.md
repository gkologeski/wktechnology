# Três correções: contagem do Kanban de Leads, Configurações que saltam para fora, e nota do formulário na timeline

## 1. Quadro de Leads: contagem por etapa divergente do filtro (verificado)

Diagnóstico:

- O quadro recebe apenas a página atual da lista (`pageSize` = 50 em `src/routes/_authenticated/leads.tsx`), então a contagem no cabeçalho da coluna é "quantos cards estão carregados", não o total da etapa. Daí "Em Contato" mostrar 1.
- O filtro lateral usa outro critério no banco: para leads sem `stage_id`, converte a etapa em status legado com `deriveLeadStatus`, que colapsa várias etapas em `contacted`. Por isso "Em Contato" filtra 36 registros que o quadro distribui em colunas diferentes (o cliente resolve a etapa com `resolveLeadStageValue`, que usa outro mapeamento).

O que será feito:

- Novo módulo `src/lib/leads/stage-query.ts` (já criado) que traduz uma etapa em predicado de banco espelhando exatamente `resolveLeadStageValue`: `stage_id` igual à etapa, ou `stage_id` nulo com o status legado que mapeia para aquela etapa (incluindo status nulo na primeira etapa aberta).
- O filtro lateral passa a usar esse predicado, eliminando a divergência entre filtro, grid e quadro.
- O quadro passa a ter consulta própria: uma query por etapa, com `count: "exact"` e limite de cards por coluna. O cabeçalho mostra o total real da etapa e, quando houver mais leads do que os carregados, indica "X de N".
- Ações em massa do quadro ganham "Iniciar fila" e "Modo Prospecção" agindo apenas na seleção; o checkbox da coluna passa a selecionar todos os leads da etapa no filtro atual (busca paginada no banco, com estado de carregamento).
- "Iniciar fila" do topo deixa de ser truncado silenciosamente em 1.000: passa a paginar em blocos de 1.000 até o limite pedido.
- A paginação do rodapé continua apenas no modo Tabela.

Estado atual: `src/lib/leads/stage-query.ts` foi criado e `leads.tsx` recebeu o uso de `stagesOrExpr` sem o import correspondente — o primeiro passo da execução é completar esse import e o restante das mudanças acima.

## 2. Configurações que saltam para fora (Pontuação, Playbooks, Enriquecimento)

Diagnóstico: `settings.scoring.tsx`, `settings.playbooks.tsx` e `settings.enrichment.tsx` têm `beforeLoad` com `throw redirect({ to: "/prospecting", search: { tab: ... } })`, mesmo já importando os componentes de página correspondentes. Por isso o usuário é jogado para fora do shell de Configurações.

O que será feito: remover o `beforeLoad` das três rotas e renderizar `ScoringPage`, `PlaybooksPage` e `EnrichmentHistoryPage` dentro do shell de Configurações, mantendo os chips/abas ativos. As telas em `/prospecting` continuam funcionando como hoje.

## 3. Lead criado por formulário sem a nota na timeline

Diagnóstico: em `src/routes/api/public/forms/$slug.submit.ts` o envio cria o lead (ou contato), grava `form_submissions` e incrementa o contador — mas nunca insere em `activities`. Logo a timeline do lead não mostra nada do que foi preenchido.

O que será feito:

- Após criar o lead/contato, inserir uma atividade `type: "note"` com assunto identificando o formulário e corpo com os campos preenchidos (rótulo: valor, na ordem definida no formulário), associada a `related_lead_id` / `related_contact_id`.
- `owner_id`, `created_by`, `assigned_to` e `workspace_id` vêm do formulário/registro criado (o insert do lead passa a devolver `workspace_id`).
- Falha ao gravar a nota não invalida o envio: apenas registra erro no log, igual ao padrão já usado na API pública v1.

## Detalhes técnicos

- Arquivos: `src/lib/leads/stage-query.ts`, `src/routes/_authenticated/leads.tsx`, `src/components/leads/leads-board.tsx`, `src/components/kanban/use-board-selection.ts` (novo `selectMany`), `src/routes/_authenticated/settings.{scoring,playbooks,enrichment}.tsx`, `src/routes/api/public/forms/$slug.submit.ts`.
- Nenhuma mudança de schema, RLS, permissões ou regra de negócio; a nota do formulário usa o cliente administrativo já existente no endpoint público.
- Validações: `bunx tsgo --noEmit`, ESLint nos arquivos alterados, `bun run test` e verificação no navegador autenticado em `/leads` (Tabela e Quadro) e nas três telas de Configurações.

## Como validar

1. `/leads` no modo Quadro: total de cada coluna igual ao número que o filtro lateral retorna para a mesma etapa.
2. Selecionar a coluna "Em Contato" e clicar em "Iniciar fila": a fila tem exatamente a quantidade da etapa.
3. Configurações → Pontuação, Playbooks e Enriquecimento abrem dentro de Configurações.
4. Enviar um formulário público com descrição e abrir o lead criado: a timeline mostra a nota com os campos preenchidos.
