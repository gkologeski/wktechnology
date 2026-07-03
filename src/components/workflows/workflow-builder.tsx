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
  SelectItem,
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
} from "lucide-react";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { TokenPills } from "@/components/ui/token-pills";
import { WORKFLOW_TOKENS } from "@/lib/message-tokens-catalog";
import { useTokenInserter } from "@/lib/token-insert";
import { cn } from "@/lib/utils";
import { getEntityFieldCatalog } from "@/lib/entity-fields.functions";

type FieldOpt = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "boolean";
  options?: { value: string; label: string }[];
};

function useEntityFieldOptions(entity: WorkflowEntity): FieldOpt[] {
  const fetchCatalog = useServerFn(getEntityFieldCatalog);
  const { data } = useQuery({
    queryKey: ["wf-entity-fields", entity],
    queryFn: () => fetchCatalog({ data: { entity } }),
    staleTime: 5 * 60_000,
  });
  if (data?.fields?.length) {
    return data.fields.map((f) => ({
      name: f.name,
      label: f.label,
      type: f.type,
      options: f.options,
    }));
  }
  // Fallback: usa constantes locais enquanto o catálogo carrega.
  return (ENTITY_FIELDS[entity] ?? []).map((n) => ({ name: n, label: n }));
}

import {
  ENTITY_FIELDS,
  ENTITY_LABELS,
  ENTITY_GROUPS,
  EVENT_LABELS,
  ACTION_LABELS,
  ACTION_CATEGORIES,
  FILTER_OPS,
  type WorkflowEntity,
  type WorkflowEventType,
  type WorkflowTrigger,
  type WorkflowFilter,
  type WorkflowAction,
  type WorkflowActionType,
  type FilterOp,
} from "@/lib/workflows/types";

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
const ACTION_ICONS: Record<WorkflowActionType, typeof Zap> = {
  set_field: Sparkles,
  create_activity: Mail,
  assign_to: UserPlus,
  rotate_assign: Users,
  add_to_sequence: Mail,
  send_notification: Bell,
  webhook: Webhook,
  delay: Clock,
  branch_if: GitBranch,
  create_ats_job: Briefcase,
  advance_ats_application_stage: ArrowRight,
  create_ats_candidate: UserPlus,
  assign_recruiter: UserPlus,
};

function defaultActionOfType(type: WorkflowActionType): WorkflowAction {
  switch (type) {
    case "set_field":
      return { type, field: "status", value: "" };
    case "create_activity":
      return { type, subject: "Nova tarefa", activity_type: "task" };
    case "assign_to":
      return { type, user_id: "" };
    case "rotate_assign":
      return { type, rule_id: "" };
    case "add_to_sequence":
      return { type, sequence_id: "" };
    case "send_notification":
      return { type, title: "Atenção" };
    case "webhook":
      return { type, url: "https://" };
    case "delay":
      return { type, amount: 1, unit: "hours" };
    case "branch_if":
      return { type, filters: [], then: [], else: [] };
    case "create_ats_job":
      return { type, title: "Vaga para {{name}}", headcount: 1 };
    case "advance_ats_application_stage":
      return { type, stage_value: "" };
    case "create_ats_candidate":
      return { type, full_name: "{{full_name}}" };
    case "assign_recruiter":
      return { type, user_id: "", target: "auto" };
  }
}

// ============================================================================
// Path: um passo é endereçado por um array de índices (branches criam níveis).
// Ex: [0] = 1º passo topo. [1,"then",0] = 1º passo do ramo "sim" do 2º passo.
// ============================================================================
type StepPath = Array<number | "then" | "else">;

function getStep(actions: WorkflowAction[], path: StepPath): WorkflowAction | null {
  if (path.length === 0) return null;
  const [head, ...rest] = path;
  if (typeof head !== "number") return null;
  const a = actions[head];
  if (!a) return null;
  if (rest.length === 0) return a;
  if (a.type !== "branch_if") return null;
  const branch = rest[0];
  if (branch !== "then" && branch !== "else") return null;
  return getStep(a[branch] ?? [], rest.slice(1) as StepPath);
}

function updateStep(
  actions: WorkflowAction[],
  path: StepPath,
  updater: (a: WorkflowAction) => WorkflowAction,
): WorkflowAction[] {
  if (path.length === 0) return actions;
  const [head, ...rest] = path;
  if (typeof head !== "number") return actions;
  return actions.map((a, i) => {
    if (i !== head) return a;
    if (rest.length === 0) return updater(a);
    if (a.type !== "branch_if") return a;
    const branch = rest[0];
    if (branch !== "then" && branch !== "else") return a;
    return {
      ...a,
      [branch]: updateStep(a[branch] ?? [], rest.slice(1) as StepPath, updater),
    };
  });
}

function removeStep(actions: WorkflowAction[], path: StepPath): WorkflowAction[] {
  if (path.length === 0) return actions;
  const [head, ...rest] = path;
  if (typeof head !== "number") return actions;
  if (rest.length === 0) return actions.filter((_, i) => i !== head);
  return actions.map((a, i) => {
    if (i !== head || a.type !== "branch_if") return a;
    const branch = rest[0];
    if (branch !== "then" && branch !== "else") return a;
    return {
      ...a,
      [branch]: removeStep(a[branch] ?? [], rest.slice(1) as StepPath),
    };
  });
}

// Insere ação no fim de uma lista endereçada por `parentPath`.
// parentPath = [] → topo. parentPath = [2, "then"] → dentro do ramo then do passo 2.
function insertStep(
  actions: WorkflowAction[],
  parentPath: StepPath,
  newAction: WorkflowAction,
): WorkflowAction[] {
  if (parentPath.length === 0) return [...actions, newAction];
  const [head, ...rest] = parentPath;
  if (typeof head !== "number") {
    // parentPath começa por "then"/"else" — só existe no contexto recursivo.
    return actions;
  }
  return actions.map((a, i) => {
    if (i !== head) return a;
    if (rest.length === 0) return a;
    if (a.type !== "branch_if") return a;
    const branch = rest[0];
    if (branch !== "then" && branch !== "else") return a;
    const remaining = rest.slice(1) as StepPath;
    if (remaining.length === 0) {
      return { ...a, [branch]: [...(a[branch] ?? []), newAction] };
    }
    return {
      ...a,
      [branch]: insertStep(a[branch] ?? [], remaining, newAction),
    };
  });
}

// ============================================================================
// Componente principal
// ============================================================================
export function WorkflowBuilder({
  open,
  draft,
  onClose,
  onSave,
}: {
  open: boolean;
  draft: WorkflowDraft | null;
  onClose: () => void;
  onSave: (d: WorkflowDraft) => Promise<void>;
}) {
  const [state, setState] = useState<WorkflowDraft>(draft ?? EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState<StepPath | "trigger" | null>("trigger");
  const [library, setLibrary] = useState<{ parentPath: StepPath } | null>(null);
  const [entityPickerOpen, setEntityPickerOpen] = useState(false);
  const fieldOptions = useEntityFieldOptions(state.entity);

  useEffect(() => {
    if (open) {
      setState(draft ?? EMPTY_DRAFT);
      setSelection("trigger");
      setLibrary(null);
      // Abre picker quando é um workflow novo sem entidade escolhida (id vazio + nome vazio).
      setEntityPickerOpen(!draft?.id && !draft?.name);
    }
  }, [open, draft]);

  if (!open) return null;

  const setActions = (fn: (prev: WorkflowAction[]) => WorkflowAction[]) =>
    setState((s) => ({ ...s, actions: fn(s.actions) }));

  const setTrigger = (fn: (t: WorkflowTrigger) => WorkflowTrigger) =>
    setState((s) => ({ ...s, trigger: fn(s.trigger) }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(state);
    } finally {
      setSaving(false);
    }
  };

  const selectedAction =
    selection && selection !== "trigger" ? getStep(state.actions, selection) : null;

  const addAction = (type: WorkflowActionType, parentPath: StepPath) => {
    const newAction = defaultActionOfType(type);
    setActions((prev) => insertStep(prev, parentPath, newAction));
    setLibrary(null);
    // Seleciona o novo passo (último índice do array em que foi inserido).
    // Como cálculo exato é chato, apenas fecha a biblioteca — usuário pode clicar no card.
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-none w-screen h-screen max-h-screen p-0 gap-0 rounded-none border-0 flex flex-col sm:rounded-none [&>button.absolute]:hidden">

        <DialogTitle className="sr-only">
          {state.id ? "Editar workflow" : "Novo workflow"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Editor visual de workflow no padrão HubSpot com gatilho, condições e ações.
        </DialogDescription>

        {/* Header */}
        <header className="flex items-center gap-3 border-b bg-background px-4 h-14 shrink-0">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Voltar">
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
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !state.name || state.actions.length === 0}
          >
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </header>

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
                {(state.trigger.filters ?? []).length} condição(ões)
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
            <div className="max-w-xl mx-auto py-8 px-4">
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
              />

              {state.actions.length === 0 && (
                <p className="text-center text-sm text-muted-foreground mt-6">
                  Clique no <span className="font-medium">+</span> acima para adicionar sua primeira
                  ação.
                </p>
              )}
            </div>
          </main>

          {/* Painel direito */}
          <aside className="w-full sm:w-96 border-l bg-background flex flex-col shrink-0 max-w-full sm:max-w-96">
            <ScrollArea className="flex-1">
              <div className="p-4" aria-live="polite">
                {library ? (
                  <ActionLibraryPanel
                    onClose={() => setLibrary(null)}
                    onPick={(t) => addAction(t, library.parentPath)}
                  />
                ) : selection === "trigger" ? (
                  <TriggerConfigPanel
                    entity={state.entity}
                    trigger={state.trigger}
                    onEntityClick={() => setEntityPickerOpen(true)}
                    onChange={setTrigger}
                  />
                ) : selection && selectedAction ? (
                  <StepConfigPanel
                    action={selectedAction}
                    entityFields={ENTITY_FIELDS[state.entity]}
                    onChange={(na) =>
                      setActions((prev) => updateStep(prev, selection, () => na))
                    }
                  />
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
          {trigger.filters!.length} condição(ões)
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

function StepsList({
  actions,
  path,
  selection,
  library,
  onSelect,
  onRemove,
  onAddAt,
}: {
  actions: WorkflowAction[];
  path: StepPath;
  selection: StepPath | "trigger" | null;
  library: { parentPath: StepPath } | null;
  onSelect: (p: StepPath) => void;
  onRemove: (p: StepPath) => void;
  onAddAt: (parentPath: StepPath) => void;
}) {
  return (
    <>
      {actions.map((action, i) => {
        const stepPath: StepPath = [...path, i];
        const isSelected =
          Array.isArray(selection) && JSON.stringify(selection) === JSON.stringify(stepPath);
        return (
          <div key={i}>
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
              />
            ) : (
              <StepCard
                action={action}
                index={i + 1}
                selected={isSelected}
                onSelect={() => onSelect(stepPath)}
                onRemove={() => onRemove(stepPath)}
              />
            )}
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

function StepCard({
  action,
  index,
  selected,
  onSelect,
  onRemove,
}: {
  action: WorkflowAction;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const Icon = ACTION_ICONS[action.type] ?? Sparkles;
  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card p-3 shadow-sm transition",
        "hover:border-primary/50",
        selected && "border-primary ring-2 ring-primary/20",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="w-full text-left focus-visible:outline-none"
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
            <p className="text-xs text-muted-foreground truncate">{describeAction(action)}</p>
          </div>
        </div>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100"
        onClick={onRemove}
        aria-label="Remover passo"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
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
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card shadow-sm",
        selected && "border-primary ring-2 ring-primary/20",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="w-full text-left p-3 flex items-center gap-3"
      >
        <div className="h-8 w-8 rounded-md bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
          <GitBranch className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            Ramificação
          </p>
          <p className="text-sm font-medium">Se / Então / Senão</p>
          <p className="text-xs text-muted-foreground">
            {action.filters.length} condição(ões)
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label="Remover ramificação">
          <Trash2 className="h-4 w-4" />
        </Button>
      </button>
      <div className="grid grid-cols-2 gap-3 p-3 pt-0">
        {(["then", "else"] as const).map((branch) => {
          const parentPath: StepPath = [...stepPath, branch];
          return (
            <div key={branch} className="rounded-md border bg-muted/20 p-2">
              <p className="text-[11px] uppercase tracking-wide font-semibold mb-2">
                {branch === "then" ? "Sim" : "Não"}
              </p>
              <div className="space-y-2">
                {(action[branch] ?? []).map((child, ci) => {
                  const childPath: StepPath = [...parentPath, ci];
                  const isSel =
                    Array.isArray(selection) &&
                    JSON.stringify(selection) === JSON.stringify(childPath);
                  const Icon = ACTION_ICONS[child.type] ?? Sparkles;
                  return (
                    <div
                      key={ci}
                      className={cn(
                        "group relative rounded border bg-card p-2",
                        isSel && "border-primary ring-1 ring-primary/20",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectPath(childPath)}
                        aria-pressed={isSel}
                        className="w-full text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="text-xs font-medium truncate">
                            {ACTION_LABELS[child.type]}
                          </span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemovePath(childPath)}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        aria-label="Remover"
                      >
                        <X className="h-3 w-3" />
                      </button>
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
        })}
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
  onPick: (t: WorkflowActionType) => void;
}) {
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
    </div>
  );
}

// ============================================================================
// Right-panel: Trigger config
// ============================================================================
function TriggerConfigPanel({
  entity,
  trigger,
  onEntityClick,
  onChange,
}: {
  entity: WorkflowEntity;
  trigger: WorkflowTrigger;
  onEntityClick: () => void;
  onChange: (fn: (t: WorkflowTrigger) => WorkflowTrigger) => void;
}) {
  const fields = ENTITY_FIELDS[entity];
  const setFilters = (fn: (f: WorkflowFilter[]) => WorkflowFilter[]) =>
    onChange((t) => ({ ...t, filters: fn(t.filters ?? []) }));

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
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Condições</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setFilters((p) => [...p, { field: fields[0], op: "eq", value: "" }])
            }
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
          </Button>
        </div>
        {(trigger.filters ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">
            Sem condições — todos os eventos casam.
          </p>
        )}
        {(trigger.filters ?? []).map((f, i) => (
          <FilterRow
            key={i}
            filter={f}
            fields={fields}
            onChange={(nf) => setFilters((p) => p.map((x, idx) => (idx === i ? nf : x)))}
            onRemove={() => setFilters((p) => p.filter((_, idx) => idx !== i))}
          />
        ))}
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
    </div>
  );
}

function FilterRow({
  filter,
  fields,
  onChange,
  onRemove,
}: {
  filter: WorkflowFilter;
  fields: string[];
  onChange: (f: WorkflowFilter) => void;
  onRemove: () => void;
}) {
  const needsValue = filter.op !== "is_empty" && filter.op !== "is_not_empty";
  return (
    <div className="space-y-2 rounded-md border p-2 bg-card">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Select value={filter.field} onValueChange={(v) => onChange({ ...filter, field: v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fields.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remover condição">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <Select
        value={filter.op}
        onValueChange={(v) => onChange({ ...filter, op: v as FilterOp })}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FILTER_OPS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {needsValue && (
        <Input
          className="h-8 text-xs"
          value={String(filter.value ?? "")}
          onChange={(e) => onChange({ ...filter, value: e.target.value })}
          placeholder="valor"
        />
      )}
    </div>
  );
}

// ============================================================================
// Right-panel: Step config (formulários por tipo)
// ============================================================================
function StepConfigPanel({
  action,
  entityFields,
  onChange,
}: {
  action: WorkflowAction;
  entityFields: string[];
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{ACTION_LABELS[action.type]}</h3>
        <p className="text-xs text-muted-foreground mt-1">Configure os detalhes deste passo.</p>
      </div>
      <StepConfigForm action={action} entityFields={entityFields} onChange={onChange} />
    </div>
  );
}

function StepConfigForm({
  action,
  entityFields,
  onChange,
}: {
  action: WorkflowAction;
  entityFields: string[];
  onChange: (a: WorkflowAction) => void;
}) {
  const subjectInserter = useTokenInserter<HTMLInputElement>(
    () => ("subject" in action ? (action.subject ?? "") : ""),
    (v) => onChange({ ...action, subject: v } as WorkflowAction),
  );
  const bodyInserter = useTokenInserter<HTMLTextAreaElement>(
    () => ("body" in action ? (action.body ?? "") : ""),
    (v) => onChange({ ...action, body: v } as WorkflowAction),
  );
  const titleInserter = useTokenInserter<HTMLInputElement>(
    () => ("title" in action ? (action.title ?? "") : ""),
    (v) => onChange({ ...action, title: v } as WorkflowAction),
  );

  switch (action.type) {
    case "set_field":
      return (
        <div className="grid grid-cols-2 gap-2">
          <Select value={action.field} onValueChange={(v) => onChange({ ...action, field: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {entityFields.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={String(action.value ?? "")}
            onChange={(e) => onChange({ ...action, value: e.target.value })}
            placeholder="novo valor"
          />
        </div>
      );
    case "create_activity":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <Input
              ref={subjectInserter.ref}
              value={action.subject}
              onChange={(e) => onChange({ ...action, subject: e.target.value })}
              placeholder="Assunto"
            />
            <Select
              value={action.activity_type ?? "task"}
              onValueChange={(v) => onChange({ ...action, activity_type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="task">Tarefa</SelectItem>
                <SelectItem value="note">Nota</SelectItem>
                <SelectItem value="call">Ligação</SelectItem>
                <SelectItem value="meeting">Reunião</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            ref={bodyInserter.ref}
            value={action.body ?? ""}
            onChange={(e) => onChange({ ...action, body: e.target.value })}
            placeholder="Descrição (opcional)"
            rows={3}
          />
          <TokenPills
            tokens={WORKFLOW_TOKENS}
            onInsert={(t) => {
              const active = typeof document !== "undefined" ? document.activeElement : null;
              if (active === bodyInserter.ref.current) bodyInserter.insert(t);
              else subjectInserter.insert(t);
            }}
          />
          <div className="flex items-center gap-2">
            <Label className="text-xs">Vence em (dias)</Label>
            <Input
              type="number"
              min={0}
              max={365}
              className="w-24"
              value={action.due_in_days ?? ""}
              onChange={(e) =>
                onChange({
                  ...action,
                  due_in_days: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
        </div>
      );
    case "assign_to":
      return (
        <UserPicker value={action.user_id} onChange={(v) => onChange({ ...action, user_id: v })} />
      );
    case "rotate_assign":
      return (
        <div className="space-y-1">
          <RotationRulePicker
            value={action.rule_id}
            onChange={(v) => onChange({ ...action, rule_id: v })}
          />
          <p className="text-xs text-muted-foreground">
            Configure regras em Configurações → Distribuição.
          </p>
        </div>
      );
    case "add_to_sequence":
      return (
        <SequencePicker
          value={action.sequence_id}
          onChange={(v) => onChange({ ...action, sequence_id: v })}
        />
      );
    case "send_notification":
      return (
        <div className="space-y-2">
          <Input
            ref={titleInserter.ref}
            value={action.title}
            onChange={(e) => onChange({ ...action, title: e.target.value })}
            placeholder="Título"
          />
          <Textarea
            ref={bodyInserter.ref}
            value={action.body ?? ""}
            onChange={(e) => onChange({ ...action, body: e.target.value })}
            placeholder="Corpo (opcional)"
            rows={2}
          />
          <TokenPills
            tokens={WORKFLOW_TOKENS}
            onInsert={(t) => {
              const active = typeof document !== "undefined" ? document.activeElement : null;
              if (active === bodyInserter.ref.current) bodyInserter.insert(t);
              else titleInserter.insert(t);
            }}
          />
          <div>
            <Label className="text-xs">Notificar (opcional — padrão: você)</Label>
            <UserPicker
              value={action.user_id ?? ""}
              onChange={(v) => onChange({ ...action, user_id: v })}
            />
          </div>
        </div>
      );
    case "webhook":
      return (
        <div className="space-y-2">
          <Input
            value={action.url}
            onChange={(e) => onChange({ ...action, url: e.target.value })}
            placeholder="https://..."
          />
          <Textarea
            value={JSON.stringify(action.payload ?? {}, null, 2)}
            onChange={(e) => {
              try {
                onChange({ ...action, payload: JSON.parse(e.target.value) });
              } catch {
                /* ignore */
              }
            }}
            placeholder='{"foo": "bar"}'
            rows={3}
            className="font-mono text-xs"
          />
        </div>
      );
    case "delay":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_140px] gap-2">
            <Input
              type="number"
              min={1}
              value={action.amount}
              onChange={(e) => onChange({ ...action, amount: Math.max(1, Number(e.target.value) || 1) })}
            />
            <Select
              value={action.unit}
              onValueChange={(v) => onChange({ ...action, unit: v as "minutes" | "hours" | "days" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutos</SelectItem>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="days">Dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Esperar {action.amount}{" "}
            {action.unit === "minutes" ? "minuto(s)" : action.unit === "hours" ? "hora(s)" : "dia(s)"}{" "}
            antes de executar as próximas ações.
          </p>
        </div>
      );
    case "branch_if":
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            O ramo <strong>Sim</strong> é executado quando todas as condições abaixo passam;
            caso contrário, executa o ramo <strong>Não</strong>. Adicione passos filhos
            diretamente no canvas.
          </p>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Condições</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onChange({
                  ...action,
                  filters: [
                    ...action.filters,
                    { field: entityFields[0], op: "eq", value: "" },
                  ],
                })
              }
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          </div>
          {action.filters.length === 0 && (
            <p className="text-xs text-muted-foreground">Sem condições — sempre executa o ramo Sim.</p>
          )}
          {action.filters.map((f, i) => (
            <FilterRow
              key={i}
              filter={f}
              fields={entityFields}
              onChange={(nf) =>
                onChange({
                  ...action,
                  filters: action.filters.map((x, idx) => (idx === i ? nf : x)),
                })
              }
              onRemove={() =>
                onChange({
                  ...action,
                  filters: action.filters.filter((_, idx) => idx !== i),
                })
              }
            />
          ))}
        </div>
      );
    case "create_ats_job":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Título da vaga</Label>
            <Input
              value={action.title}
              onChange={(e) => onChange({ ...action, title: e.target.value })}
              placeholder="Vaga para {{name}}"
            />
            <TokenPills
              tokens={WORKFLOW_TOKENS}
              onInsert={(t) => onChange({ ...action, title: (action.title ?? "") + t })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Departamento</Label>
              <Input
                value={action.department ?? ""}
                onChange={(e) => onChange({ ...action, department: e.target.value })}
                placeholder="Ex: Engenharia"
              />
            </div>
            <div>
              <Label className="text-xs">Quantidade</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={action.headcount ?? 1}
                onChange={(e) =>
                  onChange({ ...action, headcount: Math.max(1, Number(e.target.value) || 1) })
                }
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Hiring manager (opcional)</Label>
            <UserPicker
              value={action.hiring_manager_id ?? ""}
              onChange={(v) => onChange({ ...action, hiring_manager_id: v })}
            />
          </div>
          <div>
            <Label className="text-xs">Notificar aprovador</Label>
            <UserPicker
              value={action.notify_user_id ?? ""}
              onChange={(v) => onChange({ ...action, notify_user_id: v })}
            />
          </div>
        </div>
      );
    case "advance_ats_application_stage":
      return (
        <div className="space-y-2">
          <Label className="text-xs">Novo stage_value</Label>
          <Input
            value={action.stage_value}
            onChange={(e) => onChange({ ...action, stage_value: e.target.value })}
            placeholder="ex: entrevista, contratado, rejeitado"
          />
        </div>
      );
    case "create_ats_candidate":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Nome completo</Label>
            <Input
              value={action.full_name}
              onChange={(e) => onChange({ ...action, full_name: e.target.value })}
              placeholder="{{full_name}}"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                value={action.email ?? ""}
                onChange={(e) => onChange({ ...action, email: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input
                value={action.phone ?? ""}
                onChange={(e) => onChange({ ...action, phone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Origem</Label>
            <Input
              value={action.source ?? ""}
              onChange={(e) => onChange({ ...action, source: e.target.value })}
              placeholder="workflow"
            />
          </div>
        </div>
      );
    case "assign_recruiter":
      return (
        <div className="space-y-2">
          <Label className="text-xs">Recrutador / responsável</Label>
          <UserPicker value={action.user_id} onChange={(v) => onChange({ ...action, user_id: v })} />
          <Label className="text-xs">Alvo</Label>
          <Select
            value={action.target ?? "auto"}
            onValueChange={(v) =>
              onChange({
                ...action,
                target: v as "auto" | "job" | "candidate" | "application" | "interview",
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Automático</SelectItem>
              <SelectItem value="job">Vaga</SelectItem>
              <SelectItem value="candidate">Candidato</SelectItem>
              <SelectItem value="application">Aplicação</SelectItem>
              <SelectItem value="interview">Entrevista</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return null;
    }
  }
}

// ============================================================================
// Entity picker
// ============================================================================
function EntityPickerDialog({
  open,
  currentEntity,
  onClose,
  onPick,
}: {
  open: boolean;
  currentEntity: WorkflowEntity;
  onClose: () => void;
  onPick: (e: WorkflowEntity) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>Escolha o tipo de workflow</DialogTitle>
        <DialogDescription>
          O tipo define qual objeto dispara este workflow (leads, negócios, vagas, etc.).
        </DialogDescription>
        <div className="space-y-4 mt-2">
          {ENTITY_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                {group.label}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {group.entities.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => onPick(e)}
                    className={cn(
                      "text-left rounded-md border bg-card px-3 py-3 hover:border-primary hover:bg-accent/30 transition",
                      currentEntity === e && "border-primary ring-1 ring-primary/30",
                    )}
                  >
                    <p className="text-sm font-medium">{ENTITY_LABELS[e]}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Pickers reaproveitados
// ============================================================================
function UserPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: members = [], nameFor } = useWorkspaceMembers();
  if (members.length === 0) {
    return (
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="UUID do usuário" />
    );
  }
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Escolha um membro" />
      </SelectTrigger>
      <SelectContent>
        {members.map((m) => (
          <SelectItem key={m.user_id} value={m.user_id}>
            {nameFor(m.user_id)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RotationRulePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: rules = [] } = useQuery({
    queryKey: ["rotation-rules-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rotation_rules")
        .select("id, name, entity")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; entity: string }>;
    },
  });
  if (rules.length === 0) {
    return (
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="UUID da regra" />
    );
  }
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Escolha uma regra" />
      </SelectTrigger>
      <SelectContent>
        {rules.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            {r.name}
            <span className="text-muted-foreground text-xs ml-1">({r.entity})</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SequencePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: seqs = [] } = useQuery({
    queryKey: ["sequences-picker"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sequences").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });
  if (seqs.length === 0) {
    return (
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="UUID da sequência" />
    );
  }
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Escolha uma sequência" />
      </SelectTrigger>
      <SelectContent>
        {seqs.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ============================================================================
// Helpers
// ============================================================================
function countSteps(actions: WorkflowAction[]): number {
  let n = 0;
  for (const a of actions) {
    n += 1;
    if (a.type === "branch_if") {
      n += countSteps(a.then ?? []) + countSteps(a.else ?? []);
    }
  }
  return n;
}

function describeAction(a: WorkflowAction): string {
  switch (a.type) {
    case "set_field":
      return `${a.field} = ${String(a.value ?? "")}`;
    case "create_activity":
      return `${a.activity_type ?? "task"}: ${a.subject}`;
    case "assign_to":
      return a.user_id ? `usuário ${a.user_id.slice(0, 8)}…` : "—";
    case "rotate_assign":
      return a.rule_id ? `regra ${a.rule_id.slice(0, 8)}…` : "—";
    case "add_to_sequence":
      return a.sequence_id ? `sequência ${a.sequence_id.slice(0, 8)}…` : "—";
    case "send_notification":
      return a.title;
    case "webhook":
      return a.url;
    case "delay":
      return `${a.amount} ${a.unit}`;
    case "branch_if":
      return `${a.filters.length} condição(ões)`;
    case "create_ats_job":
      return `${a.headcount ?? 1}× ${a.title}`;
    case "advance_ats_application_stage":
      return `→ ${a.stage_value || "—"}`;
    case "create_ats_candidate":
      return a.full_name;
    case "assign_recruiter":
      return `${a.target ?? "auto"} · ${a.user_id ? a.user_id.slice(0, 8) + "…" : "—"}`;
    default:
      return "";
  }
}

// Silence unused-import in case memo helper not used elsewhere.
void useMemo;
