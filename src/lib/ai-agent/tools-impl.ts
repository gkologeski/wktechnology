// Funções puras das tools de LEITURA do agente. Recebem um supabase client
// já autenticado (não dependem de getRequest()/middleware de server-fn),
// o que evita "Unauthorized" quando invocadas de dentro do streamText.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;

function safeLike(q: string) {
  return `%${q.replace(/[%_]/g, " ")}%`;
}

function searchTerms(q: string) {
  return q
    .trim()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function scoreMatch(query: string, ...values: Array<string | null | undefined>) {
  const haystack = values.filter(Boolean).join(" ").toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  const terms = searchTerms(query).map((term) => term.toLowerCase());

  if (haystack.includes(normalizedQuery)) return 0;
  if (terms.length > 1 && terms.every((term) => haystack.includes(term))) return 1;
  if (terms.some((term) => haystack.includes(term))) return 2;
  return 3;
}

function personFilters(query: string, fields: string[]) {
  const full = safeLike(query);
  const terms = searchTerms(query);
  const filters = fields.map((field) => `${field}.ilike.${full}`);

  terms.forEach((term) => {
    const like = safeLike(term);
    fields.forEach((field) => filters.push(`${field}.ilike.${like}`));
  });

  return filters.join(",");
}

export async function searchEntityImpl(
  supabase: SB,
  input: { kind: "contact" | "company" | "deal" | "lead" | "ticket"; query: string },
) {
  const like = safeLike(input.query);
  const results: Array<{ id: string; label: string; extra?: string }> = [];

  if (input.kind === "contact") {
    const { data: rows } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email, phone, company_name")
      .or(personFilters(input.query, ["first_name", "last_name", "email", "company_name"]))
      .limit(15);
    (rows ?? [])
      .sort(
        (a, b) =>
          scoreMatch(input.query, a.first_name, a.last_name, a.email, a.company_name) -
          scoreMatch(input.query, b.first_name, b.last_name, b.email, b.company_name),
      )
      .slice(0, 5)
      .forEach((r) =>
        results.push({
          id: r.id,
          label: [r.first_name, r.last_name].filter(Boolean).join(" ") || (r.email ?? "Contato"),
          extra: [r.email, r.phone, r.company_name].filter(Boolean).join(" · "),
        }),
      );
  } else if (input.kind === "company") {
    const filters = [
      `name.ilike.${like}`,
      `cnpj.ilike.${like}`,
      ...searchTerms(input.query).flatMap((term) => [
        `name.ilike.${safeLike(term)}`,
        `cnpj.ilike.${safeLike(term)}`,
      ]),
    ].join(",");
    const { data: rows } = await supabase
      .from("companies")
      .select("id, name, cnpj, description")
      .or(filters)
      .limit(15);
    (rows ?? [])
      .sort(
        (a, b) => scoreMatch(input.query, a.name, a.cnpj) - scoreMatch(input.query, b.name, b.cnpj),
      )
      .slice(0, 5)
      .forEach((r) =>
        results.push({
          id: r.id,
          label: r.name,
          extra: [r.cnpj, r.description].filter(Boolean).join(" · ") || undefined,
        }),
      );
  } else if (input.kind === "deal") {
    const { data: rows } = await supabase
      .from("deals")
      .select("id, name, value, stage")
      .ilike("name", like)
      .limit(5);
    (rows ?? []).forEach((r) =>
      results.push({ id: r.id, label: r.name, extra: `R$ ${r.value} · ${r.stage}` }),
    );
  } else if (input.kind === "lead") {
    const { data: rows } = await supabase
      .from("leads")
      .select("id, first_name, last_name, email, phone, company_name, status")
      .or(personFilters(input.query, ["first_name", "last_name", "email", "phone", "company_name"]))
      .limit(15);
    (rows ?? [])
      .sort(
        (a, b) =>
          scoreMatch(input.query, a.first_name, a.last_name, a.email, a.phone, a.company_name) -
          scoreMatch(input.query, b.first_name, b.last_name, b.email, b.phone, b.company_name),
      )
      .slice(0, 5)
      .forEach((r) =>
        results.push({
          id: r.id,
          label: [r.first_name, r.last_name].filter(Boolean).join(" ") || (r.email ?? "Lead"),
          extra: [r.email, r.phone, r.company_name, r.status].filter(Boolean).join(" · "),
        }),
      );
  } else if (input.kind === "ticket") {
    const { data: rows } = await supabase
      .from("tickets")
      .select("id, subject, status, stage")
      .ilike("subject", like)
      .limit(5);
    (rows ?? []).forEach((r) =>
      results.push({ id: r.id, label: r.subject, extra: `${r.stage} · ${r.status}` }),
    );
  }
  return { kind: input.kind, results };
}

export async function listPipelinesImpl(supabase: SB, input: { kind: "deal" | "ticket" }) {
  const { data: pipelines } = await supabase
    .from("pipelines")
    .select("id, name, entity, stages")
    .eq("entity", input.kind)
    .limit(20);
  return {
    pipelines: (pipelines ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      stages: Array.isArray(p.stages)
        ? (p.stages as Array<{ id?: string; key?: string; label?: string; name?: string }>).map(
            (s) => ({
              id: String(s.id ?? s.key ?? s.name ?? ""),
              label: String(s.label ?? s.name ?? s.id ?? ""),
            }),
          )
        : [],
    })),
  };
}

export async function lookupUserImpl(supabase: SB, input: { query: string }) {
  const like = safeLike(input.query);
  const { data: rows } = await supabase
    .from("profiles")
    .select("id, full_name")
    .ilike("full_name", like)
    .limit(5);
  return {
    users: (rows ?? []).map((r) => ({ id: r.id, label: r.full_name || "Usuário" })),
  };
}
