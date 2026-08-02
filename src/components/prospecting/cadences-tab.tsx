/**
 * Aba "Cadências" — CRUD de cadências multi-canal unificadas, listagem básica
 * com criar/editar em diálogo. O editor rico de passos vive em componente
 * separado; para MVP mantemos criar/renomear/desativar/excluir + link para
 * inscrição posterior a partir de um lead/contato.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown, Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AtsSectionHeader, EmptyState } from "@/components/ats/ui";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  listCadences,
  getCadence,
  upsertCadence,
  deleteCadence,
  upsertCadenceStep,
  deleteCadenceStep,
} from "@/lib/prospecting/cadences.functions";

type Scope = "sales" | "hr";
type Channel =
  | "email"
  | "whatsapp"
  | "linkedin_task"
  | "linkedin_invite"
  | "linkedin_message"
  | "call"
  | "task"
  | "wait"
  | "wait_invite_accept";

const CHANNEL_LABELS: Record<Channel, string> = {
  email: "E-mail",
  whatsapp: "WhatsApp",
  linkedin_task: "LinkedIn (tarefa)",
  linkedin_invite: "LinkedIn (convite)",
  linkedin_message: "LinkedIn (mensagem)",
  call: "Ligação",
  task: "Tarefa manual",
  wait: "Aguardar (dias)",
  wait_invite_accept: "Aguardar aceite (LinkedIn)",
};

export function CadencesTab() {
  const list = useServerFn(listCadences);
  const del = useServerFn(deleteCadence);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["prospecting", "cadences"],
    queryFn: () => list(),
  });

  const [openNew, setOpenNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Cadência removida.");
      qc.invalidateQueries({ queryKey: ["prospecting", "cadences"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const items = data ?? [];

  return (
    <div className="space-y-4">
      <AtsSectionHeader
        title="Cadências multi-canal"
        description="Réguas unificadas de comunicação (e-mail, WhatsApp, LinkedIn, ligação, tarefa)."
        action={
          <Button size="sm" onClick={() => setOpenNew(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nova cadência
          </Button>
        }
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={RouteIcon}
          title="Nenhuma cadência criada"
          description="Crie uma cadência para automatizar sua régua de contato multi-canal."
          action={
            <Button size="sm" onClick={() => setOpenNew(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nova cadência
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <Card key={c.id} className="hover:shadow-sm transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm">{c.name}</CardTitle>
                  <Badge variant="outline" className="text-[10px]">
                    {c.scope === "sales" ? "Vendas" : "RH"}
                  </Badge>
                </div>
                {c.description ? (
                  <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                ) : null}
              </CardHeader>
              <CardContent className="pt-0 flex items-center justify-between">
                <Badge variant={c.enabled ? "default" : "secondary"} className="text-[10px]">
                  {c.enabled ? "Ativa" : "Pausada"}
                </Badge>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditingId(c.id)}
                    aria-label="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      if ((await confirmDialog(`Excluir "${c.name}"?`))) delMut.mutate(c.id);
                    }}
                    aria-label="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CadenceDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onSaved={() => {
          setOpenNew(false);
          qc.invalidateQueries({ queryKey: ["prospecting", "cadences"] });
        }}
      />

      {editingId ? (
        <CadenceEditorSheet
          id={editingId}
          onClose={() => setEditingId(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["prospecting", "cadences"] })}
        />
      ) : null}
    </div>
  );
}

function CadenceDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const upsert = useServerFn(upsertCadence);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<Scope>("sales");

  const save = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          name,
          description: description || null,
          scope,
          enabled: true,
          timezone: "America/Sao_Paulo",
          send_days: [1, 2, 3, 4, 5],
        },
      }),
    onSuccess: () => {
      toast.success("Cadência criada.");
      setName("");
      setDescription("");
      setScope("sales");
      onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova cadência</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1">
            <Label>Escopo</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Vendas (TechSales)</SelectItem>
                <SelectItem value="hr">RH / Sourcing (TechHire)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!name || save.isPending} onClick={() => save.mutate()}>
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type OnTimeout = "skip_messages" | "end_sequence" | "continue";

const ON_TIMEOUT_LABELS: Record<OnTimeout, string> = {
  skip_messages: "Pular mensagens de LinkedIn",
  end_sequence: "Encerrar a cadência",
  continue: "Continuar mesmo assim",
};

type StepDraft = {
  id?: string;
  channel: Channel;
  delay_days: number;
  subject: string;
  body: string;
  task_instructions: string;
  variant_label: string;
  variant_weight: number;
  max_wait_days: number;
  poll_interval_hours: number;
  on_timeout: OnTimeout;
};

const EMPTY_STEP: StepDraft = {
  channel: "email",
  delay_days: 0,
  subject: "",
  body: "",
  task_instructions: "",
  variant_label: "A",
  variant_weight: 1,
  max_wait_days: 14,
  poll_interval_hours: 12,
  on_timeout: "end_sequence",
};

type CadenceStepRow = {
  id: string;
  step_order: number;
  channel: string;
  delay_days: number;
  subject: string | null;
  body: string | null;
  task_instructions?: string | null;
  variant_label?: string | null;
  variant_weight?: number | null;
  max_wait_days?: number | null;
  poll_interval_hours?: number | null;
  on_timeout?: string | null;
};

function toDraft(s: CadenceStepRow): StepDraft {
  return {
    id: s.id,
    channel: (s.channel as Channel) ?? "email",
    delay_days: s.delay_days ?? 0,
    subject: s.subject ?? "",
    body: s.body ?? "",
    task_instructions: s.task_instructions ?? "",
    variant_label: s.variant_label ?? "A",
    variant_weight: s.variant_weight ?? 1,
    max_wait_days: s.max_wait_days ?? 14,
    poll_interval_hours: s.poll_interval_hours ?? 12,
    on_timeout: (s.on_timeout as OnTimeout) ?? "end_sequence",
  };
}

/** Formulário de passo reutilizado para criar e editar. */
function StepForm({
  draft,
  onChange,
  onSubmit,
  onCancel,
  pending,
}: {
  draft: StepDraft;
  onChange: (next: StepDraft) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  pending: boolean;
}) {
  const set = <K extends keyof StepDraft>(k: K, v: StepDraft[K]) => onChange({ ...draft, [k]: v });
  const isWait = draft.channel === "wait";
  const isWaitAccept = draft.channel === "wait_invite_accept";
  const isTask = draft.channel === "task" || draft.channel === "linkedin_task";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Canal</Label>
          <Select value={draft.channel} onValueChange={(v) => set("channel", v as Channel)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CHANNEL_LABELS) as Channel[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {CHANNEL_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{isWait ? "Aguardar (dias)" : "Delay (dias)"}</Label>
          <Input
            type="number"
            min={0}
            value={draft.delay_days}
            onChange={(e) => set("delay_days", Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
      </div>

      {draft.channel === "email" ? (
        <div className="space-y-1">
          <Label className="text-xs">Assunto</Label>
          <Input value={draft.subject} onChange={(e) => set("subject", e.target.value)} />
        </div>
      ) : null}

      {isWaitAccept ? (
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Espera máx. (dias)</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={draft.max_wait_days}
              onChange={(e) => set("max_wait_days", Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Verificar a cada (h)</Label>
            <Input
              type="number"
              min={6}
              max={48}
              value={draft.poll_interval_hours}
              onChange={(e) =>
                set("poll_interval_hours", Math.max(6, Number(e.target.value) || 6))
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Se não aceitar</Label>
            <Select
              value={draft.on_timeout}
              onValueChange={(v) => set("on_timeout", v as OnTimeout)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ON_TIMEOUT_LABELS) as OnTimeout[]).map((o) => (
                  <SelectItem key={o} value={o}>
                    {ON_TIMEOUT_LABELS[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {!isWait && !isWaitAccept ? (
        <div className="space-y-1">
          <Label className="text-xs">Mensagem</Label>
          <Textarea value={draft.body} onChange={(e) => set("body", e.target.value)} rows={3} />
        </div>
      ) : null}

      {isTask ? (
        <div className="space-y-1">
          <Label className="text-xs">Instruções da tarefa</Label>
          <Textarea
            value={draft.task_instructions}
            onChange={(e) => set("task_instructions", e.target.value)}
            rows={2}
            placeholder="O que o SDR deve fazer neste passo"
          />
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onSubmit} disabled={pending}>
          {draft.id ? (
            "Salvar passo"
          ) : (
            <>
              <Plus className="w-4 h-4 mr-1" /> Adicionar passo
            </>
          )}
        </Button>
        {onCancel ? (
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CadenceEditorSheet({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const get = useServerFn(getCadence);
  const upsertMeta = useServerFn(upsertCadence);
  const upsertStep = useServerFn(upsertCadenceStep);
  const delStep = useServerFn(deleteCadenceStep);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["prospecting", "cadence", id],
    queryFn: () => get({ data: { id } }),
  });

  const [newDraft, setNewDraft] = useState<StepDraft>(EMPTY_STEP);
  const [editing, setEditing] = useState<{ order: number; draft: StepDraft } | null>(null);

  const invalidate = () => {
    refetch();
    onChanged();
  };

  const buildPayload = (draft: StepDraft, order: number) => ({
    ...(draft.id ? { id: draft.id } : {}),
    cadence_id: id,
    step_order: order,
    channel: draft.channel,
    delay_days: draft.delay_days,
    subject: draft.channel === "email" ? draft.subject || null : null,
    body: draft.body || null,
    task_instructions: draft.task_instructions || null,
    variant_label: draft.variant_label || "A",
    variant_weight: draft.variant_weight || 1,
    max_wait_days: draft.max_wait_days,
    poll_interval_hours: draft.poll_interval_hours,
    on_timeout: draft.on_timeout,
  });

  const addStep = useMutation({
    mutationFn: async () => {
      const order = (data?.steps ?? []).length + 1;
      return upsertStep({ data: buildPayload(newDraft, order) });
    },
    onSuccess: () => {
      setNewDraft(EMPTY_STEP);
      toast.success("Passo adicionado.");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const saveStep = useMutation({
    mutationFn: async () => {
      if (!editing) return null;
      return upsertStep({ data: buildPayload(editing.draft, editing.order) });
    },
    onSuccess: () => {
      setEditing(null);
      toast.success("Passo atualizado.");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const removeStep = useMutation({
    mutationFn: (stepId: string) => delStep({ data: { id: stepId } }),
    onSuccess: invalidate,
    onError: (e) => toast.error((e as Error).message),
  });

  // Troca de posição entre um passo e o vizinho, usando uma posição
  // temporária para não violar a unicidade de (cadência, ordem, variante).
  const moveStep = useMutation({
    mutationFn: async (args: { index: number; dir: -1 | 1 }) => {
      const steps = (data?.steps ?? []) as CadenceStepRow[];
      const a = steps[args.index];
      const b = steps[args.index + args.dir];
      if (!a || !b) return null;
      const tmp = Math.min(50, Math.max(...steps.map((s) => s.step_order)) + 1);
      await upsertStep({ data: buildPayload(toDraft(a), tmp) });
      await upsertStep({ data: buildPayload(toDraft(b), a.step_order) });
      await upsertStep({ data: buildPayload(toDraft(a), b.step_order) });
      return true;
    },
    onSuccess: invalidate,
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleEnabled = useMutation({
    mutationFn: (enabled: boolean) =>
      upsertMeta({
        data: {
          id,
          name: data!.cadence.name,
          scope: data!.cadence.scope as Scope,
          enabled,
          timezone: data!.cadence.timezone,
          send_days: data!.cadence.send_days,
        },
      }),
    onSuccess: invalidate,
  });

  const steps = (data?.steps ?? []) as CadenceStepRow[];

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{data?.cadence.name ?? "Carregando..."}</SheetTitle>
        </SheetHeader>
        {isLoading || !data ? (
          <div className="text-sm text-muted-foreground mt-4">Carregando...</div>
        ) : (
          <div className="space-y-6 mt-4">
            <div className="flex items-center justify-between rounded-md border p-3 bg-muted/30">
              <div>
                <p className="text-sm font-medium">Ativa</p>
                <p className="text-xs text-muted-foreground">
                  Cadências ativas processam passos automaticamente.
                </p>
              </div>
              <Switch
                checked={data.cadence.enabled}
                onCheckedChange={(v) => toggleEnabled.mutate(v)}
              />
            </div>

            <div>
              <AtsSectionHeader
                title="Passos"
                description={`${steps.length} etapa(s) na régua de comunicação.`}
              />
              <div className="space-y-2 mt-3">
                {steps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum passo ainda.</p>
                ) : (
                  steps.map((s, idx) => (
                    <div key={s.id} className="rounded-md border p-3 bg-background">
                      {editing?.draft.id === s.id ? (
                        <StepForm
                          draft={editing.draft}
                          onChange={(d) => setEditing({ order: editing.order, draft: d })}
                          onSubmit={() => saveStep.mutate()}
                          onCancel={() => setEditing(null)}
                          pending={saveStep.isPending}
                        />
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-[10px]">
                                #{s.step_order}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px]">
                                {CHANNEL_LABELS[s.channel as Channel] ?? s.channel}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                +{s.delay_days} dia(s)
                              </span>
                            </div>
                            {s.subject ? (
                              <p className="text-sm font-medium mt-1 truncate">{s.subject}</p>
                            ) : null}
                            {s.body ? (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {s.body}
                              </p>
                            ) : null}
                            {s.task_instructions ? (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {s.task_instructions}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={idx === 0 || moveStep.isPending}
                              onClick={() => moveStep.mutate({ index: idx, dir: -1 })}
                              aria-label="Mover para cima"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={idx === steps.length - 1 || moveStep.isPending}
                              onClick={() => moveStep.mutate({ index: idx, dir: 1 })}
                              aria-label="Mover para baixo"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                setEditing({ order: s.step_order, draft: toDraft(s) })
                              }
                              aria-label="Editar passo"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={async () => {
                                if ((await confirmDialog("Excluir este passo?"))) removeStep.mutate(s.id);
                              }}
                              aria-label="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-3">
              <p className="text-sm font-medium">Adicionar passo</p>
              <StepForm
                draft={newDraft}
                onChange={setNewDraft}
                onSubmit={() => addStep.mutate()}
                pending={addStep.isPending}
              />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
