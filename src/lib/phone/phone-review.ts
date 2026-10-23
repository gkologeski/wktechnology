import { maskPhone, normalizePhone, sanitizePhoneText, splitPhoneExtension } from "./e164";

/** Classes da fila de revisão de telefones (nunca aplicadas automaticamente). */
export const PHONE_REVIEW_CLASSES = [
  "region_unknown",
  "invalid",
  "ambiguous",
  "multiple",
  "letters",
  "bad_plus",
  "too_long",
  "too_short",
  "conflict_duplicate",
  "extension_without_field",
  "extension_only",
  "repeated_country_code",
  "changed_since_dry_run",
] as const;
export type PhoneReviewClass = (typeof PHONE_REVIEW_CLASSES)[number];

/** Subtipos para revisão humana dentro da fila. */
export const PHONE_REVIEW_KINDS = ["legacy_mobile_no9"] as const;
export type PhoneReviewKind = (typeof PHONE_REVIEW_KINDS)[number];
export const PHONE_KIND_LABEL: Record<PhoneReviewKind, string> = {
  legacy_mobile_no9: "Celular antigo sem o 9 (confirmar)",
};

/** Resoluções que gravaram um telefone padronizado. */
const PHONE_FIXED_RESOLUTIONS = new Set([
  "safe_explicit",
  "safe_record_country",
  "placeholder",
  "manual_confirmed",
]);

export const PHONE_SAFE_CLASSES = [
  "safe_explicit",
  "safe_record_country",
  "placeholder",
  "blank_short",
] as const;

export const PHONE_CLASS_LABEL: Record<string, string> = {
  safe_explicit: "Tinha código do país",
  safe_record_country: "País do próprio cadastro",
  placeholder: 'Sem número ("--", "0")',
  already_canonical: "Já no padrão",
  region_unknown: "Sem código do país",
  invalid: "Número inválido",
  ambiguous: "Leitura ambígua",
  multiple: "Vários números no campo",
  letters: "Letras ou símbolos",
  bad_plus: "Sinal + fora do lugar",
  too_long: "Longo demais",
  too_short: "Curto demais",
  conflict_duplicate: "Duplicado com outro lead",
  extension_without_field: "Ramal sem campo",
  changed_since_dry_run: "Alterado depois da simulação",
  blank_short: "Até 4 dígitos (em branco)",
  extension_only: "Só ramal",
  repeated_country_code: "Código do país repetido",
  manual_confirmed: "Confirmado na revisão",
  manual_kept: "Mantido na revisão",
  manual_cleared: "Apagado na revisão",
};

export const PHONE_FIELD_LABEL: Record<string, string> = {
  "contacts.phone": "Contatos · Telefone",
  "contacts.mobile_phone": "Contatos · Celular",
  "leads.phone": "Leads · Telefone",
  "leads.mobile_phone": "Leads · Celular",
  "companies.phone": "Empresas · Telefone",
  "people.phone": "Pessoas · Telefone",
  "people.emergency_phone": "Pessoas · Telefone de recado",
  "ats_candidates.phone": "Candidatos · Telefone",
  "ats_referrals.candidate_phone": "Indicações · Telefone",
  "bookings.invitee_phone": "Agendamentos · Telefone",
  "prospecting_results.phone": "Prospecção · Telefone",
  "prospecting_results.company_phone": "Prospecção · Telefone da empresa",
  "profiles.phone": "Usuários · Telefone",
};

/** Tabelas da fila que têm ficha própria para abrir. */
export const PHONE_ENTITY_ROUTE = {
  contacts: "/contacts/$id",
  leads: "/leads/$id",
  companies: "/companies/$id",
  people: "/people/$id",
  ats_candidates: "/candidates/$id",
} as const;
export type PhoneEntityRoute = (typeof PHONE_ENTITY_ROUTE)[keyof typeof PHONE_ENTITY_ROUTE];

export function phoneEntityRoute(table: string): PhoneEntityRoute | null {
  return (PHONE_ENTITY_ROUTE as Record<string, PhoneEntityRoute>)[table] ?? null;
}

/** Nome exibido do registro: nome completo → nome/sobrenome → e-mail → nulo. */
export function phoneEntityName(r: {
  name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}): string | null {
  const person = [r.first_name, r.last_name].filter((s) => s?.trim()).join(" ");
  return r.name?.trim() || r.full_name?.trim() || person.trim() || r.email?.trim() || null;
}

/**
 * Resumo por campo a partir das contagens da varredura. `resolved` vem das
 * correções posteriores (execuções filhas): por campo, quantos itens da fila
 * foram resolvidos e como (`blank_short` = apagado por ter até 4 dígitos).
 */
export function summarizePhoneRun(
  counts: Record<string, Record<string, number>>,
  applied: Record<string, number>,
  resolved: Record<string, Record<string, number>> = {},
) {
  const review = new Set<string>(PHONE_REVIEW_CLASSES);
  const rows = Object.entries(counts).map(([field, byClass]) => {
    const total = Object.values(byClass).reduce((a, b) => a + b, 0);
    const canonical = byClass.already_canonical ?? 0;
    const res = resolved[field] ?? {};
    const blanked = res.blank_short ?? 0;
    const fixedLater = Object.entries(res)
      .filter(([k]) => PHONE_FIXED_RESOLUTIONS.has(k))
      .reduce((a, [, n]) => a + n, 0);
    const resolvedTotal = Object.values(res).reduce((a, n) => a + n, 0);
    const pending = Object.entries(byClass)
      .filter(([k]) => review.has(k))
      .reduce((a, [, n]) => a + n, 0);
    return {
      field,
      total,
      canonical,
      applied: (applied[field] ?? 0) + fixedLater,
      blanked,
      pending: Math.max(0, pending - resolvedTotal),
    };
  });
  rows.sort((a, b) => b.total - a.total);
  const sum = (k: "total" | "canonical" | "applied" | "blanked" | "pending") =>
    rows.reduce((a, r) => a + r[k], 0);
  return {
    rows,
    total: sum("total"),
    canonical: sum("canonical"),
    applied: sum("applied"),
    blanked: sum("blanked"),
    pending: sum("pending"),
  };
}

/** Celular BR antigo (DDD + 8 dígitos 6–9): candidato com o 9º dígito. NUNCA aplicado. */
export function legacyMobileCandidate(v: string): string | null {
  const { main } = splitPhoneExtension(sanitizePhoneText(v));
  let d = main.replace(/\D/g, "");
  if (d.startsWith("55") && d.length === 12) d = d.slice(2);
  if (d.length !== 10 || !/^[1-9][1-9][6-9]/.test(d)) return null;
  const cand = `+55${d.slice(0, 2)}9${d.slice(2)}`;
  const r = normalizePhone(cand, { defaultCountry: null });
  return r.status === "valid" && r.type === "mobile" ? cand : null;
}

/**
 * Motivo específico de um item pendente, com candidato MASCARADO quando
 * houver (hipótese para quem revisa; nada é aplicado). `country` só quando é
 * evidência do próprio registro. Nulo quando não há detalhe melhor.
 */
export function phoneReviewDetail(
  v: string | null | undefined,
  country?: string | null,
): string | null {
  if (!v || !v.trim()) return null;
  const legacy = legacyMobileCandidate(v);
  if (legacy)
    return `Celular antigo sem o 9º dígito; candidato ${maskPhone(legacy)} não aplicado (confirmar com o contato).`;
  const r = normalizePhone(v, { defaultCountry: country ?? null });
  if (r.status !== "invalid") return null;
  const cand = r.candidates?.[0];
  switch (r.reason) {
    case "repeated_country_code":
      return `Código do país repetido; candidato ${maskPhone(cand)} não aplicado (país do cadastro não confirma).`;
    case "region_unknown": {
      if (cand) return `Sem país no cadastro; leitura internacional ${maskPhone(cand)} é hipótese.`;
      const br = normalizePhone(v, { defaultCountry: "BR" });
      return br.status === "valid"
        ? `Sem código do país e sem país no cadastro; leitura como Brasil (${maskPhone(br.e164)}) é só hipótese.`
        : "Sem código do país e sem país no cadastro.";
    }
    case "ambiguous":
      return `Mais de uma leitura possível (${(r.candidates ?? []).map(maskPhone).join(" ou ")}).`;
    case "multiple":
      return `${r.candidates?.length ?? 2} números no mesmo campo; nenhum escolhido automaticamente.`;
    case "extension_only":
      return "Só ramal, sem número.";
    case "too_long":
      return "Mais dígitos que o permitido para o país.";
    case "invalid":
      return "Não corresponde ao plano de numeração do país (código de área, prefixo ou tamanho).";
    default:
      return null;
  }
}

export type PhoneRunRow = {
  id: string;
  parent_run_id: string | null;
  status: string;
  created_at: string;
  finished_at: string | null;
  counts: unknown;
};

/**
 * Reconcilia várias execuções: a base é a VARREDURA mais recente (sem mãe),
 * nunca simplesmente a última execução — uma correção posterior parcial não
 * pode virar a referência (teria 0 pendentes). Correções concluídas filhas da
 * base somam o que resolveram por campo/tipo.
 */
export function reconcilePhoneRuns(runs: PhoneRunRow[]) {
  const base =
    [...runs]
      .filter((r) => !r.parent_run_id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  if (!base) return null;
  const children = runs
    .filter((r) => r.parent_run_id === base.id && r.status === "done")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const resolved: Record<string, Record<string, number>> = {};
  let correctedAt: string | null = null;
  for (const c of children) {
    const r = ((c.counts as Record<string, unknown> | null)?.resolved ?? {}) as Record<
      string,
      Record<string, number>
    >;
    for (const [field, byRes] of Object.entries(r)) {
      resolved[field] ??= {};
      for (const [k, n] of Object.entries(byRes))
        resolved[field][k] = (resolved[field][k] ?? 0) + Number(n);
    }
    correctedAt = c.finished_at ?? correctedAt;
  }
  const {
    applied,
    resolved: _ignored,
    ...byField
  } = (base.counts ?? {}) as {
    applied?: Record<string, number>;
    resolved?: unknown;
  } & Record<string, Record<string, number>>;
  return {
    base,
    childIds: children.map((c) => c.id),
    counts: byField as Record<string, Record<string, number>>,
    applied: applied ?? {},
    resolved,
    correctedAt,
  };
}

/**
 * Ajusta o resumo com a contagem REAL de pendentes lida do banco (itens da
 * base sem `applied_at` e sem `resolved_at`): é ela que vale na tela; o
 * cálculo por diferença só preenche campos sem contagem real.
 */
export function withLivePending<
  T extends { rows: { field: string; pending: number }[]; pending: number },
>(summary: T, live: Record<string, number> | null): T {
  if (!live) return summary;
  const rows = summary.rows.map((r) => ({ ...r, pending: live[r.field] ?? r.pending }));
  return { ...summary, rows, pending: rows.reduce((a, r) => a + r.pending, 0) };
}
