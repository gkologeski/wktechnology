import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Download,
  ClipboardCheck,
  Briefcase,
  Users,
  Calendar,
  Building2,
  ExternalLink,
  Save,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getAtsJob,
  listJobApplications,
  moveApplication,
  addApplication,
  listAtsCandidates,
  saveAtsJob,
  listJobEvents,
  listJobInterviews,
} from "@/lib/ats/ats.functions";
import { listAtsPipelines } from "@/lib/ats/pipelines.functions";
import { PipelineSelectNotice } from "@/components/ats/pipeline-select-notice";
import { DEFAULT_ATS_STAGES, type AtsStage, ATS_JOB_STATUSES } from "@/lib/ats/stages";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { listJobScorecardSummary } from "@/lib/ats/scorecards.functions";
import { exportJobApplicationsCsv } from "@/lib/ats/export.functions";
import { ScorecardEvalDialog } from "@/components/ats/scorecard-eval-dialog";
import { ScheduleInterviewDialog } from "@/components/ats/schedule-interview-dialog";
import { JobPostingsPanel } from "@/components/ats/job-postings-panel";
import { LinkedinJobConfigPanel } from "@/components/ats/linkedin-job-config-panel";
import { JobCopilotPanel } from "@/components/ats/job-copilot-panel";
import { RecordLayout } from "@/components/record/record-layout";
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
import { OwnerField } from "@/components/entity/owner-field";
import { AssigneeField } from "@/components/entity/assignee-field";
import { AssigneeCell } from "@/components/entity/assignee-cell";
import {
  AssigneeFilter,
  useAssigneeFilter,
  ASSIGNEE_ALL,
} from "@/components/entity/assignee-filter";
import { ViewModeToggle, type ListViewMode } from "@/components/kanban/view-mode-toggle";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DealPicker } from "@/components/ats/deal-picker";
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
const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  ATS_JOB_STATUSES.map((s) => [s.value, s.label]),
);

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
      </div>
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        <Skeletons.Card lines={6} />
        <Skeletons.Card lines={10} />
        <Skeletons.Card lines={6} />
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
  const saveJobFn = useServerFn(saveAtsJob);
  const listEventsFn = useServerFn(listJobEvents);
  const listInterviewsFn = useServerFn(listJobInterviews);
  const listPipelinesFn = useServerFn(listAtsPipelines);
  const [pipelineNames, setPipelineNames] = useState<Record<string, string>>({});


  const [job, setJob] = useState<Job | null>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [events, setEvents] = useState<Awaited<ReturnType<typeof listJobEvents>>>([]);
  const [interviews, setInterviews] = useState<Awaited<ReturnType<typeof listJobInterviews>>>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCand, setSelectedCand] = useState<string>("");
  const [scoreSummary, setScoreSummary] = useState<
    Record<string, { avg: number; count: number }>
  >({});
  const [evalApp, setEvalApp] = useState<App | null>(null);
  const [tab, setTab] = useState<string>("pipeline");
  const [schedSearch, setSchedSearch] = useState("");
  const [schedActiveOnly, setSchedActiveOnly] = useState(true);
  const [scheduleApp, setScheduleApp] = useState<App | null>(null);
  // Candidaturas: filtro por responsável, alternância de visualização e ordenação
  const {
    assignee: appsAssignee,
    setAssignee: setAppsAssignee,
    filterRows: filterAppsByAssignee,
    isActive: appsAssigneeActive,
  } = useAssigneeFilter();
  const [appsView, setAppsView] = useState<ListViewMode>("kanban");
  const [appsSortDir, setAppsSortDir] = useState<"asc" | "desc">("asc");
  const { nameFor: assigneeNameFor } = useWorkspaceMembers();

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
        } catch {
          /* noop */
        }
      } else {
        setScoreSummary({});
      }
      // background secondary fetches
      listEventsFn({ data: { jobId: id, limit: 50 } })
        .then((rs) => setEvents(rs))
        .catch(() => undefined);
      listInterviewsFn({ data: { jobId: id, limit: 100 } })
        .then((rs) => setInterviews(rs))
        .catch(() => undefined);
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
    listPipelinesFn()
      .then((rs) => {
        const m: Record<string, string> = {};
        for (const p of rs as Array<{ id: string; name: string }>) m[p.id] = p.name;
        setPipelineNames(m);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const visibleApps = useMemo(() => filterAppsByAssignee(apps), [apps, filterAppsByAssignee]);

  const byStage = useMemo(() => {
    const m: Record<string, App[]> = {};
    for (const s of stages) m[s.value] = [];
    for (const a of visibleApps) {
      const k = a.stage_value in m ? a.stage_value : "applied";
      m[k].push(a);
    }
    return m;
  }, [visibleApps, stages]);

  const totalApps = apps.length;

  const stageLabel = (value: string | null | undefined) => {
    const raw = value ?? "applied";
    const known = stages.find((s) => s.value === raw)?.label;
    if (known) return known;
    const pretty = raw.replace(/_/g, " ").trim();
    return pretty.charAt(0).toUpperCase() + pretty.slice(1);
  };

  const sortedApps = useMemo(() => {
    const rows = [...visibleApps];
    rows.sort((a, b) => {
      const an = assigneeNameFor((a as { assigned_to?: string | null }).assigned_to ?? null);
      const bn = assigneeNameFor((b as { assigned_to?: string | null }).assigned_to ?? null);
      const cmp = an.localeCompare(bn, "pt-BR");
      return appsSortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [visibleApps, assigneeNameFor, appsSortDir]);


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
    id: string;
    title: string;
    seniority: string | null;
    remote_mode: string | null;
    employment_type: string | null;
    location: string | null;
    description: string | null;
    requirements: string | null;
    status: string;
    metadata?: { department?: string | null } | null;
    salary_min?: number | null;
    salary_max?: number | null;
    pipeline_id?: string | null;
    deal_id?: string | null;
  };
  const department = jobAny.metadata?.department ?? null;

  const statusVariant = STATUS_TO_BADGE[jobAny.status] ?? "draft";
  const metaItems: Array<{ key: string; label: string }> = [];
  if (jobAny.seniority)
    metaItems.push({ key: "sen", label: SENIORITY_LABEL[jobAny.seniority] ?? jobAny.seniority });
  if (jobAny.remote_mode)
    metaItems.push({ key: "rem", label: REMOTE_LABEL[jobAny.remote_mode] ?? jobAny.remote_mode });
  if (jobAny.employment_type)
    metaItems.push({
      key: "emp",
      label: EMPLOYMENT_LABEL[jobAny.employment_type] ?? jobAny.employment_type,
    });
  if (jobAny.location) metaItems.push({ key: "loc", label: jobAny.location });
  if (department) metaItems.push({ key: "dep", label: department });
  if (jobAny.pipeline_id && pipelineNames[jobAny.pipeline_id])
    metaItems.push({ key: "pipe", label: `Pipeline: ${pipelineNames[jobAny.pipeline_id]}` });

  const header = (
    <AtsPageHeader
      eyebrow="Vagas"
      title={jobAny.title}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <Link
            to="/jobs"
            className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden />
            Voltar
          </Link>
          <StatusBadge status={statusVariant} label={STATUS_LABEL[jobAny.status] ?? jobAny.status} />
          {metaItems.map((m) => (
            <MetaPill key={m.key}>{m.label}</MetaPill>
          ))}
          <span className="inline-flex items-center gap-1 text-xs text-text-tertiary">
            <Users className="h-3 w-3" aria-hidden />
            {totalApps} {totalApps === 1 ? "candidato" : "candidatos"}
          </span>
        </span>
      }
      secondaryActions={
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" aria-hidden />
          CSV
        </Button>
      }
      primaryAction={
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" aria-hidden />
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
                      Nenhum candidato cadastrado.
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
  );

  const appsToolbar = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <AssigneeFilter value={appsAssignee} onChange={setAppsAssignee} className="h-9 w-56" />
        <span className="text-xs text-text-tertiary" aria-live="polite">
          {visibleApps.length} de {totalApps} candidatura(s)
        </span>
      </div>
      <ViewModeToggle value={appsView} onChange={setAppsView} />
    </div>
  );

  const appsTable =
    sortedApps.length === 0 ? (
      <EmptyState
        icon={Users}
        title="Nenhuma candidatura encontrada"
        description={
          appsAssigneeActive
            ? "Nenhuma candidatura para o responsável selecionado. Ajuste o filtro para ver mais registros."
            : "Adicione candidatos manualmente ou compartilhe a página de carreiras para receber aplicações."
        }
        action={
          appsAssigneeActive ? (
            <Button variant="outline" onClick={() => setAppsAssignee(ASSIGNEE_ALL)}>
              Limpar filtro
            </Button>
          ) : (
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" aria-hidden />
              Adicionar candidato
            </Button>
          )
        }
      />
    ) : (
      <div className="rounded-lg border border-border-subtle bg-surface-1">
        <Table className="min-w-[680px]">
          <TableHeader>
            <TableRow>
              <TableHead>Candidato</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Avaliação</TableHead>
              <TableHead aria-sort={appsSortDir === "asc" ? "ascending" : "descending"}>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-medium hover:text-text-primary"
                  onClick={() => setAppsSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                >
                  Responsável
                  <ArrowUpDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
                  <span className="sr-only">
                    Ordenar por responsável ({appsSortDir === "asc" ? "crescente" : "decrescente"})
                  </span>
                </button>
              </TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedApps.map((a) => (
              <TableRow key={a.id as string}>
                <TableCell>
                  <Link
                    to="/candidates/$id"
                    params={{ id: a.candidate_id as string }}
                    className="font-medium text-text-primary hover:underline"
                  >
                    {a.candidate?.full_name ?? "Candidato"}
                  </Link>
                  {a.candidate?.current_position && (
                    <div className="text-xs text-text-tertiary truncate">
                      {a.candidate.current_position}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm text-text-secondary">
                  {stageLabel(a.stage_value)}
                </TableCell>
                <TableCell>
                  {a.ai_match_score != null ? (
                    <ScoreBadge score={Number(a.ai_match_score)} />
                  ) : scoreSummary[a.id] ? (
                    <MetaPill>
                      {scoreSummary[a.id].avg} · {scoreSummary[a.id].count}×
                    </MetaPill>
                  ) : (
                    <span className="text-xs text-text-tertiary">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <AssigneeCell
                    assignedTo={(a as { assigned_to?: string | null }).assigned_to}
                    className="text-sm"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => setEvalApp(a)}
                  >
                    <ClipboardCheck className="h-3 w-3 mr-1" aria-hidden />
                    Avaliar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );

  const pipelineSection = totalApps === 0 ? (
    <EmptyState
      icon={Users}
      title="Nenhum candidato nesta vaga"
      description="Adicione candidatos manualmente ou compartilhe a página de carreiras para receber aplicações."
      action={
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" aria-hidden />
          Adicionar candidato
        </Button>
      }
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
                        )}
                      >
                        <Link
                          to="/candidates/$id"
                          params={{ id: a.candidate_id as string }}
                          onClick={(e) => e.stopPropagation()}
                          draggable={false}
                          onDragStart={(e) => e.stopPropagation()}
                          className="font-medium text-text-primary truncate hover:underline block"
                        >
                          {a.candidate?.full_name ?? "Candidato"}
                        </Link>
                        {a.candidate?.current_position && (
                          <div className="text-xs text-text-tertiary truncate mt-0.5">
                            {a.candidate.current_position}
                            {a.candidate.current_company && ` @ ${a.candidate.current_company}`}
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
                        <AssigneeCell
                          assignedTo={(a as { assigned_to?: string | null }).assigned_to}
                          className="mt-2 text-xs"
                        />
                        <div className="mt-2 flex justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEvalApp(a);
                            }}
                            draggable={false}
                            onDragStart={(e) => e.stopPropagation()}
                          >
                            <ClipboardCheck className="h-3 w-3 mr-1" aria-hidden />
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
  );


  const applicantsForScheduling = apps.filter((a) => {
    if (schedActiveOnly && (a.status ?? "active") !== "active") return false;
    if (!schedSearch.trim()) return true;
    const q = schedSearch.trim().toLowerCase();
    const cand = (a as unknown as { candidate?: { full_name?: string | null } | null }).candidate;
    const name = (cand?.full_name ?? "").toLowerCase();
    const stage = (a.stage_value ?? "").toLowerCase();
    return name.includes(q) || stage.includes(q);
  });

  const interviewsSection = (
    <div className="space-y-4">
      <div className="rounded-lg border border-border-subtle bg-surface-1 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <AtsSectionHeader
              title="Agendar entrevista"
              description={`Selecione um candidato para marcar entrevista. ${applicantsForScheduling.length} candidato(s).`}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Input
            value={schedSearch}
            onChange={(e) => setSchedSearch(e.target.value)}
            placeholder="Buscar por nome ou estágio…"
            className="h-8 max-w-xs"
          />
          <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={schedActiveOnly}
              onChange={(e) => setSchedActiveOnly(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Somente ativos
          </label>
        </div>
        {applicantsForScheduling.length === 0 ? (
          <p className="text-xs text-text-tertiary">
            Nenhum candidato encontrado. Assim que aparecerem na aba Pipeline, você poderá agendar entrevistas aqui.
          </p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 max-h-[420px] overflow-y-auto pr-1">
            {applicantsForScheduling.map((a) => {
              const cand = (a as unknown as { candidate?: { full_name?: string | null } | null })
                .candidate;
              const name = cand?.full_name ?? "Candidato";
              return (
                <button
                  key={a.id as string}
                  type="button"
                  onClick={() => setScheduleApp(a)}
                  className="flex items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-left text-sm hover:border-border-strong hover:bg-surface-3 transition"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-text-primary truncate">{name}</div>
                    <div className="text-[11px] text-text-tertiary truncate">
                      {a.stage_value ?? "applied"}
                    </div>
                  </div>
                  <Calendar className="h-4 w-4 text-text-tertiary shrink-0" aria-hidden />
                </button>
              );
            })}
          </div>
        )}
      </div>


      {interviews.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Nenhuma entrevista agendada"
          description="As entrevistas agendadas para esta vaga aparecerão aqui."
        />
      ) : (
        <div className="rounded-lg border border-border-subtle bg-surface-1 divide-y divide-border-subtle">
          {interviews.map((iv) => (
            <div key={iv.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-text-primary truncate">
                  {iv.candidate_name ?? "Candidato"}
                </div>
                <div className="text-xs text-text-tertiary truncate">
                  {iv.kind ?? "Entrevista"} · {iv.stage_value ?? "—"}
                  {iv.location ? ` · ${iv.location}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <MetaPill>{iv.status}</MetaPill>
                <span className="text-xs text-text-tertiary tabular-nums">
                  {iv.scheduled_at
                    ? new Date(iv.scheduled_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const eventsSection = events.length === 0 ? (
    <EmptyState
      icon={Calendar}
      title="Sem atividade ainda"
      description="Movimentações no pipeline e eventos da vaga aparecerão aqui."
    />
  ) : (
    <ol className="space-y-2">
      {events.map((ev) => (
        <li
          key={ev.id}
          className="flex items-start gap-3 rounded-md border border-border-subtle bg-surface-1 p-3 text-sm"
        >
          <div className="mt-1 h-2 w-2 rounded-full bg-primary/70 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-text-primary">
              <span className="font-medium">{ev.candidate_name ?? "Candidato"}</span>{" "}
              <span className="text-text-tertiary">— {ev.event_type}</span>
            </div>
            {(ev.from_stage || ev.to_stage) && (
              <div className="mt-0.5 text-xs text-text-tertiary">
                {ev.from_stage ?? "—"} → {ev.to_stage ?? "—"}
              </div>
            )}
          </div>
          <span className="text-xs text-text-tertiary tabular-nums shrink-0">
            {new Date(ev.created_at).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </li>
      ))}
    </ol>
  );

  const overviewSection = (
    <div className="space-y-4">
      {(jobAny.description || jobAny.requirements) ? (
        <section className="rounded-lg border border-border-subtle bg-surface-1 shadow-xs">
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
      ) : (
        <EmptyState
          icon={Briefcase}
          title="Sem descrição"
          description="Edite a vaga no painel à esquerda para adicionar descrição e requisitos."
        />
      )}
    </div>
  );

  return (
    <>
      <RecordLayout
        header={header}
        left={
          <JobPropertiesPanel
            job={job}
            applicationCount={totalApps}
            onSaved={refresh}
            save={async (patch) => {
              await saveJobFn({
                data: {
                  id: jobAny.id,
                  title: patch.title ?? jobAny.title,
                  description: patch.description ?? jobAny.description ?? null,
                  requirements: patch.requirements ?? jobAny.requirements ?? null,
                  seniority: (patch.seniority ?? jobAny.seniority) as never,
                  employment_type: (patch.employment_type ?? jobAny.employment_type) as never,
                  location: patch.location ?? jobAny.location ?? null,
                  remote_mode: (patch.remote_mode ?? jobAny.remote_mode) as never,
                  salary_min: patch.salary_min ?? jobAny.salary_min ?? null,
                  salary_max: patch.salary_max ?? jobAny.salary_max ?? null,
                  status: (patch.status ?? jobAny.status) as never,
                  pipeline_id: patch.pipeline_id ?? jobAny.pipeline_id ?? null,
                  deal_id: patch.deal_id !== undefined ? patch.deal_id : jobAny.deal_id ?? null,
                },
              });
            }}
          />
        }
        center={
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Visão geral</TabsTrigger>
              <TabsTrigger value="pipeline">
                Pipeline{" "}
                <span className="ml-1 text-[10px] text-text-tertiary">({totalApps})</span>
              </TabsTrigger>
              
              <TabsTrigger value="interviews">
                Entrevistas{" "}
                <span className="ml-1 text-[10px] text-text-tertiary">
                  ({interviews.length})
                </span>
              </TabsTrigger>
              <TabsTrigger value="postings">Postagens</TabsTrigger>
              <TabsTrigger value="activity">Atividade</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0">
              {overviewSection}
            </TabsContent>
            <TabsContent value="pipeline" className="mt-0">
              <AtsSectionHeader
                title="Candidaturas"
                description={
                  appsView === "kanban"
                    ? "Arraste candidatos entre etapas para atualizar o status."
                    : "Lista de candidaturas desta vaga. Ordene pela coluna Responsável."
                }
              />
              <div className="mt-3 space-y-3">
                {totalApps > 0 ? appsToolbar : null}
                {appsView === "table" ? appsTable : pipelineSection}
              </div>
            </TabsContent>
            <TabsContent value="interviews" className="mt-0">
              {interviewsSection}
            </TabsContent>
            <TabsContent value="postings" className="mt-0 space-y-4">
              <LinkedinJobConfigPanel jobId={String(id)} />
              <JobPostingsPanel jobId={String(id)} />
            </TabsContent>
            <TabsContent value="activity" className="mt-0">
              {eventsSection}
            </TabsContent>
          </Tabs>
        }
        right={
          <div className="space-y-4">
            <JobCopilotPanel
              jobId={String(id)}
              candidates={apps
                .filter((a) => a.candidate)
                .map((a) => ({
                  id: a.candidate_id as string,
                  full_name:
                    (a.candidate as { full_name: string } | null)?.full_name ?? "Candidato",
                }))}
            />
            {department ? (
              <section className="rounded-lg border border-border-subtle bg-surface-1 p-4">
                <AtsSectionHeader title="Departamento" />
                <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-text-secondary">
                  <Building2 className="h-3.5 w-3.5 text-text-tertiary" aria-hidden />
                  {department}
                </div>
              </section>
            ) : null}
          </div>
        }
      />
      <MountEvalDialog
        evalApp={evalApp}
        jobId={id}
        onClose={() => setEvalApp(null)}
        refresh={refresh}
      />
      {scheduleApp && (
        <ScheduleInterviewDialog
          open={!!scheduleApp}
          onOpenChange={(v) => !v && setScheduleApp(null)}
          applicationId={scheduleApp.id as string}
          candidateName={
            (scheduleApp as unknown as { candidate?: { full_name?: string | null } | null })
              .candidate?.full_name ?? "Candidato"
          }
          onSaved={() => {
            setScheduleApp(null);
            void refresh();
            listInterviewsFn({ data: { jobId: id, limit: 100 } })
              .then((rs) => setInterviews(rs))
              .catch(() => undefined);
          }}
        />
      )}
    </>
  );
}


/* ---------- Left: Properties (inline editor) ---------- */
type JobPatch = {
  title?: string;
  description?: string | null;
  requirements?: string | null;
  seniority?: string | null;
  employment_type?: string | null;
  location?: string | null;
  remote_mode?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  status?: string;
  pipeline_id?: string | null;
  deal_id?: string | null;
};

function JobPropertiesPanel({
  job,
  save,
  onSaved,
  applicationCount,
}: {
  job: Job;
  save: (patch: JobPatch) => Promise<unknown>;
  onSaved: () => void;
  applicationCount: number;
}) {
  const j = job as unknown as {
    title: string;
    seniority: string | null;
    remote_mode: string | null;
    employment_type: string | null;
    location: string | null;
    description: string | null;
    requirements: string | null;
    status: string;
    salary_min: number | null;
    salary_max: number | null;
    pipeline_id: string | null;
    deal_id: string | null;
  };
  const [form, setForm] = useState({
    title: j.title,
    seniority: j.seniority ?? "",
    employment_type: j.employment_type ?? "",
    remote_mode: j.remote_mode ?? "",
    location: j.location ?? "",
    description: j.description ?? "",
    requirements: j.requirements ?? "",
    status: j.status,
    salary_min: j.salary_min?.toString() ?? "",
    salary_max: j.salary_max?.toString() ?? "",
    pipeline_id: j.pipeline_id ?? "",
    deal_id: j.deal_id ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [pipelines, setPipelines] = useState<Array<{ id: string; name: string; is_default: boolean }>>([]);
  const [pipelinesError, setPipelinesError] = useState<string | null>(null);
  const [pipelinesLoading, setPipelinesLoading] = useState(true);
  const [confirmPipeline, setConfirmPipeline] = useState<string | null>(null);
  const listPipelinesFn = useServerFn(listAtsPipelines);

  const loadPipelines = useCallback(async () => {
    setPipelinesLoading(true);
    setPipelinesError(null);
    try {
      const rs = await listPipelinesFn();
      setPipelines(
        (rs as Array<{ id: string; name: string; is_default: boolean }>).map((p) => ({
          id: p.id,
          name: p.name,
          is_default: p.is_default,
        })),
      );
    } catch (e) {
      setPipelinesError(e instanceof Error ? e.message : "Falha ao carregar pipelines");
    } finally {
      setPipelinesLoading(false);
    }
  }, [listPipelinesFn]);

  useEffect(() => {
    void loadPipelines();
  }, [loadPipelines]);


  // Garante que o pipeline atual da vaga sempre apareça no seletor,
  // mesmo que ainda não esteja na lista carregada.
  const pipelineOptions = useMemo(() => {
    const current = j.pipeline_id;
    if (!current || pipelines.some((p) => p.id === current)) return pipelines;
    return [{ id: current, name: "Pipeline atual da vaga", is_default: false }, ...pipelines];
  }, [pipelines, j.pipeline_id]);



  useEffect(() => {
    setForm({
      title: j.title,
      seniority: j.seniority ?? "",
      employment_type: j.employment_type ?? "",
      remote_mode: j.remote_mode ?? "",
      location: j.location ?? "",
      description: j.description ?? "",
      requirements: j.requirements ?? "",
      status: j.status,
      salary_min: j.salary_min?.toString() ?? "",
      salary_max: j.salary_max?.toString() ?? "",
      pipeline_id: j.pipeline_id ?? "",
      deal_id: j.deal_id ?? null,
    });
  }, [j.title, j.seniority, j.employment_type, j.remote_mode, j.location, j.description, j.requirements, j.status, j.salary_min, j.salary_max, j.pipeline_id, j.deal_id]);

  const dirty =
    form.title !== j.title ||
    (form.seniority || null) !== j.seniority ||
    (form.employment_type || null) !== j.employment_type ||
    (form.remote_mode || null) !== j.remote_mode ||
    (form.location || null) !== (j.location ?? null) ||
    (form.description || null) !== (j.description ?? null) ||
    (form.requirements || null) !== (j.requirements ?? null) ||
    form.status !== j.status ||
    (form.salary_min ? Number(form.salary_min) : null) !== j.salary_min ||
    (form.salary_max ? Number(form.salary_max) : null) !== j.salary_max ||
    (form.pipeline_id || null) !== (j.pipeline_id ?? null) ||
    (form.deal_id ?? null) !== (j.deal_id ?? null);

  const persist = async () => {
    setSaving(true);
    try {
      await save({
        title: form.title,
        description: form.description || null,
        requirements: form.requirements || null,
        seniority: form.seniority || null,
        employment_type: form.employment_type || null,
        location: form.location || null,
        remote_mode: form.remote_mode || null,
        salary_min: form.salary_min ? Number(form.salary_min) : null,
        salary_max: form.salary_max ? Number(form.salary_max) : null,
        status: form.status,
        pipeline_id: form.pipeline_id || null,
        deal_id: form.deal_id,
      });
      toast.success("Vaga atualizada");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
      setConfirmPipeline(null);
    }
  };

  const onSubmit = async () => {
    const pipelineChanged = (form.pipeline_id || null) !== (j.pipeline_id ?? null);
    if (pipelineChanged && applicationCount > 0) {
      setConfirmPipeline(form.pipeline_id || null);
      return;
    }
    await persist();
  };


  const jobRow = job as unknown as {
    id: string;
    owner_id: string | null;
    assigned_to: string | null;
  };
  return (
    <section className="rounded-lg border border-border-subtle bg-surface-1 p-4 space-y-3">
      <AtsSectionHeader title="Propriedades" />
      <div className="space-y-3 pb-3 border-b border-border-subtle">
        <OwnerField
          table="ats_jobs"
          rowId={jobRow.id}
          ownerId={jobRow.owner_id}
          onChanged={onSaved}
        />
        <AssigneeField
          table="ats_jobs"
          rowId={jobRow.id}
          assignedTo={jobRow.assigned_to}
          onChanged={() => onSaved()}
        />
      </div>
      <div className="space-y-2 text-sm">

        <div>
          <Label htmlFor="prop-title" className="text-xs text-text-tertiary">
            Título
          </Label>
          <Input
            id="prop-title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="prop-status" className="text-xs text-text-tertiary">
            Status
          </Label>
          <Select
            value={form.status}
            onValueChange={(v) => setForm({ ...form, status: v })}
          >
            <SelectTrigger id="prop-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ATS_JOB_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="prop-pipeline" className="text-xs text-text-tertiary">
            Pipeline
          </Label>
          <Select
            value={form.pipeline_id}
            onValueChange={(v) => setForm({ ...form, pipeline_id: v })}
            disabled={pipelineOptions.length === 0}
          >
            <SelectTrigger id="prop-pipeline">
              <SelectValue
                placeholder={pipelinesLoading ? "Carregando pipelines..." : "Selecionar pipeline"}
              />
            </SelectTrigger>
            <SelectContent>
              {pipelineOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.is_default ? " (padrão)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!pipelinesLoading && (pipelinesError || pipelines.length === 0) ? (
            <PipelineSelectNotice
              error={pipelinesError}
              onRetry={() => void loadPipelines()}
            />
          ) : (
            <p className="mt-1 text-[11px] text-text-tertiary">
              Define as etapas pelas quais as candidaturas desta vaga vão passar.
            </p>
          )}

        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-text-tertiary">Negócio</Label>
            {form.deal_id ? (
              <Link
                to="/deals/$id"
                params={{ id: form.deal_id }}
                className="inline-flex items-center gap-1 text-[11px] text-text-tertiary hover:text-text-primary"
              >
                Abrir <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            ) : null}
          </div>
          <DealPicker
            value={form.deal_id}
            onChange={(id) => setForm({ ...form, deal_id: id })}
            placeholder="Vincular negócio…"
          />
          <p className="mt-1 text-[11px] text-text-tertiary">
            Associa esta vaga a um negócio do CRM.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="prop-sen" className="text-xs text-text-tertiary">
              Senioridade
            </Label>
            <Select
              value={form.seniority}
              onValueChange={(v) => setForm({ ...form, seniority: v })}
            >
              <SelectTrigger id="prop-sen">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SENIORITY_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="prop-rem" className="text-xs text-text-tertiary">
              Modalidade
            </Label>
            <Select
              value={form.remote_mode}
              onValueChange={(v) => setForm({ ...form, remote_mode: v })}
            >
              <SelectTrigger id="prop-rem">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REMOTE_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="prop-emp" className="text-xs text-text-tertiary">
            Vínculo
          </Label>
          <Select
            value={form.employment_type}
            onValueChange={(v) => setForm({ ...form, employment_type: v })}
          >
            <SelectTrigger id="prop-emp">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(EMPLOYMENT_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="prop-loc" className="text-xs text-text-tertiary">
            Localização
          </Label>
          <Input
            id="prop-loc"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="prop-min" className="text-xs text-text-tertiary">
              Salário mín
            </Label>
            <Input
              id="prop-min"
              type="number"
              value={form.salary_min}
              onChange={(e) => setForm({ ...form, salary_min: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="prop-max" className="text-xs text-text-tertiary">
              Salário máx
            </Label>
            <Input
              id="prop-max"
              type="number"
              value={form.salary_max}
              onChange={(e) => setForm({ ...form, salary_max: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="prop-desc" className="text-xs text-text-tertiary">
            Descrição
          </Label>
          <Textarea
            id="prop-desc"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="prop-req" className="text-xs text-text-tertiary">
            Requisitos
          </Label>
          <Textarea
            id="prop-req"
            rows={3}
            value={form.requirements}
            onChange={(e) => setForm({ ...form, requirements: e.target.value })}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={onSubmit} disabled={!dirty || saving}>
          <Save className="h-3.5 w-3.5 mr-1.5" aria-hidden />
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
      <AlertDialog
        open={confirmPipeline !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmPipeline(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar pipeline desta vaga?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta vaga tem {applicationCount}{" "}
              {applicationCount === 1 ? "candidatura" : "candidaturas"} em andamento.
              As etapas atuais dos candidatos podem não existir no novo pipeline e
              precisarão ser reajustadas manualmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={persist} disabled={saving}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/* Eval dialog mount point (kept for parity) */
function MountEvalDialog({
  evalApp,
  jobId,
  onClose,
  refresh,
}: {
  evalApp: App | null;
  jobId: string;
  onClose: () => void;
  refresh: () => void;
}) {
  if (!evalApp) return null;
  return (
    <ScorecardEvalDialog
      open={!!evalApp}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      applicationId={evalApp.id}
      jobId={jobId}
      candidateId={evalApp.candidate_id}
      candidateName={evalApp.candidate?.full_name ?? "Candidato"}
      onSaved={refresh}
    />
  );
}
