import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Briefcase, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { DEFAULT_ATS_STAGES, type AtsStage } from "@/lib/ats/stages";
import { listJobScorecardSummary } from "@/lib/ats/scorecards.functions";
import { exportJobApplicationsCsv } from "@/lib/ats/export.functions";
import { ScheduleInterviewDialog } from "@/components/ats/schedule-interview-dialog";
import { JobPostingsPanel } from "@/components/ats/job-postings-panel";
import { LinkedinJobConfigPanel } from "@/components/ats/linkedin-job-config-panel";
import { JobCopilotPanel } from "@/components/ats/job-copilot-panel";
import { RecordLayout } from "@/components/record/record-layout";
import { AtsSectionHeader, EmptyState } from "@/components/ats/ui";
import { useAssigneeFilter, ASSIGNEE_ALL } from "@/components/entity/assignee-filter";
import { type ListViewMode } from "@/components/kanban/view-mode-toggle";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { JobDetailSkeleton } from "@/components/ats/jobs/job-detail-skeleton";
import { JobDetailHeader } from "@/components/ats/jobs/job-detail-header";
import { JobApplicationsToolbar } from "@/components/ats/jobs/job-applications-toolbar";
import { JobApplicationsTable } from "@/components/ats/jobs/job-applications-table";
import { JobPipelineBoard } from "@/components/ats/jobs/job-pipeline-board";
import { JobInterviewsPanel } from "@/components/ats/jobs/job-interviews-panel";
import { JobActivityTimeline } from "@/components/ats/jobs/job-activity-timeline";
import { JobOverviewPanel } from "@/components/ats/jobs/job-overview-panel";
import { JobPropertiesPanel } from "@/components/ats/jobs/job-properties-panel";
import { JobEvalDialog } from "@/components/ats/jobs/job-eval-dialog";
import { SENIORITY_LABEL, REMOTE_LABEL, EMPLOYMENT_LABEL } from "@/components/ats/jobs/job-labels";
import type { App, Candidate, Job } from "@/components/ats/jobs/job-detail.types";

export const Route = createFileRoute("/_authenticated/(ats)/jobs/$id")({
  component: JobDetailPage,
});

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
  const [interviews, setInterviews] = useState<Awaited<ReturnType<typeof listJobInterviews>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCand, setSelectedCand] = useState<string>("");
  const [scoreSummary, setScoreSummary] = useState<Record<string, { avg: number; count: number }>>(
    {},
  );
  const [evalApp, setEvalApp] = useState<App | null>(null);
  const [tab, setTab] = useState<string>("pipeline");
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
    setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, stage_value: toStage } : a)));
    try {
      await moveApp({ data: { applicationId: app.id, toStage, position: 0 } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao mover");
      refresh();
    }
  };

  // Move várias candidaturas de etapa (ação em massa do quadro).
  const onBulkMoveStage = async (ids: string[], toStage: string) => {
    try {
      for (const applicationId of ids) {
        await moveApp({ data: { applicationId, toStage, position: 0 } });
      }
      toast.success(`${ids.length} candidatura(s) movida(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao mover em massa");
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
    <JobDetailHeader
      title={jobAny.title}
      status={jobAny.status}
      metaItems={metaItems}
      totalApps={totalApps}
      addOpen={addOpen}
      onAddOpenChange={setAddOpen}
      onOpenAdd={openAdd}
      candidates={candidates}
      selectedCand={selectedCand}
      onSelectedCandChange={setSelectedCand}
      onAdd={handleAdd}
      onExport={handleExport}
    />
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
                  deal_id: patch.deal_id !== undefined ? patch.deal_id : (jobAny.deal_id ?? null),
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
                Pipeline <span className="ml-1 text-[10px] text-text-tertiary">({totalApps})</span>
              </TabsTrigger>
              <TabsTrigger value="interviews">
                Entrevistas{" "}
                <span className="ml-1 text-[10px] text-text-tertiary">({interviews.length})</span>
              </TabsTrigger>
              <TabsTrigger value="postings">Postagens</TabsTrigger>
              <TabsTrigger value="activity">Atividade</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0">
              <JobOverviewPanel
                description={jobAny.description ?? null}
                requirements={jobAny.requirements ?? null}
              />
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
                {totalApps > 0 ? (
                  <JobApplicationsToolbar
                    assignee={appsAssignee}
                    onAssigneeChange={setAppsAssignee}
                    visibleCount={visibleApps.length}
                    totalCount={totalApps}
                    view={appsView}
                    onViewChange={setAppsView}
                  />
                ) : null}
                {appsView === "table" ? (
                  <JobApplicationsTable
                    apps={sortedApps}
                    sortDir={appsSortDir}
                    onToggleSortDir={() => setAppsSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                    scoreSummary={scoreSummary}
                    onEvaluate={setEvalApp}
                    stageLabel={stageLabel}
                    assigneeFilterActive={appsAssigneeActive}
                    onClearAssigneeFilter={() => setAppsAssignee(ASSIGNEE_ALL)}
                    onAddCandidate={openAdd}
                  />
                ) : (
                  <JobPipelineBoard
                    totalApps={totalApps}
                    stages={stages}
                    byStage={byStage}
                    scoreSummary={scoreSummary}
                    onEvaluate={setEvalApp}
                    onAddCandidate={openAdd}
                    onDragStart={setDragging}
                    onDragEnd={() => setDragging(null)}
                    onDropStage={onDrop}
                    onBulkMoveStage={onBulkMoveStage}
                    onBulkDone={refresh}
                  />
                )}
              </div>
            </TabsContent>
            <TabsContent value="interviews" className="mt-0">
              <JobInterviewsPanel apps={apps} interviews={interviews} onSchedule={setScheduleApp} />
            </TabsContent>
            <TabsContent value="postings" className="mt-0 space-y-4">
              <LinkedinJobConfigPanel jobId={String(id)} />
              <JobPostingsPanel jobId={String(id)} />
            </TabsContent>
            <TabsContent value="activity" className="mt-0">
              <JobActivityTimeline events={events} />
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
      <JobEvalDialog
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
