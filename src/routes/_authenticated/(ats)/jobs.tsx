import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Plus, Briefcase, MapPin, Users, AlertCircle, Link2 } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { listAtsJobs, saveAtsJob } from "@/lib/ats/ats.functions";
import { ATS_JOB_STATUSES } from "@/lib/ats/stages";
import {
  AtsPageHeader,
  FilterBar,
  EmptyState,
  StatusBadge,
  Skeletons,
  type JobStatus,
} from "@/components/ats/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/(ats)/jobs")({
  component: AtsJobsPage,
});

type JobRow = Awaited<ReturnType<typeof listAtsJobs>>[number];

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  ATS_JOB_STATUSES.map((s) => [s.value, s.label]),
);

/** Map ATS backend statuses → design-system StatusBadge variants. */
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

// MetaPill foi promovido para a camada global do TechHire.
// Mantemos o re-export local para preservar imports e nomes existentes neste arquivo.
import { MetaPill } from "@/components/techhire/ui";

function JobCard({ job }: { job: JobRow }) {
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
              className="inline-flex items-center gap-1 text-text-tertiary"
              title="Vinculada a um negócio"
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden />
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
  const navigate = useNavigate();
  const [rows, setRows] = useState<JobRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    seniority: "",
    employment_type: "clt",
    remote_mode: "hybrid",
    location: "",
    description: "",
    requirements: "",
    status: "draft",
  });

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await list({ data: { search, status } });
      setRows(r);
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

  // Debounced search refresh
  useEffect(() => {
    const t = setTimeout(() => {
      refresh();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

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

  const total = rows.length;
  const subtitle = useMemo(() => {
    if (loading) return "Carregando vagas…";
    if (error) return "Não foi possível carregar a lista.";
    if (total === 0 && (search || status !== "all"))
      return "Nenhuma vaga corresponde aos filtros atuais.";
    if (total === 0) return "Crie a primeira vaga para iniciar o pipeline.";
    return `${total} ${total === 1 ? "vaga" : "vagas"} no workspace`;
  }, [loading, error, total, search, status]);

  const newJobButton = (
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate}>Criar vaga</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        chips={statusFilterChip}
        actions={
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
        }
      />

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
            search || status !== "all"
              ? "Nenhuma vaga encontrada"
              : "Nenhuma vaga ainda"
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
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      )}
    </div>
  );
}
