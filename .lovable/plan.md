## Objetivo
Trazer para **Prospecção → Fila** a mesma experiência de execução sequencial que existe em `/tasks/queues/:id/play`, adicionar link direto no nome do lead/contato e criar uma tela de trabalho focada com escolha de questionário, dados do lead, timeline e painel de qualificação.

## Escopo

### 1. Ajustes na lista da fila (`src/components/prospecting/queue-tab.tsx`)
- **`QueueWorkspace`**: adicionar botão **"Iniciar fila"** no cabeçalho, ao lado de "Excluir fila", que navega para a nova rota de play. Desabilitado quando a fila estiver vazia.
- **`QueueItemRow`**:
  - Remover o botão **"Abrir"** à direita.
  - Transformar o **nome** em `<Link>` para `/leads/:id` ou `/contacts/:id` (mantém `detailHref` já calculado), com estilo `hover:underline`.
  - Nenhuma outra alteração de layout/badges.

### 2. Nova rota de execução: `src/routes/_authenticated/prospecting.queues.$queueId.play.tsx`
Segue o padrão de `tasks.queues.$queueId.play.tsx` (mesma UX, mesmos atalhos), adaptado ao domínio de prospecção.

Fluxo em dois estados:

**Estado A — Escolha do questionário** (renderizado enquanto `selectedQuestionnaireId` for null):
- Carrega `listQuestionnaires` (server fn já existente) e mostra apenas os `enabled`.
- Card central com `Select` dos questionários e botão **"Começar"**.
- Se não houver questionário habilitado, `EmptyState` com CTA para `/prospecting?tab=questionnaires`.

**Estado B — Workspace por item** (após seleção):
- Header: nome da fila + `idx de total` + botão **Voltar** para `/prospecting?tab=fila`.
- Coluna esquerda (dados do lead/contato, ~1/3):
  - Nome (link para detalhe), e-mail, telefone, empresa (`company_name` para lead / `company.name` para contato quando disponível), status/lifecycle e score.
  - Botões rápidos: **Ligar** (`tel:`), **Abrir registro** (`/leads/:id` ou `/contacts/:id`).
- Coluna direita (~2/3), em duas seções empilhadas:
  1. **Timeline de interações** — reutiliza `<ActivityTimeline entityType={entity} entityId={item.id} />` já existente.
  2. **Qualificação** — reutiliza `<QualificationPanel entity={entity} entityId={item.id} />` com prop nova opcional `preselectedQuestionnaireId` para forçar o questionário escolhido no Estado A (default = permanece no primeiro habilitado, comportamento atual preservado).
- Rodapé fixo: **Pular (S)** e **Próximo (N/→)**. `Concluir` não se aplica aqui — o próprio salvamento da qualificação no painel já persiste o estado. Atalhos de teclado idênticos ao Play de tasks (ignorar em `INPUT`/`TEXTAREA`).
- Ao chegar no fim: card "Fila concluída" com link de volta.

Sem novas mutations; a navegação entre itens é apenas index local (`useState`) sobre a lista carregada.

### 3. Dados
- Reutilizar `listQueueItems({ queue_id, limit: 500, offset: 0 })` (mesma server fn usada no `QueueWorkspace`) — sem alterações na server function.
- Reutilizar `listQuestionnaires`.
- Nenhuma migration. Nenhuma alteração de RLS.

### 4. Pequena extensão em `QualificationPanel`
- Aceitar prop opcional `preselectedQuestionnaireId?: string | null`. Quando presente e válida, inicializa `selectedId` com esse valor e esconde o `Select` de questionário (o SDR já escolheu na tela anterior). Comportamento atual (sem a prop) permanece intacto para os demais usos.

## Fora de escopo
- Nenhuma mudança em backend, RLS, schema, cadências ou scoring.
- Nenhuma alteração em `/tasks/queues` (referência apenas).
- Nenhum novo tipo de fila ou ordenação; a ordem é a mesma retornada por `listQueueItems`.

## Como validar manualmente
1. `/prospecting?tab=fila` → nome do lead abre a página do lead; não há mais botão "Abrir".
2. Cabeçalho da fila mostra **Iniciar fila**; desabilitado se vazio.
3. Ao clicar, abre a tela de escolha de questionário; depois de "Começar", entra no workspace.
4. Cada item mostra dados básicos + timeline + painel de qualificação com o questionário escolhido.
5. **S** pula, **N/→** avança; ao fim, aparece "Fila concluída".
