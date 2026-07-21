// Painel de Riscos Psicossociais (NR-1). Sprint 3 do TechPeople.
// Avaliações periódicas com dimensões (carga, autonomia, clareza, relações,
// reconhecimento, equilíbrio, segurança psicológica), score derivado e plano
// de ação. Todos os dados são sensíveis — RLS restringe visualização.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ShieldAlert, HeartPulse } from "lucide-react";

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
  listPsychAssessments,
  upsertPsychAssessment,
  deletePsychAssessment,
  PSYCH_METHODS,
  PSYCH_METHOD_LABELS,
  PSYCH_STATUSES,
  PSYCH_STATUS_LABELS,
  PSYCH_RISK_LABELS,
  PSYCH_DIMENSIONS,
  type PsychAssessmentRow,
  type PsychMethod,
  type PsychStatus,
  type PsychRiskLevel,
} from "@/lib/people/wellbeing.functions";

function riskClass(level: PsychRiskLevel) {
  switch (level) {
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

function RiskSlider({
  value,
  onChange,
  readOnly,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={`h-6 w-6 rounded text-xs font-medium border transition-colors disabled:cursor-default ${
            n === value
              ? n >= 4
                ? "bg-rose-500 text-white border-rose-500"
                : n >= 3
                  ? "bg-orange-500 text-white border-orange-500"
                  : n >= 2
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-emerald-500 text-white border-emerald-500"
              : "bg-background border-border text-muted-foreground hover:bg-muted"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function PsychosocialPanel({
  personId,
  canWrite,
}: {
  personId: string;
  canWrite: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPsychAssessments);
  const upsertFn = useServerFn(upsertPsychAssessment);
  const deleteFn = useServerFn(deletePsychAssessment);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["person-psych", personId],
    queryFn: () => listFn({ data: { person_id: personId } }),
    staleTime: 30_000,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PsychAssessmentRow | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["person-psych", personId] });
      toast.success("Avaliação removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <HeartPulse className="h-4 w-4" /> Riscos psicossociais
          </h3>
          <p className="text-xs text-muted-foreground">
            Avaliações NR-1: carga, autonomia, relações, segurança psicológica e sinais de burnout.
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
            <Plus className="h-4 w-4 mr-2" /> Nova avaliação
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <HeartPulse className="h-6 w-6 mx-auto mb-2 opacity-60" />
            Nenhuma avaliação registrada.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {new Date(r.assessed_at).toLocaleDateString("pt-BR")}
                      </span>
                      <Badge variant="outline">{PSYCH_METHOD_LABELS[r.method]}</Badge>
                      <Badge className={riskClass(r.risk_level)} variant="outline">
                        Risco {PSYCH_RISK_LABELS[r.risk_level]}
                      </Badge>
                      <Badge variant="secondary">{PSYCH_STATUS_LABELS[r.status]}</Badge>
                      {r.overall_score != null ? (
                        <span className="text-xs text-muted-foreground">
                          Score {r.overall_score.toFixed(2)}/5
                        </span>
                      ) : null}
                    </div>
                    {(r.burnout_signals || r.harassment_signals) && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {r.burnout_signals ? (
                          <Badge variant="destructive" className="gap-1">
                            <ShieldAlert className="h-3 w-3" /> Sinais de burnout
                          </Badge>
                        ) : null}
                        {r.harassment_signals ? (
                          <Badge variant="destructive" className="gap-1">
                            <ShieldAlert className="h-3 w-3" /> Sinais de assédio
                          </Badge>
                        ) : null}
                      </div>
                    )}
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
                          if (confirm("Remover avaliação?")) del.mutate(r.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
                {r.action_plan ? (
                  <div className="text-xs bg-muted/50 rounded p-2">
                    <div className="font-medium mb-1">Plano de ação</div>
                    <div className="whitespace-pre-wrap text-muted-foreground">{r.action_plan}</div>
                  </div>
                ) : null}
                {r.follow_up_at ? (
                  <div className="text-xs text-muted-foreground">
                    Follow-up: {new Date(r.follow_up_at).toLocaleDateString("pt-BR")}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PsychDialog
        open={open}
        onOpenChange={setOpen}
        personId={personId}
        editing={editing}
        upsertFn={upsertFn}
        onSaved={() => qc.invalidateQueries({ queryKey: ["person-psych", personId] })}
      />
    </div>
  );
}

function PsychDialog({
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
  editing: PsychAssessmentRow | null;
  upsertFn: ReturnType<typeof useServerFn<typeof upsertPsychAssessment>>;
  onSaved: () => void;
}) {
  const [assessedAt, setAssessedAt] = useState(
    editing?.assessed_at ?? new Date().toISOString().slice(0, 10),
  );
  const [method, setMethod] = useState<PsychMethod>(editing?.method ?? "self_report");
  const [status, setStatus] = useState<PsychStatus>(editing?.status ?? "open");
  const [dimensions, setDimensions] = useState<Record<string, number>>(editing?.dimensions ?? {});
  const [burnout, setBurnout] = useState(editing?.burnout_signals ?? false);
  const [harassment, setHarassment] = useState(editing?.harassment_signals ?? false);
  const [actionPlan, setActionPlan] = useState(editing?.action_plan ?? "");
  const [followUp, setFollowUp] = useState(editing?.follow_up_at ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const mut = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: editing?.id ?? null,
          person_id: personId,
          assessed_at: assessedAt,
          method,
          dimensions,
          burnout_signals: burnout,
          harassment_signals: harassment,
          action_plan: actionPlan || null,
          follow_up_at: followUp || null,
          status,
          notes: notes || null,
        },
      }),
    onSuccess: () => {
      onSaved();
      onOpenChange(false);
      toast.success("Avaliação salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar avaliação" : "Nova avaliação psicossocial"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={assessedAt} onChange={(e) => setAssessedAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Método</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PsychMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PSYCH_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {PSYCH_METHOD_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PsychStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PSYCH_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PSYCH_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dimensões (0 = ok, 5 = risco crítico)</Label>
            <div className="rounded border divide-y">
              {PSYCH_DIMENSIONS.map((d) => (
                <div key={d.key} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm">{d.label}</span>
                  <RiskSlider
                    value={dimensions[d.key] ?? 0}
                    onChange={(v) => setDimensions({ ...dimensions, [d.key]: v })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded border px-3 py-2">
              <Label htmlFor="burnout" className="text-sm">
                Sinais de burnout
              </Label>
              <Switch id="burnout" checked={burnout} onCheckedChange={setBurnout} />
            </div>
            <div className="flex items-center justify-between rounded border px-3 py-2">
              <Label htmlFor="harassment" className="text-sm">
                Sinais de assédio
              </Label>
              <Switch id="harassment" checked={harassment} onCheckedChange={setHarassment} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Plano de ação</Label>
            <Textarea
              value={actionPlan}
              onChange={(e) => setActionPlan(e.target.value)}
              rows={3}
              placeholder="Ações previstas, responsáveis, prazos…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Follow-up</Label>
              <Input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
