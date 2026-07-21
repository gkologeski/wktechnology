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
} from "lucide-react";

import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getEntityFieldCatalog } from "@/lib/entity-fields.functions";
import { ExtraFieldsEditor, FkPicker } from "./extra-fields-editor";
import { GenericRecordForm } from "./generic-record-form";
import { TokenInput, TokenTextarea } from "./token-input";
import { useReferenceLabels } from "./use-reference-labels";


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
  create_lead: Sparkles,
  create_contact: Contact,
  create_company: Building2,
  create_deal: Handshake,
  create_ticket: Ticket,
  create_task: CheckSquare,
  copy_field_from_association: Copy,
  associate_records: Link2,
  disassociate_records: Link2Off,
  clear_field: Eraser,
  increment_field: PlusIcon,
  send_email: Mail,
  send_whatsapp: MessageCircle,
  switch_by_value: SplitSquareHorizontal,
  branch_multi: GitFork,
  delay_until_date: CalendarClock,
  format_data: Wand2,
  send_slack: Hash,
  send_teams: MessageSquare,
  approval_step: CheckSquare,
  create_record: PlusIcon,
  update_record: Sparkles,
  delete_record: Eraser,
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
    case "create_lead":
      return { type, first_name: "" };
    case "create_contact":
      return { type, first_name: "" };
    case "create_company":
      return { type, name: "" };
    case "create_deal":
      return { type, name: "Novo negócio", currency: "BRL" };
    case "create_ticket":
      return { type, subject: "" };
    case "create_task":
      return { type, subject: "" };
    case "copy_field_from_association":
      return { type, association: "", source_field: "", target_field: "" };
    case "associate_records":
      return { type, association: "", target_id: "" };
    case "disassociate_records":
      return { type, association: "" };
    case "clear_field":
      return { type, field: "" };
    case "increment_field":
      return { type, field: "score", amount: 1 };
    case "send_email":
      return { type, subject: "Assunto", body: "Corpo do email" };
    case "send_whatsapp":
      return { type, body: "" };
    case "switch_by_value":
      return { type, field: "status", cases: [], default: [] };
    case "branch_multi":
      return { type, branches: [], else: [] };
    case "delay_until_date":
      return { type, field: "expected_close_date", offset_amount: 0, offset_unit: "days" };
    case "format_data":
      return { type, op: "upper", source_field: "name", target_var: "formatted" };
    case "send_slack":
      return { type, text: "Notificação de workflow: {{name}}" };
    case "send_teams":
      return { type, webhook_url: "https://outlook.office.com/webhook/...", text: "Notificação de workflow: {{name}}" };
    case "approval_step":
      return { type, title: "Aprovar {{name}}", note: "", halt_on_reject: true };
    case "create_record":
      return { type, table: "activities", values: {} };
    case "update_record":
      return { type, table: "activities", target_id: "{{id}}", values: {} };
    case "delete_record":
      return { type, table: "activities", target_id: "{{id}}" };
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

// Insere ação em posição específica dentro do array endereçado por parentPath.
function insertStepAt(
  actions: WorkflowAction[],
  parentPath: StepPath,
  index: number,
  newAction: WorkflowAction,
): WorkflowAction[] {
  if (parentPath.length === 0) {
    const copy = [...actions];
    const clamped = Math.max(0, Math.min(index, copy.length));
    copy.splice(clamped, 0, newAction);
    return copy;
  }
  const [head, ...rest] = parentPath;
  if (typeof head !== "number") return actions;
  return actions.map((a, i) => {
    if (i !== head) return a;
    if (a.type !== "branch_if") return a;
    const branch = rest[0];
    if (branch !== "then" && branch !== "else") return a;
    const remaining = rest.slice(1) as StepPath;
    const list = a[branch] ?? [];
    if (remaining.length === 0) {
      const copy = [...list];
      const clamped = Math.max(0, Math.min(index, copy.length));
      copy.splice(clamped, 0, newAction);
      return { ...a, [branch]: copy };
    }
    return { ...a, [branch]: insertStepAt(list, remaining, index, newAction) };
  });
}

// True se `target` está dentro (ou é igual a) `source`.
function isDescendantOrSelf(target: StepPath, source: StepPath): boolean {
  if (target.length < source.length) return false;
  for (let i = 0; i < source.length; i++) {
    if (target[i] !== source[i]) return false;
  }
  return true;
}

// Move um passo para um novo destino. Retorna null se inválido / no-op.
function moveStepTo(
  actions: WorkflowAction[],
  from: StepPath,
  to: { parentPath: StepPath; index: number },
): { actions: WorkflowAction[]; newPath: StepPath } | null {
  if (from.length === 0) return null;
  if (isDescendantOrSelf(to.parentPath, from)) return null;
  const step = getStep(actions, from);
  if (!step) return null;
  const fromParent = from.slice(0, -1) as StepPath;
  const fromIndex = from[from.length - 1] as number;
  const sameParent = JSON.stringify(fromParent) === JSON.stringify(to.parentPath);
  let targetIndex = to.index;
  if (sameParent) {
    if (targetIndex === fromIndex || targetIndex === fromIndex + 1) return null;
    if (targetIndex > fromIndex) targetIndex -= 1;
  }
  const afterRemove = removeStep(actions, from);
  const afterInsert = insertStepAt(afterRemove, to.parentPath, targetIndex, step);
  return { actions: afterInsert, newPath: [...to.parentPath, targetIndex] };
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
  const [dragging, setDragging] = useState<StepPath | null>(null);
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

  const addAction = (
    type: WorkflowActionType,
    parentPath: StepPath,
    overrides?: Partial<WorkflowAction>,
  ) => {
    const base = defaultActionOfType(type);
    const newAction = (overrides ? { ...base, ...overrides } : base) as WorkflowAction;
    setActions((prev) => insertStep(prev, parentPath, newAction));
    setLibrary(null);
    // Seleciona o novo passo (último índice do array em que foi inserido).
    // Como cálculo exato é chato, apenas fecha a biblioteca — usuário pode clicar no card.
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
                dragging={dragging}
                onDragStartStep={(p) => setDragging(p)}
                onDragEndStep={() => setDragging(null)}
                onDropAt={handleDropAt}
                onMove={handleMove}
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
          <aside className="w-full sm:w-[28rem] lg:w-[32rem] border-l bg-background flex flex-col shrink-0 max-w-full">
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
                    fields={fieldOptions}
                    onEntityClick={() => setEntityPickerOpen(true)}
                    onChange={setTrigger}
                  />
                ) : selection && selectedAction ? (
                  <StepConfigPanel
                    action={selectedAction}
                    entity={state.entity}
                    entityFields={fieldOptions}
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
        const isDraggingSelf = dragging !== null && JSON.stringify(dragging) === JSON.stringify(stepPath);
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
            <DropSlot
              parentPath={path}
              index={i + 1}
              dragging={dragging}
              onDropAt={onDropAt}
            />
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
  return (
    <p className="text-xs text-muted-foreground truncate">{describeAction(action, labels)}</p>
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
            <p className="text-xs text-muted-foreground">
              {action.filters.length} condição(ões)
            </p>
          </div>
        </button>
        <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onMove(stepPath, -1); }}
            disabled={!canMoveUp}
            aria-label="Mover ramificação para cima"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onMove(stepPath, 1); }}
            disabled={!canMoveDown}
            aria-label="Mover ramificação para baixo"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            aria-label="Remover ramificação"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 p-3 pt-0">
        {(["then", "else"] as const).map((branch) => {
          const parentPath: StepPath = [...stepPath, branch];
          const children = action[branch] ?? [];
          return (
            <div key={branch} className="rounded-md border bg-muted/20 p-2">
              <p className="text-[11px] uppercase tracking-wide font-semibold mb-2">
                {branch === "then" ? "Sim" : "Não"}
              </p>
              <div className="space-y-1">
                <DropSlot
                  parentPath={parentPath}
                  index={0}
                  dragging={dragging}
                  onDropAt={onDropAt}
                  variant={children.length === 0 && !!dragging ? "empty" : "between"}
                />
                {children.map((child, ci) => {
                  const childPath: StepPath = [...parentPath, ci];
                  const isSel =
                    Array.isArray(selection) &&
                    JSON.stringify(selection) === JSON.stringify(childPath);
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
                            disabled={ci === children.length - 1}
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
  const setFilters = (fn: (f: WorkflowFilter[]) => WorkflowFilter[]) =>
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
          (trigger.filters ?? []).some((f) => f.field === "stage_id" || f.field === "stage") && (
            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
              Para reagir a mudanças de etapa do pipeline, use o evento <strong>Mudou de etapa</strong>.
              O evento <em>Atualizado</em> não dispara em transições de etapa.
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
                    time_based: { ...(t.time_based ?? { amount: 1, unit: "days" }), kind: v as never },
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
                      time_based: { ...(t.time_based ?? { kind: "time_since_field", amount: 1, unit: "days" }), field: e.target.value },
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
                    time_based: { ...(t.time_based ?? { kind: "time_since_field", unit: "days" }), amount: Math.max(1, parseInt(e.target.value) || 1) },
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
                    time_based: { ...(t.time_based ?? { kind: "time_since_field", amount: 1 }), unit: v as "minutes" | "hours" | "days" },
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
              Varredura executa a cada 15 min. Cada registro dispara no máximo uma vez até
              o campo de referência mudar.
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
          <Button
            variant="ghost"
            size="sm"
            disabled={!defaultField}
            onClick={() =>
              setFilters((p) => [...p, { field: defaultField, op: "eq", value: "" }])
            }
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
          </Button>
        </div>
        {(trigger.filters ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">
            Sem condições, todos os registros que dispararem o evento entram no workflow.
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

      {/* Critérios de meta (goal) */}
      <div className="rounded-md border p-3 space-y-2 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm">Critérios de meta</Label>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={!defaultField}
            onClick={() =>
              onChange((t) => ({
                ...t,
                goal_filters: [...(t.goal_filters ?? []), { field: defaultField, op: "eq", value: "" }],
              }))
            }
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Se todos os critérios passarem no processamento do evento, o registro é considerado no objetivo
          e não recebe novas execuções.
        </p>
        {(trigger.goal_filters ?? []).map((f, i) => (
          <FilterRow
            key={i}
            filter={f}
            fields={fields}
            onChange={(nf) =>
              onChange((t) => ({
                ...t,
                goal_filters: (t.goal_filters ?? []).map((x, idx) => (idx === i ? nf : x)),
              }))
            }
            onRemove={() =>
              onChange((t) => ({
                ...t,
                goal_filters: (t.goal_filters ?? []).filter((_, idx) => idx !== i),
              }))
            }
          />
        ))}
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
  fields: FieldOpt[];
  onChange: (f: WorkflowFilter) => void;
  onRemove: () => void;
}) {
  const needsValue = filter.op !== "is_empty" && filter.op !== "is_not_empty";
  const selected = fields.find((f) => f.name === filter.field);
  const options = selected?.options;
  const type = selected?.type;
  return (
    <div className="space-y-2 rounded-md border p-2 bg-card">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Select value={filter.field} onValueChange={(v) => onChange({ ...filter, field: v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Selecionar propriedade" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {fields.map((f) => (
              <SelectItem key={f.name} value={f.name}>
                {f.label}
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
      {needsValue &&
        (options && options.length > 0 ? (
          <Select
            value={String(filter.value ?? "")}
            onValueChange={(v) => onChange({ ...filter, value: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecionar valor" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            className="h-8 text-xs"
            type={type === "number" ? "number" : type === "date" ? "date" : "text"}
            value={String(filter.value ?? "")}
            onChange={(e) => {
              const raw = e.target.value;
              // Coerção de tipo: números só quando o campo é numérico.
              // Filtros contra colunas text (ex.: stage_id) devem ser string
              // — o engine usa comparação estrita (===).
              const coerced: string | number =
                type === "number" && raw !== "" && !Number.isNaN(Number(raw))
                  ? Number(raw)
                  : raw;
              onChange({ ...filter, value: coerced });
            }}
            placeholder="valor"
          />
        ))}
    </div>
  );
}

// ============================================================================
// Right-panel: Step config (formulários por tipo)
// ============================================================================
function StepConfigPanel({
  action,
  entity,
  entityFields,
  onChange,
}: {
  action: WorkflowAction;
  entity: WorkflowEntity;
  entityFields: FieldOpt[];
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{ACTION_LABELS[action.type]}</h3>
        <p className="text-xs text-muted-foreground mt-1">Configure os detalhes deste passo.</p>
      </div>
      <StepConfigForm action={action} entity={entity} entityFields={entityFields} onChange={onChange} />
    </div>
  );
}

function StepConfigForm({
  action,
  entity,
  entityFields,
  onChange,
}: {
  action: WorkflowAction;
  entity: WorkflowEntity;
  entityFields: FieldOpt[];
  onChange: (a: WorkflowAction) => void;
}) {




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
                <SelectItem key={f.name} value={f.name}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TokenInput
            value={String(action.value ?? "")}
            onValueChange={(v) => onChange({ ...action, value: v })}
            placeholder="novo valor"
          />
        </div>
      );
    case "create_activity":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <TokenInput
              value={action.subject}
              onValueChange={(v) => onChange({ ...action, subject: v })}
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
          <TokenTextarea
            value={action.body ?? ""}
            onValueChange={(v) => onChange({ ...action, body: v })}
            placeholder="Descrição (opcional)"
            rows={3}
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
          <TokenInput
            value={action.title}
            onValueChange={(v) => onChange({ ...action, title: v })}
            placeholder="Título"
          />
          <TokenTextarea
            value={action.body ?? ""}
            onValueChange={(v) => onChange({ ...action, body: v })}
            placeholder="Corpo (opcional)"
            rows={2}
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
                    { field: entityFields[0]?.name ?? "", op: "eq", value: "" },
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
            <TokenInput
              value={action.title}
              onValueChange={(v) => onChange({ ...action, title: v })}
              placeholder="Vaga para {{name}}"
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
          <TokenInput
            value={action.stage_value}
            onValueChange={(v) => onChange({ ...action, stage_value: v })}
            placeholder="ex: entrevista, contratado, rejeitado"
          />
        </div>
      );
    case "create_ats_candidate":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Nome completo</Label>
            <TokenInput
              value={action.full_name}
              onValueChange={(v) => onChange({ ...action, full_name: v })}
              placeholder="{{full_name}}"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Email</Label>
              <TokenInput
                value={action.email ?? ""}
                onValueChange={(v) => onChange({ ...action, email: v })}
              />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <TokenInput
                value={action.phone ?? ""}
                onValueChange={(v) => onChange({ ...action, phone: v })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Origem</Label>
            <TokenInput
              value={action.source ?? ""}
              onValueChange={(v) => onChange({ ...action, source: v })}
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
    case "create_lead":
      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Use <code className="text-[11px]">{`{{campo}}`}</code> para puxar valores do registro que disparou o workflow.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Nome *</Label>
              <TokenInput
                value={action.first_name}
                onValueChange={(v) => onChange({ ...action, first_name: v })}
                placeholder="{{first_name}}"
              />
            </div>
            <div>
              <Label className="text-xs">Sobrenome</Label>
              <TokenInput
                value={action.last_name ?? ""}
                onValueChange={(v) => onChange({ ...action, last_name: v })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Email</Label>
              <TokenInput
                value={action.email ?? ""}
                onValueChange={(v) => onChange({ ...action, email: v })}
              />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <TokenInput
                value={action.phone ?? ""}
                onValueChange={(v) => onChange({ ...action, phone: v })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Empresa</Label>
              <TokenInput
                value={action.company_name ?? ""}
                onValueChange={(v) => onChange({ ...action, company_name: v })}
              />
            </div>
            <div>
              <Label className="text-xs">Origem</Label>
              <TokenInput
                value={action.source ?? ""}
                onValueChange={(v) => onChange({ ...action, source: v })}
                placeholder="workflow"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Responsável (opcional)</Label>
            <UserPicker
              value={action.owner_id ?? ""}
              onChange={(v) => onChange({ ...action, owner_id: v })}
            />
          </div>
          <ExtraFieldsEditor
            entity="leads"
            extraFields={action.extra_fields}
            hiddenKeys={[
              "first_name",
              "last_name",
              "email",
              "phone",
              "company_name",
              "source",
              "owner_id",
              "status",
            ]}
            onChange={(v) => onChange({ ...action, extra_fields: v })}
          />
        </div>
      );
    case "create_contact":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Nome *</Label>
              <TokenInput
                value={action.first_name}
                onValueChange={(v) => onChange({ ...action, first_name: v })}
                placeholder="{{first_name}}"
              />
            </div>
            <div>
              <Label className="text-xs">Sobrenome</Label>
              <TokenInput
                value={action.last_name ?? ""}
                onValueChange={(v) => onChange({ ...action, last_name: v })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Email</Label>
              <TokenInput
                value={action.email ?? ""}
                onValueChange={(v) => onChange({ ...action, email: v })}
              />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <TokenInput
                value={action.phone ?? ""}
                onValueChange={(v) => onChange({ ...action, phone: v })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Cargo</Label>
              <TokenInput
                value={action.job_title ?? ""}
                onValueChange={(v) => onChange({ ...action, job_title: v })}
              />
            </div>
            <div>
              <Label className="text-xs">Empresa</Label>
              <TokenInput
                value={action.company_name ?? ""}
                onValueChange={(v) => onChange({ ...action, company_name: v })}
              />
            </div>
          </div>
          <ExtraFieldsEditor
            entity="contacts"
            extraFields={action.extra_fields}
            hiddenKeys={[
              "first_name",
              "last_name",
              "email",
              "phone",
              "job_title",
              "company_name",
              "owner_id",
            ]}
            onChange={(v) => onChange({ ...action, extra_fields: v })}
          />
        </div>
      );
    case "create_company":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Nome *</Label>
            <TokenInput
              value={action.name}
              onValueChange={(v) => onChange({ ...action, name: v })}
              placeholder="{{company_name}}"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Domínio</Label>
              <TokenInput
                value={action.domain ?? ""}
                onValueChange={(v) => onChange({ ...action, domain: v })}
                placeholder="exemplo.com"
              />
            </div>
            <div>
              <Label className="text-xs">Setor</Label>
              <TokenInput
                value={action.industry ?? ""}
                onValueChange={(v) => onChange({ ...action, industry: v })}
              />
            </div>
          </div>
          <ExtraFieldsEditor
            entity="companies"
            extraFields={action.extra_fields}
            hiddenKeys={["name", "domain", "industry", "owner_id"]}
            onChange={(v) => onChange({ ...action, extra_fields: v })}
          />
        </div>
      );
    case "create_deal":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Nome do negócio *</Label>
            <TokenInput
              value={action.name}
              onValueChange={(v) => onChange({ ...action, name: v })}
              placeholder="Negócio com {{name}}"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Valor</Label>
              <Input
                type="number"
                value={action.value ?? ""}
                onChange={(e) =>
                  onChange({
                    ...action,
                    value: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Moeda</Label>
              <Input
                value={action.currency ?? "BRL"}
                onChange={(e) => onChange({ ...action, currency: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Pipeline padrão será usado se não for especificado. Contato/empresa são associados
            automaticamente quando o workflow dispara neles.
          </p>
          <ExtraFieldsEditor
            entity="deals"
            extraFields={action.extra_fields}
            hiddenKeys={[
              "name",
              "value",
              "currency",
              "pipeline_id",
              "stage_id",
              "owner_id",
            ]}
            onChange={(v) => onChange({ ...action, extra_fields: v })}
          />
        </div>
      );
    case "create_ticket":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Assunto *</Label>
            <TokenInput
              value={action.subject}
              onValueChange={(v) => onChange({ ...action, subject: v })}
              placeholder="Chamado sobre {{name}}"
            />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <TokenTextarea
              value={action.description ?? ""}
              onValueChange={(v) => onChange({ ...action, description: v })}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select
                value={action.priority ?? "normal"}
                onValueChange={(v) => onChange({ ...action, priority: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Responsável</Label>
              <UserPicker
                value={action.assignee_id ?? ""}
                onChange={(v) => onChange({ ...action, assignee_id: v })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Pipeline</Label>
            <FkPicker
              kind="pipeline"
              value={(action.extra_fields?.pipeline_id as string) ?? ""}
              onChange={(v) =>
                onChange({
                  ...action,
                  extra_fields: { ...(action.extra_fields ?? {}), pipeline_id: v || undefined },
                })
              }
            />
          </div>
          <ExtraFieldsEditor
            entity="tickets"
            extraFields={action.extra_fields}
            hiddenKeys={[
              "subject",
              "description",
              "priority",
              "pipeline_id",
              "assignee_id",
            ]}
            onChange={(v) => onChange({ ...action, extra_fields: v })}
          />
        </div>
      );
    case "create_task":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Assunto *</Label>
            <TokenInput
              value={action.subject}
              onValueChange={(v) => onChange({ ...action, subject: v })}
              placeholder="Ligar para {{first_name}}"
            />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <TokenTextarea
              value={action.body ?? ""}
              onValueChange={(v) => onChange({ ...action, body: v })}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Vence em (dias)</Label>
              <Input
                type="number"
                min={0}
                max={365}
                value={action.due_in_days ?? ""}
                onChange={(e) =>
                  onChange({
                    ...action,
                    due_in_days: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Responsável</Label>
              <UserPicker
                value={action.assignee_id ?? ""}
                onChange={(v) => onChange({ ...action, assignee_id: v })}
              />
            </div>
          </div>
          <ExtraFieldsEditor
            entity="activities"
            extraFields={action.extra_fields}
            hiddenKeys={[
              "subject",
              "body",
              "type",
              "due_date",
              "owner_id",
              "related_lead_id",
              "related_contact_id",
              "related_company_id",
              "related_deal_id",
            ]}
            onChange={(v) => onChange({ ...action, extra_fields: v })}
          />
        </div>
      );

    case "copy_field_from_association":
      return <CopyFromAssociationForm entity={entity} action={action} onChange={onChange} />;
    case "associate_records":
      return <AssociateRecordsForm entity={entity} action={action} onChange={onChange} />;
    case "disassociate_records":
      return <DisassociateRecordsForm entity={entity} action={action} onChange={onChange} />;
    case "clear_field":
      return (
        <div className="space-y-2">
          <Label className="text-xs">Campo a limpar</Label>
          <FieldSelect
            entity={entity}
            value={action.field}
            onChange={(v) => onChange({ ...action, field: v })}
          />
        </div>
      );
    case "increment_field":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Campo numérico</Label>
            <FieldSelect
              entity={entity}
              value={action.field}
              onChange={(v) => onChange({ ...action, field: v })}
            />
          </div>
          <div>
            <Label className="text-xs">Incrementar em</Label>
            <Input
              type="number"
              value={action.amount}
              onChange={(e) => onChange({ ...action, amount: Number(e.target.value) || 0 })}
            />
            <p className="text-[11px] text-muted-foreground mt-1">Use valores negativos para decrementar.</p>
          </div>
        </div>
      );
    case "send_email":
      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Fica na caixa de saída (email_messages) como outbound; a entrega ocorre pela conta de email configurada.
          </p>
          <div>
            <Label className="text-xs">Template (opcional)</Label>
            <EmailTemplatePicker
              value={action.template_id ?? ""}
              onChange={(v) => onChange({ ...action, template_id: v || undefined })}
            />
          </div>
          <div>
            <Label className="text-xs">Assunto *</Label>
            <TokenInput
              value={action.subject}
              onValueChange={(v) => onChange({ ...action, subject: v })}
              placeholder="Olá {{first_name}}"
            />
          </div>
          <div>
            <Label className="text-xs">Corpo *</Label>
            <TokenTextarea
              value={action.body}
              onValueChange={(v) => onChange({ ...action, body: v })}
              rows={5}
            />
          </div>
          <div>
            <Label className="text-xs">Campo com email do destinatário</Label>
            <Input
              value={action.to_field ?? ""}
              onChange={(e) => onChange({ ...action, to_field: e.target.value })}
              placeholder="email"
            />
          </div>
        </div>
      );
    case "send_whatsapp":
      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Enfileira em whatsapp_messages (outbound, status queued). Entrega depende do provedor configurado.
          </p>
          <div>
            <Label className="text-xs">Template (opcional)</Label>
            <Input
              value={action.template_name ?? ""}
              onChange={(e) => onChange({ ...action, template_name: e.target.value || undefined })}
              placeholder="nome_do_template_aprovado"
            />
          </div>
          <div>
            <Label className="text-xs">Corpo (se não usar template)</Label>
            <TokenTextarea
              value={action.body ?? ""}
              onValueChange={(v) => onChange({ ...action, body: v })}
              rows={3}
              placeholder="Olá {{first_name}}, ..."
            />
          </div>
          <div>
            <Label className="text-xs">Campo com telefone do destinatário</Label>
            <Input
              value={action.to_field ?? ""}
              onChange={(e) => onChange({ ...action, to_field: e.target.value })}
              placeholder="phone"
            />
          </div>
        </div>
      );
    case "switch_by_value":
      return (
        <SwitchByValueForm entity={entity} action={action} onChange={onChange} />
      );
    case "branch_multi":
      return (
        <BranchMultiForm entity={entity} entityFields={entityFields} action={action} onChange={onChange} />
      );
    case "delay_until_date":
      return (
        <DelayUntilDateForm entity={entity} action={action} onChange={onChange} />
      );
    case "format_data":
      return <FormatDataForm action={action} onChange={onChange} />;
    case "send_slack":
      return <SendSlackForm action={action} onChange={onChange} />;
    case "send_teams":
      return <SendTeamsForm action={action} onChange={onChange} />;
    case "approval_step":
      return <ApprovalStepForm action={action} onChange={onChange} />;
    case "create_record":
    case "update_record":
    case "delete_record":
      return <GenericRecordForm action={action} onChange={onChange} />;
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return null;
    }
  }
}

// ============================================================================
// Fase 2 — helpers de UI para associações/campos/templates
// ============================================================================
function AssociationSelect({
  entity,
  value,
  onChange,
}: {
  entity: WorkflowEntity;
  value: string;
  onChange: (v: string) => void;
}) {
  const [assocs, setAssocs] = useState<Array<{ key: string; label: string; target_table: string }>>([]);
  useEffect(() => {
    let alive = true;
    import("@/lib/workflows/associations").then((m) => {
      if (alive) {
        setAssocs(
          (m.ENTITY_ASSOCIATIONS[entity] ?? []).map((a) => ({
            key: a.key,
            label: a.label,
            target_table: a.target_table,
          })),
        );
      }
    });
    return () => {
      alive = false;
    };
  }, [entity]);
  if (assocs.length === 0) {
    return <p className="text-xs text-muted-foreground">Esta entidade não tem associações configuráveis.</p>;
  }
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Escolha a associação" />
      </SelectTrigger>
      <SelectContent>
        {assocs.map((a) => (
          <SelectItem key={a.key} value={a.key}>
            {a.label} <span className="text-muted-foreground text-xs">({a.target_table})</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FieldSelect({
  entity,
  value,
  onChange,
}: {
  entity: WorkflowEntity;
  value: string;
  onChange: (v: string) => void;
}) {
  const fields = useEntityFieldOptions(entity);
  if (fields.length === 0) {
    return <Input value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Escolha um campo" />
      </SelectTrigger>
      <SelectContent>
        {fields.map((f) => (
          <SelectItem key={f.name} value={f.name}>
            {f.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CopyFromAssociationForm({
  entity,
  action,
  onChange,
}: {
  entity: WorkflowEntity;
  action: Extract<WorkflowAction, { type: "copy_field_from_association" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs">Associação de origem</Label>
        <AssociationSelect
          entity={entity}
          value={action.association}
          onChange={(v) => onChange({ ...action, association: v })}
        />
      </div>
      <div>
        <Label className="text-xs">Campo de origem</Label>
        <Input
          value={action.source_field}
          onChange={(e) => onChange({ ...action, source_field: e.target.value })}
          placeholder="ex: industry"
        />
      </div>
      <div>
        <Label className="text-xs">Campo de destino (nesta entidade)</Label>
        <FieldSelect
          entity={entity}
          value={action.target_field}
          onChange={(v) => onChange({ ...action, target_field: v })}
        />
      </div>
    </div>
  );
}

function AssociateRecordsForm({
  entity,
  action,
  onChange,
}: {
  entity: WorkflowEntity;
  action: Extract<WorkflowAction, { type: "associate_records" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs">Associação</Label>
        <AssociationSelect
          entity={entity}
          value={action.association}
          onChange={(v) => onChange({ ...action, association: v })}
        />
      </div>
      <div>
        <Label className="text-xs">ID do registro alvo</Label>
        <TokenInput
          value={action.target_id}
          onValueChange={(v) => onChange({ ...action, target_id: v })}
          placeholder="uuid ou {{company_id}}"
        />
      </div>
    </div>
  );
}

function DisassociateRecordsForm({
  entity,
  action,
  onChange,
}: {
  entity: WorkflowEntity;
  action: Extract<WorkflowAction, { type: "disassociate_records" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div>
      <Label className="text-xs">Associação a remover</Label>
      <AssociationSelect
        entity={entity}
        value={action.association}
        onChange={(v) => onChange({ ...action, association: v })}
      />
    </div>
  );
}

function EmailTemplatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: templates = [] } = useQuery({
    queryKey: ["email-templates-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });
  if (templates.length === 0) {
    return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="UUID do template" />;
  }
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Nenhum (assunto/corpo abaixo)" />
      </SelectTrigger>
      <SelectContent>
        {templates.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ============================================================================
// Fase 3 — forms para switch_by_value / branch_multi / delay_until_date
// ============================================================================
function SwitchByValueForm({
  entity,
  action,
  onChange,
}: {
  entity: WorkflowEntity;
  action: Extract<WorkflowAction, { type: "switch_by_value" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  const setCases = (next: typeof action.cases) => onChange({ ...action, cases: next });
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Executa o primeiro <em>case</em> cujo valor bate com o campo. Se nenhum bater, executa o padrão.
        As ações filhas de cada case são configuradas via JSON até o editor visual completo estar pronto.
      </p>
      <div>
        <Label className="text-xs">Campo</Label>
        <FieldSelect
          entity={entity}
          value={action.field}
          onChange={(v) => onChange({ ...action, field: v })}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Cases</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCases([...action.cases, { value: "", actions: [] }])}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar case
          </Button>
        </div>
        {action.cases.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum case; executa apenas o padrão.</p>
        )}
        {action.cases.map((c, i) => (
          <div key={i} className="rounded-md border p-2 space-y-2 bg-muted/10">
            <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
              <div>
                <Label className="text-[11px]">Valor</Label>
                <Input
                  value={String(c.value ?? "")}
                  onChange={(e) =>
                    setCases(action.cases.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))
                  }
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remover case"
                onClick={() => setCases(action.cases.filter((_, idx) => idx !== i))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div>
              <Label className="text-[11px]">Ações (JSON)</Label>
              <Textarea
                rows={3}
                className="font-mono text-xs"
                value={JSON.stringify(c.actions ?? [], null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    if (Array.isArray(parsed)) {
                      setCases(action.cases.map((x, idx) => (idx === i ? { ...x, actions: parsed } : x)));
                    }
                  } catch {
                    /* ignore invalid json */
                  }
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div>
        <Label className="text-xs">Padrão (JSON de ações)</Label>
        <Textarea
          rows={3}
          className="font-mono text-xs"
          value={JSON.stringify(action.default ?? [], null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              if (Array.isArray(parsed)) onChange({ ...action, default: parsed });
            } catch {
              /* ignore */
            }
          }}
        />
      </div>
    </div>
  );
}

function BranchMultiForm({
  entity,
  entityFields,
  action,
  onChange,
}: {
  entity: WorkflowEntity;
  entityFields: FieldOpt[];
  action: Extract<WorkflowAction, { type: "branch_multi" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  void entity;
  const setBranches = (next: typeof action.branches) => onChange({ ...action, branches: next });
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Executa a 1ª ramificação cujos filtros passam. Se nenhuma bater, executa o ramo "senão".
        Ações filhas são configuradas via JSON até o editor visual completo estar pronto.
      </p>
      <div className="flex items-center justify-between">
        <Label className="text-xs">Ramificações</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setBranches([...action.branches, { label: `Branch ${action.branches.length + 1}`, filters: [], actions: [] }])
          }
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
        </Button>
      </div>
      {action.branches.map((b, i) => (
        <div key={i} className="rounded-md border p-2 space-y-2 bg-muted/10">
          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <Label className="text-[11px]">Rótulo</Label>
              <Input
                value={b.label ?? ""}
                onChange={(e) =>
                  setBranches(action.branches.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))
                }
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remover ramificação"
              onClick={() => setBranches(action.branches.filter((_, idx) => idx !== i))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-[11px]">Filtros</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setBranches(
                    action.branches.map((x, idx) =>
                      idx === i
                        ? { ...x, filters: [...x.filters, { field: entityFields[0]?.name ?? "", op: "eq", value: "" }] }
                        : x,
                    ),
                  )
                }
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {b.filters.map((f, fi) => (
              <FilterRow
                key={fi}
                filter={f}
                fields={entityFields}
                onChange={(nf) =>
                  setBranches(
                    action.branches.map((x, idx) =>
                      idx === i
                        ? { ...x, filters: x.filters.map((y, yi) => (yi === fi ? nf : y)) }
                        : x,
                    ),
                  )
                }
                onRemove={() =>
                  setBranches(
                    action.branches.map((x, idx) =>
                      idx === i ? { ...x, filters: x.filters.filter((_, yi) => yi !== fi) } : x,
                    ),
                  )
                }
              />
            ))}
          </div>
          <div>
            <Label className="text-[11px]">Ações (JSON)</Label>
            <Textarea
              rows={3}
              className="font-mono text-xs"
              value={JSON.stringify(b.actions ?? [], null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  if (Array.isArray(parsed)) {
                    setBranches(action.branches.map((x, idx) => (idx === i ? { ...x, actions: parsed } : x)));
                  }
                } catch {
                  /* ignore */
                }
              }}
            />
          </div>
        </div>
      ))}
      <div>
        <Label className="text-xs">Senão (JSON de ações)</Label>
        <Textarea
          rows={3}
          className="font-mono text-xs"
          value={JSON.stringify(action.else ?? [], null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              if (Array.isArray(parsed)) onChange({ ...action, else: parsed });
            } catch {
              /* ignore */
            }
          }}
        />
      </div>
    </div>
  );
}

function DelayUntilDateForm({
  entity,
  action,
  onChange,
}: {
  entity: WorkflowEntity;
  action: Extract<WorkflowAction, { type: "delay_until_date" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Espera até a data de um campo do registro. Use offset negativo para disparar antes (ex: -3 dias).
        Se a data já passou, segue direto para a próxima ação.
      </p>
      <div>
        <Label className="text-xs">Campo de data</Label>
        <FieldSelect
          entity={entity}
          value={action.field}
          onChange={(v) => onChange({ ...action, field: v })}
        />
      </div>
      <div className="grid grid-cols-[1fr_140px] gap-2">
        <div>
          <Label className="text-xs">Offset</Label>
          <Input
            type="number"
            value={action.offset_amount ?? 0}
            onChange={(e) => onChange({ ...action, offset_amount: Number(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label className="text-xs">Unidade</Label>
          <Select
            value={action.offset_unit ?? "days"}
            onValueChange={(v) => onChange({ ...action, offset_unit: v as "minutes" | "hours" | "days" })}
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
      </div>
    </div>
  );
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
    } else if (a.type === "switch_by_value") {
      n += (a.cases ?? []).reduce((s, c) => s + countSteps(c.actions ?? []), 0);
      n += countSteps(a.default ?? []);
    } else if (a.type === "branch_multi") {
      n += (a.branches ?? []).reduce((s, b) => s + countSteps(b.actions ?? []), 0);
      n += countSteps(a.else ?? []);
    }
  }
  return n;
}

type DescribeLabels = {
  labelForUser: (id: string | null | undefined) => string;
  labelForCompany: (id: string | null | undefined) => string;
  labelForPipeline: (id: string | null | undefined) => string;
  labelForSequence: (id: string | null | undefined) => string;
  labelForRule: (id: string | null | undefined) => string;
};

function describeAction(a: WorkflowAction, labels?: DescribeLabels): string {
  // Fallback quando labels não é passado: hash curto.
  const short = (id: string | null | undefined, prefix: string) =>
    id ? `${prefix} ${id.slice(0, 8)}…` : "—";
  const L: DescribeLabels =
    labels ?? {
      labelForUser: (id) => (id ? `usuário ${id.slice(0, 8)}…` : "—"),
      labelForCompany: (id) => short(id, "empresa"),
      labelForPipeline: (id) => short(id, "pipeline"),
      labelForSequence: (id) => short(id, "sequência"),
      labelForRule: (id) => short(id, "regra"),
    };

  switch (a.type) {
    case "set_field":
      return `${a.field} = ${String(a.value ?? "")}`;
    case "create_activity":
      return `${a.activity_type ?? "task"}: ${a.subject}`;
    case "assign_to":
      return a.user_id ? L.labelForUser(a.user_id) : "—";
    case "rotate_assign":
      return a.rule_id ? L.labelForRule(a.rule_id) : "—";
    case "add_to_sequence":
      return a.sequence_id ? L.labelForSequence(a.sequence_id) : "—";
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
      return `${a.target ?? "auto"} · ${a.user_id ? L.labelForUser(a.user_id) : "—"}`;
    case "create_lead":
      return `lead: ${a.first_name || "—"}`;
    case "create_contact":
      return `contato: ${a.first_name || "—"}`;
    case "create_company":
      return `empresa: ${a.name || "—"}`;
    case "create_deal":
      return `negócio: ${a.name || "—"}`;
    case "create_ticket":
      return `ticket: ${a.subject || "—"}`;
    case "create_task":
      return `tarefa: ${a.subject || "—"}`;
    case "copy_field_from_association":
      return `${a.association}.${a.source_field} → ${a.target_field}`;
    case "associate_records":
      // target_id pode ser UUID ou token {{...}} — só encurta se parecer UUID.
      return `${a.association} = ${
        /^[0-9a-f-]{36}$/i.test(a.target_id) ? a.target_id.slice(0, 8) + "…" : a.target_id
      }`;
    case "disassociate_records":
      return `remover ${a.association}`;
    case "clear_field":
      return `limpar ${a.field}`;
    case "increment_field":
      return `${a.field} += ${a.amount}`;
    case "send_email":
      return `email: ${a.subject || "—"}`;
    case "send_whatsapp":
      return `whatsapp: ${a.template_name || a.body?.slice(0, 30) || "—"}`;
    case "switch_by_value":
      return `switch ${a.field} · ${a.cases.length} case(s)`;
    case "branch_multi":
      return `${a.branches.length} ramo(s) + senão`;
    case "delay_until_date":
      return `até ${a.field}${a.offset_amount ? ` ${a.offset_amount > 0 ? "+" : ""}${a.offset_amount}${(a.offset_unit ?? "days")[0]}` : ""}`;
    default:
      return "";
  }
}


// ============================================================================
// Fase 5 — forms simples para novas ações
// ============================================================================
function FormatDataForm({
  action,
  onChange,
}: {
  action: Extract<WorkflowAction, { type: "format_data" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  const showSource = action.op !== "template_string";
  const showFormat = action.op === "date_format";
  const showAmount = action.op === "date_add" || action.op === "number_round";
  const showUnit = action.op === "date_add";
  const showTemplate = action.op === "template_string";
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Operação</Label>
        <Select value={action.op} onValueChange={(v) => onChange({ ...action, op: v as typeof action.op })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="upper">Maiúsculas</SelectItem>
            <SelectItem value="lower">Minúsculas</SelectItem>
            <SelectItem value="trim">Remover espaços</SelectItem>
            <SelectItem value="date_add">Somar tempo à data</SelectItem>
            <SelectItem value="date_format">Formatar data</SelectItem>
            <SelectItem value="number_round">Arredondar número</SelectItem>
            <SelectItem value="template_string">Concatenar (template)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {showSource && (
        <div className="space-y-1">
          <Label>Campo de origem</Label>
          <Input
            value={action.source_field ?? ""}
            onChange={(e) => onChange({ ...action, source_field: e.target.value })}
            placeholder="ex: name, created_at, value"
          />
        </div>
      )}
      {showTemplate && (
        <div className="space-y-1">
          <Label>Template</Label>
          <TokenTextarea
            value={action.template ?? ""}
            onValueChange={(v) => onChange({ ...action, template: v })}
            placeholder="Ex: {{first_name}} <{{email}}> — score {{vars.score_pct}}"
            rows={3}
          />
        </div>
      )}
      {showFormat && (
        <div className="space-y-1">
          <Label>Formato</Label>
          <Input
            value={action.format ?? "yyyy-MM-dd"}
            onChange={(e) => onChange({ ...action, format: e.target.value })}
            placeholder="yyyy-MM-dd HH:mm"
          />
          <p className="text-xs text-muted-foreground">Tokens: yyyy, MM, dd, HH, mm, ss.</p>
        </div>
      )}
      {showAmount && (
        <div className="space-y-1">
          <Label>{action.op === "number_round" ? "Casas decimais" : "Quantidade"}</Label>
          <Input
            type="number"
            value={action.amount ?? 0}
            onChange={(e) => onChange({ ...action, amount: Number(e.target.value) })}
          />
        </div>
      )}
      {showUnit && (
        <div className="space-y-1">
          <Label>Unidade</Label>
          <Select
            value={action.unit ?? "days"}
            onValueChange={(v) => onChange({ ...action, unit: v as "minutes" | "hours" | "days" })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">Minutos</SelectItem>
              <SelectItem value="hours">Horas</SelectItem>
              <SelectItem value="days">Dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1">
        <Label>Salvar em variável</Label>
        <Input
          value={action.target_var}
          onChange={(e) => onChange({ ...action, target_var: e.target.value })}
          placeholder="ex: score_pct"
        />
        <p className="text-xs text-muted-foreground">
          Use nas ações seguintes como <code>{"{{vars." + (action.target_var || "nome") + "}}"}</code>.
        </p>
      </div>
    </div>
  );
}

function SendSlackForm({
  action,
  onChange,
}: {
  action: Extract<WorkflowAction, { type: "send_slack" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Canal (opcional)</Label>
        <Input
          value={action.channel ?? ""}
          onChange={(e) => onChange({ ...action, channel: e.target.value })}
          placeholder="C0123ABCD ou #geral (usa canal padrão se vazio)"
        />
      </div>
      <div className="space-y-1">
        <Label>Mensagem</Label>
        <TokenTextarea
          value={action.text}
          onValueChange={(v) => onChange({ ...action, text: v })}
          rows={4}
          placeholder="Aceita tokens {{campo}} e {{vars.NOME}}"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Requer o Slack conectado nas integrações do workspace.
      </p>
    </div>
  );
}

function SendTeamsForm({
  action,
  onChange,
}: {
  action: Extract<WorkflowAction, { type: "send_teams" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Webhook URL do Teams</Label>
        <Input
          value={action.webhook_url}
          onChange={(e) => onChange({ ...action, webhook_url: e.target.value })}
          placeholder="https://outlook.office.com/webhook/..."
        />
        <p className="text-xs text-muted-foreground">
          Crie um "Incoming Webhook" no canal do Teams e cole a URL aqui.
        </p>
      </div>
      <div className="space-y-1">
        <Label>Título (opcional)</Label>
        <TokenInput
          value={action.title ?? ""}
          onValueChange={(v) => onChange({ ...action, title: v })}
        />
      </div>
      <div className="space-y-1">
        <Label>Mensagem</Label>
        <TokenTextarea
          value={action.text}
          onValueChange={(v) => onChange({ ...action, text: v })}
          rows={4}
          placeholder="Aceita tokens {{campo}} e {{vars.NOME}}"
        />
      </div>
    </div>
  );
}

function ApprovalStepForm({
  action,
  onChange,
}: {
  action: Extract<WorkflowAction, { type: "approval_step" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Título da aprovação</Label>
        <TokenInput
          value={action.title}
          onValueChange={(v) => onChange({ ...action, title: v })}
          placeholder="Aprovar desconto de {{name}}"
        />
      </div>
      <div className="space-y-1">
        <Label>Contexto para o aprovador (opcional)</Label>
        <TokenTextarea
          value={action.note ?? ""}
          onValueChange={(v) => onChange({ ...action, note: v })}
          rows={3}
          placeholder="Detalhes que o aprovador precisa ver."
        />
      </div>
      <div className="space-y-1">
        <Label>Aprovador (deixe vazio para o dono do workflow)</Label>
        <UserPicker
          value={action.approver_user_id ?? ""}
          onChange={(v) => onChange({ ...action, approver_user_id: v || undefined })}
        />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Switch
          checked={action.halt_on_reject ?? true}
          onCheckedChange={(v) => onChange({ ...action, halt_on_reject: v })}
          id="halt_on_reject"
        />
        <Label htmlFor="halt_on_reject" className="text-xs">
          Interromper workflow em caso de rejeição
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        O workflow pausa aqui. O aprovador recebe uma notificação e decide em
        Configurações → Workflows → Aprovações pendentes.
      </p>
    </div>
  );
}

// Silence unused-import in case memo helper not used elsewhere.
void useMemo;

