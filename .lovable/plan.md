# Botões flutuantes lado a lado + qualificação via workflow (pesquisa)

## 1. Botões flutuantes

Hoje o botão de chamado (canto inferior direito) e o botão de I.A. ocupam praticamente a mesma posição, ficando sobrepostos.

- Posicionar os três botões flutuantes lado a lado, na mesma linha inferior: Chamado, Mensageiro e I.A., com espaçamento uniforme.
- Aplicar 90% de transparência (opacidade 10%) também no botão de Chamado e manter no de I.A., ficando 100% opacos no mouse-over, como já ocorre no Mensageiro.
- Manter tooltips, aria-labels, badge de não lidas e z-index atuais.

## 2. Qualificação de lead deixa de ser regra fixa no código

A abertura do modal estava presa ao valor de etapa `qualified`; ao renomear a etapa para "Em Qualificação" a regra deixou de valer.

- Remover do detalhe do lead a interceptação da etapa, o modal "Qualificar lead" e o gate por etapa. Mover o lead entre etapas volta a ser uma gravação simples e imediata.
- A qualificação passa a ser uma **atividade de pesquisa normal** (aba Pesquisas), respondida pelo diálogo de pesquisa já existente, que usa o questionário de prospecção e calcula nota do questionário + fit ICP como hoje.

## 3. Workflow que gera e abre a pesquisa

- Nova ação no construtor de workflows: "Criar pesquisa (atividade)", com escolha da origem (questionário de prospecção ou modelo de pesquisa), assunto e responsável. O engine cria a atividade do tipo `survey` vinculada ao registro, pendente de resposta.
- Criar (já ativo) um workflow para Leads: gatilho de mudança de etapa, condição "etapa mudou para Em Qualificação", ação "Criar pesquisa (atividade)" com o questionário de qualificação ativo + notificação para o responsável. Fica visível e editável em Configurações → Workflows.
- Ao mover o lead para "Em Qualificação" na tela do lead, a etapa é gravada na hora e o sistema aguarda brevemente a atividade de pesquisa criada pelo workflow e **abre o diálogo de resposta automaticamente**. Se o workflow estiver inativo ou nada for criado, aparece um aviso discreto e nada bloqueia a etapa.
- A timeline continua atualizando em tempo real após a resposta (comportamento atual de realtime das pesquisas).

## Detalhes técnicos

- `src/components/bug-report/bug-report-button.tsx`, `src/components/chat/chat-trigger.tsx`, `src/components/ai-agent/agent-trigger.tsx`: posições fixas coordenadas (`right-5` / `right-20` / `right-[8.75rem]`, mesma `bottom`) e classes `opacity-10 hover:opacity-100 transition-opacity`.
- `src/routes/_authenticated/leads.$id.tsx`: `setStage` sem exceção para etapa de qualificação; remove o `Dialog` com `QualificationPanel`; passa a escutar a atividade de pesquisa recém-criada (invalidação/consulta curta por `related_lead_id` + `type = survey` sem resposta) e abrir `SurveyActivityDialog` em modo resposta.
- `src/lib/workflows/types.ts`: novo action type `create_survey_activity` (`source: "prospecting_questionnaire" | "survey_template"`, `source_id`, `subject`, `assigned_to?`, `due_in_days?`), rótulo e categoria no builder.
- `src/lib/workflows/engine.server.ts`: handler da nova ação inserindo em `activities` (`type: 'survey'`, vínculo pela entidade, campos de origem já usados pelo diálogo de pesquisa) com validação de workspace/RLS.
- `src/components/workflows/builder/*`: editor da ação com seletor de questionário/modelo (reaproveitando `listAvailableSurveys`).
- Seed do workflow via migration, resolvendo o `stage_id` da etapa "Em Qualificação" do pipeline de leads do workspace; sem alteração de RLS, autenticação ou schema de pesquisas.
- Sem mudança na lógica de score (questionário até 50 + ICP até 35).

## Como validar

1. Verificar os três botões flutuantes lado a lado, translúcidos, e 100% opacos no hover.
2. Em Configurações → Workflows, confirmar o workflow "Qualificação do lead" ativo.
3. Mover um lead para "Em Qualificação": a etapa grava na hora e a pesquisa de qualificação abre automaticamente.
4. Responder a pesquisa: registro aparece na timeline imediatamente, com nota e fit ICP.
5. Desativar o workflow e mover outro lead: etapa muda normalmente, sem modal.
