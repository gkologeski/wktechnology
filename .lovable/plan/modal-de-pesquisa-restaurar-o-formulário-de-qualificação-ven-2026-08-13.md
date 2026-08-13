# Modal de pesquisa: restaurar o formulário de qualificação (Vendas)

## Causa

As perguntas dos questionários de prospecção usam os tipos `single`, `multi`, `text`, `number`, `boolean` e guardam `options` como `[{ label, points }]`. O modal novo renderiza todas as perguntas com `SurveyField`, que conhece apenas os tipos do catálogo de pesquisas (`single_choice`, `multi_choice`, `linear_scale`, ...). Tipo desconhecido cai no fallback de input de texto — por isso as perguntas BANT aparecem como caixas de texto, sem combo e sem os pontos por opção. O modal também não exibe score, máximo, percentual nem corte, que existem no painel de qualificação.

## O que muda

Somente apresentação, em `src/components/surveys/survey-activity-dialog.tsx`:

1. Extrair o renderizador de perguntas de prospecção (`QuestionInput` de `src/components/prospecting/qualification-panel.tsx`, hoje interno) para um componente compartilhado `src/components/prospecting/qualification-question-input.tsx`, sem alterar o comportamento atual. O painel de qualificação passa a importar dele.
2. No modal, quando a pesquisa selecionada vier de `prospecting_questionnaire`, renderizar as perguntas com esse componente (combo com "(N pts)" em escolha única, checkboxes com pontos em múltipla, textarea, número, sim/não). Para `survey_template` (CSAT/NPS/Livre), continua `SurveyField`.
3. Adicionar no cabeçalho do formulário de Vendas o mesmo bloco de score do painel: `score`, `de {max}`, percentual, barra de progresso e "Corte {pass_threshold}", usando `computeQualificationScore`, `computeQualificationMaxScore` e `scorePercent` de `src/lib/prospecting/score.ts` sobre as respostas em tempo real. Os dados já vêm de `getSurveyForm` (`pass_threshold`, pontuação).
4. Validação de obrigatórios: usar a checagem de preenchimento compatível com os dois formatos (a atual `isAnswered` já cobre string/array/número/boolean).

Sem mudanças de schema, RLS, server functions ou na lógica de salvamento/score no servidor.

## Como validar

1. Abrir um lead → timeline → **Pesquisa** → tipo **Vendas** → escolher o questionário BANT.
2. Conferir combos com pontos nas perguntas de escolha, checkboxes na múltipla, e score/percentual/corte atualizando ao responder.
3. Responder e salvar; conferir o card da pesquisa na timeline com o score.
4. Repetir com uma pesquisa **CSAT** e uma **Livre** para garantir que a renderização anterior continua igual.
