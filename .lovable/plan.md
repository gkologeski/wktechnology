
## Situação atual

Em `/prospecting` → aba **Fila**, uma fila é um **conjunto de filtros salvos** (status, fonte, score, busca) aplicado sobre `leads`/`contacts`. Não existe hoje ação "adicionar este lead à fila": um lead entra automaticamente na fila se casar com os filtros.

Além disso, existe `prospecting_enrollments` (inscrições em **cadências**), mas nenhuma UI em /leads permite inscrever leads selecionados.

O usuário precisa de um caminho **explícito** para empurrar leads escolhidos para dentro da suíte de prospecção.

## Objetivo

Permitir 2 formas de inclusão explícita:

1. **Fila manual** — o SDR seleciona N leads em `/leads` (ou `/contacts`) e envia para uma fila específica de /prospecting, que passa a exibir exatamente esses IDs.
2. **Inscrever em cadência** — os leads selecionados entram como `prospecting_enrollments` da cadência escolhida (start = agora, step 1).

## Escopo

### 1. Backend (migration)

- `prospecting_queues`: adicionar coluna `kind text not null default 'dynamic' check (kind in ('dynamic','manual'))` e `item_ids uuid[] not null default '{}'`.
- Manter RLS e GRANTs já existentes (só ALTER TABLE, sem recriar policies).

### 2. Server functions (`src/lib/prospecting/queues.functions.ts`)

- `upsertQueue`: aceitar `kind` e `item_ids` no schema.
- `listQueueItems`: quando `kind='manual'`, ignorar filtros e fazer `.in('id', item_ids)` na tabela alvo.
- Nova `addToQueue({ queue_id, ids[] })` — faz merge (união) em `item_ids`, validando que a fila é do dono/workspace via RLS.
- Nova `enrollInCadence({ cadence_id, entity, ids[] })` — insere em `prospecting_enrollments` (status='active', current_step=1, owner_id=auth.uid()). Deduplica por `(cadence_id, subject_id)`.

### 3. UI — dialog compartilhado

Novo `src/components/prospecting/add-to-prospecting-dialog.tsx` com 2 abas:

- **Fila**: Select das filas existentes do workspace (entidade compatível) + botão "Nova fila manual" (cria fila `kind='manual'` inline com nome).
- **Cadência**: Select das cadências ativas.

Confirmação mostra "X leads serão adicionados". Fecha e dispara toast.

### 4. Integração nas telas

- `src/routes/_authenticated/leads.tsx`: novo botão na barra de ações em massa **"Adicionar à prospecção"** (ao lado de "Iniciar fila"/"Enriquecer") que abre o dialog com `entity='lead'` e os IDs selecionados.
- `src/routes/_authenticated/contacts.tsx`: mesma ação com `entity='contact'`.

### 5. Ajustes em /prospecting

- `queue-tab.tsx` — `QueueDialog`: novo campo `Tipo de fila` (Dinâmica por filtros / Manual por seleção). Se manual, esconde filtros e mostra apenas nome/descrição.
- Cabeçalho da fila mostra badge "Manual · N itens" ou "Dinâmica".
- Em fila manual, cada linha ganha botão "Remover da fila" (chama `removeFromQueue`).

## Fora de escopo

- Não alterar scoring, questionários, cadence steps ou voice agent.
- Não mexer em RLS de `leads`/`contacts`.
- Sem UI de reordenação manual de itens dentro da fila (ordena por `updated_at`).

## Como validar

1. Em `/leads`, selecionar 3 leads → "Adicionar à prospecção" → aba Fila → criar "Fila teste manual".
2. Ir para `/prospecting?tab=fila` → ver a nova fila com os 3 leads.
3. Voltar a `/leads`, selecionar mais 2 → adicionar à mesma fila → total 5 (sem duplicar).
4. Selecionar leads → aba Cadência → escolher cadência ativa → verificar registros em `prospecting_enrollments`.
5. Typecheck limpo.
