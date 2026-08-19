import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  ExternalLink,
  FileText,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Plus,
  Trash2,
  Users,
  Flag,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { HireCandidateDialog } from "@/components/people/hire-candidate-dialog";
import { Button } from "@/components/ui/button";
import { RecordLayout } from "@/components/record/record-layout";
import { ScoreBadge, SourceBadge } from "@/components/ats/ui/badges";
import { MetaPill } from "@/components/techhire/ui/meta-pill";
import { CandidateCopilotPanel } from "@/components/ats/candidate-copilot-panel";
import { AssociateCandidateJobDialog } from "@/components/ats/associate-candidate-job-dialog";
import { SendLinkedinDialog } from "@/components/ats/send-linkedin-dialog";
import {
  getCandidateDetail,
  removeCandidateFromPool,
  type CandidateDetail,
} from "@/lib/ats/candidate-detail.functions";
import { saveAtsCandidate, deleteAtsCandidate } from "@/lib/ats/ats.functions";
import { formatValidationError } from "@/lib/validation-message";
import {
  AboutBlock,
  CaptureMetaBlock,
  CertificationsLanguagesBlock,
  CurrentCompanyBlock,
  EducationBlock,
  ExperienceBlock,
  ExternalLinksBlock,
  IdentityBlock,
  ProjectsPublicationsBlock,
  RecentActivityBlock,
  RecommendationsBlock,
  SignalsBlock,
  SkillsDetailedBlock,
  VolunteeringBlock,
  hasDetailedSkills,
} from "@/components/ats/candidate/rich-profile-blocks";
import { formatDateTime } from "@/lib/crm";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/ui/confirm-dialog";

function CandidateLoading() {
  return <div className="p-8 text-sm text-text-tertiary">Carregando candidato...</div>;
}

function CandidateError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  console.error(error);
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center bg-surface-1 border border-border-subtle rounded-xl p-6 shadow-xs">
        <h2 className="text-base font-semibold text-text-primary">
          Não foi possível abrir este candidato
        </h2>
        <p className="mt-2 text-sm text-text-secondary">{error.message}</p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Tentar novamente
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/candidates">Voltar para candidatos</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/(ats)/candidates/$id")({
  component: CandidateDetailPage,
  pendingComponent: CandidateLoading,
  errorComponent: CandidateError,
});

const STATUS_LABELS: Record<CandidateDetail["derived_status"], { label: string; cls: string }> = {
  hired: { label: "Contratado", cls: "bg-stage-hired/10 text-stage-hired border-stage-hired/30" },
  offer: { label: "Em oferta", cls: "bg-stage-offer/10 text-stage-offer border-stage-offer/30" },
  interview: {
    label: "Em entrevista",
    cls: "bg-stage-interview/10 text-stage-interview border-stage-interview/30",
  },
  in_process: {
    label: "Em processo",
    cls: "bg-stage-screen/10 text-stage-screen border-stage-screen/30",
  },
  archived: {
    label: "Arquivado",
    cls: "bg-surface-sunken text-text-secondary border-border-subtle",
  },
  new: { label: "Novo", cls: "bg-stage-sourced/10 text-stage-sourced border-stage-sourced/30" },
};

function CandidateDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const getDetail = useServerFn(getCandidateDetail);
  const saveFn = useServerFn(saveAtsCandidate);
  const deleteFn = useServerFn(deleteAtsCandidate);
  const removePoolFn = useServerFn(removeCandidateFromPool);

  const [data, setData] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [hireOpen, setHireOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getDetail({ data: { id } });
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar candidato");
    } finally {
      setLoading(false);
    }
  }, [getDetail, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="p-8 text-sm text-text-tertiary">Carregando candidato...</div>;
  }
  if (!data) {
    return (
      <div className="p-8 text-sm text-text-tertiary">
        Candidato não encontrado.{" "}
        <Link to="/candidates" className="underline">
          Voltar
        </Link>
      </div>
    );
  }

  const c = data.candidate;
  const status = STATUS_LABELS[data.derived_status];

  const handleDelete = async () => {
    if (!(await confirmDialog(`Excluir candidato "${c.full_name}"?`))) return;
    try {
      await deleteFn({ data: { id: c.id } });
      toast.success("Candidato excluído");
      navigate({ to: "/candidates" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  };

  const header = (
    <div className="bg-surface-1 rounded-xl border border-border-subtle shadow-xs p-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-4 min-w-0">
        <Button variant="ghost" size="icon" asChild className="rounded-full shrink-0">
          <Link to="/candidates">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-text-primary truncate">{c.full_name}</h1>
            <span
              className={cn(
                "inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md border",
                status.cls,
              )}
            >
              {status.label}
            </span>
            {c.score != null && <ScoreBadge score={Number(c.score)} />}
            {c.source && <SourceBadge source={c.source} />}
          </div>
          {(c.current_position || c.current_company) && (
            <p className="text-sm text-text-secondary mt-1 truncate">
              {c.current_position}
              {c.current_company ? ` @ ${c.current_company}` : ""}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
            {c.email && (
              <a
                href={`mailto:${c.email}`}
                className="inline-flex items-center gap-1 hover:text-text-secondary"
              >
                <Mail className="h-3 w-3" /> {c.email}
              </a>
            )}
            {c.phone && (
              <a
                href={`tel:${c.phone}`}
                className="inline-flex items-center gap-1 hover:text-text-secondary"
              >
                <Phone className="h-3 w-3" /> {c.phone}
              </a>
            )}
            {c.linkedin_url && (
              <a
                href={c.linkedin_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-text-secondary"
              >
                <Linkedin className="h-3 w-3" /> LinkedIn
              </a>
            )}
            {c.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {c.location}
              </span>
            )}
            {c.cv_url && (
              <a
                href={c.cv_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-text-secondary"
              >
                <FileText className="h-3 w-3" /> Currículo
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {c.linkedin_url && (
          <SendLinkedinDialog
            candidateId={c.id}
            linkedinUrl={c.linkedin_url}
            candidateName={c.full_name}
          />
        )}
        <Button variant="default" size="sm" onClick={() => setHireOpen(true)}>
          <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Contratar
        </Button>
        <Button variant="outline" size="sm" onClick={handleDelete}>
          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <HireCandidateDialog
        open={hireOpen}
        onOpenChange={setHireOpen}
        candidateId={c.id}
        candidateName={c.full_name}
        suggestedRole={c.current_position ?? null}
      />
      <RecordLayout
        header={header}
        left={
          <div className="space-y-4">
            <IdentityBlock candidate={c} />
            <PropertiesPanel
              candidate={c}
              onSave={async (patch) => {
                await saveFn({
                  data: {
                    id: c.id,
                    full_name: patch.full_name ?? c.full_name,
                    email: patch.email ?? c.email ?? "",
                    phone: patch.phone ?? c.phone ?? null,
                    linkedin_url: patch.linkedin_url ?? c.linkedin_url ?? "",
                    location: patch.location ?? c.location ?? null,
                    current_position: patch.current_position ?? c.current_position ?? null,
                    current_company: patch.current_company ?? c.current_company ?? null,
                    skills: patch.skills ?? c.skills,
                    tags: patch.tags ?? c.tags,
                    source: (c.source as never) ?? "manual",
                    notes: patch.notes ?? c.notes ?? null,
                  },
                });
                await load();
              }}
            />
            <ExternalLinksBlock candidate={c} />
          </div>
        }
        center={
          <div className="space-y-6">
            <AboutBlock candidate={c} />
            <ApplicationsCard detail={data} onChanged={load} />
            <ExperienceBlock candidate={c} />
            <EducationBlock candidate={c} />
            <ProjectsPublicationsBlock candidate={c} />
            <VolunteeringBlock candidate={c} />
            <RecommendationsBlock candidate={c} />
            <RecentActivityBlock candidate={c} />
            <InterviewsCard detail={data} />
            <OffersCard detail={data} />
            <EventsCard detail={data} />
          </div>
        }
        right={
          <div className="space-y-4">
            <CandidateCopilotPanel candidateId={data.candidate.id} />
            <SignalsBlock candidate={c} />
            <CurrentCompanyBlock candidate={c} />
            <PoolsCard
              detail={data}
              onRemove={async (mid) => {
                await removePoolFn({ data: { membership_id: mid } });
                await load();
              }}
            />
            <FlagsCard detail={data} />
            {hasDetailedSkills(c) ? (
              <SkillsDetailedBlock candidate={c} />
            ) : (
              <SkillsCard detail={data} />
            )}
            <CertificationsLanguagesBlock candidate={c} />
            <TagsCard detail={data} />
            <CaptureMetaBlock candidate={c} />
          </div>
        }
      />
    </>
  );
}

/* ---------- Left: Properties ---------- */
type EditablePatch = Partial<CandidateDetail["candidate"]>;

function PropertiesPanel({
  candidate,
  onSave,
}: {
  candidate: CandidateDetail["candidate"];
  onSave: (patch: EditablePatch) => Promise<void>;
}) {
  const [form, setForm] = useState(candidate);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(candidate), [candidate]);

  const dirty = useMemo(
    () =>
      form.full_name !== candidate.full_name ||
      (form.email ?? "") !== (candidate.email ?? "") ||
      (form.phone ?? "") !== (candidate.phone ?? "") ||
      (form.linkedin_url ?? "") !== (candidate.linkedin_url ?? "") ||
      (form.location ?? "") !== (candidate.location ?? "") ||
      (form.current_position ?? "") !== (candidate.current_position ?? "") ||
      (form.current_company ?? "") !== (candidate.current_company ?? "") ||
      (form.notes ?? "") !== (candidate.notes ?? ""),
    [form, candidate],
  );

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        linkedin_url: form.linkedin_url,
        location: form.location,
        current_position: form.current_position,
        current_company: form.current_company,
        notes: form.notes,
      });
      toast.success("Atualizado");
    } catch (e) {
      toast.error(formatValidationError(e, "Erro ao salvar"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-surface-1 rounded-xl border border-border-subtle shadow-xs">
      <header className="px-4 py-3 border-b border-border-subtle">
        <h2 className="text-sm font-semibold text-text-primary">Propriedades</h2>
      </header>
      <div className="p-4 space-y-3 text-sm">
        <Field label="Nome">
          <Input value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
        </Field>
        <Field label="Email">
          <Input
            value={form.email ?? ""}
            onChange={(v) => setForm({ ...form, email: v })}
            type="email"
          />
        </Field>
        <Field label="Telefone">
          <Input value={form.phone ?? ""} onChange={(v) => setForm({ ...form, phone: v })} />
        </Field>
        <Field label="LinkedIn">
          <Input
            value={form.linkedin_url ?? ""}
            onChange={(v) => setForm({ ...form, linkedin_url: v })}
          />
        </Field>
        <Field label="Localização">
          <Input value={form.location ?? ""} onChange={(v) => setForm({ ...form, location: v })} />
        </Field>
        <Field label="Cargo">
          <Input
            value={form.current_position ?? ""}
            onChange={(v) => setForm({ ...form, current_position: v })}
          />
        </Field>
        <Field label="Empresa">
          <Input
            value={form.current_company ?? ""}
            onChange={(v) => setForm({ ...form, current_company: v })}
          />
        </Field>
        <Field label="Notas">
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            className="w-full rounded-md border border-border-subtle bg-surface-base px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>
        {dirty && (
          <Button size="sm" onClick={submit} disabled={saving} className="w-full">
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        )}
        <div className="pt-3 border-t border-border-subtle text-xs text-text-tertiary space-y-1">
          <div>Criado em {formatDateTime(candidate.created_at)}</div>
          <div>Atualizado em {formatDateTime(candidate.updated_at)}</div>
          {candidate.last_touch_at && (
            <div>Último contato: {formatDateTime(candidate.last_touch_at)}</div>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-border-subtle bg-surface-base px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

/* ---------- Center cards ---------- */
function Card({
  title,
  icon,
  children,
  count,
  action,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <section className="bg-surface-1 rounded-xl border border-border-subtle shadow-xs">
      <header className="px-4 py-3 border-b border-border-subtle flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          {icon}
          {title}
          {count != null && (
            <span className="text-xs text-text-tertiary font-normal">({count})</span>
          )}
        </div>
        {action}
      </header>
      <div className="divide-y divide-border-subtle">{children}</div>
    </section>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-6 text-xs text-text-tertiary">{children}</div>;
}

function ApplicationsCard({
  detail,
  onChanged,
}: {
  detail: CandidateDetail;
  onChanged?: () => void | Promise<void>;
}) {
  const [assocOpen, setAssocOpen] = useState(false);
  return (
    <>
      <Card
        title="Aplicações"
        icon={<Briefcase className="h-4 w-4 text-text-secondary" />}
        count={detail.applications.length}
        action={
          <Button size="sm" variant="outline" onClick={() => setAssocOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
            Associar a vaga
          </Button>
        }
      >
        {detail.applications.length === 0 ? (
          <EmptyRow>Nenhuma aplicação ainda.</EmptyRow>
        ) : (
          detail.applications.map((a) => (
            <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Link
                  to="/jobs/$id"
                  params={{ id: a.job_id }}
                  className="text-sm font-medium text-text-primary hover:underline truncate block"
                >
                  {a.job_title ?? "Vaga"}
                </Link>
                <div className="text-xs text-text-tertiary mt-0.5 flex flex-wrap items-center gap-2">
                  <MetaPill>{a.stage_value}</MetaPill>
                  <MetaPill>{a.status}</MetaPill>
                  {a.source && <span>via {a.source}</span>}
                  {a.moved_at && <span>· {formatDateTime(a.moved_at)}</span>}
                </div>
              </div>
              {a.ai_match_score != null && <ScoreBadge score={Number(a.ai_match_score)} />}
            </div>
          ))
        )}
      </Card>
      <AssociateCandidateJobDialog
        open={assocOpen}
        onOpenChange={setAssocOpen}
        presetCandidateId={detail.candidate.id}
        presetCandidateName={detail.candidate.full_name}
        onSuccess={() => onChanged?.()}
      />
    </>
  );
}

function InterviewsCard({ detail }: { detail: CandidateDetail }) {
  return (
    <Card
      title="Entrevistas"
      icon={<Calendar className="h-4 w-4 text-text-secondary" />}
      count={detail.interviews.length}
    >
      {detail.interviews.length === 0 ? (
        <EmptyRow>Nenhuma entrevista agendada.</EmptyRow>
      ) : (
        detail.interviews.map((i) => (
          <div key={i.id} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-text-primary truncate">
                {i.job_title ?? "Entrevista"}{" "}
                {i.kind && <span className="text-text-tertiary">· {i.kind}</span>}
              </div>
              <div className="text-xs text-text-tertiary mt-0.5">
                {i.scheduled_at ? formatDateTime(i.scheduled_at) : "Sem data"} · {i.status}
              </div>
            </div>
          </div>
        ))
      )}
    </Card>
  );
}

function OffersCard({ detail }: { detail: CandidateDetail }) {
  return (
    <Card
      title="Ofertas"
      icon={<FileText className="h-4 w-4 text-text-secondary" />}
      count={detail.offers.length}
    >
      {detail.offers.length === 0 ? (
        <EmptyRow>Nenhuma oferta emitida.</EmptyRow>
      ) : (
        detail.offers.map((o) => (
          <div key={o.id} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-text-primary truncate">{o.job_title ?? "Vaga"}</div>
              <div className="text-xs text-text-tertiary mt-0.5">
                {o.status}
                {o.salary_amount != null &&
                  ` · ${o.salary_currency ?? "BRL"} ${Number(o.salary_amount).toLocaleString("pt-BR")}`}
                {o.sent_at && ` · enviada em ${formatDateTime(o.sent_at)}`}
              </div>
            </div>
          </div>
        ))
      )}
    </Card>
  );
}

function EventsCard({ detail }: { detail: CandidateDetail }) {
  return (
    <Card
      title="Histórico"
      icon={<ShieldCheck className="h-4 w-4 text-text-secondary" />}
      count={detail.events.length}
    >
      {detail.events.length === 0 ? (
        <EmptyRow>Sem eventos registrados.</EmptyRow>
      ) : (
        detail.events.slice(0, 20).map((e) => (
          <div key={e.id} className="px-4 py-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-text-primary font-medium">{e.event_type}</span>
              <span className="text-text-tertiary">{formatDateTime(e.created_at)}</span>
            </div>
            {(e.from_stage || e.to_stage) && (
              <div className="text-text-tertiary mt-0.5">
                {e.from_stage ?? "—"} → {e.to_stage ?? "—"}
              </div>
            )}
          </div>
        ))
      )}
    </Card>
  );
}

/* ---------- Right cards ---------- */
function PoolsCard({
  detail,
  onRemove,
}: {
  detail: CandidateDetail;
  onRemove: (membershipId: string) => Promise<void>;
}) {
  return (
    <Card
      title="Talent Pools"
      icon={<Users className="h-4 w-4 text-text-secondary" />}
      count={detail.pools.length}
    >
      {detail.pools.length === 0 ? (
        <EmptyRow>Não está em nenhum pool.</EmptyRow>
      ) : (
        detail.pools.map((p) => (
          <div
            key={p.membership_id}
            className="px-4 py-2.5 flex items-center justify-between gap-2 text-sm"
          >
            <span className="truncate">{p.pool_name}</span>
            <button
              type="button"
              onClick={() => onRemove(p.membership_id)}
              className="text-text-tertiary hover:text-status-closed"
              aria-label="Remover do pool"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))
      )}
    </Card>
  );
}

function FlagsCard({ detail }: { detail: CandidateDetail }) {
  const active = detail.flags.filter((f) => !f.resolved);
  return (
    <Card
      title="Sinais & flags"
      icon={<Flag className="h-4 w-4 text-text-secondary" />}
      count={active.length}
    >
      {active.length === 0 ? (
        <EmptyRow>Sem sinais ativos.</EmptyRow>
      ) : (
        active.map((f) => (
          <div key={f.id} className="px-4 py-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-text-primary font-medium">{f.kind}</span>
              {f.severity && <MetaPill>{f.severity}</MetaPill>}
            </div>
            <div className="text-text-tertiary mt-0.5">{formatDateTime(f.created_at)}</div>
          </div>
        ))
      )}
    </Card>
  );
}

function SkillsCard({ detail }: { detail: CandidateDetail }) {
  return (
    <Card
      title="Skills"
      icon={<ExternalLink className="h-4 w-4 text-text-secondary" />}
      count={detail.candidate.skills.length}
    >
      {detail.candidate.skills.length === 0 ? (
        <EmptyRow>Sem skills informadas.</EmptyRow>
      ) : (
        <div className="px-4 py-3 flex flex-wrap gap-1.5">
          {detail.candidate.skills.map((s) => (
            <MetaPill key={s}>{s}</MetaPill>
          ))}
        </div>
      )}
    </Card>
  );
}

function TagsCard({ detail }: { detail: CandidateDetail }) {
  return (
    <Card
      title="Tags"
      icon={<ExternalLink className="h-4 w-4 text-text-secondary" />}
      count={detail.candidate.tags.length}
    >
      {detail.candidate.tags.length === 0 ? (
        <EmptyRow>Sem tags.</EmptyRow>
      ) : (
        <div className="px-4 py-3 flex flex-wrap gap-1.5">
          {detail.candidate.tags.map((t) => (
            <MetaPill key={t}>{t}</MetaPill>
          ))}
        </div>
      )}
    </Card>
  );
}
