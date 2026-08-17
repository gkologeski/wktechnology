# Pesquisa de Vendas abre a tela padrão de qualificação

## Comportamento atual (verificado)

- Na timeline, o botão **Pesquisa** abre o `SurveyActivityDialog`. Ao escolher tipo **Vendas** + um questionário de prospecção, ele renderiza um formulário genérico (perguntas + score + fit ICP), sem enriquecimento Apollo, sem campos de Lead/Empresa/Contato e sem as ações Qualificar / Desqualificar / Nutrir.
- A tela rica (`QualificationPanel`) hoje só aparece no detalhe do lead quando existe uma atividade de pesquisa pendente criada por workflow. Esse painel suporta apenas a entidade `lead`.

## O que muda

- No modal de pesquisa, quando o tipo for **Vendas** (origem = questionário de prospecção) e a entidade for um **lead**, o conteúdo passa a ser a tela padrão de qualificação (`QualificationPanel`), com enriquecimento Apollo, campos de entidade, questionário, score unificado em %, perfil ICP e ações de decisão.
- Os dois seletores (tipo e pesquisa) continuam no topo, para o usuário poder trocar de questionário; o questionário escolhido é o que o painel carrega.
- Ao concluir a decisão, o modal fecha, a timeline atualiza na hora e a atividade de pesquisa é registrada/concluída pelo próprio painel (comportamento já existente, sem duplicidade).
- Fora desse caso nada muda: CSAT, NPS, Livre e pesquisas de vendas em outras entidades (contato, empresa, negócio, ticket) seguem com o formulário atual.

## Detalhes técnicos

- `src/components/surveys/survey-activity-dialog.tsx`: quando `kind === "vendas"`, `selection.source === "prospecting_questionnaire"` e `relatedKey === "related_lead_id"`, renderizar `QualificationPanel` (`entity="lead"`, `entityId={relatedId}`, `preselectedQuestionnaireId={selection.id}`, `activityId`) no lugar do bloco de perguntas/score/entidade e do rodapé de salvar; `onDecided` chama `onSaved()` e fecha o modal. Largura do `DialogContent` ampliada para acomodar o painel.
- Import de `QualificationPanel` via `React.lazy` + `Suspense` com `LoadingSkeleton`, para não pesar o bundle da timeline.
- `src/routes/_authenticated/leads.$id.tsx` permanece como está (já abre o painel para pendências de workflow).
- Sem alteração de schema, RLS, server functions ou da lógica de score.

## Como validar

1. Abrir um lead → timeline → **Pesquisa** → tipo **Vendas** → escolher o questionário: aparece a tela padrão de qualificação (Apollo, campos, score em %, perfil ICP).
2. Qualificar: modal fecha, timeline atualiza imediatamente com o registro da qualificação.
3. Trocar para **CSAT**/**NPS**/**Livre**: formulário atual, inalterado.
4. Em uma empresa ou negócio, tipo **Vendas**: formulário atual, inalterado.
