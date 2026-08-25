// Workflow builder no padrão HubSpot: canvas vertical + painel lateral de configuração.
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  Braces,
  List,
  Zap,
  Filter,
  Clock,
  GitBranch,
  Mail,
  Bell,
  Webhook,
  Users,
  UserPlus,
  Briefcase,
  ArrowRight,
  X,
  Sparkles,
  ChevronLeft,
  Repeat,
  Building2,
  Handshake,
  Ticket,
  CheckSquare,
  Contact,
  Copy,
  Link2,
  Link2Off,
  Eraser,
  Plus as PlusIcon,
  MessageCircle,
  SplitSquareHorizontal,
  GitFork,
  CalendarClock,
  Target,
  Wand2,
  Hash,
  MessageSquare,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Upload,
  Info,
} from "lucide-react";

import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getEntityFieldCatalog } from "@/lib/entity-fields.functions";
import { ExtraFieldsEditor, FkPicker } from "./extra-fields-editor";
import { GenericRecordForm } from "./generic-record-form";
import { TokenInput, TokenTextarea, WorkflowTokensProvider } from "./token-input";
import { buildIdTokens, buildTextTokens, buildVarTokens } from "@/lib/workflows/token-catalog";
import {
  buildAssociationTextTokens,
  priorStepRefOptions,
  triggerRefOptions,
} from "@/lib/workflows/association-tokens";
import type { RefKind } from "@/lib/entity-fields-refs";
import { useReferenceLabels } from "./use-reference-labels";
import { ActionTemplatesBar } from "./action-templates-bar";

import { lazy, Suspense } from "react";
import type { FieldOpt } from "./builder/step-tree";
import {
  ACTION_ICONS,
  countSteps,
  defaultActionOfType,
  describeAction,
  getBranchList,
  getStep,
  insertStep,
  insertStepAt,
  isBranchKey,
  isDescendantOrSelf,
  listAt,
  moveStepTo,
  priorStepFieldOptions,
  priorStepMeta,
  removeStep,
  setBranchList,
  siblingsOfPath,
  updateStep,
  collectFlowVarNames,
  STEP_OUTPUT_KEYS,
  type BranchKey,
  type StepPath,
  type DescribeLabels,
} from "./builder/step-tree";
import { useEntityFieldOptions } from "./builder/use-entity-field-options";
import {
  ConditionListEditor,
  conditionsIncludeField,
  newLeafCondition,
  normalizeTopGroup,
  denormalizeTopGroup,
} from "./builder/conditions-editor";
import { EntityPickerDialog } from "./builder/entity-picker-dialog";

// Painel de configuração de passo: ~1.9k linhas de formulários carregados
// somente quando o usuário abre um passo (code-splitting real).
const StepConfigPanel = lazy(() =>
  import("./builder/step-config-panel").then((m) => ({ default: m.StepConfigPanel })),
);

import {
  ENTITY_FIELDS,
  ENTITY_LABELS,
  ENTITY_GROUPS,
  EVENT_LABELS,
  ACTION_LABELS,
  ACTION_CATEGORIES,
  RECORD_ACTION_MODULES,
  type WorkflowWritableTable,
  FILTER_OPS,
  type WorkflowEntity,
  type WorkflowEventType,
  type WorkflowTrigger,
  type WorkflowFilter,
  type WorkflowCondition,
  type WorkflowFilterGroup,
  type WorkflowAction,
  type WorkflowActionType,
  type FilterOp,
  isFilterGroup,
} from "@/lib/workflows/types";
import { conditionsSummary } from "@/lib/workflows/conditions";
import { confirmDialog } from "@/components/ui/confirm-dialog";

export type WorkflowDraft = {
  id?: string;
  name: string;
  entity: WorkflowEntity;
  enabled: boolean;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
};

export const EMPTY_DRAFT: WorkflowDraft = {
  name: "",
  entity: "leads",
  enabled: true,
  trigger: { event: "created", filters: [], reenroll: { enabled: false, events: [] } },
  actions: [],
};

// Ícone por tipo de ação.
// ============================================================================
export function WorkflowBuilder({
  open,
  draft,
  onClose,
  onSave,
  onSaveAndPublish,
  publishedVersion = 0,
  hasDraftChanges = false,
}: {
  open: boolean;
  draft: WorkflowDraft | null;
  onClose: () => void;
  onSave: (d: WorkflowDraft) => Promise<void>;
  onSaveAndPublish?: (d: WorkflowDraft) => Promise<void>;
  publishedVersion?: number;
  hasDraftChanges?: boolean;
}) {
  const [state, setState] = useState<WorkflowDraft>(draft ?? EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selection, setSelection] = useState<StepPath | "trigger" | null>("trigger");
  const [library, setLibrary] = useState<{ parentPath: StepPath } | null>(null);
  const [entityPickerOpen, setEntityPickerOpen] = useState(false);
  const [dragging, setDragging] = useState<StepPath | null>(null);
  // Snapshot do rascunho como estava ao abrir/salvar, para detectar alterações não salvas.
  const [baseline, setBaseline] = useState<string>(() => JSON.stringify(draft ?? EMPTY_DRAFT));
  const fieldOptions = useEntityFieldOptions(state.entity);

  useEffect(() => {
    if (open) {
      setState(draft ?? EMPTY_DRAFT);
      setBaseline(JSON.stringify(draft ?? EMPTY_DRAFT));
      setSelection("trigger");
      setLibrary(null);
      // Abre picker quando é um workflow novo sem entidade escolhida (id vazio + nome vazio).
      setEntityPickerOpen(!draft?.id && !draft?.name);
    }
  }, [open, draft]);

  // Saídas de passos que vêm antes do passo selecionado (mesmo nível do fluxo).
  // Precisa ficar antes do early return para manter a ordem dos hooks estável.
  const priorStepFields = useMemo(
    () =>
      selection && selection !== "trigger" ? priorStepFieldOptions(state.actions, selection) : [],
    [state.actions, selection],
  );

  // Variáveis do fluxo criadas por passos "Formatar dados" ({{vars.X}}).
  const flowVarNames = useMemo(() => collectFlowVarNames(state.actions), [state.actions]);

  // Variáveis oferecidas nas pills: derivadas da entidade do gatilho, dos
  // passos anteriores e das variáveis do fluxo (o motor resolve
  // `{{coluna}}` / `{{steps.N.campo}}` / `{{vars.X}}`).
  const priorSteps = useMemo(
    () => (selection && selection !== "trigger" ? priorStepMeta(state.actions, selection) : []),
    [state.actions, selection],
  );

  const tokenSets = useMemo(() => {
    const refKinds: RefKind[] = [
      "company",
      "contact",
      "deal",
      "contract",
      "legal_entity",
      "pipeline",
      "user",
    ];
    const refs: Record<string, { token: string; label: string; group: string }[]> = {};
    for (const kind of refKinds) {
      refs[kind] = [
        ...triggerRefOptions(state.entity, kind),
        ...priorStepRefOptions(priorSteps, kind),
      ];
    }
    return {
      text: [
        ...buildTextTokens(fieldOptions, priorStepFields),
        ...buildAssociationTextTokens(state.entity),
        ...buildVarTokens(flowVarNames),
      ],
      id: buildIdTokens(fieldOptions, priorStepFields),
      refs,
    };
  }, [fieldOptions, priorStepFields, flowVarNames, state.entity, priorSteps]);

  if (!open) return null;

  const setActions = (fn: (prev: WorkflowAction[]) => WorkflowAction[]) =>
    setState((s) => ({ ...s, actions: fn(s.actions) }));

  const setTrigger = (fn: (t: WorkflowTrigger) => WorkflowTrigger) =>
    setState((s) => ({ ...s, trigger: fn(s.trigger) }));

  const isDirty = JSON.stringify(state) !== baseline;

  /** Fecha o editor, confirmando antes quando há alterações não salvas. */
  const requestClose = async () => {
    if (busy) return;
    if (isDirty) {
      const ok = await confirmDialog({
        title: "Sair sem salvar?",
        description:
          "Há alterações não salvas neste rascunho. Se você sair agora, elas serão descartadas.",
        confirmLabel: "Descartar alterações",
        cancelLabel: "Continuar editando",
        variant: "destructive",
      });
      if (!ok) return;
    }
    onClose();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(state);
      setBaseline(JSON.stringify(state));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndPublish = async () => {
    if (!onSaveAndPublish) return;
    setPublishing(true);
    try {
      await onSaveAndPublish(state);
      setBaseline(JSON.stringify(state));
    } finally {
      setPublishing(false);
    }
  };

  const isUpToDate = publishedVersion > 0 && !hasDraftChanges;
  const busy = saving || publishing;
  const canSubmit = !busy && !!state.name && state.actions.length > 0;

  const selectedAction =
    selection && selection !== "trigger" ? getStep(state.actions, selection) : null;

  const addAction = (
    type: WorkflowActionType,
    parentPath: StepPath,
    overrides?: Record<string, unknown>,
  ) => {
    const base = defaultActionOfType(type) as unknown as Record<string, unknown>;
    const newAction = (overrides ? { ...base, ...overrides } : base) as unknown as WorkflowAction;

    setActions((prev) => insertStep(prev, parentPath, newAction));
    setLibrary(null);
    // Seleciona o novo passo (inserido no fim da lista do `parentPath`) e leva
    // o foco/scroll até o card recém-criado.
    const list = listAt(state.actions, parentPath);
    if (list) {
      const newPath = [...parentPath, list.length] as StepPath;
      setSelection(newPath);
      const key = JSON.stringify(newPath);
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(`[data-step-path='${key}']`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.querySelector<HTMLElement>("button[aria-pressed]")?.focus();
      });
    }
  };

  const handleDropAt = (to: { parentPath: StepPath; index: number }) => {
    if (!dragging) return;
    const from = dragging;
    setDragging(null);
    setState((s) => {
      const res = moveStepTo(s.actions, from, to);
      if (!res) return s;
      // Ajusta seleção se o passo movido estava selecionado ou dentro dele.
      setSelection((sel) => {
        if (Array.isArray(sel) && isDescendantOrSelf(sel, from)) {
          const rest = sel.slice(from.length);
          return [...res.newPath, ...rest];
        }
        return sel;
      });
      return { ...s, actions: res.actions };
    });
  };

  const handleMove = (path: StepPath, dir: -1 | 1) => {
    const idx = path[path.length - 1] as number;
    const parentPath = path.slice(0, -1) as StepPath;
    setState((s) => {
      const target = dir < 0 ? idx - 1 : idx + 2;
      const res = moveStepTo(s.actions, path, { parentPath, index: target });
      if (!res) return s;
      setSelection((sel) => {
        if (Array.isArray(sel) && isDescendantOrSelf(sel, path)) {
          const rest = sel.slice(path.length);
          return [...res.newPath, ...rest];
        }
        return sel;
      });
      return { ...s, actions: res.actions };
    });
  };

  return (
    <WorkflowTokensProvider value={tokenSets}>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) void requestClose();
        }}
      >
        <DialogContent className="max-w-none w-screen h-screen max-h-screen p-0 gap-0 rounded-none border-0 flex flex-col sm:rounded-none [&>button.absolute]:hidden">
          <DialogTitle className="sr-only">
            {state.id ? "Editar workflow" : "Novo workflow"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Editor visual de workflow no padrão HubSpot com gatilho, condições e ações.
          </DialogDescription>

          {/* Header */}
          <header className="flex items-center gap-3 border-b bg-background px-4 h-14 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void requestClose()}
              aria-label="Voltar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <Input
                value={state.name}
                onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
                placeholder="Nome do workflow"
                className="h-9 text-base font-medium border-0 shadow-none focus-visible:ring-1 px-2"
              />
            </div>
            <Badge variant="outline" className="hidden md:inline-flex">
              {ENTITY_LABELS[state.entity]}
            </Badge>
            <div className="flex items-center gap-2 pr-1">
              <Switch
                id="wf-enabled"
                checked={state.enabled}
                onCheckedChange={(v) => setState((s) => ({ ...s, enabled: v }))}
              />
              <Label htmlFor="wf-enabled" className="text-sm">
                {state.enabled ? "Ativo" : "Pausado"}
              </Label>
            </div>
            <Badge variant={isUpToDate ? "secondary" : "outline"} className="hidden md:inline-flex">
              {isUpToDate
                ? `Publicado v${publishedVersion}`
                : publishedVersion > 0
                  ? `Rascunho pendente (v${publishedVersion} no ar)`
                  : "Rascunho"}
            </Badge>
            <Button variant="ghost" onClick={() => void requestClose()}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={handleSave} disabled={!canSubmit}>
              {saving ? "Salvando…" : "Salvar rascunho"}
            </Button>
            {onSaveAndPublish && (
              <Button onClick={handleSaveAndPublish} disabled={!canSubmit}>
                <Upload className="h-4 w-4 mr-1.5" />
                {publishing ? "Publicando…" : "Salvar e publicar"}
              </Button>
            )}
          </header>

          {!isUpToDate && (
            <div className="flex items-start gap-2 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground shrink-0">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                Este workflow está em rascunho. As alterações só passam a valer para novos registros
                depois de <span className="font-medium text-foreground">publicar</span>.
              </p>
            </div>
          )}

          {/* 3-panel body */}
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar esquerda */}
            <aside className="hidden lg:flex flex-col w-56 border-r bg-muted/20 p-4 gap-4 shrink-0">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Tipo
                </p>
                <p className="text-sm font-medium mt-1">{ENTITY_LABELS[state.entity]}</p>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline mt-1"
                  onClick={() => setEntityPickerOpen(true)}
                >
                  Alterar
                </button>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Gatilho
                </p>
                <p className="text-sm mt-1">{EVENT_LABELS[state.trigger.event]}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {conditionsSummary(state.trigger.filters)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Passos
                </p>
                <p className="text-sm mt-1">{countSteps(state.actions)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Reinscrição
                </p>
                <p className="text-sm mt-1">
                  {state.trigger.reenroll?.enabled ? "Habilitada" : "Desabilitada"}
                </p>
              </div>
            </aside>

            {/* Canvas central */}
            <main className="flex-1 overflow-y-auto bg-muted/10">
              <div className="max-w-3xl mx-auto py-8 px-4">
                {/* Trigger card */}
                <TriggerCard
                  trigger={state.trigger}
                  entity={state.entity}
                  selected={selection === "trigger"}
                  onSelect={() => {
                    setSelection("trigger");
                    setLibrary(null);
                  }}
                />
                <Connector
                  onAdd={() => setLibrary({ parentPath: [] })}
                  active={library?.parentPath.length === 0}
                />

                {/* Steps */}
                <StepsList
                  entityFields={fieldOptions}
                  actions={state.actions}
                  path={[]}
                  selection={selection}
                  library={library}
                  onSelect={(p) => {
                    setSelection(p);
                    setLibrary(null);
                  }}
                  onRemove={(p) => {
                    setActions((prev) => removeStep(prev, p));
                    if (
                      Array.isArray(selection) &&
                      JSON.stringify(selection) === JSON.stringify(p)
                    ) {
                      setSelection("trigger");
                    }
                  }}
                  onAddAt={(parentPath) => setLibrary({ parentPath })}
                  onChangeAction={(p, na) => setActions((prev) => updateStep(prev, p, () => na))}
                  dragging={dragging}
                  onDragStartStep={(p) => setDragging(p)}
                  onDragEndStep={() => setDragging(null)}
                  onDropAt={handleDropAt}
                  onMove={handleMove}
                />

                {state.actions.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground mt-6">
                    Clique no <span className="font-medium">+</span> acima para adicionar sua
                    primeira ação.
                  </p>
                )}
              </div>
            </main>

            {/* Painel direito */}
            <aside className="w-full sm:w-[28rem] lg:w-[32rem] border-l bg-background flex flex-col shrink-0 max-w-full">
              <ScrollArea className="flex-1">
                <div className="p-4" aria-live="polite">
                  {library ? (
                    <ActionLibraryPanel
                      onClose={() => setLibrary(null)}
                      onPick={(t, overrides) => addAction(t, library.parentPath, overrides)}
                    />
                  ) : selection === "trigger" ? (
                    <TriggerConfigPanel
                      entity={state.entity}
                      trigger={state.trigger}
                      fields={fieldOptions}
                      onEntityClick={() => setEntityPickerOpen(true)}
                      onChange={setTrigger}
                    />
                  ) : selection && selectedAction ? (
                    <Suspense
                      fallback={
                        <div className="space-y-3" aria-busy="true">
                          <div className="h-5 w-40 rounded bg-muted animate-pulse" />
                          <div className="h-9 w-full rounded bg-muted animate-pulse" />
                          <div className="h-9 w-full rounded bg-muted animate-pulse" />
                          <div className="h-24 w-full rounded bg-muted animate-pulse" />
                        </div>
                      }
                    >
                      <StepConfigPanel
                        action={selectedAction}
                        entity={state.entity}
                        entityFields={fieldOptions}
                        priorFields={priorStepFields}
                        onChange={(na) =>
                          setActions((prev) => updateStep(prev, selection, () => na))
                        }
                      />
                    </Suspense>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Selecione um passo no canvas para configurar.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </aside>
          </div>

          {/* Entity picker */}
          <EntityPickerDialog
            open={entityPickerOpen}
            currentEntity={state.entity}
            onClose={() => setEntityPickerOpen(false)}
            onPick={(entity) => {
              setState((s) => ({ ...s, entity }));
              setEntityPickerOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </WorkflowTokensProvider>
  );
}

// ============================================================================
// Canvas primitives
// ============================================================================
function TriggerCard({
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

function StepsList({
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
      <div className="absolute top-1 right-1 flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onMove(stepPath, -1)}
          disabled={!canMoveUp}
          aria-label="Mover passo para cima"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onMove(stepPath, 1)}
          disabled={!canMoveDown}
          aria-label="Mover passo para baixo"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onRemove}
          aria-label="Remover passo"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
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
          <div className="h-8 w-8 rounded-md bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
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
        <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onMove(stepPath, -1);
            }}
            disabled={!canMoveUp}
            aria-label="Mover ramificação para cima"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onMove(stepPath, 1);
            }}
            disabled={!canMoveDown}
            aria-label="Mover ramificação para baixo"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label="Remover ramificação"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
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
                <div className="absolute top-0.5 right-0.5 flex items-center opacity-0 group-hover/step:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => onMove(childPath, -1)}
                    disabled={ci === 0}
                    className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                    aria-label="Mover para cima"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(childPath, 1)}
                    disabled={ci === actions.length - 1}
                    className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                    aria-label="Mover para baixo"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemovePath(childPath)}
                    className="p-0.5 text-muted-foreground hover:text-destructive"
                    aria-label="Remover"
                  >
                    <X className="h-3 w-3" />
                  </button>
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
        <button
          type="button"
          onClick={() => onAddAt(parentPath)}
          className={cn(
            "w-full rounded border border-dashed text-xs py-1.5 text-muted-foreground hover:text-primary hover:border-primary",
            library && JSON.stringify(library.parentPath) === JSON.stringify(parentPath)
              ? "border-primary text-primary"
              : "",
          )}
        >
          + Adicionar
        </button>
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
        <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100">
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
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onMove(stepPath, -1);
            }}
            disabled={!canMoveUp}
            aria-label="Mover ramificação para cima"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onMove(stepPath, 1);
            }}
            disabled={!canMoveDown}
            aria-label="Mover ramificação para baixo"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label="Remover ramificação"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="p-3 pt-0 overflow-x-auto">
        <div className="flex gap-3 min-w-max items-start">
          {cases.map((c, ci) => {
            const valueText = valueLabel(c.value);

            return (
              <div key={ci} className="w-64 shrink-0">
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
                    <button
                      type="button"
                      onClick={() => removeCase(ci)}
                      aria-label="Remover case"
                      className="p-0.5 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  }
                />
              </div>
            );
          })}
          <div className="w-64 shrink-0">
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

function Connector({ onAdd, active }: { onAdd: () => void; active?: boolean }) {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="w-px h-3 bg-border" />
      <button
        type="button"
        onClick={onAdd}
        aria-label="Adicionar ação"
        className={cn(
          "h-6 w-6 rounded-full border bg-background flex items-center justify-center text-muted-foreground",
          "hover:border-primary hover:text-primary transition",
          active && "border-primary text-primary ring-2 ring-primary/20",
        )}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <div className="w-px h-3 bg-border" />
    </div>
  );
}

// ============================================================================
// Right-panel: Action library
// ============================================================================
function ActionLibraryPanel({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (t: WorkflowActionType, overrides?: Record<string, unknown>) => void;
}) {
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Escolher ação</h3>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
          <X className="h-4 w-4" />
        </Button>
      </div>
      {ACTION_CATEGORIES.map((cat) => (
        <div key={cat.label}>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
            {cat.label}
          </p>
          <div className="space-y-1">
            {cat.actions.map((t) => {
              const Icon = ACTION_ICONS[t] ?? Sparkles;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onPick(t)}
                  className="w-full text-left rounded-md border bg-card px-3 py-2 hover:border-primary hover:bg-accent/30 transition flex items-center gap-3"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{ACTION_LABELS[t]}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Registros por módulo → entidade → operação */}
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
          Registros
        </p>
        <div className="space-y-1">
          {RECORD_ACTION_MODULES.map((mod) => {
            const modOpen = expandedModule === mod.key;
            return (
              <div key={mod.key} className="rounded-md border bg-card">
                <button
                  type="button"
                  onClick={() => {
                    setExpandedModule(modOpen ? null : mod.key);
                    setExpandedEntity(null);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-accent/30 transition flex items-center gap-3"
                >
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm flex-1">{mod.label}</span>
                  <span className="text-[10px] text-muted-foreground">{modOpen ? "−" : "+"}</span>
                </button>
                {modOpen && (
                  <div className="border-t bg-muted/20 px-2 py-1.5 space-y-1">
                    {mod.entities.map((ent) => {
                      const entKey = `${mod.key}:${ent.table}`;
                      const entOpen = expandedEntity === entKey;
                      return (
                        <div
                          key={ent.table}
                          className="rounded border border-border/60 bg-background"
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedEntity(entOpen ? null : entKey)}
                            className="w-full text-left px-2.5 py-1.5 hover:bg-accent/30 transition flex items-center gap-2"
                          >
                            <span className="text-sm flex-1">{ent.singular}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {entOpen ? "−" : "+"}
                            </span>
                          </button>
                          {entOpen && (
                            <div className="border-t border-border/60 px-2 py-2 space-y-1">
                              {ent.hint && (
                                <p className="text-[10px] text-muted-foreground px-1 pb-1">
                                  {ent.hint}
                                </p>
                              )}
                              {[
                                { op: "create_record" as const, label: `Criar ${ent.singular}` },
                                { op: "update_record" as const, label: `Editar ${ent.singular}` },
                                { op: "delete_record" as const, label: `Excluir ${ent.singular}` },
                              ].map(({ op, label }) => (
                                <button
                                  key={op}
                                  type="button"
                                  onClick={() =>
                                    onPick(op, {
                                      table: ent.table as WorkflowWritableTable,
                                    })
                                  }
                                  className="w-full text-left rounded-sm border bg-card px-2.5 py-1.5 text-xs hover:border-primary hover:bg-accent/30 transition"
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Right-panel: Trigger config
// ============================================================================
function TriggerConfigPanel({
  entity,
  trigger,
  fields,
  onEntityClick,
  onChange,
}: {
  entity: WorkflowEntity;
  trigger: WorkflowTrigger;
  fields: FieldOpt[];
  onEntityClick: () => void;
  onChange: (fn: (t: WorkflowTrigger) => WorkflowTrigger) => void;
}) {
  const setFilters = (fn: (f: WorkflowCondition[]) => WorkflowCondition[]) =>
    onChange((t) => ({ ...t, filters: fn(t.filters ?? []) }));
  const defaultField = fields[0]?.name ?? "";

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold">Gatilho de entrada</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Quando esta condição for atendida, o registro entra no workflow.
        </p>
      </div>

      <div>
        <Label className="text-xs">Tipo de objeto</Label>
        <button
          type="button"
          onClick={onEntityClick}
          className="w-full mt-1 rounded-md border bg-card px-3 py-2 text-sm text-left hover:border-primary"
        >
          {ENTITY_LABELS[entity]}
          <span className="text-xs text-muted-foreground ml-2">(alterar)</span>
        </button>
      </div>

      <div>
        <Label className="text-xs">Evento</Label>
        <Select
          value={trigger.event}
          onValueChange={(v) => onChange((t) => ({ ...t, event: v as WorkflowEventType }))}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(EVENT_LABELS) as WorkflowEventType[]).map((e) => (
              <SelectItem key={e} value={e}>
                {EVENT_LABELS[e]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {trigger.event === "updated" &&
          conditionsIncludeField(trigger.filters, ["stage_id", "stage"]) && (
            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
              Para reagir a mudanças de etapa do pipeline, use o evento{" "}
              <strong>Mudou de etapa</strong>. O evento <em>Atualizado</em> não dispara em
              transições de etapa.
            </p>
          )}
      </div>

      <div className="rounded-md border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs">Gatilho baseado em tempo</Label>
            <p className="text-[11px] text-muted-foreground">
              Dispara periodicamente para registros que atendem à condição temporal.
            </p>
          </div>
          <Switch
            checked={!!trigger.time_based}
            onCheckedChange={(v) =>
              onChange((t) => ({
                ...t,
                time_based: v
                  ? { kind: "time_since_field", field: "created_at", amount: 1, unit: "days" }
                  : undefined,
              }))
            }
          />
        </div>
        {trigger.time_based && (
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={trigger.time_based.kind}
                onValueChange={(v) =>
                  onChange((t) => ({
                    ...t,
                    time_based: {
                      ...(t.time_based ?? { amount: 1, unit: "days" }),
                      kind: v as never,
                    },
                  }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time_since_field">Tempo desde campo (data)</SelectItem>
                  <SelectItem value="no_activity_for">Sem atividade há…</SelectItem>
                  <SelectItem value="stuck_in_stage_for">Parado na etapa há…</SelectItem>
                  <SelectItem value="field_unchanged_for">Campo inalterado há…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(trigger.time_based.kind === "time_since_field" ||
              trigger.time_based.kind === "field_unchanged_for") && (
              <div className="col-span-2">
                <Label className="text-xs">Campo (data)</Label>
                <Input
                  value={trigger.time_based.field ?? ""}
                  onChange={(e) =>
                    onChange((t) => ({
                      ...t,
                      time_based: {
                        ...(t.time_based ?? { kind: "time_since_field", amount: 1, unit: "days" }),
                        field: e.target.value,
                      },
                    }))
                  }
                  placeholder="created_at"
                />
              </div>
            )}
            <div>
              <Label className="text-xs">Quantidade</Label>
              <Input
                type="number"
                min={1}
                value={trigger.time_based.amount}
                onChange={(e) =>
                  onChange((t) => ({
                    ...t,
                    time_based: {
                      ...(t.time_based ?? { kind: "time_since_field", unit: "days" }),
                      amount: Math.max(1, parseInt(e.target.value) || 1),
                    },
                  }))
                }
              />
            </div>
            <div>
              <Label className="text-xs">Unidade</Label>
              <Select
                value={trigger.time_based.unit}
                onValueChange={(v) =>
                  onChange((t) => ({
                    ...t,
                    time_based: {
                      ...(t.time_based ?? { kind: "time_since_field", amount: 1 }),
                      unit: v as "minutes" | "hours" | "days",
                    },
                  }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">minutos</SelectItem>
                  <SelectItem value="hours">horas</SelectItem>
                  <SelectItem value="days">dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="col-span-2 text-[11px] text-muted-foreground">
              Varredura executa a cada 15 min. Cada registro dispara no máximo uma vez até o campo
              de referência mudar.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Condições</Label>
            <Badge variant="secondary" className="text-[10px] font-normal">
              opcional
            </Badge>
          </div>
        </div>
        {(trigger.filters ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">
            Sem condições, todos os registros que dispararem o evento entram no workflow.
          </p>
        )}
        <ConditionListEditor
          value={trigger.filters}
          fields={fields}
          defaultField={defaultField}
          onChange={(next) => setFilters(() => next)}
        />
      </div>

      {/* Reinscrição */}
      <div className="rounded-md border p-3 space-y-3 bg-muted/20">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Reinscrição</Label>
            <p className="text-xs text-muted-foreground">
              Permite que o mesmo registro entre no workflow mais de uma vez.
            </p>
          </div>
          <Switch
            checked={trigger.reenroll?.enabled ?? false}
            onCheckedChange={(v) =>
              onChange((t) => ({
                ...t,
                reenroll: { enabled: v, events: t.reenroll?.events ?? [] },
              }))
            }
          />
        </div>
        {trigger.reenroll?.enabled && (
          <div className="space-y-2">
            <Label className="text-xs">Reinscrever quando</Label>
            {(Object.keys(EVENT_LABELS) as WorkflowEventType[]).map((e) => {
              const list = trigger.reenroll?.events ?? [];
              const checked = list.includes(e);
              return (
                <label key={e} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) =>
                      onChange((t) => {
                        const cur = t.reenroll?.events ?? [];
                        const next = v ? [...cur, e] : cur.filter((x) => x !== e);
                        return {
                          ...t,
                          reenroll: { enabled: true, events: next },
                        };
                      })
                    }
                  />
                  {EVENT_LABELS[e]}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Critérios de meta (goal) */}
      <div className="rounded-md border p-3 space-y-2 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm">Critérios de meta</Label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Se todos os critérios passarem no processamento do evento, o registro é considerado no
          objetivo e não recebe novas execuções.
        </p>
        <ConditionListEditor
          value={trigger.goal_filters}
          fields={fields}
          defaultField={defaultField}
          onChange={(next) => onChange((t) => ({ ...t, goal_filters: next }))}
        />
      </div>
    </div>
  );
}
