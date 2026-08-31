# Substatus no quadro de Leads e barra de ações em massa movível

## O que foi verificado

- O card do quadro de Leads (`leads-board-card.tsx`) **já usa** o mesmo `SubstatusQuickPicker` dos Negócios, recebendo `pipelineId` e a etapa da coluna.
- No banco, o "Funil de Leads" tem 7 etapas (`new`, `contacting`, `qualifying`, `qualified`, `meeting`, `oportunity`, `disqualified`) e substatus cadastrados em apenas 5 delas — `new` e `disqualified` não têm nenhum, então nessas colunas o seletor abre vazio.
- `LeadsBoard` é renderizado em `/leads` **sem** `canUpdate`/`canDelete`. Como `canDelete` tem default `false`, o botão **Excluir** não aparece na barra de ações em massa do quadro (no modo Tabela ele existe, dentro da toolbar).
- "Iniciar fila" e "Modo Prospecção" existem em dois lugares: no cabeçalho (`LeadsTopBar`) e, no modo Tabela, numa faixa inline dentro de `LeadsToolbar`.
- `BulkActionBar` (`src/components/bulk-action-bar.tsx`) é fixa em `bottom-4`, sem possibilidade de reposicionar.

## O que muda

### 1. Substatus editável em toda etapa de lead
- Passar `canUpdate` real (permissão de atualizar leads) do `/leads` para o quadro, para que o seletor fique editável para quem pode atualizar e somente-leitura para os demais.
- Nas etapas sem substatus cadastrado, o seletor continua abrindo com o estado "Nenhum substatus nesta etapa" + atalho de configuração (para quem gerencia pipelines) — mesmo comportamento dos Negócios.
- Não serão inseridos substatus novos no banco (isso é cadastro, feito em Configurações → Pipelines). Se você quiser que eu já cadastre sugestões para "Novo" e "Desqualificado", me avise.

### 2. Excluir na seleção em massa de Leads
- `/leads` passa `canDelete`/`canUpdate` (RBAC de leads) ao `LeadsBoard`, habilitando Excluir com confirmação por contagem no quadro.
- A RLS continua sendo a fonte de verdade; a exclusão segue usando o caminho já existente com relatório de bloqueio.

### 3. "Iniciar fila" e "Modo Prospecção" dentro da barra de seleção
- No modo **Tabela**, a faixa inline de seleção de `LeadsToolbar` é substituída pela `BulkActionBar` flutuante, com as mesmas ações: Iniciar fila, Modo Prospecção, Enriquecer, Adicionar à prospecção, Editar em massa, Excluir, "Selecionar todos os N registros" e limpar seleção.
- No modo **Quadro**, as duas ações já vivem na barra (mantidas).
- No cabeçalho (`LeadsTopBar`), "Iniciar fila" e "Modo Prospecção" passam a atuar apenas sobre o filtro atual (sem seleção) e ficam **ocultos quando houver seleção ativa**, para não duplicar a ação.

### 4. Barra de ações em massa reposicionável (todas as telas)
- `BulkActionBar` ganha uma alça de arraste (ícone de grip, `aria-label` "Mover barra de ações"), permitindo arrastar a barra para qualquer ponto da janela.
- A posição é lembrada por usuário no `localStorage` (chave única global, ex.: `bulk-bar:position`), valendo para todas as telas que usam a barra.
- Suporte a teclado: com foco na alça, setas movem a barra; `Esc`/duplo clique na alça restaura a posição padrão (rodapé centralizado).
- Reposicionamento com limites de tela (a barra nunca sai da área visível) e recálculo no resize.

## Detalhes técnicos

- `src/components/bulk-action-bar.tsx`: novo estado de posição (`{x, y}` ou `null` = padrão), handlers de `pointerdown/move/up`, clamp ao viewport, persistência em `localStorage` e alça com `GripVertical`. Sem mudança de API — todas as telas herdam o comportamento.
- `src/routes/_authenticated/leads.tsx`: cálculo de `canUpdateLeads`/`canDeleteLeads` via `usePermissions`, repasse ao `LeadsBoard`; remoção das props de seleção da toolbar em favor da nova barra.
- `src/components/leads/leads-toolbar.tsx`: remover o bloco inline de seleção (a toolbar volta a ser busca + view toggle + colunas + ações).
- `src/components/leads/leads-top-bar.tsx`: esconder "Iniciar fila"/"Modo Prospecção" quando `selectedCount > 0`.
- `src/components/leads/leads-board.tsx`: sem mudança estrutural; passa a receber as permissões.
- Sem alteração de schema, migrations, RLS, GRANT, permissões ou regras de negócio.

## Validação

`bunx tsgo --noEmit`, ESLint nos arquivos alterados, `bun run test` e verificação manual em `/leads` (Tabela e Quadro), Negócios e uma tela de grid genérica, em light/dark e 768/1280, conferindo arraste, persistência da posição e ações da barra.
