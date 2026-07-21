// Painel de Incidentes (segurança, assédio, discriminação). Sprint 3 do TechPeople.
// Registros confidenciais com categoria, severidade, local, testemunhas e resolução.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, AlertTriangle, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
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
  listIncidents,
  upsertIncident,
  deleteIncident,
  INCIDENT_CATEGORIES,
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_STATUSES,
  INCIDENT_STATUS_LABELS,
  type IncidentRow,
  type IncidentCategory,
  type IncidentSeverity,
  type IncidentStatus,
} from "@/lib/people/wellbeing.functions";

function severityClass(s: IncidentSeverity) {
  switch (s) {
    case "critical":
      return "bg-rose-500/15 text-rose-700 border-rose-500/30";
    case "high":
      return "bg-orange-500/15 text-orange-700 border-orange-500/30";
    case "moderate":
      return "bg-amber-500/15 text-amber-700 border-amber-500/30";
    default:
      return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  }
}

export function IncidentsPanel({
  personId,
  canWrite,
}: {
  personId: string;
  canWrite: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listIncidents);
  const upsertFn = useServerFn(upsertIncident);
  const deleteFn = useServerFn(deleteIncident);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["person-incidents", personId],
    queryFn: () => listFn({ data: { person_id: personId } }),
    staleTime: 30_000,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IncidentRow | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["person-incidents", personId] });
      toast.success("Incidente removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Incidentes
          </h3>
          <p className="text-xs text-muted-foreground">
            Registros de segurança, assédio, discriminação e quase-acidentes. Dados confidenciais.
          </p>
        </div>
        {canWrite ? (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Novo incidente
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <AlertTriangle className="h-6 w-6 mx-auto mb-2 opacity-60" />
            Nenhum incidente registrado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{r.title}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{INCIDENT_CATEGORY_LABELS[r.category]}</Badge>
                      <Badge className={severityClass(r.severity)} variant="outline">
                        {INCIDENT_SEVERITY_LABELS[r.severity]}
                      </Badge>
                      <Badge variant="secondary">{INCIDENT_STATUS_LABELS[r.status]}</Badge>
                      {r.is_confidential ? (
                        <Badge variant="outline" className="gap-1">
                          <Lock className="h-3 w-3" /> Confidencial
                        </Badge>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.occurred_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </div>
                  {canWrite ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(r);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Remover incidente?")) del.mutate(r.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
                {r.description ? (
                  <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {r.description}
                  </div>
                ) : null}
                {(r.location || r.witnesses) && (
                  <div className="text-xs text-muted-foreground space-x-4">
                    {r.location ? <span>Local: {r.location}</span> : null}
                    {r.witnesses ? <span>Testemunhas: {r.witnesses}</span> : null}
                  </div>
                )}
                {r.resolution ? (
                  <div className="text-xs bg-muted/50 rounded p-2">
                    <div className="font-medium mb-1">Resolução</div>
                    <div className="whitespace-pre-wrap text-muted-foreground">{r.resolution}</div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <IncidentDialog
        open={open}
        onOpenChange={setOpen}
        personId={personId}
        editing={editing}
        upsertFn={upsertFn}
        onSaved={() => qc.invalidateQueries({ queryKey: ["person-incidents", personId] })}
      />
    </div>
  );
}

function IncidentDialog({
  open,
  onOpenChange,
  personId,
  editing,
  upsertFn,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  personId: string;
  editing: IncidentRow | null;
  upsertFn: ReturnType<typeof useServerFn<typeof upsertIncident>>;
  onSaved: () => void;
}) {
  const [occurredAt, setOccurredAt] = useState(
    (editing?.occurred_at ?? new Date().toISOString()).slice(0, 16),
  );
  const [category, setCategory] = useState<IncidentCategory>(editing?.category ?? "safety");
  const [severity, setSeverity] = useState<IncidentSeverity>(editing?.severity ?? "low");
  const [status, setStatus] = useState<IncidentStatus>(editing?.status ?? "open");
  const [confidential, setConfidential] = useState(editing?.is_confidential ?? true);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [location, setLocation] = useState(editing?.location ?? "");
  const [witnesses, setWitnesses] = useState(editing?.witnesses ?? "");
  const [resolution, setResolution] = useState(editing?.resolution ?? "");

  const mut = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: editing?.id ?? null,
          person_id: personId,
          occurred_at: new Date(occurredAt).toISOString(),
          category,
          severity,
          is_confidential: confidential,
          title,
          description: description || null,
          location: location || null,
          witnesses: witnesses || null,
          status,
          resolution: resolution || null,
        },
      }),
    onSuccess: () => {
      onSaved();
      onOpenChange(false);
      toast.success("Incidente salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar incidente" : "Novo incidente"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Ocorrido em</Label>
              <Input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as IncidentCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {INCIDENT_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Severidade</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as IncidentSeverity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {INCIDENT_SEVERITY_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as IncidentStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {INCIDENT_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded border px-3 py-2">
            <Label htmlFor="conf" className="text-sm flex items-center gap-2">
              <Lock className="h-4 w-4" /> Confidencial
            </Label>
            <Switch id="conf" checked={confidential} onCheckedChange={setConfidential} />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Local</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Testemunhas</Label>
              <Input value={witnesses} onChange={(e) => setWitnesses(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Resolução</Label>
            <Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={mut.isPending || !title} onClick={() => mut.mutate()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
