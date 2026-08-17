# Abertura imediata do modal ao entrar em "Em qualificação"

## O que está acontecendo hoje

Ao mudar a etapa do lead, a tela grava a etapa e então chama o processamento da fila de automações sem filtro (`triggerTickNow` → `tickWorkflows(supabase, 50)`), que consome os eventos **mais antigos primeiro**. Com backlog gerado por backfills, o evento da mudança de etapa não é processado nessa chamada; o polling roda 8 tentativas de 750ms (até ~6s) e, no fim, dispara o toast "Nenhuma pesquisa pendente foi criada pelo workflow" — mensagem incorreta e atrasada.

## Correção proposta

### 1. Processamento direcionado ao registro em foco

- `tickWorkflows` ganha um irmão `tickWorkflowsFor(supabase, entity, entityId, limit)` que seleciona apenas os eventos pendentes **daquele registro**, reusando `processEvent` sem alterar ordenação nem comportamento do tick geral.
- `triggerTickNow` passa a aceitar `entity` e `entity_id` opcionais: quando informados, processa primeiro os eventos do registro e só então segue o comportamento atual. Chamadas existentes sem parâmetros continuam iguais.

### 2. Mudança de etapa não bloqueia a UI

- A gravação da etapa continua imediata.
- O trabalho de automação passa a rodar em segundo plano, sem prender interação e sem toast de falha por demora.
- Se o processamento direcionado falhar por erro real (permissão, erro do motor), o aviso aparece; demora de fila não gera aviso.

### 3. Modal imediato

- Nova server function `openQualificationForLead({ lead_id })` que, em uma única chamada: processa os eventos pendentes do lead, e devolve a atividade de pesquisa pendente (ou a intenção de oportunidade) já criada pelo workflow.
- A tela do lead chama essa função ao mudar de etapa e abre o `QualificationPanel`/`SurveyActivityDialog` na resposta — sem depender do cron nem do backlog.
- O polling atual passa a ser apenas fallback curto (2 tentativas) para o caso do workflow criar a atividade de forma assíncrona.

### 4. Verificação de saúde da fila

- A mesma função retorna `queue_backlog` (contagem de eventos pendentes do workspace). Quando houver backlog relevante e nada pendente para o lead, a tela mostra um aviso informativo com ação "Tentar novamente" — em vez de afirmar que o workflow não criou nada.
- O aviso só aparece se, de fato, nenhuma pesquisa/intenção existir para o lead.

## Detalhes técnicos

- `src/lib/workflows/engine.server.ts`: adiciona `tickWorkflowsFor` (filtro `entity` + `entity_id`, mesma projeção e mesma chamada a `processEvent`). Nenhuma mudança em `tickWorkflows`, `tickTimeTriggers` ou `processEvent`.
- `src/lib/workflows.functions.ts`: `triggerTickNow` recebe `inputValidator` opcional (`entity`, `entity_id`).
- `src/lib/leads/deal-intent.functions.ts` (ou novo `src/lib/leads/qualification.functions.ts`): `openQualificationForLead` com `requireSupabaseAuth`, retornando `{ survey, deal_intent, queue_backlog }`.
- `src/routes/_authenticated/leads.$id.tsx`: `setStage` chama a nova função sem `await` bloqueante na UI; abre o diálogo com o resultado; toast final substituído por aviso condicional com retry.
- Sem alteração de RLS, grants, schema, permissões ou regras de negócio dos workflows. Sem migration.

## Como validar

1. Mover um lead de "Novo" para "Em qualificação": a etapa grava na hora e o modal de qualificação (Apollo + score ICP) abre em ~1s, mesmo com fila acumulada.
2. A tela permanece interativa durante o processo; nenhum toast de erro aparece por demora.
3. Se realmente não houver workflow ativo, o aviso informa fila/ausência e oferece nova tentativa.
4. Mover para "Oportunidade" continua abrindo o modal de criação de oportunidade.
