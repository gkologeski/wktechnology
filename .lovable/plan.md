## Problema
1. Na aba **Questionários** da Prospecção, os cards dos modelos (BANT, MEDDIC, CHAMP, GPCT) exibem os botões **Visualizar** e **Duplicar** em uma única linha ao lado do texto "Corte: X". Quando a janela é reduzida, esses botões excedem a largura do card e são cortados pela borda, conforme screenshot.
2. Ao editar um questionário no `QuestionnaireEditorSheet`, o usuário não consegue alterar o nome do questionário — apenas as perguntas e o toggle "Ativo" são editáveis.

## Diagnóstico
- `src/components/prospecting/questionnaires-tab.tsx` renderiza os cards de modelo com `CardContent` usando `flex items-center justify-between`, sem quebra de linha responsiva.
- O editor (`QuestionnaireEditorSheet`) carrega `data.questionnaire.name` no título da Sheet, mas não expõe um campo editável para o nome.
- A server function `upsertQuestionnaire` já aceita `name`, portanto basta adicionar o campo na UI e enviá-lo no payload de atualização.

## Plano de correção

### 1. Responsividade dos cards de modelo
- Alterar o `CardContent` dos cards de modelo para empilhar verticalmente o bloco de informações (Corte) e as ações em telas pequenas (`flex-col sm:flex-row`).
- Permitir quebra de linha nos botões de ação (`flex-wrap`) e usar `gap-2` consistente.
- Garantir `min-w-0` e `truncate` no texto para evitar expansão forçada.
- Em telas pequenas, exibir os botões de modelo como icon-only com `aria-label` e tooltip, mantendo texto completo em telas maiores.
- Aplicar o mesmo cuidado responsivo na seção "Meus questionários" se necessário.

### 2. Edição do nome do questionário
- Adicionar um campo "Nome" editável no topo do `QuestionnaireEditorSheet`, logo abaixo do cabeçalho.
- Manter o estado local do nome e atualizá-lo via `upsertQuestionnaire` ao perder foco (`onBlur`) ou com um botão explícito "Salvar nome".
- Garantir que o título da Sheet reflita o nome atualizado após salvar.
- Ajustar o payload de `toggleEnabled` para incluir o `name` atual, evitando sobrescrever o nome com valor vazio.

## Escopo
- Ajustes de layout/CSS no componente `src/components/prospecting/questionnaires-tab.tsx`.
- Adição de campo editável de nome no `QuestionnaireEditorSheet`.
- Nenhuma mudança em server functions, banco de dados, RLS ou comportamento funcional além da edição do nome.

## Fora do escopo
- Alterações na lógica de duplicação ou visualização.
- Novas funcionalidades de prospecção.
- Refatoração do editor de perguntas.