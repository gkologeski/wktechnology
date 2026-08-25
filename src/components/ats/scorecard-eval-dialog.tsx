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
import { AsyncVideoResponses } from "./async-video-responses";
import { CreateOfferDialog } from "./create-offer-dialog";
import { CalendarPlus, FileSignature } from "lucide-react";

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
  candidateId?: string;
  candidateName: string;
  onSaved?: () => void;
};

export function ScorecardEvalDialog({
  open,
  onOpenChange,
  applicationId,
  jobId,
  candidateId,
  candidateName,
  onSaved,
}: Props) {
  const fetchScs = useServerFn(listScorecards);
  const fetchRes = useServerFn(listScorecardResponses);
  const fetchEvents = useServerFn(listApplicationEvents);
  const fetchInterviews = useServerFn(listInterviews);
  const cancelIv = useServerFn(cancelInterview);
  const markIv = useServerFn(markInterviewStatus);
  const submit = useServerFn(submitScorecardResponse);

  const [scs, setScs] = useState<Scorecard[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [recommendation, setRecommendation] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<
    Array<{ id: string; total_score: number | null; recommendation: string | null }>
  >([]);
  type Event = {
    id: string;
    event_type: string;
    from_stage: string | null;
    to_stage: string | null;
    actor_name: string | null;
    created_at: string;
  };
  const [events, setEvents] = useState<Event[]>([]);
  type Interview = {
    id: string;
    kind: string;
    status: string;
    scheduled_at: string | null;
    duration_min: number;
    meet_url: string | null;
    location: string | null;
  };
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showOffer, setShowOffer] = useState(false);

  const reloadInterviews = async () => {
    try {
      const iv = await fetchInterviews({ data: { application_id: applicationId } });
      setInterviews(iv as unknown as Interview[]);
    } catch {
      /* noop */
    }
  };

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [s, h, ev, iv] = await Promise.all([
          fetchScs({ data: { job_id: jobId } }),
          fetchRes({ data: { application_id: applicationId } }),
          fetchEvents({ data: { application_id: applicationId, limit: 50 } }),
          fetchInterviews({ data: { application_id: applicationId } }),
        ]);
        setScs(s as unknown as Scorecard[]);
        setHistory(h as unknown as typeof history);
        setEvents(ev as unknown as Event[]);
        setInterviews(iv as unknown as Interview[]);
        if (s.length > 0) setSelected((s[0] as { id: string }).id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao carregar");
      }
    })();
  }, [open, jobId, applicationId, fetchScs, fetchRes, fetchEvents, fetchInterviews]);

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
          recommendation: (recommendation || null) as
            | "strong_yes"
            | "yes"
            | "maybe"
            | "no"
            | "strong_no"
            | null,
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
      <DialogContent className="max-w-2xl overflow-y-auto">
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

        <div className="border rounded-lg p-3 mb-2">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-muted-foreground">Entrevistas</div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setShowSchedule(true)}>
                <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Agendar
              </Button>
              {candidateId && (
                <Button size="sm" variant="default" onClick={() => setShowOffer(true)}>
                  <FileSignature className="h-3.5 w-3.5 mr-1" /> Nova oferta
                </Button>
              )}
            </div>
          </div>
          {interviews.length === 0 ? (
            <div className="text-xs text-muted-foreground">Nenhuma entrevista agendada.</div>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {interviews.map((iv) => (
                <li key={iv.id} className="flex items-center justify-between gap-2">
                  <div className="truncate">
                    <Badge variant="outline" className="mr-1 capitalize">
                      {iv.kind}
                    </Badge>
                    <Badge
                      variant={
                        iv.status === "scheduled"
                          ? "default"
                          : iv.status === "done"
                            ? "secondary"
                            : "outline"
                      }
                      className="mr-1"
                    >
                      {iv.status}
                    </Badge>
                    {iv.scheduled_at
                      ? new Date(iv.scheduled_at).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "aguardando candidato"}
                    {iv.meet_url ? (
                      <a
                        href={iv.meet_url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 text-primary underline"
                      >
                        link
                      </a>
                    ) : null}
                  </div>
                  {iv.status === "scheduled" && (
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={async () => {
                          await markIv({ data: { id: iv.id, status: "done" } });
                          await reloadInterviews();
                          toast.success("Marcada como realizada");
                        }}
                      >
                        Realizada
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={async () => {
                          await cancelIv({ data: { id: iv.id } });
                          await reloadInterviews();
                          toast.success("Cancelada");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {/* players de vídeo das entrevistas async */}
          {interviews
            .filter((iv) => iv.kind === "async")
            .map((iv) => (
              <AsyncVideoResponses
                key={`vids-${iv.id}`}
                interviewId={iv.id}
                snapshot={
                  (
                    iv as unknown as {
                      async_questions_snapshot?: Array<{ id: string; text: string }>;
                    }
                  ).async_questions_snapshot ?? null
                }
              />
            ))}
        </div>

        {scs.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Nenhum scorecard cadastrado. Crie um em <strong>/scorecards</strong>.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scs.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {current && (
              <div className="space-y-4 mt-2">
                {current.criteria.map((c) => (
                  <div key={c.key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {c.label}{" "}
                        <span className="text-xs text-muted-foreground">(peso {c.weight})</span>
                      </span>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar…" />
                    </SelectTrigger>
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
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Histórico da candidatura
            </div>
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
                  <span className="text-muted-foreground whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !current}>
            {saving ? "Salvando…" : "Salvar avaliação"}
          </Button>
        </DialogFooter>
      </DialogContent>
      <ScheduleInterviewDialog
        open={showSchedule}
        onOpenChange={setShowSchedule}
        applicationId={applicationId}
        candidateName={candidateName}
        onSaved={() => {
          void reloadInterviews();
        }}
      />
      {candidateId && (
        <CreateOfferDialog
          open={showOffer}
          onOpenChange={setShowOffer}
          candidateId={candidateId}
          candidateName={candidateName}
          jobId={jobId}
          applicationId={applicationId}
        />
      )}
    </Dialog>
  );
}
