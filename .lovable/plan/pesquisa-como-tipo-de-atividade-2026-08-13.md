# Pesquisa como tipo de atividade

## Objetivo

"Pesquisa" passa a ser um tipo de atividade de primeira classe (como Ligação, E-mail, Reunião). O usuário aciona "Pesquisa" na timeline de qualquer entidade (lead, contato, empresa, negócio, ticket), escolhe uma pesquisa existente, responde o formulário na hora e a atividade fica registrada com as respostas visíveis.

Hoje existem duas coisas separadas e nenhuma delas é atividade:

- `/surveys` — pesquisas CSAT/NPS de ticket, uma única pergunta, respondidas por link público.
- `/prospecting?tab=questionarios` — questionários de qualificação (perguntas, pesos, score), usados só no painel de qualificação do lead; as respostas ficam em `prospecting_qualifications`.

## Como vai funcionar

1. Na timeline, novo botão **Pesquisa**.
2. Abre um modal com a lista de pesquisas disponíveis, em dois grupos: **Modelos de pesquisa** (`/surveys`) e **Questionários** (`/prospecting?tab=questionarios`).
3. Escolhida a pesquisa, o formulário é renderizado com as perguntas na ordem configurada, respeitando obrigatoriedade.
4. Ao salvar: cria a atividade tipo `survey` vinculada à entidade, com assunto "Pesquisa — {nome}", e grava as respostas.
   - Quando a pesquisa é um questionário de prospecção, o score é calculado com a lógica já existente (`src/lib/prospecting/score.ts`) e exibido junto.
5. No card da timeline: nome da pesquisa, data, autor, score (quando houver) e a lista de perguntas/respostas, com opção de editar as respostas enquanto a atividade não estiver concluída.
6. Filtros de tipo da timeline e das telas de atividades passam a incluir "Pesquisa".

## Padronização dos modelos de pesquisa (campos de formulário)

Os modelos de `/surveys` deixam de ser "uma pergunta só" e passam a suportar formulário com múltiplas perguntas, no padrão das ferramentas de mercado (Typeform/SurveyMonkey/Qualtrics), tudo com rótulos em português:

- Texto curto, Texto longo
- Escolha única, Múltipla escolha, Lista (select)
- Escala linear (1–5 / 1–10 com rótulos nas pontas)
- NPS (0–10 com faixas detrator/neutro/promotor)
- Avaliação por estrelas
- Sim/Não
- Número, Moeda, Data
- E-mail, Telefone

Cada pergunta tem: rótulo, texto de ajuda, obrigatória, posição, opções (quando aplicável) e configurações do tipo (mín/máx, rótulos das pontas, casas decimais).

Os CSAT/NPS existentes continuam funcionando: são migrados para um modelo de uma pergunta do tipo correspondente, sem mudar o fluxo de link público de ticket.

## Alterações técnicas

Banco (migration única, com GRANTs e RLS por workspace/owner no mesmo padrão das tabelas vizinhas):

- `activity_type`: adicionar valor `survey`.
- `survey_templates`: adicionar `description`, `kind` passa a aceitar `form`, e `scope` (`ticket` | `activity`) para separar disparo automático de ticket de pesquisa aplicada em atividade.
- Nova `survey_template_questions` (`survey_template_id`, `position`, `label`, `help_text`, `type`, `options` jsonb, `required`, `settings` jsonb) — espelha o padrão de `prospecting_questions`.
- Nova `activity_survey_responses` (`activity_id`, `source` = `survey_template` | `prospecting_questionnaire`, `source_id`, `answers` jsonb, `score`, `max_score`, `responded_by`, `responded_at`, `owner_id`, `workspace_id`).
- Backfill: cada `survey_templates.question` atual virá como pergunta única do respectivo modelo.

Código:

- `src/lib/crm.ts`: `ACTIVITY_TYPES` ganha `{ value: "survey", label: "Pesquisa" }`.
- `src/components/activity/timeline-shared.tsx`: ícone (ClipboardList), rótulo de log e nova ação `survey` na barra de ações.
- Novo `src/lib/surveys/survey-activity.functions.ts`: `listAvailableSurveys`, `getSurveyForm`, `saveSurveyActivity`, `getActivitySurveyResponse` (todas com `requireSupabaseAuth`).
- Novo `src/components/surveys/survey-activity-dialog.tsx` (seleção + formulário) e `src/components/surveys/survey-form-fields.tsx` (renderização por tipo de campo, reutilizável).
- Novo card de timeline `src/components/surveys/survey-timeline-item.tsx`.
- Editor de modelos: substituir o `CrudSettings` de `survey-templates-tab.tsx` por um editor com lista de perguntas arrastáveis, no mesmo padrão do editor de questionários de prospecção.

Sem mudança em RLS de outras tabelas, sem alterar o fluxo de qualificação de lead nem o link público de CSAT/NPS de ticket.

UX/UI: `PageHeader`/`SectionHeader`, `FormSection` no formulário, `EmptyState` quando não houver pesquisas cadastradas, `LoadingSkeleton`, `ErrorState`, tokens semânticos, labels acessíveis, responsivo e dark mode.

## Como validar

1. Abrir um lead → timeline → **Pesquisa** → escolher "Questionário Padrão" → responder → salvar.
2. Conferir o card na timeline com perguntas, respostas e score; editar e salvar de novo.
3. Filtrar a timeline por "Pesquisa".
4. Em `/surveys` → Modelos: criar um modelo com escala linear, NPS, múltipla escolha e texto; usar esse modelo numa atividade de empresa.
5. Confirmar que os CSAT/NPS antigos e o link público de ticket continuam funcionando.
