// Blocos apresentacionais para os dados ricos capturados pela extensão
// TechHire Hunter (LinkedIn). Sem fetch / sem mutations — recebem o
// `candidate` por props e fazem parsing defensivo de JSONB.
import type { ReactNode } from "react";
import {
  Award,
  BadgeCheck,
  Briefcase,
  Building2,
  ExternalLink,
  Github,
  GraduationCap,
  Globe,
  Handshake,
  Heart,
  Languages,
  Lightbulb,
  Linkedin,
  MessageSquare,
  Send,
  Sparkles,
  Star,
  Twitter,
  UserCheck,
  Users,
} from "lucide-react";
import { MetaPill } from "@/components/techhire/ui/meta-pill";
import { cn } from "@/lib/utils";
import { OwnerField } from "@/components/entity/owner-field";
import type { CandidateDetail, RichJson } from "@/lib/ats/candidate-detail.functions";

type Candidate = CandidateDetail["candidate"];
type Rec = { [k: string]: RichJson };

// ---------- parsers tolerantes ----------
export function asArray(v: RichJson): Rec[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (x && typeof x === "object" && !Array.isArray(x) ? (x as Rec) : null))
    .filter((x): x is Rec => x !== null);
}
export function asRecord(v: RichJson): Rec {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Rec;
  return {};
}
export function asString(v: RichJson | undefined): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}
function pick(r: Rec, keys: string[]): string {
  for (const k of keys) {
    const v = asString(r[k]);
    if (v) return v;
  }
  return "";
}
function periodOf(r: Rec): string {
  const start = pick(r, ["start_date", "start", "started_at", "from"]);
  const end = pick(r, ["end_date", "end", "ended_at", "to"]);
  const current = r.current === true || r.is_current === true;
  if (!start && !end) return pick(r, ["period", "date_range", "dates"]);
  return `${start || "—"} → ${current ? "Atual" : end || "—"}`;
}

// ---------- wrappers de UI consistentes ----------
function Card({
  title,
  icon,
  count,
  children,
  action,
}: {
  title: string;
  icon: ReactNode;
  count?: number;
  children: ReactNode;
  action?: ReactNode;
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
      <div>{children}</div>
    </section>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-5 text-xs text-text-tertiary">{children}</div>;
}

// ---------- Identity (left column complement) ----------
export function IdentityBlock({ candidate }: { candidate: Candidate }) {
  const photo = candidate.photo_url;
  const headline = candidate.headline;
  const open = candidate.open_to_work === true;
  const degree = candidate.connection_degree;
  if (!photo && !headline && !open && !degree) return null;
  return (
    <section className="bg-surface-1 rounded-xl border border-border-subtle shadow-xs p-4 flex items-start gap-3">
      {photo ? (
        <img
          src={photo}
          alt={candidate.full_name}
          className="h-14 w-14 rounded-full object-cover border border-border-subtle"
          loading="lazy"
        />
      ) : (
        <div
          className="h-14 w-14 rounded-full bg-surface-sunken text-text-tertiary flex items-center justify-center text-base font-semibold"
          aria-hidden="true"
        >
          {candidate.full_name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        {headline && (
          <p className="text-sm text-text-primary leading-snug line-clamp-3">{headline}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {open && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border border-status-open/30 bg-status-open/10 text-status-open">
              <Sparkles className="h-3 w-3" /> Open to work
            </span>
          )}
          {degree && <MetaPill>Conexão {degree}</MetaPill>}
        </div>
      </div>
    </section>
  );
}

// ---------- External links (left column) ----------
const LINK_ICON: Record<string, typeof Globe> = {
  github: Github,
  twitter: Twitter,
  x: Twitter,
  linkedin: Linkedin,
  website: Globe,
  site: Globe,
  portfolio: Globe,
  blog: Globe,
};
const LINK_LABEL: Record<string, string> = {
  github: "GitHub",
  twitter: "Twitter / X",
  x: "Twitter / X",
  linkedin: "LinkedIn",
  website: "Website",
  site: "Site",
  portfolio: "Portfólio",
  blog: "Blog",
};
export function ExternalLinksBlock({ candidate }: { candidate: Candidate }) {
  const links = asRecord(candidate.external_links);
  const entries = Object.entries(links)
    .map(([k, v]) => [k.toLowerCase(), asString(v)] as const)
    .filter(([, url]) => url.startsWith("http"));
  if (entries.length === 0) return null;
  return (
    <Card
      title="Links externos"
      icon={<ExternalLink className="h-4 w-4 text-text-secondary" />}
      count={entries.length}
    >
      <ul className="px-4 py-3 space-y-2">
        {entries.map(([k, url]) => {
          const Icon = LINK_ICON[k] ?? Globe;
          const label = LINK_LABEL[k] ?? k;
          return (
            <li key={`${k}-${url}`} className="text-sm">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary truncate"
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ---------- About ----------
export function AboutBlock({ candidate }: { candidate: Candidate }) {
  const about = candidate.about?.trim();
  const c = candidate as unknown as { id: string; owner_id: string | null };
  return (
    <Card title="Sobre" icon={<UserCheck className="h-4 w-4 text-text-secondary" />}>
      <div className="px-4 py-3 border-b border-border-subtle">
        <OwnerField table="ats_candidates" rowId={c.id} ownerId={c.owner_id} />
      </div>
      {about ? (
        <p className="px-4 py-3 text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
          {about}
        </p>
      ) : (
        <Empty>Sem resumo. Capture pelo TechHire Hunter para preencher.</Empty>
      )}
    </Card>
  );
}

// ---------- Experiences ----------
export function ExperienceBlock({ candidate }: { candidate: Candidate }) {
  const items = asArray(candidate.experiences);
  return (
    <Card
      title="Experiência"
      icon={<Briefcase className="h-4 w-4 text-text-secondary" />}
      count={items.length}
    >
      {items.length === 0 ? (
        <Empty>Sem experiências capturadas.</Empty>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {items.map((it, idx) => {
            const title = pick(it, ["title", "role", "position"]);
            const company = pick(it, ["company", "organization", "employer"]);
            const loc = pick(it, ["location", "city"]);
            const desc = pick(it, ["description", "summary"]);
            return (
              <li key={idx} className="px-4 py-3">
                <div className="text-sm font-medium text-text-primary">
                  {title || "—"}
                  {company && <span className="text-text-secondary font-normal"> · {company}</span>}
                </div>
                <div className="text-xs text-text-tertiary mt-0.5 flex flex-wrap items-center gap-2">
                  <span>{periodOf(it)}</span>
                  {loc && <span>· {loc}</span>}
                </div>
                {desc && (
                  <p className="text-xs text-text-secondary mt-2 whitespace-pre-wrap line-clamp-4">
                    {desc}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ---------- Education ----------
export function EducationBlock({ candidate }: { candidate: Candidate }) {
  const items = asArray(candidate.education);
  return (
    <Card
      title="Educação"
      icon={<GraduationCap className="h-4 w-4 text-text-secondary" />}
      count={items.length}
    >
      {items.length === 0 ? (
        <Empty>Sem formação capturada.</Empty>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {items.map((it, idx) => {
            const school = pick(it, ["school", "institution", "university"]);
            const degree = pick(it, ["degree", "title"]);
            const field = pick(it, ["field", "field_of_study", "major"]);
            return (
              <li key={idx} className="px-4 py-3">
                <div className="text-sm font-medium text-text-primary">{school || "—"}</div>
                <div className="text-xs text-text-secondary mt-0.5">
                  {[degree, field].filter(Boolean).join(" · ") || "—"}
                </div>
                <div className="text-xs text-text-tertiary mt-0.5">{periodOf(it)}</div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ---------- Projects & Publications ----------
export function ProjectsPublicationsBlock({ candidate }: { candidate: Candidate }) {
  const projects = asArray(candidate.projects);
  const publications = asArray(candidate.publications);
  if (projects.length === 0 && publications.length === 0) return null;
  return (
    <Card
      title="Projetos & publicações"
      icon={<Lightbulb className="h-4 w-4 text-text-secondary" />}
      count={projects.length + publications.length}
    >
      <div className="divide-y divide-border-subtle">
        {projects.length > 0 && (
          <div className="px-4 py-3">
            <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-2">
              Projetos
            </div>
            <ul className="space-y-2">
              {projects.map((p, idx) => {
                const name = pick(p, ["name", "title"]);
                const desc = pick(p, ["description", "summary"]);
                const url = pick(p, ["url", "link"]);
                return (
                  <li key={idx} className="text-sm">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-text-primary hover:underline"
                      >
                        {name || "Projeto"}
                      </a>
                    ) : (
                      <span className="font-medium text-text-primary">{name || "Projeto"}</span>
                    )}
                    {desc && (
                      <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{desc}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {publications.length > 0 && (
          <div className="px-4 py-3">
            <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-2">
              Publicações
            </div>
            <ul className="space-y-2">
              {publications.map((p, idx) => {
                const title = pick(p, ["title", "name"]);
                const publisher = pick(p, ["publisher", "journal", "venue"]);
                const date = pick(p, ["date", "published_at"]);
                const url = pick(p, ["url", "link"]);
                return (
                  <li key={idx} className="text-sm">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-text-primary hover:underline"
                      >
                        {title || "Publicação"}
                      </a>
                    ) : (
                      <span className="font-medium text-text-primary">{title || "Publicação"}</span>
                    )}
                    <div className="text-xs text-text-tertiary mt-0.5">
                      {[publisher, date].filter(Boolean).join(" · ")}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------- Volunteering ----------
export function VolunteeringBlock({ candidate }: { candidate: Candidate }) {
  const items = asArray(candidate.volunteering);
  if (items.length === 0) return null;
  return (
    <Card
      title="Voluntariado"
      icon={<Heart className="h-4 w-4 text-text-secondary" />}
      count={items.length}
    >
      <ul className="divide-y divide-border-subtle">
        {items.map((it, idx) => {
          const role = pick(it, ["role", "title"]);
          const org = pick(it, ["organization", "company"]);
          const desc = pick(it, ["description", "summary"]);
          return (
            <li key={idx} className="px-4 py-3">
              <div className="text-sm font-medium text-text-primary">
                {role || "—"}
                {org && <span className="text-text-secondary font-normal"> · {org}</span>}
              </div>
              <div className="text-xs text-text-tertiary mt-0.5">{periodOf(it)}</div>
              {desc && <p className="text-xs text-text-secondary mt-1 line-clamp-3">{desc}</p>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ---------- Recent activity ----------
export function RecentActivityBlock({ candidate }: { candidate: Candidate }) {
  const items = asArray(candidate.recent_activity);
  if (items.length === 0) return null;
  return (
    <Card
      title="Atividade recente"
      icon={<Sparkles className="h-4 w-4 text-text-secondary" />}
      count={items.length}
    >
      <ul className="divide-y divide-border-subtle">
        {items.slice(0, 5).map((it, idx) => {
          const text = pick(it, ["text", "title", "summary"]);
          const url = pick(it, ["url", "link"]);
          const date = pick(it, ["date", "posted_at", "created_at"]);
          const kind = pick(it, ["kind", "type"]);
          return (
            <li key={idx} className="px-4 py-3">
              <div className="text-xs text-text-tertiary flex items-center gap-2 mb-1">
                {kind && <MetaPill>{kind}</MetaPill>}
                {date && <span>{date}</span>}
              </div>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-text-primary hover:underline line-clamp-3"
                >
                  {text || url}
                </a>
              ) : (
                <p className="text-sm text-text-primary line-clamp-3">{text || "—"}</p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ---------- Recommendations ----------
export function RecommendationsBlock({ candidate }: { candidate: Candidate }) {
  const items = asArray(candidate.recommendations);
  if (items.length === 0) return null;
  return (
    <Card
      title="Recomendações"
      icon={<Handshake className="h-4 w-4 text-text-secondary" />}
      count={items.length}
    >
      <ul className="divide-y divide-border-subtle">
        {items.map((it, idx) => {
          const author = pick(it, ["author", "name", "from"]);
          const role = pick(it, ["role", "title", "relationship"]);
          const text = pick(it, ["text", "body", "content"]);
          return (
            <li key={idx} className="px-4 py-3">
              <div className="text-xs text-text-tertiary mb-1">
                <span className="font-medium text-text-secondary">{author || "—"}</span>
                {role && <span> · {role}</span>}
              </div>
              {text && (
                <p className="text-sm text-text-secondary whitespace-pre-wrap line-clamp-5">
                  “{text}”
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ---------- Signals (right column) ----------
const ACTION_LABEL: Record<string, { label: string; Icon: typeof MessageSquare }> = {
  message: { label: "Mensagem", Icon: MessageSquare },
  connect: { label: "Conectar", Icon: UserCheck },
  inmail: { label: "InMail", Icon: Send },
  follow: { label: "Seguir", Icon: Users },
};
export function SignalsBlock({ candidate }: { candidate: Candidate }) {
  const actions = asRecord(candidate.available_actions);
  const enabledActions = Object.entries(actions)
    .filter(([, v]) => v === true)
    .map(([k]) => k.toLowerCase())
    .filter((k) => ACTION_LABEL[k]);
  const hasSignals =
    candidate.open_to_work === true || !!candidate.connection_degree || enabledActions.length > 0;
  if (!hasSignals) return null;
  return (
    <Card title="Sinais" icon={<BadgeCheck className="h-4 w-4 text-text-secondary" />}>
      <div className="px-4 py-3 flex flex-wrap items-center gap-1.5">
        {candidate.open_to_work === true && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border border-status-open/30 bg-status-open/10 text-status-open">
            <Sparkles className="h-3 w-3" /> Open to work
          </span>
        )}
        {candidate.connection_degree && <MetaPill>Conexão {candidate.connection_degree}</MetaPill>}
        {enabledActions.map((k) => {
          const { label, Icon } = ACTION_LABEL[k];
          return (
            <span
              key={k}
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border border-border-subtle bg-surface-sunken text-text-secondary"
            >
              <Icon className="h-3 w-3" /> {label}
            </span>
          );
        })}
      </div>
    </Card>
  );
}

// ---------- Skills detailed (substitui SkillsCard quando disponível) ----------
export function hasDetailedSkills(candidate: Candidate): boolean {
  return asArray(candidate.skills_detailed).length > 0;
}
export function SkillsDetailedBlock({ candidate }: { candidate: Candidate }) {
  const items = asArray(candidate.skills_detailed);
  if (items.length === 0) return null;
  return (
    <Card
      title="Skills"
      icon={<Star className="h-4 w-4 text-text-secondary" />}
      count={items.length}
    >
      <ul className="px-4 py-3 flex flex-wrap gap-1.5">
        {items.map((s, idx) => {
          const name = pick(s, ["name", "skill"]);
          const endorsementsRaw = s.endorsements;
          const endorsements =
            typeof endorsementsRaw === "number"
              ? endorsementsRaw
              : typeof endorsementsRaw === "string"
                ? Number(endorsementsRaw) || 0
                : 0;
          if (!name) return null;
          return (
            <span
              key={`${name}-${idx}`}
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border border-border-subtle bg-surface-sunken text-text-secondary",
              )}
            >
              {name}
              {endorsements > 0 && <span className="text-text-tertiary">· {endorsements}</span>}
            </span>
          );
        })}
      </ul>
    </Card>
  );
}

// ---------- Certifications & languages ----------
export function CertificationsLanguagesBlock({ candidate }: { candidate: Candidate }) {
  const certs = asArray(candidate.certifications);
  const langsArr = Array.isArray(candidate.languages) ? candidate.languages : [];
  type LangRow = { name: string; level: string };
  const langs: LangRow[] = langsArr
    .map((l): LangRow | null => {
      if (typeof l === "string") return { name: l, level: "" };
      if (l && typeof l === "object" && !Array.isArray(l)) {
        const r = l as Rec;
        const name = pick(r, ["name", "language"]);
        const level = pick(r, ["level", "proficiency"]);
        return name ? { name, level } : null;
      }
      return null;
    })
    .filter((x): x is LangRow => x !== null);

  if (certs.length === 0 && langs.length === 0) return null;
  return (
    <Card
      title="Certificações & idiomas"
      icon={<Award className="h-4 w-4 text-text-secondary" />}
      count={certs.length + langs.length}
    >
      <div className="divide-y divide-border-subtle">
        {certs.length > 0 && (
          <ul className="px-4 py-3 space-y-2">
            {certs.map((c, idx) => {
              const name = pick(c, ["name", "title"]);
              const issuer = pick(c, ["issuer", "authority"]);
              const date = pick(c, ["date", "issued_at"]);
              const url = pick(c, ["url", "link"]);
              return (
                <li key={idx} className="text-sm">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-text-primary hover:underline"
                    >
                      {name || "Certificação"}
                    </a>
                  ) : (
                    <span className="font-medium text-text-primary">{name || "Certificação"}</span>
                  )}
                  <div className="text-xs text-text-tertiary mt-0.5">
                    {[issuer, date].filter(Boolean).join(" · ")}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {langs.length > 0 && (
          <div className="px-4 py-3">
            <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Languages className="h-3.5 w-3.5" /> Idiomas
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {langs.map((l, idx) => (
                <MetaPill key={`${l.name}-${idx}`}>
                  {l.name}
                  {l.level && ` · ${l.level}`}
                </MetaPill>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------- Current company ----------
export function CurrentCompanyBlock({ candidate }: { candidate: Candidate }) {
  const data = asRecord(candidate.current_company_data);
  const size = pick(data, ["size", "employees", "headcount"]);
  const industry = pick(data, ["industry", "sector"]);
  const location = pick(data, ["location", "headquarters", "city"]);
  if (!size && !industry && !location && !candidate.current_company) return null;

  // tempo na empresa atual
  const firstExp = asArray(candidate.experiences)[0];
  const start = firstExp ? pick(firstExp, ["start_date", "start", "from"]) : "";
  const tenure = (() => {
    if (!start) return "";
    const m = start.match(/(\d{4})/);
    if (!m) return "";
    const year = Number(m[1]);
    const now = new Date().getFullYear();
    const diff = now - year;
    if (diff <= 0) return "Menos de 1 ano";
    return `${diff} ano${diff === 1 ? "" : "s"} no cargo`;
  })();

  return (
    <Card title="Empresa atual" icon={<Building2 className="h-4 w-4 text-text-secondary" />}>
      <div className="px-4 py-3 space-y-1.5">
        {candidate.current_company && (
          <div className="text-sm font-medium text-text-primary">{candidate.current_company}</div>
        )}
        <div className="text-xs text-text-tertiary flex flex-wrap gap-2">
          {industry && <span>{industry}</span>}
          {size && <span>· {size}</span>}
          {location && <span>· {location}</span>}
        </div>
        {tenure && <div className="text-xs text-text-secondary mt-1">{tenure}</div>}
      </div>
    </Card>
  );
}

// ---------- Capture meta (rodapé direito) ----------
export function CaptureMetaBlock({ candidate }: { candidate: Candidate }) {
  if (!candidate.captured_at && !candidate.linkedin_url) return null;
  return (
    <section className="text-xs text-text-tertiary px-1 flex flex-wrap items-center gap-2">
      {candidate.captured_at && (
        <span>
          Capturado em{" "}
          {new Date(candidate.captured_at).toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </span>
      )}
      {candidate.capture_version && <MetaPill>Hunter v{candidate.capture_version}</MetaPill>}
      {candidate.linkedin_url && (
        <a
          href={candidate.linkedin_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-text-secondary"
        >
          <Linkedin className="h-3 w-3" /> Ver no LinkedIn
        </a>
      )}
    </section>
  );
}
