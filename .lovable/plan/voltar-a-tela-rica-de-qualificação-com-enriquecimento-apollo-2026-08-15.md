# Voltar a tela rica de qualificação (com enriquecimento Apollo) no fluxo do workflow

## Situação atual (verificada)

- Ao mover o lead para "Em qualificação", o workflow cria uma atividade de pesquisa e o detalhe do lead (`src/routes/_authenticated/leads.$id.tsx`) abre o `SurveyActivityDialog` — um diálogo genérico de pesquisa (519 linhas), sem enriquecimento e sem decisão de qualificação.
- A tela anterior é o `QualificationPanel` (`src/components/prospecting/qualification-panel.tsx`), que reúne: enriquecimento Apollo (cascata + gravação automática dos campos vazios), campos de Lead/Empresa/Contato, questionário de prospecção, score unificado (questionário + fit ICP, com barra em %), perfil ICP e ações Qualificar / Desqualificar (com atualização de `status` + `stage_id`).

## O que muda

- Quando a atividade de pesquisa criada pelo workflow for de um lead e tiver origem em questionário de prospecção, o detalhe do lead volta a abrir o `QualificationPanel` (mesma tela de antes, com Apollo), em vez do diálogo genérico.
- O `SurveyActivityDialog` continua sendo usado para todos os outros casos: pesquisas NPS/CSAT/Livre, modelos de pesquisa, outras entidades e resposta pela aba Pesquisas/timeline.
- A atividade criada pelo workflow deixa de ficar pendente: ao concluir a qualificação, ela é marcada como respondida/concluída e vinculada ao registro de qualificação, para a timeline mostrar um único evento (sem pesquisa "fantasma" pendente).
- Se o usuário fechar sem concluir, a atividade permanece pendente e pode ser retomada — reabrindo a mesma tela de qualificação.

## Detalhes técnicos

- `src/routes/_authenticated/leads.$id.tsx`: no resultado de `getPendingSurveyActivity`, ramificar por origem — `prospecting_questionnaire` renderiza `QualificationPanel` dentro do `Dialog` (passando `entityId` do lead e o `activityId`); demais origens seguem com `SurveyActivityDialog`. Manter o polling/`triggerTickNow` e os toasts atuais.
- `src/components/prospecting/qualification-panel.tsx`: aceitar prop opcional `activityId` e, no sucesso de Qualificar/Desqualificar, encerrar a atividade de pesquisa (resposta + status concluído) reaproveitando a função de conclusão já usada pelo diálogo de pesquisa; sem mudança na lógica de score, enriquecimento ou RLS.
- Se necessário, expor em `src/lib/surveys/survey-activity.functions.ts` uma chamada de conclusão reutilizável (mesma validação de workspace/auth já existente) para evitar duplicar lógica.
- Sem alteração de schema, permissões, workflows publicados ou do catálogo de campos.

## Como validar

1. Mover um lead de outra etapa para "Em qualificação": abre a tela de qualificação antiga, com selo Apollo, campos preenchidos, questionário, score em % e perfil ICP.
2. Concluir com "Qualificar": timeline atualiza na hora com o registro de qualificação e a atividade de pesquisa não fica pendente.
3. Concluir com "Desqualificar": lead vai para a etapa/status de desqualificado.
4. Fechar sem responder e reabrir pela aba Pesquisas: a mesma tela de qualificação é exibida.
5. Criar uma pesquisa NPS/CSAT por modelo: continua abrindo o diálogo de pesquisa normal.
