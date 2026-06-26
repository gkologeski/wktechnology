import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Download, ClipboardCheck, Briefcase, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { listJobScorecardSummary } from "@/lib/ats/scorecards.functions";
import { exportJobApplicationsCsv } from "@/lib/ats/export.functions";
import { ScorecardEvalDialog } from "@/components/ats/scorecard-eval-dialog";
import { JobPostingsPanel } from "@/components/ats/job-postings-panel";
import {
  AtsPageHeader,
  AtsSectionHeader,
  EmptyState,
  ScoreBadge,
  Skeletons,
  StatusBadge,
  type JobStatus,
} from "@/components/ats/ui";
import { MetaPill } from "@/components/techhire/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/(ats)/jobs/$id")({
  component: JobDetailPage,
});

type App = Awaited<ReturnType<typeof listJobApplications>>[number];
type Job = Awaited<ReturnType<typeof getAtsJob>>;
type Candidate = Awaited<ReturnType<typeof listAtsCandidates>>[number];

const STATUS_TO_BADGE: Record<string, JobStatus> = {
  published: "open",
  draft: "draft",
  on_hold: "onhold",
  filled: "closed",
  closed: "closed",
};

const SENIORITY_LABEL: Record<string, string> = {
  intern: "Estágio",
  junior: "Júnior",
  mid: "Pleno",
  senior: "Sênior",
  lead: "Líder",
  principal: "Principal",
};
const REMOTE_LABEL: Record<string, string> = {
  onsite: "Presencial",
  hybrid: "Híbrido",
  remote: "Remoto",
};
const EMPLOYMENT_LABEL: Record<string, string> = {
  clt: "CLT",
  pj: "PJ",
  contract: "Contrato",
  internship: "Estágio",
  temporary: "Temporário",
};

function JobDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <div className="h-4 w-32 rounded-md bg-surface-sunken animate-pulse" />
        <div className="h-7 w-72 rounded-md bg-surface-sunken animate-pulse" />
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded-md bg-surface-sunken animate-pulse" />
          <div className="h-5 w-20 rounded-md bg-surface-sunken animate-pulse" />
          <div className="h-5 w-24 rounded-md bg-surface-sunken animate-pulse" />
        </div>
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-72 flex-shrink-0">
            <Skeletons.Card />
          </div>
        ))}
      </div>
    </div>
  );
}

function JobDetailPage() {
  const { id } = Route.useParams();
  const getJob = useServerFn(getAtsJob);
  const listApps = useServerFn(listJobApplications);
  const moveApp = useServerFn(moveApplication);
  const addApp = useServerFn(addApplication);
  const listCands = useServerFn(listAtsCandidates);
  const listSummary = useServerFn(listJobScorecardSummary);
  const exportCsv = useServerFn(exportJobApplicationsCsv);

  const [job, setJob] = useState<Job | null>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCand, setSelectedCand] = useState<string>("");
  const [scoreSummary, setScoreSummary] = useState<Record<string, { avg: number; count: number }>>({});
  const [evalApp, setEvalApp] = useState<App | null>(null);

  const stages: AtsStage[] = DEFAULT_ATS_STAGES;

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [j, a] = await Promise.all([
        getJob({ data: { id } }),
        listApps({ data: { jobId: id } }),
      ]);
      setJob(j);
      setApps(a);
      const ids = a.map((x) => x.id as string);
      if (ids.length > 0) {
        try {
          const s = await listSummary({ data: { application_ids: ids } });
          setScoreSummary(s as Record<string, { avg: number; count: number }>);
        } catch { /* noop */ }
      } else {
        setScoreSummary({});
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao carregar";
      setError(msg);
      toast.error(msg);
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

  const totalApps = apps.length;

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

  const handleExport = async () => {
    try {
      const r = await exportCsv({ data: { jobId: id } });
      const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar");
    }
  };

  if (loading) return <JobDetailSkeleton />;

  if (error && !job) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Não foi possível carregar a vaga"
        description={error}
        action={<Button onClick={refresh}>Tentar novamente</Button>}
      />
    );
  }

  if (!job) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Vaga não encontrada"
        description="Esta vaga pode ter sido removida ou você não tem acesso a ela."
        action={
          <Link to="/jobs">
            <Button variant="outline">Voltar para vagas</Button>
          </Link>
        }
      />
    );
  }

  const jobAny = job as unknown as {
    title: string;
    seniority: string | null;
    remote_mode: string | null;
    employment_type: string | null;
    location: string | null;
    description: string | null;
    requirements: string | null;
    status: string;
    department?: string | null;
  };

  const statusVariant = STATUS_TO_BADGE[jobAny.status] ?? "draft";
  const metaItems: Array<{ key: string; label: string }> = [];
  if (jobAny.seniority) metaItems.push({ key: "sen", label: SENIORITY_LABEL[jobAny.seniority] ?? jobAny.seniority });
  if (jobAny.remote_mode) metaItems.push({ key: "rem", label: REMOTE_LABEL[jobAny.remote_mode] ?? jobAny.remote_mode });
  if (jobAny.employment_type) metaItems.push({ key: "emp", label: EMPLOYMENT_LABEL[jobAny.employment_type] ?? jobAny.employment_type });
  if (jobAny.location) metaItems.push({ key: "loc", label: jobAny.location });
  if (jobAny.department) metaItems.push({ key: "dep", label: jobAny.department });

  return (
    <div className="flex flex-col gap-6">
      <AtsPageHeader
        eyebrow="Vagas"
        title={jobAny.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link
              to="/jobs"
              className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden="true" />
              Voltar
            </Link>
            <StatusBadge status={statusVariant} />
            {metaItems.map((m) => (
              <MetaPill key={m.key}>{m.label}</MetaPill>
            ))}
            <span className="inline-flex items-center gap-1 text-xs text-text-tertiary">
              <Users className="h-3 w-3" aria-hidden="true" />
              {totalApps} {totalApps === 1 ? "candidato" : "candidatos"}
            </span>
          </span>
        }
        secondaryActions={
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" aria-hidden="true" />
            CSV
          </Button>
        }
        primaryAction={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button onClick={openAdd}>
                  <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                  Adicionar candidato
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar candidato à vaga</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="job-detail-add-candidate">Candidato</Label>
                  <Select value={selectedCand} onValueChange={setSelectedCand}>
                    <SelectTrigger id="job-detail-add-candidate">
                      <SelectValue placeholder="Escolha um candidato cadastrado" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-text-tertiary">
                          Nenhum candidato cadastrado. Cadastre em /candidates.
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
                  <Button variant="outline" onClick={() => setAddOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAdd} disabled={!selectedCand}>
                    Adicionar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
        }
      />

      {(jobAny.description || jobAny.requirements) && (
        <section
          className={cn(
            "rounded-lg border border-border-subtle bg-surface-1",
            "shadow-xs",
          )}
        >
          <div className="grid md:grid-cols-2 gap-6 p-5 text-sm">
            {jobAny.description && (
              <div>
                <AtsSectionHeader title="Descrição" />
                <p className="mt-2 text-text-secondary whitespace-pre-wrap leading-relaxed">
                  {jobAny.description}
                </p>
              </div>
            )}
            {jobAny.requirements && (
              <div>
                <AtsSectionHeader title="Requisitos" />
                <p className="mt-2 text-text-secondary whitespace-pre-wrap leading-relaxed">
                  {jobAny.requirements}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      <JobPostingsPanel jobId={jobAny.id} />

      <section className="flex flex-col gap-3">
        <AtsSectionHeader
          title="Pipeline"
          description="Arraste candidatos entre etapas para atualizar o status."
        />
        {totalApps === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum candidato nesta vaga"
            description="Adicione candidatos manualmente ou compartilhe a página de carreiras para receber aplicações."
            action={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" aria-hidden="true" />Adicionar candidato</Button>}
          />
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <div className="flex gap-3 min-w-max pb-2">
              {stages.map((s) => {
                const items = byStage[s.value] ?? [];
                return (
                  <div
                    key={s.value}
                    className="w-72 flex-shrink-0"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(s.value)}
                  >
                    <div className="rounded-lg border border-border-subtle bg-surface-sunken h-full flex flex-col">
                      <div className="px-3 py-2.5 border-b border-border-subtle flex items-center justify-between">
                        <span className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                          {s.label}
                        </span>
                        <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-md bg-surface-1 border border-border-subtle text-[11px] font-medium text-text-secondary tabular-nums">
                          {items.length}
                        </span>
                      </div>
                      <div className="space-y-2 p-2 min-h-[200px] flex-1">
                        {items.length === 0 ? (
                          <div className="h-full min-h-[180px] flex items-center justify-center text-[11px] text-text-tertiary">
                            Solte aqui
                          </div>
                        ) : (
                          items.map((a) => (
                            <div
                              key={a.id}
                              draggable
                              onDragStart={() => setDragging(a.id)}
                              onDragEnd={() => setDragging(null)}
                              className={cn(
                                "bg-surface-1 border border-border-subtle rounded-md p-3 text-sm",
                                "cursor-grab active:cursor-grabbing",
                                "hover:border-border-strong hover:shadow-xs transition-all",
                                "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
                              )}
                            >
                              <div className="font-medium text-text-primary truncate">
                                {a.candidate?.full_name ?? "Candidato"}
                              </div>
                              {a.candidate?.current_position && (
                                <div className="text-xs text-text-tertiary truncate mt-0.5">
                                  {a.candidate.current_position}
                                  {a.candidate.current_company && ` @ ${a.candidate.current_company}`}
                                </div>
                              )}
                              {a.candidate?.email && (
                                <div className="text-xs text-text-tertiary truncate">
                                  {a.candidate.email}
                                </div>
                              )}
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {a.ai_match_score != null && (
                                  <ScoreBadge score={Number(a.ai_match_score)} />
                                )}
                                {scoreSummary[a.id] && (
                                  <MetaPill>
                                    Avaliação {scoreSummary[a.id].avg} · {scoreSummary[a.id].count}×
                                  </MetaPill>
                                )}
                              </div>
                              <div className="mt-2 flex justify-end">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={(e) => { e.stopPropagation(); setEvalApp(a); }}
                                  draggable={false}
                                  onDragStart={(e) => e.stopPropagation()}
                                >
                                  <ClipboardCheck className="h-3 w-3 mr-1" aria-hidden="true" />
                                  Avaliar
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {evalApp && (
        <ScorecardEvalDialog
          open={!!evalApp}
          onOpenChange={(v) => { if (!v) setEvalApp(null); }}
          applicationId={evalApp.id}
          jobId={id}
          candidateId={evalApp.candidate_id}
          candidateName={evalApp.candidate?.full_name ?? "Candidato"}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
