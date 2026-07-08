# Reordenar passos do workflow com drag-and-drop

Permitir reordenar passos arrastando, incluindo mover entre níveis diferentes (raiz ↔ ramo `then`/`else` de um `branch_if`, e entre ramos distintos).

## Escopo

- Somente UI do builder (`src/components/workflows/workflow-builder.tsx`).
- Sem alterações no engine, schemas, tipos ou banco — a ordem persistida é a posição no array `actions`.
- HTML5 Drag and Drop nativo (mesmo padrão já usado em `src/components/entity-board.tsx`), sem novas dependências.

## Comportamento

- Cada passo (`StepCard` e `BranchCard`) fica arrastável (`draggable`), com um handle visual (ícone `GripVertical`) que aparece ao passar o mouse ou receber foco.
- Drop targets:
  - **Entre passos** — os `Connector` existentes viram zonas de drop; ao arrastar por cima, ficam destacados e aceitam o drop naquela posição.
  - **Início da lista raiz** e **início de cada ramo** (`then`/`else`) — novo drop-slot no topo de cada `StepsList` para permitir colocar o passo como primeiro item daquele nível.
- Movimentação entre níveis:
  - Raiz → dentro de um ramo `then`/`else` e vice-versa.
  - Entre `then` e `else` do mesmo (ou de outro) `branch_if`.
  - Reordenar dentro do mesmo nível.
- Restrição: um `branch_if` **não pode ser solto dentro de si mesmo** (nem em nenhum descendente) — evita ciclo. O drop target fica desabilitado visualmente nesse caso.
- Feedback: cursor `grabbing`, opacidade reduzida no card arrastado, borda/realce no drop target ativo.
- Acessibilidade: além do drag, mantemos os botões ↑/↓ em cada card para reordenar via teclado dentro do mesmo nível (fallback acessível — drag-and-drop HTML5 é limitado para teclado).
- Seleção atual acompanha o passo movido (o `selection` é reapontado para o novo `StepPath`).

## Implementação técnica

1. **Helper novo** ao lado dos existentes (`getStep`/`removeStep`/`insertStepAt`):
   ```ts
   function moveStepTo(
     actions: WorkflowAction[],
     from: StepPath,
     to: { parentPath: StepPath; index: number }
   ): { actions: WorkflowAction[]; newPath: StepPath } | null
   ```
   - Verifica se `to.parentPath` começa com `from` (impede drop dentro de si mesmo).
   - Faz `removeStep` do path de origem e depois `insertStepAt` no destino, ajustando `to.index` quando o remove aconteceu no mesmo pai em índice anterior.
   - Retorna a nova lista e o novo `StepPath` para atualizar a seleção.

2. **Estado de arrasto** no componente principal do builder:
   ```ts
   const [dragging, setDragging] = useState<StepPath | null>(null);
   const [dropTarget, setDropTarget] = useState<{ parentPath: StepPath; index: number } | null>(null);
   ```

3. **StepCard / BranchCard**:
   - `draggable`, `onDragStart` seta `dragging` (e `e.dataTransfer.effectAllowed = "move"`), `onDragEnd` limpa.
   - Handle `GripVertical` visível no hover/focus, sem sobrepor o botão remover.
   - Botões ↑/↓ (accessibility fallback) usando helper `moveStepTo` para o mesmo pai.

4. **Drop slots** (novo componente `DropSlot`) usados em:
   - Topo de cada `StepsList` (índice 0).
   - Entre cada par de passos (substitui o `Connector` atual, ou envolve ele).
   - Dentro dos ramos `then` e `else` do `BranchCard` (mesmo `StepsList` já é recursivo).
   - Handlers: `onDragOver` chama `preventDefault` e seta `dropTarget`; `onDragLeave` limpa; `onDrop` chama `moveStepTo`, atualiza `state.actions` e ajusta `selection`.
   - Se `dragging` é um `branch_if` e o `parentPath` do slot começa com `dragging` (ciclo), o slot rejeita: sem highlight, `dropEffect = "none"`.

5. **Props novas** propagadas por `StepsList` / `StepCard` / `BranchCard`:
   - `dragging`, `dropTarget`, `onDragStartStep(path)`, `onDragEndStep()`, `onDropAt({parentPath,index})`, `onHoverSlot({parentPath,index} | null)`, `onMove(path, dir)`.

6. **Estilo**: usar tokens semânticos existentes (`border-primary`, `bg-primary/5`, `ring-primary/20`) — nada de cores hardcoded. Handle e slots respeitam dark mode.

## Validação

- `bunx tsgo --noEmit`.
- Manual:
  - Reordenar dentro da raiz por drag.
  - Arrastar um passo da raiz para dentro do `then` de um `branch_if`.
  - Arrastar de volta do ramo para a raiz.
  - Mover entre `then` e `else` do mesmo `branch_if`.
  - Confirmar que soltar um `branch_if` dentro de si mesmo é impedido.
  - Reordenar via teclado com ↑/↓.
  - Salvar e reabrir — ordem persiste.

## Fora do escopo

- Biblioteca de DnD (dnd-kit, react-dnd) — HTML5 nativo cobre o caso.
- Multi-seleção (arrastar vários passos de uma vez).
- Reordenar ramos `then`/`else` entre si (eles são fixos dentro de um `branch_if`).
