// Canvas do workflow builder: cartão de gatilho, lista de passos, ramificações
// (Se/Então/Senão e por valor) e conectores. Extraído de workflow-builder.tsx
// sem mudança de comportamento.
import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Filter,
  GitBranch,
  GripVertical,
  MoreHorizontal,
  Plus,
  Repeat,
  Sparkles,
  SplitSquareHorizontal,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { conditionsSummary } from "@/lib/workflows/conditions";
import {
  ACTION_LABELS,
  ENTITY_LABELS,
  EVENT_LABELS,
  type WorkflowAction,
  type WorkflowEntity,
  type WorkflowTrigger,
} from "@/lib/workflows/types";
import {
  ACTION_ICONS,
  describeAction,
  isDescendantOrSelf,
  type FieldOpt,
  type StepPath,
} from "./step-tree";
import { useReferenceLabels } from "../use-reference-labels";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { confirmDialog } from "@/components/ui/confirm-dialog";

// ============================================================================
// Canvas primitives
// ============================================================================
export function TriggerCard({
  trigger,
  entity,
  selected,
  onSelect,
}: {
  trigger: WorkflowTrigger;
  entity: WorkflowEntity;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-full text-left rounded-lg border bg-card p-4 shadow-sm transition",
        "hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-primary ring-2 ring-primary/20",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <Zap className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            Gatilho de entrada
          </p>
          <p className="text-sm font-medium truncate">
            {ENTITY_LABELS[entity]} · {EVENT_LABELS[trigger.event]}
          </p>
        </div>
      </div>
      {(trigger.filters ?? []).length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          {conditionsSummary(trigger.filters)}
        </div>
      )}
      {trigger.reenroll?.enabled && (
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Repeat className="h-3.5 w-3.5" />
          Reinscrição habilitada
        </div>
      )}
    </button>
  );
}

type DragProps = {
  dragging: StepPath | null;
  onDragStartStep: (p: StepPath) => void;
  onDragEndStep: () => void;
  onDropAt: (to: { parentPath: StepPath; index: number }) => void;
  onMove: (p: StepPath, dir: -1 | 1) => void;
};

function DropSlot({
  parentPath,
  index,
  dragging,
  onDropAt,
  variant = "between",
}: {
  parentPath: StepPath;
  index: number;
  dragging: StepPath | null;
  onDropAt: (to: { parentPath: StepPath; index: number }) => void;
  variant?: "between" | "empty";
}) {
  const [hover, setHover] = useState(false);
  // Rejeita drop dentro de si mesmo / descendente (ciclo).
  const isCycle = dragging ? isDescendantOrSelf(parentPath, dragging) : false;
  const active = !!dragging && !isCycle;
  if (!active && variant === "between") {
    // Sem drag ativo: slot invisível e não interfere no layout.
    return <div className="h-0" aria-hidden />;
  }
  return (
    <div
      onDragOver={(e) => {
        if (isCycle) {
          e.dataTransfer.dropEffect = "none";
          return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        if (!isCycle) onDropAt({ parentPath, index });
      }}
      className={cn(
        "rounded-md transition",
        variant === "between" ? "my-1 h-2" : "my-1 h-8 border border-dashed",
        active && "border border-dashed border-primary/40",
        hover && !isCycle && "bg-primary/10 border-primary ring-1 ring-primary/20",
      )}
      aria-hidden
    />
  );
}

export function StepsList({
  actions,
  path,
  selection,
  library,
  onSelect,
  onRemove,
  onAddAt,
  onChangeAction,
  entityFields,

  dragging,
  onDragStartStep,
  onDragEndStep,
  onDropAt,
  onMove,
}: {
  actions: WorkflowAction[];
  path: StepPath;
  selection: StepPath | "trigger" | null;
  library: { parentPath: StepPath } | null;
  onSelect: (p: StepPath) => void;
  onRemove: (p: StepPath) => void;
  onAddAt: (parentPath: StepPath) => void;
  onChangeAction: (p: StepPath, a: WorkflowAction) => void;
  entityFields: FieldOpt[];
} & DragProps) {
  return (
    <>
      {/* Drop slot no início do nível */}
      <DropSlot
        parentPath={path}
        index={0}
        dragging={dragging}
        onDropAt={onDropAt}
        variant={actions.length === 0 && !!dragging ? "empty" : "between"}
      />
      {actions.map((action, i) => {
        const stepPath: StepPath = [...path, i];
        const isSelected =
          Array.isArray(selection) && JSON.stringify(selection) === JSON.stringify(stepPath);
        const isDraggingSelf =
          dragging !== null && JSON.stringify(dragging) === JSON.stringify(stepPath);
        return (
          <div key={i} data-step-path={JSON.stringify(stepPath)}>
            {action.type === "branch_if" ? (
              <BranchCard
                action={action}
                stepPath={stepPath}
                selected={isSelected}
                selection={selection}
                library={library}
                onSelect={() => onSelect(stepPath)}
                onRemove={() => onRemove(stepPath)}
                onSelectPath={onSelect}
                onRemovePath={onRemove}
                onAddAt={onAddAt}
                canMoveUp={i > 0}
                canMoveDown={i < actions.length - 1}
                isDraggingSelf={isDraggingSelf}
                dragging={dragging}
                onDragStartStep={onDragStartStep}
                onDragEndStep={onDragEndStep}
                onDropAt={onDropAt}
                onMove={onMove}
              />
            ) : action.type === "switch_by_value" ? (
              <SwitchCard
                entityFields={entityFields}
                action={action}
                stepPath={stepPath}
                index={i + 1}
                selected={isSelected}
                selection={selection}
                library={library}
                onSelect={() => onSelect(stepPath)}
                onRemove={() => onRemove(stepPath)}
                onSelectPath={onSelect}
                onRemovePath={onRemove}
                onAddAt={onAddAt}
                onChangeAction={onChangeAction}
                canMoveUp={i > 0}
                canMoveDown={i < actions.length - 1}
                isDraggingSelf={isDraggingSelf}
                dragging={dragging}
                onDragStartStep={onDragStartStep}
                onDragEndStep={onDragEndStep}
                onDropAt={onDropAt}
                onMove={onMove}
              />
            ) : (
              <StepCard
                action={action}
                index={i + 1}
                stepPath={stepPath}
                selected={isSelected}
                canMoveUp={i > 0}
                canMoveDown={i < actions.length - 1}
                isDraggingSelf={isDraggingSelf}
                onSelect={() => onSelect(stepPath)}
                onRemove={() => onRemove(stepPath)}
                onDragStartStep={onDragStartStep}
                onDragEndStep={onDragEndStep}
                onMove={onMove}
              />
            )}
            {/* Drop slot entre este e o próximo (e depois do último) */}
            <DropSlot parentPath={path} index={i + 1} dragging={dragging} onDropAt={onDropAt} />
            {i < actions.length - 1 && (
              <Connector
                onAdd={() => onAddAt(path)}
                active={
                  library !== null && JSON.stringify(library.parentPath) === JSON.stringify(path)
                }
              />
            )}
          </div>
        );
      })}
      {actions.length > 0 && path.length === 0 && (
        <Connector
          onAdd={() => onAddAt(path)}
          active={library !== null && library.parentPath.length === 0}
        />
      )}
    </>
  );
}

function DragHandle({
  onDragStart,
  onDragEnd,
  label = "Arrastar passo",
}: {
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  label?: string;
}) {
  return (
    <span
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      role="button"
      aria-label={label}
      tabIndex={-1}
      className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0"
    >
      <GripVertical className="h-4 w-4" />
    </span>
  );
}

function StepCardDescription({ action }: { action: WorkflowAction }) {
  const labels = useReferenceLabels();
  return <p className="text-xs text-muted-foreground truncate">{describeAction(action, labels)}</p>;
}

function StepActions({
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
}: {
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-label="Opções do passo"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="pointer-events-auto z-[180]">
        <DropdownMenuItem disabled={!canMoveUp} onSelect={onMoveUp}>
          <ArrowUp className="h-4 w-4" /> Mover para cima
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canMoveDown} onSelect={onMoveDown}>
          <ArrowDown className="h-4 w-4" /> Mover para baixo
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          onSelect={() => {
            void confirmDialog({
              title: "Remover passo?",
              description: "Este passo e suas configurações serão removidos do rascunho.",
              confirmLabel: "Remover passo",
              variant: "destructive",
            }).then((ok) => {
              if (ok) onRemove();
            });
          }}
        >
          <Trash2 className="h-4 w-4" /> Remover passo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StepCard({
  action,
  index,
  stepPath,
  selected,
  canMoveUp,
  canMoveDown,
  isDraggingSelf,
  onSelect,
  onRemove,
  onDragStartStep,
  onDragEndStep,
  onMove,
}: {
  action: WorkflowAction;
  index: number;
  stepPath: StepPath;
  selected: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isDraggingSelf: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDragStartStep: (p: StepPath) => void;
  onDragEndStep: () => void;
  onMove: (p: StepPath, dir: -1 | 1) => void;
}) {
  const Icon = ACTION_ICONS[action.type] ?? Sparkles;
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify(stepPath));
    onDragStartStep(stepPath);
  };
  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card p-3 shadow-sm transition",
        "hover:border-primary/50",
        selected && "border-primary ring-2 ring-primary/20",
        isDraggingSelf && "opacity-40",
      )}
    >
      <div className="flex items-center gap-2">
        <DragHandle onDragStart={handleDragStart} onDragEnd={onDragEndStep} />
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="flex-1 min-w-0 text-left focus-visible:outline-none"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Passo {index}
              </p>
              <p className="text-sm font-medium truncate">{ACTION_LABELS[action.type]}</p>
              <StepCardDescription action={action} />
            </div>
          </div>
        </button>
      </div>
      <div className="absolute top-1 right-1">
        <StepActions
          onMoveUp={() => onMove(stepPath, -1)}
          onMoveDown={() => onMove(stepPath, 1)}
          onRemove={onRemove}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
        />
      </div>
    </div>
  );
}

function BranchCard({
  action,
  stepPath,
  selected,
  selection,
  library,
  onSelect,
  onRemove,
  onSelectPath,
  onRemovePath,
  onAddAt,
  canMoveUp,
  canMoveDown,
  isDraggingSelf,
  dragging,
  onDragStartStep,
  onDragEndStep,
  onDropAt,
  onMove,
}: {
  action: Extract<WorkflowAction, { type: "branch_if" }>;
  stepPath: StepPath;
  selected: boolean;
  selection: StepPath | "trigger" | null;
  library: { parentPath: StepPath } | null;
  onSelect: () => void;
  onRemove: () => void;
  onSelectPath: (p: StepPath) => void;
  onRemovePath: (p: StepPath) => void;
  onAddAt: (parentPath: StepPath) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isDraggingSelf: boolean;
} & DragProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify(stepPath));
    onDragStartStep(stepPath);
  };
  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card shadow-sm",
        selected && "border-primary ring-2 ring-primary/20",
        isDraggingSelf && "opacity-40",
      )}
    >
      <div className="flex items-center gap-2 p-3">
        <DragHandle
          onDragStart={handleDragStart}
          onDragEnd={onDragEndStep}
          label="Arrastar ramificação"
        />
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="flex-1 min-w-0 text-left flex items-center gap-3"
        >
          <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <GitBranch className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
              Ramificação
            </p>
            <p className="text-sm font-medium">Se / Então / Senão</p>
            <p className="text-xs text-muted-foreground">{conditionsSummary(action.filters)}</p>
          </div>
        </button>
        <StepActions
          onMoveUp={() => onMove(stepPath, -1)}
          onMoveDown={() => onMove(stepPath, 1)}
          onRemove={onRemove}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 p-3 pt-0">
        {(["then", "else"] as const).map((branch) => (
          <BranchColumn
            key={branch}
            title={branch === "then" ? "Sim" : "Não"}
            parentPath={[...stepPath, branch]}
            actions={action[branch] ?? []}
            selection={selection}
            library={library}
            onSelectPath={onSelectPath}
            onRemovePath={onRemovePath}
            onAddAt={onAddAt}
            dragging={dragging}
            onDragStartStep={onDragStartStep}
            onDragEndStep={onDragEndStep}
            onDropAt={onDropAt}
            onMove={onMove}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Coluna de ramo no canvas: lista de passos filhos com drag & drop, mover,
 * remover e adicionar. Compartilhada por branch_if (Sim/Não) e switch (cases).
 */
function BranchColumn({
  title,
  subtitle,
  parentPath,
  actions,
  selection,
  library,
  onSelectPath,
  onRemovePath,
  onAddAt,
  dragging,
  onDragStartStep,
  onDragEndStep,
  onDropAt,
  onMove,
  headerExtra,
}: {
  title: string;
  subtitle?: string;
  parentPath: StepPath;
  actions: WorkflowAction[];
  selection: StepPath | "trigger" | null;
  library: { parentPath: StepPath } | null;
  onSelectPath: (p: StepPath) => void;
  onRemovePath: (p: StepPath) => void;
  onAddAt: (parentPath: StepPath) => void;
  headerExtra?: React.ReactNode;
} & DragProps) {
  return (
    <div className="rounded-md border bg-muted/20 p-2">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide font-semibold truncate" title={title}>
            {title}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {actions.length} {actions.length === 1 ? "ação" : "ações"}
          </p>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground truncate" title={subtitle}>
              {subtitle}
            </p>
          )}
        </div>
        {headerExtra}
      </div>
      <div className="space-y-1">
        <DropSlot
          parentPath={parentPath}
          index={0}
          dragging={dragging}
          onDropAt={onDropAt}
          variant={actions.length === 0 && !!dragging ? "empty" : "between"}
        />
        {actions.length === 0 && !dragging && (
          <p className="text-[11px] text-muted-foreground py-1">Nenhum passo neste ramo.</p>
        )}
        {actions.map((child, ci) => {
          const childPath: StepPath = [...parentPath, ci];
          const isSel =
            Array.isArray(selection) && JSON.stringify(selection) === JSON.stringify(childPath);
          const isDraggingChild =
            dragging !== null && JSON.stringify(dragging) === JSON.stringify(childPath);
          const Icon = ACTION_ICONS[child.type] ?? Sparkles;
          return (
            <div key={ci}>
              <div
                className={cn(
                  "group/step relative rounded border bg-card p-2",
                  isSel && "border-primary ring-1 ring-primary/20",
                  isDraggingChild && "opacity-40",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", JSON.stringify(childPath));
                      onDragStartStep(childPath);
                    }}
                    onDragEnd={onDragEndStep}
                    role="button"
                    aria-label="Arrastar passo"
                    tabIndex={-1}
                    className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground opacity-0 group-hover/step:opacity-100 focus-visible:opacity-100 shrink-0"
                  >
                    <GripVertical className="h-3 w-3" />
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectPath(childPath)}
                    aria-pressed={isSel}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-xs font-medium truncate">
                        {ACTION_LABELS[child.type]}
                      </span>
                    </div>
                  </button>
                </div>
                <div className="absolute top-0.5 right-0.5">
                  <StepActions
                    onMoveUp={() => onMove(childPath, -1)}
                    onMoveDown={() => onMove(childPath, 1)}
                    onRemove={() => onRemovePath(childPath)}
                    canMoveUp={ci > 0}
                    canMoveDown={ci < actions.length - 1}
                  />
                </div>
              </div>
              <DropSlot
                parentPath={parentPath}
                index={ci + 1}
                dragging={dragging}
                onDropAt={onDropAt}
              />
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAddAt(parentPath)}
          className={cn(
            "w-full border-dashed text-xs text-muted-foreground hover:text-primary hover:border-primary",
            library && JSON.stringify(library.parentPath) === JSON.stringify(parentPath)
              ? "border-primary text-primary"
              : "",
          )}
        >
          <Plus className="mr-1 h-3 w-3" /> Adicionar passo
        </Button>
      </div>
    </div>
  );
}

/**
 * Cartão de switch no canvas: uma coluna por case + coluna "Padrão",
 * no mesmo padrão visual do Se/Então/Senão.
 */
function SwitchCard({
  action,
  stepPath,
  index,
  selected,
  selection,
  library,
  onSelect,
  onRemove,
  onSelectPath,
  onRemovePath,
  onAddAt,
  onChangeAction,
  canMoveUp,
  canMoveDown,
  isDraggingSelf,
  entityFields,
  dragging,
  onDragStartStep,
  onDragEndStep,
  onDropAt,
  onMove,
}: {
  action: Extract<WorkflowAction, { type: "switch_by_value" }>;
  stepPath: StepPath;
  index: number;
  selected: boolean;
  selection: StepPath | "trigger" | null;
  library: { parentPath: StepPath } | null;
  onSelect: () => void;
  onRemove: () => void;
  onSelectPath: (p: StepPath) => void;
  onRemovePath: (p: StepPath) => void;
  onAddAt: (parentPath: StepPath) => void;
  onChangeAction: (p: StepPath, a: WorkflowAction) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isDraggingSelf: boolean;
  entityFields: FieldOpt[];
} & DragProps) {
  const labels = useReferenceLabels();
  const cases = action.cases ?? [];
  const switchField = entityFields.find((f) => f.name === action.field);
  /** Converte o valor bruto do case no rótulo amigável (lista canônica ou referência). */
  const valueLabel = (raw: unknown) => {
    if (raw === "" || raw === null || raw === undefined) return "(vazio)";
    const str = String(raw);
    const opt = switchField?.options?.find((o) => o.value === str);
    if (opt) return opt.label;
    return str;
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify(stepPath));
    onDragStartStep(stepPath);
  };
  const addCase = () =>
    onChangeAction(stepPath, { ...action, cases: [...cases, { value: "", actions: [] }] });
  const removeCase = (i: number) =>
    onChangeAction(stepPath, { ...action, cases: cases.filter((_, idx) => idx !== i) });
  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card shadow-sm",
        selected && "border-primary ring-2 ring-primary/20",
        isDraggingSelf && "opacity-40",
      )}
    >
      <div className="flex items-center gap-2 p-3">
        <DragHandle
          onDragStart={handleDragStart}
          onDragEnd={onDragEndStep}
          label="Arrastar ramificação por valor"
        />
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="flex-1 min-w-0 text-left flex items-center gap-3"
        >
          <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <SplitSquareHorizontal className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
              Passo {index}
            </p>
            <p className="text-sm font-medium">Ramificar por valor</p>
            <p className="text-xs text-muted-foreground truncate">
              {describeAction(action, labels)}
            </p>
          </div>
        </button>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={(e) => {
              e.stopPropagation();
              addCase();
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Case
          </Button>
          <StepActions
            onMoveUp={() => onMove(stepPath, -1)}
            onMoveDown={() => onMove(stepPath, 1)}
            onRemove={onRemove}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
          />
        </div>
      </div>
      <div className="p-3 pt-0">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 items-start">
          {cases.map((c, ci) => {
            const valueText = valueLabel(c.value);

            return (
              <div key={ci} className="min-w-0">
                <BranchColumn
                  title={c.label?.trim() ? c.label : valueText}
                  subtitle={c.label?.trim() ? valueText : undefined}
                  parentPath={[...stepPath, `case:${ci}`]}
                  actions={c.actions ?? []}
                  selection={selection}
                  library={library}
                  onSelectPath={onSelectPath}
                  onRemovePath={onRemovePath}
                  onAddAt={onAddAt}
                  dragging={dragging}
                  onDragStartStep={onDragStartStep}
                  onDragEndStep={onDragEndStep}
                  onDropAt={onDropAt}
                  onMove={onMove}
                  headerExtra={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        void confirmDialog({
                          title: "Remover ramo?",
                          description: "O ramo e todas as ações nele serão removidos do rascunho.",
                          confirmLabel: "Remover ramo",
                          variant: "destructive",
                        }).then((ok) => {
                          if (ok) removeCase(ci);
                        });
                      }}
                      aria-label="Remover case"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
              </div>
            );
          })}
          <div className="min-w-0">
            <BranchColumn
              title="Padrão"
              subtitle="Quando nenhum valor bate"
              parentPath={[...stepPath, "default"]}
              actions={action.default ?? []}
              selection={selection}
              library={library}
              onSelectPath={onSelectPath}
              onRemovePath={onRemovePath}
              onAddAt={onAddAt}
              dragging={dragging}
              onDragStartStep={onDragStartStep}
              onDragEndStep={onDragEndStep}
              onDropAt={onDropAt}
              onMove={onMove}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Connector({ onAdd, active }: { onAdd: () => void; active?: boolean }) {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="w-px h-3 bg-border" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAdd}
        aria-label="Adicionar passo"
        className={cn(
          "h-7 gap-1 border-dashed bg-background text-xs text-muted-foreground",
          "hover:border-primary hover:text-primary transition",
          active && "border-primary text-primary ring-2 ring-primary/20",
        )}
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar passo
      </Button>
      <div className="w-px h-3 bg-border" />
    </div>
  );
}
