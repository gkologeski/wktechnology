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
import { Plus, Trash2, Pencil, Route as RouteIcon } from "lucide-react";
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
                    onClick={() => {
                      if (confirm(`Excluir "${c.name}"?`)) delMut.mutate(c.id);
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
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["prospecting", "cadence", id],
    queryFn: () => get({ data: { id } }),
  });

  const [channel, setChannel] = useState<Channel>("email");
  const [delayDays, setDelayDays] = useState<number>(0);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const invalidate = () => {
    refetch();
    onChanged();
  };

  const addStep = useMutation({
    mutationFn: async () => {
      const order = (data?.steps ?? []).length + 1;
      return upsertStep({
        data: {
          cadence_id: id,
          step_order: order,
          channel,
          delay_days: delayDays,
          subject: channel === "email" ? subject : null,
          body: body || null,
          variant_label: "A",
          variant_weight: 1,
        },
      });
    },
    onSuccess: () => {
      setSubject("");
      setBody("");
      setDelayDays(0);
      toast.success("Passo adicionado.");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const removeStep = useMutation({
    mutationFn: (stepId: string) => delStep({ data: { id: stepId } }),
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
                description={`${data.steps.length} etapa(s) na régua de comunicação.`}
              />
              <div className="space-y-2 mt-3">
                {data.steps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum passo ainda.</p>
                ) : (
                  data.steps.map((s) => (
                    <div key={s.id} className="rounded-md border p-3 bg-background">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
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
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Excluir este passo?")) removeStep.mutate(s.id);
                          }}
                          aria-label="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-3">
              <p className="text-sm font-medium">Adicionar passo</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Canal</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
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
                  <Label className="text-xs">Delay (dias)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={delayDays}
                    onChange={(e) => setDelayDays(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
              </div>
              {channel === "email" ? (
                <div className="space-y-1">
                  <Label className="text-xs">Assunto</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
              ) : null}
              <div className="space-y-1">
                <Label className="text-xs">Mensagem / instruções</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
              </div>
              <Button size="sm" onClick={() => addStep.mutate()} disabled={addStep.isPending}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar passo
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
