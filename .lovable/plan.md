# Seletor de pipeline na tela de Vagas (/jobs)

## Situação atual (verificada)

- Em `/jobs` a barra de filtros tem apenas busca, status, responsável e alternância de visão (Cards / Tabela / Status / Depto). Não existe nenhum seletor de pipeline.
- O único seletor de pipeline da tela está dentro do modal "Nova vaga", e ele já pré-seleciona o pipeline padrão do workspace.
- A listagem de vagas (`listAtsJobs`) não traz o campo `pipeline_id`, então hoje a tela não tem como filtrar nem exibir a qual pipeline cada vaga pertence.

## O que será feito

### 1. Seletor de pipeline na barra de filtros

- Novo seletor "Pipeline" na `FilterBar` de `/jobs`, ao lado dos filtros de status e responsável, com as opções: "Todos os pipelines" + cada pipeline visível (o padrão marcado como "(padrão)").
- A escolha é persistida por usuário (localStorage, como já é feito com a visão), para que ao voltar à tela o pipeline selecionado seja mantido.
- Quando nenhum pipeline estiver visível por permissão, ou houver erro de carregamento, exibir o aviso já existente (`PipelineSelectNotice`) logo abaixo da barra de filtros — mesma orientação usada no modal de nova vaga.
- O filtro entra como chip removível junto aos chips atuais, e o botão "Limpar filtros" do estado vazio também limpa o pipeline.

### 2. Vaga passa a mostrar o pipeline

- A listagem de vagas passa a retornar o pipeline de cada vaga (id + nome).
- Cards e Kanban: o nome do pipeline aparece como uma etiqueta discreta (mesmo padrão das etiquetas de senioridade/modalidade), apenas quando o filtro estiver em "Todos os pipelines" (evita repetir a informação já filtrada).
- Tabela: nova coluna "Pipeline".

### 3. Coerência com a criação de vaga

- Se um pipeline específico estiver selecionado no filtro, o modal "Nova vaga" abre com esse pipeline pré-selecionado (em vez do padrão), o que torna o fluxo previsível ao trabalhar dentro de um pipeline.

## Detalhes técnicos

- `src/lib/ats/ats.functions.ts`: incluir `pipeline_id` no `select` de `listAtsJobs` e hidratar o nome via consulta em `ats_pipelines` pelos ids retornados (mesmo padrão já usado para hidratar nomes de negócios). Sem alteração de RLS, schema ou regras de negócio.
- `src/routes/_authenticated/(ats)/jobs.index.tsx`: novo estado `pipelineFilter` (persistido em `jobs:pipeline`), filtro aplicado no cliente sobre as linhas já carregadas, chip do filtro, coluna/etiqueta de pipeline e reuso de `PipelineSelectNotice`.
- Componentes oficiais: `Select`, `FilterBar`, `MetaPill`, `StatusBadge`, `EmptyState` — nada novo criado.
- Sem mudanças em permissões, autenticação ou funcionalidades existentes.

## Como validar

1. Em `/jobs`, escolher um pipeline no novo seletor: a lista passa a mostrar apenas as vagas daquele pipeline (nas quatro visões).
2. Selecionar "Todos os pipelines": todas as vagas voltam, com a etiqueta/coluna indicando o pipeline de cada uma.
3. Recarregar a página: o pipeline selecionado é mantido.
4. Com um usuário sem permissão de ver pipelines: o seletor fica desabilitado e o aviso de permissão aparece.
