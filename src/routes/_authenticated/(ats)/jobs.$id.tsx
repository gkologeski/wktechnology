import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAtsJob,
  listJobApplications,
  moveApplication,
  addApplication,
  listAtsCandidates,
} from "@/lib/ats/ats.functions";
import { DEFAULT_ATS_STAGES, type AtsStage } from "@/lib/ats/stages";

export const Route = createFileRoute("/_authenticated/(ats)/jobs/$id")({
  component: JobDetailPage,
});

type App = Awaited<ReturnType<typeof listJobApplications>>[number];
type Job = Awaited<ReturnType<typeof getAtsJob>>;
type Candidate = Awaited<ReturnType<typeof listAtsCandidates>>[number];

function JobDetailPage() {
  const { id } = Route.useParams();
  const getJob = useServerFn(getAtsJob);
  const listApps = useServerFn(listJobApplications);
  const moveApp = useServerFn(moveApplication);
  const addApp = useServerFn(addApplication);
  const listCands = useServerFn(listAtsCandidates);

  const [job, setJob] = useState<Job | null>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCand, setSelectedCand] = useState<string>("");

  const stages: AtsStage[] = DEFAULT_ATS_STAGES;

  const refresh = async () => {
    setLoading(true);
    try {
      const [j, a] = await Promise.all([
        getJob({ data: { id } }),
        listApps({ data: { jobId: id } }),
      ]);
      setJob(j);
      setApps(a);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const byStage = useMemo(() => {
    const m: Record<string, App[]> = {};
    for (const s of stages) m[s.value] = [];
    for (const a of apps) {
      const k = a.stage_value in m ? a.stage_value : "applied";
      m[k].push(a);
    }
    return m;
  }, [apps, stages]);

  const openAdd = async () => {
    setAddOpen(true);
    try {
      const c = await listCands({ data: {} });
      setCandidates(c);
    } catch {
      /* noop */
    }
  };

  const handleAdd = async () => {
    if (!selectedCand) return;
    try {
      await addApp({ data: { jobId: id, candidateId: selectedCand, source: "manual" } });
      setAddOpen(false);
      setSelectedCand("");
      refresh();
      toast.success("Candidato adicionado à vaga");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao adicionar");
    }
  };

  const onDrop = async (toStage: string) => {
    if (!dragging) return;
    const app = apps.find((a) => a.id === dragging);
    setDragging(null);
    if (!app || app.stage_value === toStage) return;
    // optimistic
    setApps((prev) =>
      prev.map((a) => (a.id === app.id ? { ...a, stage_value: toStage } : a)),
    );
    try {
      await moveApp({ data: { applicationId: app.id, toStage, position: 0 } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao mover");
      refresh();
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground p-6">Carregando…</div>;
  if (!job) return <div className="p-6 text-sm">Vaga não encontrada.</div>;

  const jobAny = job as unknown as {
    title: string;
    seniority: string | null;
    remote_mode: string | null;
    employment_type: string | null;
    location: string | null;
    description: string | null;
    requirements: string | null;
    status: string;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/jobs">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h2 className="text-xl font-semibold">{jobAny.title}</h2>
            <div className="flex flex-wrap gap-2 mt-1">
              <Badge>{jobAny.status}</Badge>
              {jobAny.seniority && <Badge variant="outline">{jobAny.seniority}</Badge>}
              {jobAny.remote_mode && <Badge variant="outline">{jobAny.remote_mode}</Badge>}
              {jobAny.employment_type && <Badge variant="outline">{jobAny.employment_type}</Badge>}
              {jobAny.location && <Badge variant="outline">{jobAny.location}</Badge>}
            </div>
          </div>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Adicionar candidato</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar candidato à vaga</DialogTitle>
            </DialogHeader>
            <div>
              <Label>Candidato</Label>
              <Select value={selectedCand} onValueChange={setSelectedCand}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um candidato cadastrado" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Nenhum candidato cadastrado. Cadastre em /ats/candidates.
                    </div>
                  ) : (
                    candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id as string}>
                        {c.full_name as string}
                        {c.email ? ` — ${c.email}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
              <Button onClick={handleAdd} disabled={!selectedCand}>Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {(jobAny.description || jobAny.requirements) && (
        <Card>
          <CardContent className="pt-4 grid md:grid-cols-2 gap-4 text-sm">
            {jobAny.description && (
              <div>
                <div className="font-medium mb-1">Descrição</div>
                <p className="text-muted-foreground whitespace-pre-wrap">{jobAny.description}</p>
              </div>
            )}
            {jobAny.requirements && (
              <div>
                <div className="font-medium mb-1">Requisitos</div>
                <p className="text-muted-foreground whitespace-pre-wrap">{jobAny.requirements}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto">
        <div className="flex gap-3 min-w-max pb-2">
          {stages.map((s) => (
            <div
              key={s.value}
              className="w-72 flex-shrink-0"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(s.value)}
            >
              <Card className="bg-muted/30 h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>{s.label}</span>
                    <Badge variant="secondary">{byStage[s.value]?.length ?? 0}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 min-h-[200px]">
                  {(byStage[s.value] ?? []).map((a) => (
                    <div
                      key={a.id}
                      draggable
                      onDragStart={() => setDragging(a.id)}
                      onDragEnd={() => setDragging(null)}
                      className="bg-background border rounded-md p-3 text-sm cursor-grab active:cursor-grabbing hover:border-primary/40"
                    >
                      <div className="font-medium truncate">
                        {a.candidate?.full_name ?? "Candidato"}
                      </div>
                      {a.candidate?.current_position && (
                        <div className="text-xs text-muted-foreground truncate">
                          {a.candidate.current_position}
                          {a.candidate.current_company && ` @ ${a.candidate.current_company}`}
                        </div>
                      )}
                      {a.candidate?.email && (
                        <div className="text-xs text-muted-foreground truncate">
                          {a.candidate.email}
                        </div>
                      )}
                      {a.ai_match_score != null && (
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          IA {Math.round(Number(a.ai_match_score))}
                        </Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
