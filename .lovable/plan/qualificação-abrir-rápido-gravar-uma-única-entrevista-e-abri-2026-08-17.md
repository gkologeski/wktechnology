# Qualificação: abrir rápido, gravar uma única entrevista e abrir o negócio

## Diagnóstico (verificado no banco e no código)

1. **Demora para abrir**: em `leads.$id.tsx`, ao mudar a etapa o front grava o lead, chama o processamento dos workflows e só então faz polling (até 8 tentativas de 750 ms) procurando primeiro a intenção de oportunidade e depois a pesquisa. Na prática o modal só aparece depois de vários segundos.

2. **Entrevista gravada 2x** (confirmado nas atividades do lead 7e5e43bf…):
   - 17:57:46 — `Pesquisa — Questionário Padrão` (criada pelo workflow e concluída pelo painel);
   - 17:58:53 — `Qualificação — Questionário Padrão` (criada pelo registro da qualificação).
     O registro da qualificação procura reaproveitar uma atividade existente pela linha de `activity_survey_responses`; a atividade do workflow ainda não tinha resposta nesse momento (estava pendente), então não houve reaproveitamento e nasceu uma segunda atividade.

3. **Vai para "Oportunidade" e o modal de negócio não abre**: o funil de leads não tem etapa `qualified` (etapas: `new`, `contacting`, `qualifying`, `oportunity` (won), `disqualified`). Ao qualificar, o painel cai no fallback "etapa do tipo won" = **Oportunidade**, o que disparou o workflow e criou a intenção `Criar oportunidade` (atividade 55226dc8…, ainda pendente). Só que quem abre o modal de negócio é o fluxo de mudança de etapa da tela; o `onDecided` do painel apenas fecha o diálogo e recarrega. Por isso o modal só apareceu quando você mexeu na etapa depois.

## Correções

### 1. Uma única entrevista na timeline

- Concluir a atividade de pesquisa criada pelo workflow **antes** de registrar a qualificação e repassar esse `activity_id` ao registro, para que a qualificação atualize a mesma atividade (assunto, corpo com decisão/score, respostas) em vez de criar outra.
- Reforçar o reaproveitamento no lado servidor: além de procurar por `activity_survey_responses`, casar também pela marcação de origem em `custom_fields` (`survey_source_id`) da atividade pendente do lead.
- Padronizar o assunto final como `Qualificação — {questionário}` para não ficarem dois títulos diferentes para o mesmo evento.

### 2. Abrir o modal de criação de negócio ao qualificar

- Após qualificar, a própria tela do lead passa a verificar imediatamente a intenção pendente de oportunidade e abrir `CreateDealFromLeadDialog` com pipeline, empresa, contato e previsão de fechamento (último dia útil do mês) — o mesmo caminho já usado na mudança manual de etapa.
- Se a intenção ainda não existir (workflow em processamento), uma verificação curta em segundo plano abre o modal assim que aparecer, sem bloquear a tela e sem aviso tardio.

### 3. Abertura rápida do questionário

- Abrir o diálogo de qualificação **na hora** em que a etapa muda para "Em qualificação", com o questionário ativo já selecionado, e reconciliar em segundo plano com a atividade criada pelo workflow (quando ela chegar, vincula-se ao mesmo diálogo).
- Manter o disparo do processamento dos workflows, mas sem que a abertura da tela dependa dele.
- Remover o toast "Nenhuma pesquisa pendente foi criada pelo workflow" quando a tela já abriu por conta própria.

## Detalhes técnicos

- `src/routes/_authenticated/leads.$id.tsx`: abrir o diálogo de qualificação de forma otimista na etapa `qualifying`; adotar a verificação da intenção de negócio também no callback `onDecided` do painel; polling encurtado e não bloqueante.
- `src/components/prospecting/qualification-panel.tsx`: inverter a ordem (concluir atividade de pesquisa → registrar qualificação com o `activity_id`) nas ações Qualificar/Desqualificar/Nutrir; sinalizar a decisão ao chamador para acionar a abertura do negócio.
- `src/lib/prospecting/qualification-activity.server.ts` e `src/lib/prospecting/qualifications.functions.ts`: aceitar `activity_id` opcional e usá-lo como alvo; ampliar a busca de atividade existente por `custom_fields.survey_source_id`.
- Sem alteração de schema, RLS, permissões, workflows publicados ou da lógica de score.

## Como validar

1. Mover um lead para "Em qualificação": o questionário abre imediatamente (sem espera perceptível).
2. Preencher e clicar em "Qualificar": a timeline mostra **um único** registro de pesquisa/qualificação, com score e decisão.
3. O lead vai para "Oportunidade" e o modal de criação de negócio abre em seguida, com pipeline Novos Negócios, previsão no último dia útil do mês, empresa e contato preenchidos.
4. Criar o negócio: a intenção é concluída e o modal não reabre ao navegar/mudar etapa.
5. Desqualificar: um único registro na timeline e nenhum modal de negócio.
