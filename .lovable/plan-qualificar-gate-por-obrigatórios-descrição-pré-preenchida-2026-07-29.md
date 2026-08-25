# Qualificar: gate por obrigatórios + descrição pré-preenchida

Ajustar o fluxo de qualificação em `/prospecting/queues/:id/play` para (1) só habilitar o botão "Qualificar" quando todas as perguntas obrigatórias do questionário ativo estiverem respondidas e (2) pré-preencher a descrição do modal de criação de negócio com as perguntas e respostas da qualificação.

## Mudanças

### 1. `src/components/prospecting/qualification-panel.tsx`

- Calcular `missingRequired` a partir de `qData.questions` filtrando `q.required === true` e verificando se `answers[q.id]` está vazio (null/undefined, string vazia, ou array vazio para `multi`).
- Botão "Qualificar" recebe `disabled = busy || !activeId || missingRequired.length > 0`.
- Quando desabilitado por faltarem obrigatórios, adicionar `title` no botão listando as perguntas pendentes (feedback para o usuário).
- Construir string `qualificationSummary` a partir de `qData.questions` + `answers`, formatada como bloco de texto:
  - Cabeçalho `Qualificação — {questionnaire.name} (score {score}/{threshold})`
  - Uma linha por pergunta respondida: `- {label}: {resposta formatada}`
  - Para `boolean`: "Sim"/"Não"; para `multi`: valores separados por vírgula; para `single`/`text`/`number`: valor bruto; perguntas sem resposta são omitidas.
- Passar `qualificationSummary` como nova prop `initialDescription` para `CreateDealFromLeadDialog`.

### 2. `src/components/leads/create-deal-from-lead-dialog.tsx`

- Aceitar prop opcional `initialDescription?: string`.
- Inicializar `useState(initialDescription ?? "")` e, via `useEffect`, atualizar `description` quando `open` passa a `true` e o campo ainda estiver vazio (não sobrescreve edição do usuário).

## Escopo

- Apenas UI/presentacional. Não altera server functions, schema, RLS ou regras de negócio.
- Não altera "Salvar rascunho", "Enviar para nutrição", "Desqualificar".
- Não muda o fluxo pós-criação do negócio.

## Validação manual

1. Abrir `/prospecting/queues/{id}/play`, escolher questionário com perguntas obrigatórias.
2. Confirmar que "Qualificar" fica desabilitado até responder todas as obrigatórias.
3. Preencher e clicar "Qualificar" → modal abre com o campo Descrição já contendo o resumo perguntas/respostas.
4. Criar o negócio e confirmar que a descrição foi salva.
