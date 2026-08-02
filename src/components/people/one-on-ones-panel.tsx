// Painel de One-on-Ones da pessoa. Sprint 2 do TechPeople.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MessageSquare, Smile } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  listOneOnOnes,
  upsertOneOnOne,
  deleteOneOnOne,
  ONE_ON_ONE_STATUSES,
  ONE_ON_ONE_STATUS_LABELS,
  type OneOnOneRow,
  type OneOnOneStatus,
  type ActionItem,
} from "@/lib/people/performance.functions";

const MOODS = ["😞", "😕", "😐", "🙂", "😄"];

export function OneOnOnesPanel({ personId, canWrite }: { personId: string; canWrite: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listOneOnOnes);
  const delFn = useServerFn(deleteOneOnOne);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OneOnOneRow | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["person-1on1", personId],
    queryFn: () => listFn({ data: { person_id: personId } }),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["person-1on1", personId] });
      toast.success("1:1 removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      {canWrite ? (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Nova 1:1
          </Button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground text-center">
            <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-60" />
            Nenhuma 1:1 registrada.
          </CardContent>
        </Card>
      ) : (
        items.map((it) => (
          <Card key={it.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {it.scheduled_at
                      ? new Date(it.scheduled_at).toLocaleString("pt-BR")
                      : "Sem data"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                    <Badge variant="secondary">{ONE_ON_ONE_STATUS_LABELS[it.status]}</Badge>
                    {it.duration_min ? <span>{it.duration_min} min</span> : null}
                    {it.mood ? (
                      <span className="flex items-center gap-1">
                        <Smile className="h-3 w-3" /> {MOODS[it.mood - 1]}
                      </span>
                    ) : null}
                  </div>
                </div>
                {canWrite ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(it);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (await confirmDialog("Remover 1:1?")) del.mutate(it.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
              {it.agenda ? (
                <div className="text-xs">
                  <div className="font-medium text-muted-foreground">Pauta</div>
                  <div className="whitespace-pre-line">{it.agenda}</div>
                </div>
              ) : null}
              {it.notes ? (
                <div className="text-xs">
                  <div className="font-medium text-muted-foreground">Notas</div>
                  <div className="whitespace-pre-line">{it.notes}</div>
                </div>
              ) : null}
              {it.action_items && it.action_items.length > 0 ? (
                <div className="text-xs space-y-1">
                  <div className="font-medium text-muted-foreground">Itens de ação</div>
                  {it.action_items.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={a.done ? "line-through text-muted-foreground" : ""}>
                        • {a.text}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}

      <OneOnOneDialog open={open} onOpenChange={setOpen} personId={personId} item={editing} />
    </div>
  );
}

function OneOnOneDialog({
  open,
  onOpenChange,
  personId,
  item,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  personId: string;
  item: OneOnOneRow | null;
}) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertOneOnOne);
  const [status, setStatus] = useState<OneOnOneStatus>(item?.status ?? "scheduled");
  const [scheduledAt, setScheduledAt] = useState(
    item?.scheduled_at ? item.scheduled_at.slice(0, 16) : "",
  );
  const [duration, setDuration] = useState(item?.duration_min?.toString() ?? "30");
  const [mood, setMood] = useState<string>(item?.mood?.toString() ?? "");
  const [agenda, setAgenda] = useState(item?.agenda ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [privateNotes, setPrivateNotes] = useState(item?.private_notes ?? "");
  const [actionItems, setActionItems] = useState<ActionItem[]>(item?.action_items ?? []);
  const [newAction, setNewAction] = useState("");

  const key = item?.id ?? "new";
  const [lastKey, setLastKey] = useState(key);
  if (open && lastKey !== key) {
    setStatus(item?.status ?? "scheduled");
    setScheduledAt(item?.scheduled_at ? item.scheduled_at.slice(0, 16) : "");
    setDuration(item?.duration_min?.toString() ?? "30");
    setMood(item?.mood?.toString() ?? "");
    setAgenda(item?.agenda ?? "");
    setNotes(item?.notes ?? "");
    setPrivateNotes(item?.private_notes ?? "");
    setActionItems(item?.action_items ?? []);
    setNewAction("");
    setLastKey(key);
  }

  const save = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: item?.id ?? null,
          person_id: personId,
          status,
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          duration_min: duration ? Number(duration) : null,
          mood: mood ? Number(mood) : null,
          agenda: agenda || null,
          notes: notes || null,
          private_notes: privateNotes || null,
          action_items: actionItems,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["person-1on1", personId] });
      toast.success(item ? "1:1 atualizada" : "1:1 criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Editar 1:1" : "Nova 1:1"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Data e hora</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Duração (min)</Label>
            <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as OneOnOneStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ONE_ON_ONE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {ONE_ON_ONE_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Mood (1-5)</Label>
            <Select value={mood} onValueChange={setMood}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {MOODS[n - 1]} {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Pauta</Label>
            <Textarea rows={3} value={agenda ?? ""} onChange={(e) => setAgenda(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Notas (visível para a pessoa)</Label>
            <Textarea rows={4} value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Notas privadas (gestor/admin)</Label>
            <Textarea
              rows={3}
              value={privateNotes ?? ""}
              onChange={(e) => setPrivateNotes(e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Itens de ação</Label>
            <div className="space-y-1">
              {actionItems.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Checkbox
                    checked={a.done}
                    onCheckedChange={(v) => {
                      const next = [...actionItems];
                      next[i] = { ...a, done: !!v };
                      setActionItems(next);
                    }}
                  />
                  <Input
                    value={a.text}
                    onChange={(e) => {
                      const next = [...actionItems];
                      next[i] = { ...a, text: e.target.value };
                      setActionItems(next);
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setActionItems(actionItems.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Adicionar item…"
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newAction.trim()) {
                      e.preventDefault();
                      setActionItems([...actionItems, { text: newAction.trim(), done: false }]);
                      setNewAction("");
                    }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!newAction.trim()) return;
                    setActionItems([...actionItems, { text: newAction.trim(), done: false }]);
                    setNewAction("");
                  }}
                >
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
