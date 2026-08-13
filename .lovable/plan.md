# Pesquisas por tipo: CSAT, NPS, Vendas e Livre

## Objetivo

Em `/surveys`, criar e gerenciar pesquisas por tipo. Na timeline, o botão **Pesquisa** passa a pedir primeiro o **tipo** e depois a **pesquisa específica**; quando o tipo é **Vendas**, o formulário exibido é o de qualificação (perguntas do questionário de prospecção com seus campos).

## Como vai funcionar

### /surveys

A página passa a ter as abas: **CSAT**, **NPS**, **Vendas**, **Livre** e os resultados atuais (convites/respostas de ticket seguem como hoje).

Botão **Nova pesquisa** abre um seletor de tipo:

- **CSAT** — modelo de satisfação (0–5), com pergunta, canal, disparo e atraso, como hoje.
- **NPS** — modelo 0–10, mesmos campos.
- **Vendas** — aponta para os questionários de prospecção: lista os **modelos de framework** (SPIN, GPCT, MEDDIC, BANT etc., `is_template = true`) e os **questionários derivados** criados a partir deles. Permite criar um novo questionário a partir de um modelo e editar/abrir o questionário existente (reaproveitando o editor já usado em Prospecção → Questionários).
- **Livre** — formulário aberto: nome, descrição e lista de perguntas montada com os tipos de campo já existentes (texto curto/longo, escolha única/múltipla, lista, escala linear, NPS, estrelas, sim/não, número, moeda, data, e-mail, telefone), com obrigatoriedade e reordenação.

Cada aba lista as pesquisas do tipo com ações de editar perguntas, ativar/desativar e duplicar. Estados de carregamento, vazio e erro em todas.

### Timeline (botão Pesquisa)

1. Passo 1: escolher o **tipo** (CSAT, NPS, Vendas, Livre).
2. Passo 2: escolher a **pesquisa** daquele tipo (apenas ativas).
3. Formulário:
   - CSAT / NPS / Livre: campos do modelo, como hoje.
   - **Vendas**: formulário de qualificação — as perguntas do questionário com seus tipos (única, múltipla, número, texto, sim/não), com cálculo e exibição de score/percentual usando a mesma lógica de qualificação já existente. Em leads, os blocos de campos de entidade configurados na qualificação também aparecem; nas demais entidades, apenas as perguntas.
4. Salvar registra a atividade tipo `survey` com as respostas, score e `source`/`source_name`, como já ocorre hoje.

## Alterações técnicas

Banco (migration única):

- `survey_templates`: `kind` passa a aceitar `form` (recriar o CHECK atual `csat|nps`), `question` passa a aceitar nulo (modelos livres não têm pergunta única) e default de `trigger_event` mantido; `scope` recebe `activity` para modelos livres.

Código:

- `src/components/surveys/surveys-page.tsx`: abas CSAT / NPS / Vendas / Livre + resultados; header com o novo fluxo de criação.
- Novos: `src/components/surveys/survey-type-picker-dialog.tsx` (escolha do tipo), `src/components/surveys/free-surveys-tab.tsx` (CRUD de pesquisas livres, reutilizando `SurveyQuestionsDialog`), `src/components/surveys/sales-surveys-tab.tsx` (modelos de framework + questionários derivados, consumindo `src/lib/prospecting/questionnaires.functions.ts`).
- `survey-templates-tab.tsx`: passa a receber o `kind` alvo (`csat`, `nps` ou `form`) e filtrar/criar dentro dele.
- `src/lib/surveys/survey-activity.functions.ts`: `listAvailableSurveys` retorna as pesquisas agrupadas por tipo (`csat`, `nps`, `sales`, `free`), separando modelos de framework de questionários derivados; `getSurveyForm` sinaliza o tipo para a UI escolher a renderização.
- `src/components/surveys/survey-activity-dialog.tsx`: dois passos (tipo → pesquisa) e renderização do formulário de qualificação quando o tipo é Vendas, reaproveitando `qualification-entity-fields.tsx` e `src/lib/prospecting/score.ts`.

Sem alteração em RLS, no fluxo público de CSAT/NPS de ticket, nem no painel de qualificação do lead.

UX/UI: `PageHeader`/`SectionHeader`, `FormSection`, `EmptyState`, `LoadingSkeleton`, `ErrorState`, tokens semânticos, labels acessíveis, responsivo e dark mode.

## Como validar

1. `/surveys` → Nova pesquisa → **Livre** → adicionar perguntas de vários tipos → salvar.
2. Aba **Vendas** → conferir modelos de framework e questionários derivados; criar um novo a partir de um modelo.
3. Abrir um lead → timeline → **Pesquisa** → tipo **Vendas** → escolher questionário → responder → conferir score no card.
4. Repetir com tipo **Livre** e **CSAT** em uma empresa.
5. Conferir que o link público de pesquisa de ticket continua funcionando.
