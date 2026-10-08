/**
 * Perfil de vaga do negócio (TechSales → TechHire). Utilitários puros e testáveis.
 * Não é pesquisa: não há pontuação. "Completude" mede só preenchimento.
 * Dados comerciais internos (preço/custo/margem/observações) ficam em
 * `CommercialData`, em tabela separada; nunca entram em `ProfileData`.
 */
import { z } from "zod";

export const MODALITIES = ["outsourcing", "hunting", "both"] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const STATUSES = [
  "draft",
  "awaiting_info",
  "in_validation",
  "approved",
  "forwarded",
] as const;
export const SENIORITIES = ["junior", "pleno", "senior", "especialista", "lideranca"] as const;
export type Modality = (typeof MODALITIES)[number];
export type ProfileStatus = (typeof STATUSES)[number];

export const MODALITY_LABEL: Record<Modality, string> = {
  outsourcing: "Outsourcing",
  hunting: "Hunting",
  both: "Outsourcing + Hunting",
};
export const PRIORITY_LABEL: Record<(typeof PRIORITIES)[number], string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};
export const STATUS_LABEL: Record<ProfileStatus, string> = {
  draft: "Rascunho",
  awaiting_info: "Aguardando informações",
  in_validation: "Em validação",
  approved: "Aprovado",
  forwarded: "Encaminhado ao recrutamento",
};
export const SENIORITY_LABEL: Record<(typeof SENIORITIES)[number], string> = {
  junior: "Júnior",
  pleno: "Pleno",
  senior: "Sênior",
  especialista: "Especialista",
  lideranca: "Liderança",
};

/** Transições manuais permitidas (aprovar/encaminhar têm RPC próprio). */
export const MANUAL_TRANSITIONS: Record<ProfileStatus, ProfileStatus[]> = {
  draft: ["awaiting_info", "in_validation"],
  awaiting_info: ["draft", "in_validation"],
  in_validation: ["draft", "awaiting_info"],
  approved: ["in_validation"],
  forwarded: [],
};

const txt = (max = 4000) => z.string().trim().max(max).optional();
const money = z.number().nonnegative().max(1e9).optional();
const Req = z.enum(["required", "desired"]);

export const ProfileDataZ = z
  .object({
    need: z
      .object({ reason: txt(2000) })
      .strict()
      .default({}),
    role: z
      .object({
        project_context: txt(),
        responsibilities: txt(),
        deliverables: txt(),
        team: txt(1000),
        technical_manager: txt(200),
      })
      .strict()
      .default({}),
    requirements: z
      .object({
        skills: z
          .array(
            z
              .object({
                name: z.string().trim().min(1).max(80),
                kind: Req,
                years: z.number().int().min(0).max(40).optional(),
              })
              .strict(),
          )
          .max(60)
          .default([]),
        languages: z
          .array(
            z
              .object({
                name: z.string().trim().min(1).max(60),
                level: z.enum(["basico", "intermediario", "avancado", "fluente"]).optional(),
                kind: Req,
              })
              .strict(),
          )
          .max(10)
          .default([]),
        certifications: z
          .array(z.object({ name: z.string().trim().min(1).max(120), kind: Req }).strict())
          .max(20)
          .default([]),
        experience_notes: txt(),
      })
      .strict()
      .default({ skills: [], languages: [], certifications: [] }),
    conditions: z
      .object({
        work_mode: z.enum(["remote", "hybrid", "onsite"]).optional(),
        location: txt(200),
        schedule: txt(200),
        timezone: txt(60),
        travel: txt(300),
        start_date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .strict()
      .default({}),
    outsourcing: z
      .object({
        allocation_months: z.number().int().min(1).max(120).optional(),
        dedication: z.enum(["full", "partial"]).optional(),
        hours_per_week: z.number().int().min(1).max(60).optional(),
        management: z.enum(["client", "provider", "shared"]).optional(),
        start_policy: txt(500),
        replacement_policy: txt(500),
      })
      .strict()
      .default({}),
    hunting: z
      .object({
        hiring_regime: z.enum(["clt", "pj", "cooperado", "outro"]).optional(),
        salary_min: money,
        salary_max: money,
        salary_currency: z.enum(["BRL", "USD", "EUR"]).optional(),
        salary_period: z.enum(["month", "year"]).optional(),
        benefits: txt(1000),
        fee_type: z.enum(["percent", "fixed"]).optional(),
        fee_value: money,
        fee_terms: txt(1000),
        guarantee_days: z.number().int().min(0).max(365).optional(),
        decision_process: txt(1000),
      })
      .strict()
      .default({}),
    selection: z
      .object({
        stages: z.array(z.string().trim().min(1).max(120)).max(15).default([]),
        evaluators: txt(500),
        criteria: txt(2000),
        client_confirmation: z.boolean().optional(),
      })
      .strict()
      .default({ stages: [] }),
    evidence: z
      .record(
        z.string().max(80),
        z
          .object({
            source: z.string().max(300),
            page: z.number().int().min(1).max(9999).optional(),
            excerpt: z.string().max(500).optional(),
            status: z.enum(["found", "doubtful", "missing"]),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();
export type ProfileData = z.infer<typeof ProfileDataZ>;

export const CommercialDataZ = z
  .object({
    outsourcing: z
      .object({
        sale_price: money,
        sale_currency: z.enum(["BRL", "USD", "EUR"]).optional(),
        sale_period: z.enum(["hour", "month"]).optional(),
        cost: money,
        cost_period: z.enum(["hour", "month"]).optional(),
      })
      .strict()
      .default({}),
    internal_notes: txt(4000),
    commercial_assessment: txt(4000),
  })
  .strict();
export type CommercialData = z.infer<typeof CommercialDataZ>;

export const ProfileHeaderZ = z
  .object({
    title: z.string().trim().min(1).max(200),
    quantity: z.number().int().min(1).max(999),
    modality: z.enum(MODALITIES),
    priority: z.enum(PRIORITIES),
    seniority: z.enum(SENIORITIES).nullable().optional(),
    contact_id: z.string().uuid().nullable().optional(),
    assigned_to: z.string().uuid().nullable().optional(),
  })
  .strict();
export type ProfileHeader = z.infer<typeof ProfileHeaderZ>;

export type ProfileLike = ProfileHeader & { data: ProfileData };

export function emptyData(): ProfileData {
  return ProfileDataZ.parse({});
}

export function parseData(raw: unknown): ProfileData {
  const r = ProfileDataZ.safeParse(raw ?? {});
  return r.success ? r.data : emptyData();
}

const has = (v: unknown) =>
  v !== undefined && v !== null && !(typeof v === "string" && v.trim() === "");

export const usesOutsourcing = (m: Modality) => m === "outsourcing" || m === "both";
export const usesHunting = (m: Modality) => m === "hunting" || m === "both";

/** Mínimos para aprovar/encaminhar. Lista legível do que falta. */
export function approvalMissing(p: ProfileLike): string[] {
  const d = p.data;
  const out: string[] = [];
  if (!has(p.title)) out.push("Título");
  if (!(p.quantity >= 1)) out.push("Quantidade");
  if (!p.seniority) out.push("Senioridade");
  if (!has(d.role.responsibilities)) out.push("Responsabilidades");
  if (!d.requirements.skills.some((s) => s.kind === "required"))
    out.push("Ao menos uma tecnologia obrigatória");
  if (!d.conditions.work_mode) out.push("Modelo de trabalho");
  if (d.conditions.work_mode && d.conditions.work_mode !== "remote" && !has(d.conditions.location))
    out.push("Localidade");
  if (usesOutsourcing(p.modality)) {
    if (!d.outsourcing.allocation_months) out.push("Duração da alocação");
    if (!d.outsourcing.dedication) out.push("Dedicação");
  }
  if (usesHunting(p.modality)) {
    if (!d.hunting.hiring_regime) out.push("Regime de contratação");
    if (
      d.hunting.salary_min != null &&
      d.hunting.salary_max != null &&
      d.hunting.salary_min > d.hunting.salary_max
    )
      out.push("Faixa salarial coerente (mínimo ≤ máximo)");
  }
  return out;
}

export type SectionKey =
  | "need"
  | "role"
  | "requirements"
  | "conditions"
  | "commercial"
  | "selection";
export const SECTION_LABEL: Record<SectionKey, string> = {
  need: "Necessidade",
  role: "Atuação",
  requirements: "Requisitos",
  conditions: "Condições",
  commercial: "Comercial",
  selection: "Seleção e aprovação",
};

/** Completude por seção (0–1). Não é pontuação de candidato nem de pesquisa. */
export function completeness(p: ProfileLike): {
  total: number;
  sections: Record<SectionKey, number>;
} {
  const d = p.data;
  const ratio = (xs: boolean[]) => (xs.length ? xs.filter(Boolean).length / xs.length : 1);
  const commercial: boolean[] = [];
  if (usesOutsourcing(p.modality))
    commercial.push(
      !!d.outsourcing.allocation_months,
      !!d.outsourcing.dedication,
      !!d.outsourcing.management,
    );
  if (usesHunting(p.modality))
    commercial.push(
      !!d.hunting.hiring_regime,
      d.hunting.salary_min != null || d.hunting.salary_max != null,
      !!d.hunting.fee_type,
    );
  const sections: Record<SectionKey, number> = {
    need: ratio([has(p.title), p.quantity >= 1, has(d.need.reason)]),
    role: ratio([
      has(d.role.project_context),
      has(d.role.responsibilities),
      has(d.role.deliverables),
    ]),
    requirements: ratio([!!p.seniority, d.requirements.skills.length > 0]),
    conditions: ratio([!!d.conditions.work_mode, has(d.conditions.schedule)]),
    commercial: ratio(commercial),
    selection: ratio([d.selection.stages.length > 0, has(d.selection.criteria)]),
  };
  const vals = Object.values(sections);
  return { total: vals.reduce((a, b) => a + b, 0) / vals.length, sections };
}

// ---------------------------------------------------------------------------
// Visão do cliente: allowlist explícita. Qualquer caminho fora dela nunca é
// serializado — inclusive taxas, comercial interno e evidências.
// ---------------------------------------------------------------------------
export const CLIENT_FIELDS = {
  "role.project_context": "Projeto / contexto",
  "role.responsibilities": "Responsabilidades",
  "role.deliverables": "Entregas esperadas",
  "role.team": "Equipe",
  "role.technical_manager": "Gestor técnico",
  "requirements.skills": "Tecnologias e experiência",
  "requirements.languages": "Idiomas",
  "requirements.certifications": "Certificações",
  "requirements.experience_notes": "Observações de experiência",
  "conditions.work_mode": "Modelo de trabalho",
  "conditions.location": "Localidade",
  "conditions.schedule": "Jornada",
  "conditions.timezone": "Fuso horário",
  "conditions.travel": "Viagens",
  "conditions.start_date": "Início desejado",
  "outsourcing.dedication": "Dedicação",
  "outsourcing.hours_per_week": "Horas por semana",
  "hunting.hiring_regime": "Regime de contratação",
  "hunting.salary_min": "Salário mínimo",
  "hunting.salary_max": "Salário máximo",
  "hunting.salary_currency": "Moeda do salário",
  "hunting.salary_period": "Período do salário",
  "hunting.benefits": "Benefícios",
  "hunting.decision_process": "Processo de decisão",
  "selection.stages": "Etapas de entrevista",
  "selection.evaluators": "Avaliadores",
  "selection.criteria": "Critérios de aprovação",
} as const;
export type ClientField = keyof typeof CLIENT_FIELDS;
export const CLIENT_FIELD_KEYS = Object.keys(CLIENT_FIELDS) as ClientField[];

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined),
      obj,
    );
}
function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const ks = path.split(".");
  let cur = obj;
  for (const k of ks.slice(0, -1)) {
    if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[ks[ks.length - 1]] = value;
}

export function sanitizeAllowedFields(fields: unknown): ClientField[] {
  if (!Array.isArray(fields)) return [];
  return [
    ...new Set(
      fields.filter((f): f is ClientField => CLIENT_FIELD_KEYS.includes(f as ClientField)),
    ),
  ];
}

/** Serialização para o cliente: cabeçalho público + somente campos liberados. */
export function toClientView(
  p: ProfileLike,
  allowed: ClientField[],
): {
  title: string;
  quantity: number;
  modality: Modality;
  seniority: string | null;
  fields: { key: ClientField; label: string; value: unknown }[];
} {
  const data = p.data as unknown as Record<string, unknown>;
  return {
    title: p.title,
    quantity: p.quantity,
    modality: p.modality,
    seniority: p.seniority ?? null,
    fields: sanitizeAllowedFields(allowed).map((key) => ({
      key,
      label: CLIENT_FIELDS[key],
      value: getPath(data, key) ?? null,
    })),
  };
}

/** Aplica proposta do cliente filtrando por allowlist e validando com o schema (anti mass assignment). */
export function applyClientProposal(
  base: ProfileData,
  payload: unknown,
  allowed: ClientField[],
): { ok: true; data: ProfileData; changed: ClientField[] } | { ok: false; error: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return { ok: false, error: "Proposta inválida." };
  const allow = sanitizeAllowedFields(allowed);
  const next = structuredClone(base) as unknown as Record<string, unknown>;
  const changed: ClientField[] = [];
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (!allow.includes(k as ClientField)) return { ok: false, error: `Campo não liberado: ${k}` };
    setPath(next, k, v === "" ? undefined : v);
    changed.push(k as ClientField);
  }
  const r = ProfileDataZ.safeParse(next);
  if (!r.success) return { ok: false, error: "Valores inválidos na proposta." };
  return { ok: true, data: r.data, changed };
}

// ---------------------------------------------------------------------------
// Payload para o TechHire: só o que o recrutador precisa. Sem taxas, sem
// comercial interno, sem evidências, sem observações privadas.
// ---------------------------------------------------------------------------
const WORK_MODE_LABEL = { remote: "Remoto", hybrid: "Híbrido", onsite: "Presencial" } as const;
const REGIME_LABEL = { clt: "CLT", pj: "PJ", cooperado: "Cooperado", outro: "Outro" } as const;

export function toAtsJob(p: ProfileLike) {
  const d = p.data;
  const section = (title: string, body?: string) => (body ? `## ${title}\n${body}` : "");
  const description = [
    section("Contexto", d.role.project_context),
    section("Responsabilidades", d.role.responsibilities),
    section("Entregas", d.role.deliverables),
    section("Equipe", d.role.team),
    d.conditions.schedule ? `Jornada: ${d.conditions.schedule}` : "",
    d.conditions.timezone ? `Fuso: ${d.conditions.timezone}` : "",
    d.conditions.travel ? `Viagens: ${d.conditions.travel}` : "",
    d.conditions.start_date ? `Início desejado: ${d.conditions.start_date}` : "",
    usesOutsourcing(p.modality) && d.outsourcing.allocation_months
      ? `Alocação: ${d.outsourcing.allocation_months} meses (${d.outsourcing.dedication === "partial" ? "parcial" : "integral"})`
      : "",
    d.selection.stages.length ? `Etapas: ${d.selection.stages.join(" → ")}` : "",
    d.selection.criteria ? section("Critérios", d.selection.criteria) : "",
    p.quantity > 1 ? `Posições: ${p.quantity}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const fmt = (xs: { name: string; years?: number }[]) =>
    xs.map((s) => `- ${s.name}${s.years ? ` (${s.years}+ anos)` : ""}`).join("\n");
  const req = d.requirements;
  const requirements = [
    req.skills.some((s) => s.kind === "required")
      ? `Obrigatório:\n${fmt(req.skills.filter((s) => s.kind === "required"))}`
      : "",
    req.skills.some((s) => s.kind === "desired")
      ? `Desejável:\n${fmt(req.skills.filter((s) => s.kind === "desired"))}`
      : "",
    req.languages.length
      ? `Idiomas:\n${req.languages.map((l) => `- ${l.name}${l.level ? ` (${l.level})` : ""}${l.kind === "desired" ? " — desejável" : ""}`).join("\n")}`
      : "",
    req.certifications.length
      ? `Certificações:\n${req.certifications.map((c) => `- ${c.name}${c.kind === "desired" ? " — desejável" : ""}`).join("\n")}`
      : "",
    req.experience_notes ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const hunting = usesHunting(p.modality);
  return {
    title: p.title,
    description: description || null,
    requirements: requirements || null,
    seniority: p.seniority ?? null,
    employment_type:
      hunting && d.hunting.hiring_regime
        ? REGIME_LABEL[d.hunting.hiring_regime]
        : usesOutsourcing(p.modality)
          ? "Outsourcing"
          : null,
    location: d.conditions.location ?? null,
    remote_mode: d.conditions.work_mode ? WORK_MODE_LABEL[d.conditions.work_mode] : null,
    salary_min: hunting ? (d.hunting.salary_min ?? null) : null,
    salary_max: hunting ? (d.hunting.salary_max ?? null) : null,
    salary_currency: hunting ? (d.hunting.salary_currency ?? "BRL") : null,
  };
}

// ---------------------------------------------------------------------------
// Diff entre versões. Campos "importantes" ganham destaque na UI.
// ---------------------------------------------------------------------------
const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, val: unknown) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(
          Object.entries(val as Record<string, unknown>)
            .filter(([, x]) => x !== undefined)
            .sort(([a], [b]) => a.localeCompare(b)),
        )
      : val,
  );
export type DiffItem = {
  path: string;
  label: string;
  before: unknown;
  after: unknown;
  important: boolean;
};
const DIFF_FIELDS: { path: string; label: string; important?: boolean }[] = [
  { path: "title", label: "Título", important: true },
  { path: "quantity", label: "Quantidade", important: true },
  { path: "modality", label: "Modalidade", important: true },
  { path: "seniority", label: "Senioridade", important: true },
  { path: "priority", label: "Prioridade" },
  { path: "data.requirements.skills", label: "Tecnologias", important: true },
  { path: "data.requirements.languages", label: "Idiomas" },
  { path: "data.requirements.certifications", label: "Certificações" },
  { path: "data.role.responsibilities", label: "Responsabilidades" },
  { path: "data.role.project_context", label: "Contexto" },
  { path: "data.conditions.work_mode", label: "Modelo de trabalho", important: true },
  { path: "data.conditions.location", label: "Localidade" },
  { path: "data.conditions.start_date", label: "Início" },
  { path: "data.outsourcing.allocation_months", label: "Duração da alocação", important: true },
  { path: "data.outsourcing.dedication", label: "Dedicação" },
  { path: "data.hunting.salary_min", label: "Salário mínimo", important: true },
  { path: "data.hunting.salary_max", label: "Salário máximo", important: true },
  { path: "data.hunting.hiring_regime", label: "Regime" },
  { path: "data.hunting.fee_value", label: "Honorários", important: true },
  { path: "data.selection.stages", label: "Etapas de seleção" },
];

export function diffProfiles(a: ProfileLike, b: ProfileLike): DiffItem[] {
  const A = a as unknown as Record<string, unknown>;
  const B = b as unknown as Record<string, unknown>;
  const out: DiffItem[] = [];
  for (const f of DIFF_FIELDS) {
    const x = getPath(A, f.path) ?? null;
    const y = getPath(B, f.path) ?? null;
    if (stable(x) !== stable(y))
      out.push({ path: f.path, label: f.label, before: x, after: y, important: !!f.important });
  }
  return out;
}

export function diffCommercial(a: CommercialData | null, b: CommercialData | null): DiffItem[] {
  const fields = [
    ["outsourcing.sale_price", "Preço de venda"],
    ["outsourcing.cost", "Custo"],
  ] as const;
  return fields
    .map(([path, label]) => {
      const x = a ? (getPath(a as unknown as Record<string, unknown>, path) ?? null) : null;
      const y = b ? (getPath(b as unknown as Record<string, unknown>, path) ?? null) : null;
      return { path: `commercial.${path}`, label, before: x, after: y, important: true };
    })
    .filter((d) => JSON.stringify(d.before) !== JSON.stringify(d.after));
}

export function marginPct(c: CommercialData | null | undefined): number | null {
  const s = c?.outsourcing?.sale_price;
  const k = c?.outsourcing?.cost;
  if (!s || k == null || c?.outsourcing?.sale_period !== c?.outsourcing?.cost_period) return null;
  return ((s - k) / s) * 100;
}

/**
 * Modelo reutilizável / duplicação: copia só conteúdo técnico e condições.
 * Nunca leva comercial interno, evidências, aprovação, ATS, links ou responsáveis.
 */
export function toTemplatePayload(p: ProfileLike): {
  header: Omit<ProfileHeader, "contact_id" | "assigned_to">;
  data: ProfileData;
} {
  const data = structuredClone(p.data);
  delete data.evidence;
  return {
    header: {
      title: p.title,
      quantity: p.quantity,
      modality: p.modality,
      priority: p.priority,
      seniority: p.seniority ?? null,
    },
    data,
  };
}

/** Lê a seção de snapshot de versão. */
export function snapshotOf(p: ProfileLike): ProfileLike {
  return {
    title: p.title,
    quantity: p.quantity,
    modality: p.modality,
    priority: p.priority,
    seniority: p.seniority ?? null,
    contact_id: p.contact_id ?? null,
    data: p.data,
  };
}
