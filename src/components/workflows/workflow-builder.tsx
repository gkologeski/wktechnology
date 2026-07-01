// Builder visual de workflows: Quando / Se / Então.
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Plus, Trash2, GripVertical, Zap, Filter, ArrowDown, PlayCircle } from "lucide-react";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TokenPills } from "@/components/ui/token-pills";
import { WORKFLOW_TOKENS } from "@/lib/message-tokens-catalog";
import { useTokenInserter } from "@/lib/token-insert";

import {
  ENTITY_FIELDS,
  ENTITY_LABELS,
  EVENT_LABELS,
  ACTION_LABELS,
  FILTER_OPS,
  type WorkflowEntity,
  type WorkflowTrigger,
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
  trigger: { event: "created", filters: [] },
  actions: [{ type: "create_activity", subject: "Novo registro: {{first_name}}" }],
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
  }
}

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

  // sync when opens with new draft
  useEffect(() => {
    if (draft) setState(draft);
  }, [draft?.id]);

  if (!open) return null;
  const fields = ENTITY_FIELDS[state.entity];

  const setFilters = (fn: (prev: WorkflowTrigger["filters"]) => WorkflowTrigger["filters"]) =>
    setState((s) => ({ ...s, trigger: { ...s.trigger, filters: fn(s.trigger.filters ?? []) } }));

  const setActions = (fn: (prev: WorkflowAction[]) => WorkflowAction[]) =>
    setState((s) => ({ ...s, actions: fn(s.actions) }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(state);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{state.id ? "Editar workflow" : "Novo workflow"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {/* Nome + ativo */}
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <Label>Nome</Label>
              <Input
                value={state.name}
                onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
                placeholder="Ex: Notificar comercial quando lead novo"
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch
                checked={state.enabled}
                onCheckedChange={(v) => setState((s) => ({ ...s, enabled: v }))}
              />
              <span className="text-sm">{state.enabled ? "Ativo" : "Pausado"}</span>
            </div>
          </div>

          {/* Quando */}
          <section className="space-y-3 rounded-md border p-4">
            <h3 className="text-sm font-semibold">Quando</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Entidade</Label>
                <Select
                  value={state.entity}
                  onValueChange={(v) => setState((s) => ({ ...s, entity: v as WorkflowEntity }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ENTITY_LABELS) as WorkflowEntity[]).map((e) => (
                      <SelectItem key={e} value={e}>
                        {ENTITY_LABELS[e]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Evento</Label>
                <Select
                  value={state.trigger.event}
                  onValueChange={(v) =>
                    setState((s) => ({
                      ...s,
                      trigger: { ...s.trigger, event: v as WorkflowTrigger["event"] },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(EVENT_LABELS) as Array<WorkflowTrigger["event"]>).map((e) => (
                      <SelectItem key={e} value={e}>
                        {EVENT_LABELS[e]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Se (filtros) */}
          <section className="space-y-3 rounded-md border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Se (filtros)</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setFilters((p) => [...(p ?? []), { field: fields[0], op: "eq", value: "" }])
                }
              >
                <Plus className="h-4 w-4 mr-1" /> Adicionar filtro
              </Button>
            </div>
            {(state.trigger.filters ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">Sem filtros — todos os eventos casam.</p>
            )}
            {(state.trigger.filters ?? []).map((f, i) => {
              const needsValue = f.op !== "is_empty" && f.op !== "is_not_empty";
              return (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                  <Select
                    value={f.field}
                    onValueChange={(v) =>
                      setFilters((p) => p!.map((x, idx) => (idx === i ? { ...x, field: v } : x)))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map((ff) => (
                        <SelectItem key={ff} value={ff}>
                          {ff}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={f.op}
                    onValueChange={(v) =>
                      setFilters((p) =>
                        p!.map((x, idx) => (idx === i ? { ...x, op: v as FilterOp } : x)),
                      )
                    }
                  >
                    <SelectTrigger>
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
                  {needsValue ? (
                    <Input
                      value={String(f.value ?? "")}
                      onChange={(e) =>
                        setFilters((p) =>
                          p!.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)),
                        )
                      }
                      placeholder="valor"
                    />
                  ) : (
                    <div />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFilters((p) => p!.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </section>

          {/* Então (actions) */}
          <section className="space-y-3 rounded-md border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Então</h3>
              <Select
                onValueChange={(v) =>
                  setActions((p) => [...p, defaultActionOfType(v as WorkflowActionType)])
                }
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="+ Adicionar ação" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ACTION_LABELS) as WorkflowActionType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {ACTION_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {state.actions.length === 0 && (
              <p className="text-xs text-muted-foreground">Adicione pelo menos uma ação.</p>
            )}
            <div className="space-y-3">
              {state.actions.map((a, i) => (
                <ActionCard
                  key={i}
                  action={a}
                  entityFields={fields}
                  onChange={(na) => setActions((p) => p.map((x, idx) => (idx === i ? na : x)))}
                  onRemove={() => setActions((p) => p.filter((_, idx) => idx !== i))}
                  onMoveUp={
                    i > 0
                      ? () =>
                          setActions((p) => {
                            const c = [...p];
                            [c[i - 1], c[i]] = [c[i], c[i - 1]];
                            return c;
                          })
                      : undefined
                  }
                />
              ))}
            </div>
          </section>

          <p className="text-xs text-muted-foreground">
            Use os pills de variáveis abaixo dos campos de assunto e corpo para inserir tokens do
            registro.
          </p>

          {/* Preview do fluxo */}
          <FlowPreview state={state} />

        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !state.name || state.actions.length === 0}
          >
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ActionCard({
  action,
  entityFields,
  onChange,
  onRemove,
  onMoveUp,
}: {
  action: WorkflowAction;
  entityFields: string[];
  onChange: (a: WorkflowAction) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
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
  return (
    <div className="rounded-md border p-3 space-y-2 bg-muted/20">

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!onMoveUp}
          className="text-muted-foreground disabled:opacity-30"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium flex-1">{ACTION_LABELS[action.type]}</span>
        <Button variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {action.type === "set_field" && (
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
      )}

      {action.type === "create_activity" && (
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
            rows={2}
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
      )}


      {action.type === "assign_to" && (
        <UserPicker value={action.user_id} onChange={(v) => onChange({ ...action, user_id: v })} />
      )}

      {action.type === "rotate_assign" && (
        <div className="space-y-1">
          <RotationRulePicker
            value={action.rule_id}
            onChange={(v) => onChange({ ...action, rule_id: v })}
          />
          <p className="text-xs text-muted-foreground">
            Configure regras em Configurações → Distribuição.
          </p>
        </div>
      )}

      {action.type === "add_to_sequence" && (
        <SequencePicker
          value={action.sequence_id}
          onChange={(v) => onChange({ ...action, sequence_id: v })}
        />
      )}

      {action.type === "send_notification" && (
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

        </div>
      )}

      {action.type === "webhook" && (
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
                /* ignore until válido */
              }
            }}
            placeholder='{"foo": "bar"}'
            rows={3}
            className="font-mono text-xs"
          />
        </div>
      )}
    </div>
  );
}

function UserPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: members = [], nameFor } = useWorkspaceMembers();
  if (members.length === 0) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="UUID do usuário"
      />
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
            {r.name} <span className="text-muted-foreground text-xs ml-1">({r.entity})</span>
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
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="UUID da sequência"
      />
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

function FlowPreview({ state }: { state: WorkflowDraft }) {
  const filters = state.trigger.filters ?? [];
  const filterCount = filters.length;
  const eventLabel = EVENT_LABELS[state.trigger.event];
  const entityLabel = ENTITY_LABELS[state.entity];

  const nodes = useMemo(() => {
    const out: Array<{ icon: typeof Zap; tone: string; title: string; subtitle: string }> = [];
    out.push({
      icon: Zap,
      tone: "text-primary",
      title: `${entityLabel} · ${eventLabel}`,
      subtitle: "Gatilho",
    });
    if (filterCount > 0) {
      out.push({
        icon: Filter,
        tone: "text-amber-500",
        title: `${filterCount} ${filterCount === 1 ? "condição" : "condições"}`,
        subtitle: filters.map((f) => `${f.field} ${f.op}`).join(" · "),
      });
    }
    for (const a of state.actions) {
      out.push({
        icon: PlayCircle,
        tone: "text-emerald-500",
        title: ACTION_LABELS[a.type],
        subtitle: describeAction(a),
      });
    }
    return out;
  }, [state, entityLabel, eventLabel, filterCount, filters]);

  return (
    <section className="rounded-md border bg-muted/20 p-4">
      <h3 className="text-sm font-semibold mb-3">Fluxo</h3>
      <div className="flex flex-col items-stretch gap-2">
        {nodes.map((n, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="w-full rounded-lg border bg-card px-3 py-2 shadow-sm">
              <div className="flex items-center gap-2">
                <n.icon className={`h-4 w-4 ${n.tone}`} />
                <span className="text-sm font-medium">{n.title}</span>
              </div>
              {n.subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.subtitle}</p>
              )}
            </div>
            {i < nodes.length - 1 && (
              <ArrowDown className="h-3.5 w-3.5 text-muted-foreground my-1" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
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
  }
}
