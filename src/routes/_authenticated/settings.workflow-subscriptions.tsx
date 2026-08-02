// Sprint 8 — Gestão de assinaturas de workflow (event bus v2).
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  listWorkflowSubscriptions,
  saveWorkflowSubscription,
  toggleWorkflowSubscription,
  deleteWorkflowSubscription,
  type WorkflowSubscriptionRow,
  type WorkflowSubscriptionAction,
} from "@/lib/workflow-subscriptions.functions";

export const Route = createFileRoute("/_authenticated/settings/workflow-subscriptions")({
  head: () => ({
    meta: [
      { title: "Assinaturas de workflow" },
      {
        name: "description",
        content:
          "Configure reações automáticas a eventos como onboarding, offboarding e outros eventos cross-módulo.",
      },
    ],
  }),
  component: WorkflowSubscriptionsPage,
});

const EVENT_SUGGESTIONS = [
  "people.onboarding_started",
  "people.offboarding_started",
  "people.*",
  "ats.candidate.hired",
  "crm.deal.won",
  "finance.invoice.paid",
];

type FormState = {
  id?: string;
  name: string;
  description: string;
  event_pattern: string;
  enabled: boolean;
  action: WorkflowSubscriptionAction;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  event_pattern: "people.onboarding_started",
  enabled: true,
  action: {
    type: "create_ticket",
    subject: "",
    description: "",
    priority: "medium",
  },
};

function WorkflowSubscriptionsPage() {
  const list = useServerFn(listWorkflowSubscriptions);
  const save = useServerFn(saveWorkflowSubscription);
  const toggle = useServerFn(toggleWorkflowSubscription);
  const remove = useServerFn(deleteWorkflowSubscription);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["workflow-subscriptions"],
    queryFn: () => list(),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const items = data?.items ?? [];

  const saveMut = useMutation({
    mutationFn: (payload: FormState) =>
      save({
        data: {
          id: payload.id,
          name: payload.name,
          description: payload.description || undefined,
          event_pattern: payload.event_pattern,
          enabled: payload.enabled,
          action: payload.action,
        },
      }),
    onSuccess: () => {
      toast.success("Assinatura salva");
      qc.invalidateQueries({ queryKey: ["workflow-subscriptions"] });
      setOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow-subscriptions"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Assinatura removida");
      qc.invalidateQueries({ queryKey: ["workflow-subscriptions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, WorkflowSubscriptionRow[]>();
    for (const it of items) {
      const key = it.event_pattern;
      map.set(key, [...(map.get(key) ?? []), it]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  function openEdit(row?: WorkflowSubscriptionRow) {
    if (row) {
      setForm({
        id: row.id,
        name: row.name,
        description: row.description ?? "",
        event_pattern: row.event_pattern,
        enabled: row.enabled,
        action: row.action,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setOpen(true);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5" /> Assinaturas de workflow
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Reaja automaticamente a eventos do sistema — por exemplo, criar um ticket de
            provisionamento quando o onboarding começa. Suporta wildcard <code>*</code> em padrões
            (ex.: <code>people.*</code>).
          </p>
        </div>
        <Button onClick={() => openEdit()}>
          <Plus className="h-4 w-4 mr-2" />
          Nova assinatura
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando…</div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhuma assinatura configurada.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([pattern, rows]) => (
            <Card key={pattern}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-0.5 rounded">{pattern}</code>
                  <Badge variant="secondary">{rows.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-4 p-3 rounded-md border bg-card"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{row.name}</div>
                      {row.description ? (
                        <div className="text-xs text-muted-foreground truncate">
                          {row.description}
                        </div>
                      ) : null}
                      <div className="text-xs text-muted-foreground mt-1">
                        Ação: <span className="font-mono">{row.action.type}</span>
                        {row.action.type === "create_ticket" && row.action.subject
                          ? ` · "${row.action.subject}"`
                          : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={row.enabled}
                        onCheckedChange={(v) => toggleMut.mutate({ id: row.id, enabled: v })}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(row)}
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          if (await confirmDialog(`Remover "${row.name}"?`)) {
                            deleteMut.mutate(row.id);
                          }
                        }}
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar assinatura" : "Nova assinatura"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Provisionamento de acesso"
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label>Padrão de evento</Label>
              <Input
                value={form.event_pattern}
                onChange={(e) => setForm({ ...form, event_pattern: e.target.value.trim() })}
                list="event-suggestions"
                placeholder="people.onboarding_started"
              />
              <datalist id="event-suggestions">
                {EVENT_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground mt-1">
                Suporta <code>*</code> como coringa.
              </p>
            </div>
            <div className="border-t pt-3">
              <div className="text-sm font-medium mb-2">Ação: criar ticket</div>
              <div className="space-y-3">
                <div>
                  <Label>Assunto</Label>
                  <Input
                    value={form.action.subject}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        action: { ...form.action, subject: e.target.value },
                      })
                    }
                    placeholder="Provisionamento de acesso — {{payload.person_id}}"
                  />
                </div>
                <div>
                  <Label>Descrição do ticket</Label>
                  <Textarea
                    value={form.action.description ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        action: { ...form.action, description: e.target.value },
                      })
                    }
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select
                    value={form.action.priority ?? "medium"}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        action: {
                          ...form.action,
                          priority: v as "low" | "medium" | "high" | "urgent",
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm({ ...form, enabled: v })}
              />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMut.mutate(form)}
              disabled={
                saveMut.isPending ||
                !form.name.trim() ||
                !form.event_pattern.trim() ||
                !form.action.subject.trim()
              }
            >
              {saveMut.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
