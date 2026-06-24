// Dialog para avaliar candidatura com um scorecard (critérios + notas 0-5).
import { useState, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  listScorecards,
  submitScorecardResponse,
  listScorecardResponses,
} from "@/lib/ats/scorecards.functions";
import { listApplicationEvents } from "@/lib/ats/ats.functions";
import {
  listInterviews,
  cancelInterview,
  markInterviewStatus,
} from "@/lib/ats/interviews.functions";
import { ScheduleInterviewDialog } from "./schedule-interview-dialog";
import { CalendarPlus } from "lucide-react";


type Criterion = { key: string; label: string; weight: number };
type Scorecard = {
  id: string;
  name: string;
  criteria: Criterion[];
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  applicationId: string;
  jobId: string;
  candidateName: string;
  onSaved?: () => void;
};

export function ScorecardEvalDialog({ open, onOpenChange, applicationId, jobId, candidateName, onSaved }: Props) {
  const fetchScs = useServerFn(listScorecards);
  const fetchRes = useServerFn(listScorecardResponses);
  const fetchEvents = useServerFn(listApplicationEvents);
  const submit = useServerFn(submitScorecardResponse);

  const [scs, setScs] = useState<Scorecard[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [recommendation, setRecommendation] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Array<{ id: string; total_score: number | null; recommendation: string | null }>>([]);
  type Event = { id: string; event_type: string; from_stage: string | null; to_stage: string | null; actor_name: string | null; created_at: string };
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [s, h, ev] = await Promise.all([
          fetchScs({ data: { job_id: jobId } }),
          fetchRes({ data: { application_id: applicationId } }),
          fetchEvents({ data: { application_id: applicationId, limit: 50 } }),
        ]);
        setScs(s as unknown as Scorecard[]);
        setHistory(h as unknown as typeof history);
        setEvents(ev as unknown as Event[]);
        if (s.length > 0) setSelected((s[0] as { id: string }).id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao carregar");
      }
    })();
  }, [open, jobId, applicationId, fetchScs, fetchRes, fetchEvents]);


  const current = useMemo(() => scs.find((s) => s.id === selected) ?? null, [scs, selected]);

  // reset scores quando muda scorecard
  useEffect(() => {
    if (!current) return;
    const init: Record<string, number> = {};
    for (const c of current.criteria) init[c.key] = 3;
    setScores(init);
  }, [current]);

  const handleSubmit = async () => {
    if (!current) return;
    setSaving(true);
    try {
      const res = await submit({
        data: {
          scorecard_id: current.id,
          application_id: applicationId,
          scores,
          recommendation: (recommendation || null) as "strong_yes" | "yes" | "maybe" | "no" | "strong_no" | null,
          notes: notes || null,
        },
      });
      toast.success(`Avaliação salva (score ${res.total_score ?? "—"})`);
      onOpenChange(false);
      setNotes("");
      setRecommendation("");
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Avaliar — {candidateName}</DialogTitle>
        </DialogHeader>

        {history.length > 0 && (
          <div className="text-xs text-muted-foreground border-b pb-2 mb-2">
            Avaliações anteriores:{" "}
            {history.map((h) => (
              <Badge key={h.id} variant="outline" className="mr-1">
                {h.total_score ?? "—"} {h.recommendation ? `· ${h.recommendation}` : ""}
              </Badge>
            ))}
          </div>
        )}

        {scs.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Nenhum scorecard cadastrado. Crie um em <strong>/scorecards</strong>.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {scs.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {current && (
              <div className="space-y-4 mt-2">
                {current.criteria.map((c) => (
                  <div key={c.key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{c.label} <span className="text-xs text-muted-foreground">(peso {c.weight})</span></span>
                      <span className="font-medium">{scores[c.key] ?? 0}/5</span>
                    </div>
                    <Slider
                      min={0}
                      max={5}
                      step={1}
                      value={[scores[c.key] ?? 0]}
                      onValueChange={(v) => setScores((p) => ({ ...p, [c.key]: v[0] }))}
                    />
                  </div>
                ))}

                <div className="space-y-2">
                  <Label>Recomendação</Label>
                  <Select value={recommendation} onValueChange={setRecommendation}>
                    <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strong_yes">Strong yes</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="maybe">Maybe</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="strong_no">Strong no</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
            )}
          </>
        )}

        {events.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">Histórico da candidatura</div>
            <ul className="space-y-1 max-h-40 overflow-y-auto text-xs">
              {events.map((e) => (
                <li key={e.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {e.event_type === "stage_moved"
                      ? `Movido: ${e.from_stage ?? "—"} → ${e.to_stage ?? "—"}`
                      : e.event_type === "application_created"
                        ? "Candidatura criada"
                        : e.event_type === "scorecard_submitted"
                          ? "Scorecard avaliado"
                          : e.event_type}
                    {e.actor_name ? ` · ${e.actor_name}` : ""}
                  </span>
                  <span className="text-muted-foreground whitespace-nowrap">{new Date(e.created_at).toLocaleString("pt-BR")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !current}>
            {saving ? "Salvando…" : "Salvar avaliação"}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
