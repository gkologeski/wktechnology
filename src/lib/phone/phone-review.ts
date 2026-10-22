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
  "changed_since_dry_run",
] as const;
export type PhoneReviewClass = (typeof PHONE_REVIEW_CLASSES)[number];

export const PHONE_SAFE_CLASSES = ["safe_explicit", "safe_record_country", "placeholder"] as const;

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

/** Resumo por campo a partir das contagens da execução. */
export function summarizePhoneRun(
  counts: Record<string, Record<string, number>>,
  applied: Record<string, number>,
) {
  const review = new Set<string>(PHONE_REVIEW_CLASSES);
  const rows = Object.entries(counts).map(([field, byClass]) => {
    const total = Object.values(byClass).reduce((a, b) => a + b, 0);
    const canonical = byClass.already_canonical ?? 0;
    const pending = Object.entries(byClass)
      .filter(([k]) => review.has(k))
      .reduce((a, [, n]) => a + n, 0);
    return { field, total, canonical, applied: applied[field] ?? 0, pending };
  });
  rows.sort((a, b) => b.total - a.total);
  const sum = (k: "total" | "canonical" | "applied" | "pending") =>
    rows.reduce((a, r) => a + r[k], 0);
  return {
    rows,
    total: sum("total"),
    canonical: sum("canonical"),
    applied: sum("applied"),
    pending: sum("pending"),
  };
}
