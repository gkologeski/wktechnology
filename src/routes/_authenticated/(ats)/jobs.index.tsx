import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Briefcase,
  MapPin,
  Users,
  AlertCircle,
  Link2,
  LayoutGrid,
  Rows3,
  Columns3,
  Building2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { AssigneeFilter, useAssigneeFilter } from "@/components/entity/assignee-filter";
import { AssigneeCell } from "@/components/entity/assignee-cell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  listAtsJobs,
  saveAtsJob,
  setAtsJobStatus,
  setAtsJobDepartment,
} from "@/lib/ats/ats.functions";
import { listAtsPipelines, ensureDefaultAtsPipeline } from "@/lib/ats/pipelines.functions";
import { PipelineSelectNotice } from "@/components/ats/pipeline-select-notice";


import { ATS_JOB_STATUSES } from "@/lib/ats/stages";
import {
  AtsPageHeader,
  FilterBar,
  EmptyState,
  StatusBadge,
  Skeletons,
  type JobStatus,
} from "@/components/ats/ui";
import { MetaPill } from "@/components/techhire/ui";
import { Can } from "@/lib/access-control/use-permissions";
import { DealPicker } from "@/components/ats/deal-picker";
import { KanbanScrollContainer } from "@/components/kanban/kanban-scroll-container";
import { cn } from "@/lib/utils";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { Checkbox } from "@/components/ui/checkbox";
import { useGridSelection } from "@/components/grid/use-grid-selection";
import { GridBulkBar } from "@/components/grid/grid-bulk-bar";
import { usePermissions } from "@/lib/access-control/use-permissions";

export const Route = createFileRoute("/_authenticated/(ats)/jobs/")({
  component: AtsJobsPage,
});

type JobRow = Awaited<ReturnType<typeof listAtsJobs>>[number];
type ViewKind = "cards" | "table" | "kanban_status" | "kanban_department";

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  ATS_JOB_STATUSES.map((s) => [s.value, s.label]),
);

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

function JobCard({ job, showPipeline }: { job: JobRow; showPipeline?: boolean }) {
  const badgeStatus = STATUS_TO_BADGE[job.status] ?? "draft";
  const statusLabel = STATUS_LABEL[job.status] ?? job.status;
  const createdAt = (job as { created_at?: string }).created_at;
  const createdLabel = createdAt
    ? new Date(createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    : null;

  return (
    <Link
      to="/jobs/$id"
      params={{ id: job.id }}
      className={cn(
        "group relative flex h-full flex-col gap-3 rounded-lg border border-border-subtle bg-surface-1 p-4",
        "shadow-xs transition-colors",
        "hover:border-border-strong hover:bg-surface-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary group-hover:text-primary">
          {job.title}
        </h3>
        <StatusBadge status={badgeStatus} label={statusLabel} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {job.seniority ? (
          <MetaPill>{SENIORITY_LABEL[job.seniority] ?? job.seniority}</MetaPill>
        ) : null}
        {job.remote_mode ? (
          <MetaPill>{REMOTE_LABEL[job.remote_mode] ?? job.remote_mode}</MetaPill>
        ) : null}
        {job.employment_type ? (
          <MetaPill>{EMPLOYMENT_LABEL[job.employment_type] ?? job.employment_type}</MetaPill>
        ) : null}
        {(job as { department?: string | null }).department ? (
          <MetaPill>{(job as { department?: string | null }).department}</MetaPill>
        ) : null}
        {showPipeline && job.pipeline_name ? <MetaPill>{job.pipeline_name}</MetaPill> : null}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pt-2 text-xs text-text-secondary">
        <div className="flex min-w-0 items-center gap-3">
          {job.location ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-text-tertiary" aria-hidden />
              <span className="truncate">{job.location}</span>
            </span>
          ) : null}
          {createdLabel ? (
            <span className="text-text-tertiary">Criada em {createdLabel}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {job.deal_id ? (
            <span
              className="inline-flex min-w-0 items-center gap-1 text-text-tertiary"
              title={job.deal?.name ? `Negócio: ${job.deal.name}` : "Vinculada a um negócio"}
            >
              <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {job.deal?.name ? (
                <span className="max-w-[140px] truncate">{job.deal.name}</span>
              ) : null}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 tabular-nums text-text-primary">
            <Users className="h-3.5 w-3.5 text-text-tertiary" aria-hidden />
            <span className="font-medium">{job.active_applications}</span>
            <span className="text-text-tertiary">ativos</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

function JobKanbanCard({
  job,
  onDragStart,
  onDragEnd,
  dragging,
  showPipeline,
}: {
  job: JobRow;
  onDragStart?: (jobId: string) => void;
  onDragEnd?: () => void;
  dragging?: boolean;
  showPipeline?: boolean;
}) {
  return (
    <Link
      to="/jobs/$id"
      params={{ id: job.id }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", job.id);
        onDragStart?.(job.id);
      }}
      onDragEnd={() => onDragEnd?.()}
      className={cn(
        "block rounded-md border border-border-subtle bg-surface-1 p-2.5",
        "transition-all hover:border-border-strong hover:shadow-sm",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "cursor-grab active:cursor-grabbing",
        dragging && "opacity-50",
      )}
    >
      <div className="truncate text-sm font-medium text-text-primary">{job.title}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {job.seniority ? (
          <MetaPill>{SENIORITY_LABEL[job.seniority] ?? job.seniority}</MetaPill>
        ) : null}
        {job.remote_mode ? (
          <MetaPill>{REMOTE_LABEL[job.remote_mode] ?? job.remote_mode}</MetaPill>
        ) : null}
        {showPipeline && job.pipeline_name ? <MetaPill>{job.pipeline_name}</MetaPill> : null}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-text-tertiary">
        {job.location ? (
          <span className="inline-flex min-w-0 items-center gap-1 truncate">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{job.location}</span>
          </span>
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-1 tabular-nums text-text-secondary">
          <Users className="h-3 w-3" aria-hidden />
          {job.active_applications}
        </span>
      </div>
    </Link>
  );
}


function JobsGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeletons.Card key={i} lines={3} />
      ))}
    </div>
  );
}

function AtsJobsPage() {
  const list = useServerFn(listAtsJobs);
  const save = useServerFn(saveAtsJob);
  const updateJobStatus = useServerFn(setAtsJobStatus);
  const updateJobDepartment = useServerFn(setAtsJobDepartment);
  const listPipelinesFn = useServerFn(listAtsPipelines);
  const ensureDefaultPipelineFn = useServerFn(ensureDefaultAtsPipeline);
  const [pipelines, setPipelines] = useState<Array<{ id: string; name: string; is_default: boolean }>>([]);
  const [pipelinesError, setPipelinesError] = useState<string | null>(null);
  const [pipelinesLoading, setPipelinesLoading] = useState(true);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const navigate = useNavigate();
  const [allRows, setRows] = useState<JobRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { assignee, setAssignee, filterRows } = useAssigneeFilter();
  // filtro de pipeline (persistido por usuário): "all" = todos os pipelines
  const [pipelineFilter, setPipelineFilter] = useState<string>(() =>
    typeof window !== "undefined"
      ? (localStorage.getItem("jobs:pipeline") ?? "all")
      : "all",
  );
  const rows = filterRows(allRows).filter((r) =>
    pipelineFilter === "all" ? true : r.pipeline_id === pipelineFilter,
  );
  // Seleção múltipla / em massa (padrão de grids — visão em tabela).
  const { canAny } = usePermissions();
  const selection = useGridSelection(rows as Array<JobRow & { id: string }>);
  const selectAllFiltered = () => selection.setSelectedIds(new Set(rows.map((r) => r.id)));


  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ViewKind>(() =>
    typeof window !== "undefined"
      ? ((localStorage.getItem("jobs:view") as ViewKind) ?? "cards")
      : "cards",
  );
  const [form, setForm] = useState({
    title: "",
    seniority: "",
    employment_type: "clt",
    remote_mode: "hybrid",
    location: "",
    description: "",
    requirements: "",
    status: "draft",
    pipeline_id: "",
    deal_id: null as string | null,
  });

  const loadPipelines = useCallback(async () => {
    setPipelinesLoading(true);
    setPipelinesError(null);
    try {
      // garante um único pipeline padrão do workspace antes de listar
      await ensureDefaultPipelineFn().catch(() => undefined);
      const rs = await listPipelinesFn();
      const list = (rs as Array<{ id: string; name: string; is_default: boolean }>).map((p) => ({
        id: p.id,
        name: p.name,
        is_default: p.is_default,
      }));
      setPipelines(list);
    } catch (e) {
      setPipelinesError(e instanceof Error ? e.message : "Falha ao carregar pipelines");
    } finally {
      setPipelinesLoading(false);
    }
  }, [listPipelinesFn, ensureDefaultPipelineFn]);

  // Mantém coerência entre o filtro da tela e o pipeline sugerido na criação.
  useEffect(() => {
    if (pipelines.length === 0) return;
    if (pipelineFilter !== "all" && !pipelines.some((p) => p.id === pipelineFilter)) {
      setPipelineFilter("all");
      return;
    }
    setForm((f) =>
      f.pipeline_id
        ? f
        : {
            ...f,
            pipeline_id:
              pipelines.find((p) => p.id === pipelineFilter)?.id ??
              pipelines.find((p) => p.is_default)?.id ??
              pipelines[0]?.id ??
              "",
          },
    );
  }, [pipelines, pipelineFilter]);

  useEffect(() => {
    void loadPipelines();
  }, [loadPipelines]);


  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("jobs:view", view);
  }, [view]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("jobs:pipeline", pipelineFilter);
  }, [pipelineFilter]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await list({ data: { search, status } });
      setRows(r as JobRow[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao listar vagas";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    const t = setTimeout(() => {
      refresh();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Realtime: quando outro usuário/automação criar/editar vagas, recarrega a lista.
  useRealtimeInvalidate([{ table: "ats_jobs", onChange: () => void refresh() }]);

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast.error("Informe o título da vaga");
      return;
    }
    try {
      const r = await save({
        data: {
          title: form.title.trim(),
          seniority: (form.seniority || null) as never,
          employment_type: form.employment_type as never,
          remote_mode: form.remote_mode as never,
          location: form.location || null,
          description: form.description || null,
          requirements: form.requirements || null,
          status: form.status as never,
          pipeline_id: form.pipeline_id || null,
          deal_id: form.deal_id,
        },
      });
      toast.success("Vaga criada");
      setOpen(false);
      setForm({
        title: "",
        seniority: "",
        employment_type: "clt",
        remote_mode: "hybrid",
        location: "",
        description: "",
        requirements: "",
        status: "draft",
        pipeline_id:
          pipelines.find((p) => p.id === pipelineFilter)?.id ??
          pipelines.find((p) => p.is_default)?.id ??
          pipelines[0]?.id ??
          "",
        deal_id: null,
      });
      if (r?.id) navigate({ to: "/jobs/$id", params: { id: r.id as string } });
      else refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar vaga");
    }
  };

  const statusFilterChip =
    status !== "all" ? (
      <button
        type="button"
        onClick={() => setStatus("all")}
        className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface-1 px-1.5 py-0.5 text-[11px] font-medium text-text-secondary hover:border-border-strong hover:text-text-primary"
      >
        <span className="text-text-tertiary">Status:</span>
        <span>{STATUS_LABEL[status] ?? status}</span>
        <span aria-hidden className="text-text-tertiary">×</span>
        <span className="sr-only">Remover filtro de status</span>
      </button>
    ) : null;

  const selectedPipeline = pipelines.find((p) => p.id === pipelineFilter) ?? null;
  const pipelineFilterChip = selectedPipeline ? (
    <button
      type="button"
      onClick={() => setPipelineFilter("all")}
      className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface-1 px-1.5 py-0.5 text-[11px] font-medium text-text-secondary hover:border-border-strong hover:text-text-primary"
    >
      <span className="text-text-tertiary">Pipeline:</span>
      <span>{selectedPipeline.name}</span>
      <span aria-hidden className="text-text-tertiary">×</span>
      <span className="sr-only">Remover filtro de pipeline</span>
    </button>
  ) : null;

  const filterChips =
    statusFilterChip || pipelineFilterChip ? (
      <>
        {statusFilterChip}
        {pipelineFilterChip}
      </>
    ) : null;

  const total = rows.length;
  const subtitle = useMemo(() => {
    if (loading) return "Carregando vagas…";
    if (error) return "Não foi possível carregar a lista.";
    if (total === 0 && (search || status !== "all" || pipelineFilter !== "all"))
      return "Nenhuma vaga corresponde aos filtros atuais.";
    if (total === 0) return "Crie a primeira vaga para iniciar o pipeline.";
    return `${total} ${total === 1 ? "vaga" : "vagas"} no workspace`;
  }, [loading, error, total, search, status, pipelineFilter]);

  // Group rows for kanban views
  const byStatus = useMemo(() => {
    const groups: Record<string, JobRow[]> = {};
    for (const s of ATS_JOB_STATUSES) groups[s.value] = [];
    for (const r of rows) {
      if (!groups[r.status]) groups[r.status] = [];
      groups[r.status].push(r);
    }
    return groups;
  }, [rows]);

  const byDepartment = useMemo(() => {
    const groups: Record<string, JobRow[]> = {};
    for (const r of rows) {
      const dep = (r as { department?: string | null }).department || "Sem departamento";
      if (!groups[dep]) groups[dep] = [];
      groups[dep].push(r);
    }
    return groups;
  }, [rows]);

  const newJobButton = (
    <Can permission="techhire.jobs.create.own">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="mr-1.5 h-4 w-4" /> Nova vaga
          </Button>
        </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova vaga</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label htmlFor="job-title">Título *</Label>
            <Input
              id="job-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex.: Desenvolvedor(a) Full Stack Pleno"
            />
          </div>
          <div>
            <Label htmlFor="job-seniority">Senioridade</Label>
            <Select
              value={form.seniority}
              onValueChange={(v) => setForm({ ...form, seniority: v })}
            >
              <SelectTrigger id="job-seniority">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="intern">Estágio</SelectItem>
                <SelectItem value="junior">Júnior</SelectItem>
                <SelectItem value="mid">Pleno</SelectItem>
                <SelectItem value="senior">Sênior</SelectItem>
                <SelectItem value="lead">Líder</SelectItem>
                <SelectItem value="principal">Principal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="job-employment">Vínculo</Label>
            <Select
              value={form.employment_type}
              onValueChange={(v) => setForm({ ...form, employment_type: v })}
            >
              <SelectTrigger id="job-employment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clt">CLT</SelectItem>
                <SelectItem value="pj">PJ</SelectItem>
                <SelectItem value="contract">Contrato</SelectItem>
                <SelectItem value="internship">Estágio</SelectItem>
                <SelectItem value="temporary">Temporário</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="job-remote">Modalidade</Label>
            <Select
              value={form.remote_mode}
              onValueChange={(v) => setForm({ ...form, remote_mode: v })}
            >
              <SelectTrigger id="job-remote">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="onsite">Presencial</SelectItem>
                <SelectItem value="hybrid">Híbrido</SelectItem>
                <SelectItem value="remote">Remoto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="job-location">Localização</Label>
            <Input
              id="job-location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Cidade, UF"
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="job-description">Descrição</Label>
            <Textarea
              id="job-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="job-requirements">Requisitos</Label>
            <Textarea
              id="job-requirements"
              rows={3}
              value={form.requirements}
              onChange={(e) => setForm({ ...form, requirements: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="job-status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v })}
            >
              <SelectTrigger id="job-status">
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
          <div className="col-span-2">
            <Label htmlFor="job-pipeline">Pipeline</Label>
            <Select
              value={form.pipeline_id}
              onValueChange={(v) => setForm({ ...form, pipeline_id: v })}
              disabled={pipelines.length === 0}
            >
              <SelectTrigger id="job-pipeline">
                <SelectValue
                  placeholder={pipelinesLoading ? "Carregando pipelines..." : "Selecionar pipeline"}
                />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((p) => (
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
          <div className="col-span-2">
            <Label className="text-xs text-text-tertiary">Negócio (opcional)</Label>
            <DealPicker
              value={form.deal_id}
              onChange={(id) => setForm({ ...form, deal_id: id })}
              placeholder="Vincular a um negócio…"
            />
            <p className="mt-1 text-[11px] text-text-tertiary">
              Associe esta vaga a um negócio do CRM. A empresa do negócio será preenchida automaticamente.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate}>Criar vaga</Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </Can>
  );

  return (
    <div className="flex flex-col gap-5">
      <AtsPageHeader
        eyebrow="ATS"
        title="Vagas"
        description={subtitle}
        primaryAction={newJobButton}
      />

      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Buscar por título, departamento ou local…",
        }}
        chips={filterChips}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={pipelineFilter}
              onValueChange={setPipelineFilter}
              disabled={pipelines.length === 0}
            >
              <SelectTrigger
                aria-label="Filtrar por pipeline"
                className="h-8 w-48 border-border-subtle bg-surface-1 text-xs"
              >
                <SelectValue
                  placeholder={pipelinesLoading ? "Carregando pipelines…" : "Pipeline"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os pipelines</SelectItem>
                {pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.is_default ? " (padrão)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 w-40 border-border-subtle bg-surface-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {ATS_JOB_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AssigneeFilter value={assignee} onChange={setAssignee} className="h-8 w-44 text-xs" />
            <Tabs value={view} onValueChange={(v) => setView(v as ViewKind)}>
              <TabsList className="h-8">
                <TabsTrigger value="cards" className="h-7 px-2 text-xs gap-1">
                  <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> Cards
                </TabsTrigger>
                <TabsTrigger value="table" className="h-7 px-2 text-xs gap-1">
                  <Rows3 className="h-3.5 w-3.5" aria-hidden /> Tabela
                </TabsTrigger>
                <TabsTrigger value="kanban_status" className="h-7 px-2 text-xs gap-1">
                  <Columns3 className="h-3.5 w-3.5" aria-hidden /> Status
                </TabsTrigger>
                <TabsTrigger value="kanban_department" className="h-7 px-2 text-xs gap-1">
                  <Building2 className="h-3.5 w-3.5" aria-hidden /> Depto
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        }
      />

      {!pipelinesLoading && (pipelinesError || pipelines.length === 0) ? (
        <PipelineSelectNotice
          error={pipelinesError}
          onRetry={() => void loadPipelines()}
        />
      ) : null}


      {loading ? (
        <JobsGridSkeleton />
      ) : error ? (
        <EmptyState
          icon={AlertCircle}
          title="Não foi possível carregar as vagas"
          description={error}
          action={
            <Button size="sm" variant="outline" onClick={() => refresh()}>
              Tentar novamente
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={
            search || status !== "all" ? "Nenhuma vaga encontrada" : "Nenhuma vaga ainda"
          }
          description={
            search || status !== "all"
              ? "Ajuste a busca ou os filtros para ver outras vagas."
              : "Crie a primeira vaga para começar o pipeline de seleção."
          }
          action={
            search || status !== "all" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                }}
              >
                Limpar filtros
              </Button>
            ) : (
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Nova vaga
              </Button>
            )
          }
        />
      ) : view === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((j) => (
            <JobCard key={j.id} job={j} showPipeline={pipelineFilter === "all"} />
          ))}
        </div>
      ) : view === "table" ? (
        <div className="rounded-lg border border-border-subtle bg-surface-1 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Senioridade</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Depto</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Ativos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((j) => (
                <TableRow key={j.id} className="group">
                  <TableCell className="font-medium">
                    <Link
                      to="/jobs/$id"
                      params={{ id: j.id }}
                      className="text-text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {j.title}
                      <ExternalLink
                        className="h-3 w-3 opacity-0 group-hover:opacity-60"
                        aria-hidden
                      />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={STATUS_TO_BADGE[j.status] ?? "draft"}
                      label={STATUS_LABEL[j.status] ?? j.status}
                    />
                  </TableCell>
                  <TableCell className="text-text-secondary text-sm">
                    {j.seniority ? SENIORITY_LABEL[j.seniority] ?? j.seniority : "—"}
                  </TableCell>
                  <TableCell className="text-text-secondary text-sm">
                    {j.remote_mode ? REMOTE_LABEL[j.remote_mode] ?? j.remote_mode : "—"}
                  </TableCell>
                  <TableCell className="text-text-secondary text-sm">
                    {j.location ?? "—"}
                  </TableCell>
                  <TableCell className="text-text-secondary text-sm">
                    {(j as { department?: string | null }).department ?? "—"}
                  </TableCell>
                  <TableCell>
                    <AssigneeCell assignedTo={(j as { assigned_to?: string | null }).assigned_to} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {j.active_applications}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : view === "kanban_status" ? (
        <KanbanScrollContainer ariaLabel="Vagas por status">
          <div className="flex gap-2 pb-4">
            {ATS_JOB_STATUSES.map((s) => {
              const colRows = byStatus[s.value] ?? [];
              const isOver = dragOverCol === `status:${s.value}`;
              return (
                <div
                  key={s.value}
                  onDragOver={(e) => {
                    if (!draggingId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverCol !== `status:${s.value}`)
                      setDragOverCol(`status:${s.value}`);
                  }}
                  onDragLeave={(e) => {
                    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node))
                      setDragOverCol((c) => (c === `status:${s.value}` ? null : c));
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setDragOverCol(null);
                    const jobId =
                      e.dataTransfer.getData("text/plain") || draggingId;
                    setDraggingId(null);
                    if (!jobId) return;
                    const current = rows.find((r) => r.id === jobId);
                    if (!current || current.status === s.value) return;
                    const prevStatus = current.status;
                    setRows((rs) =>
                      rs.map((r) =>
                        r.id === jobId ? { ...r, status: s.value as JobRow["status"] } : r,
                      ),
                    );
                    try {
                      await updateJobStatus({
                        data: { id: jobId, status: s.value as never },
                      });
                      toast.success(`Vaga movida para "${s.label}"`);
                    } catch (err) {
                      setRows((rs) =>
                        rs.map((r) => (r.id === jobId ? { ...r, status: prevStatus } : r)),
                      );
                      toast.error(
                        err instanceof Error ? err.message : "Falha ao mover vaga",
                      );
                    }
                  }}
                  className={cn(
                    "flex w-[280px] shrink-0 flex-col rounded-md border bg-surface-sunken transition-colors",
                    isOver
                      ? "border-primary/60 ring-1 ring-primary/30"
                      : "border-border-subtle",
                  )}
                >
                  <div className="sticky top-0 z-10 rounded-t-md border-b border-border-subtle bg-surface-sunken px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge
                        status={STATUS_TO_BADGE[s.value] ?? "draft"}
                        label={s.label}
                      />
                      <span className="text-[11px] tabular-nums text-text-tertiary">
                        {colRows.length}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1.5 p-2 min-h-[200px]">
                    {colRows.map((j) => (
                      <JobKanbanCard
                        key={j.id}
                        job={j}
                        showPipeline={pipelineFilter === "all"}
                        dragging={draggingId === j.id}
                        onDragStart={(id) => setDraggingId(id)}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverCol(null);
                        }}
                      />
                    ))}
                    {colRows.length === 0 && (
                      <p className="px-2 py-6 text-center text-xs text-text-tertiary">
                        {isOver ? "Solte aqui" : "Vazio"}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </KanbanScrollContainer>
      ) : (
        <KanbanScrollContainer ariaLabel="Vagas por departamento">
          <div className="flex gap-2 pb-4">
            {Object.entries(byDepartment).map(([dep, items]) => {
              const isOver = dragOverCol === `dept:${dep}`;
              const targetDept = dep === "Sem departamento" ? null : dep;
              return (
                <div
                  key={dep}
                  onDragOver={(e) => {
                    if (!draggingId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverCol !== `dept:${dep}`) setDragOverCol(`dept:${dep}`);
                  }}
                  onDragLeave={(e) => {
                    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node))
                      setDragOverCol((c) => (c === `dept:${dep}` ? null : c));
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setDragOverCol(null);
                    const jobId =
                      e.dataTransfer.getData("text/plain") || draggingId;
                    setDraggingId(null);
                    if (!jobId) return;
                    const current = rows.find((r) => r.id === jobId) as
                      | (JobRow & { department?: string | null })
                      | undefined;
                    if (!current) return;
                    const prevDept = current.department ?? null;
                    if ((prevDept ?? null) === (targetDept ?? null)) return;
                    setRows((rs) =>
                      rs.map((r) =>
                        r.id === jobId
                          ? ({ ...r, department: targetDept } as JobRow)
                          : r,
                      ),
                    );
                    try {
                      await updateJobDepartment({
                        data: { id: jobId, department: targetDept },
                      });
                      toast.success(
                        targetDept
                          ? `Vaga movida para "${targetDept}"`
                          : "Departamento removido da vaga",
                      );
                    } catch (err) {
                      setRows((rs) =>
                        rs.map((r) =>
                          r.id === jobId
                            ? ({ ...r, department: prevDept } as JobRow)
                            : r,
                        ),
                      );
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : "Falha ao mover vaga",
                      );
                    }
                  }}
                  className={cn(
                    "flex w-[280px] shrink-0 flex-col rounded-md border bg-surface-sunken transition-colors",
                    isOver
                      ? "border-primary/60 ring-1 ring-primary/30"
                      : "border-border-subtle",
                  )}
                >
                  <div className="sticky top-0 z-10 rounded-t-md border-b border-border-subtle bg-surface-sunken px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-text-primary uppercase tracking-wide">
                        <Building2 className="h-3 w-3 text-text-tertiary" aria-hidden />
                        {dep}
                      </span>
                      <span className="text-[11px] tabular-nums text-text-tertiary">
                        {items.length}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1.5 p-2 min-h-[200px]">
                    {items.map((j) => (
                      <JobKanbanCard
                        key={j.id}
                        job={j}
                        showPipeline={pipelineFilter === "all"}
                        dragging={draggingId === j.id}
                        onDragStart={(id) => setDraggingId(id)}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverCol(null);
                        }}
                      />
                    ))}
                    {items.length === 0 && (
                      <p className="px-2 py-6 text-center text-xs text-text-tertiary">
                        {isOver ? "Solte aqui" : "Vazio"}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </KanbanScrollContainer>
      )}

    </div>
  );
}
