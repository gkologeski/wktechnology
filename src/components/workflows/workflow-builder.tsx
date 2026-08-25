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
import { Connector, StepsList, TriggerCard } from "./builder/canvas";
import { ActionLibraryPanel } from "./builder/action-library-panel";
import { TriggerConfigPanel } from "./builder/trigger-config-panel";

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
