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

/**
 * Filtros por termo: CADA termo precisa casar em algum campo (E entre termos).
 * Antes um único termo comum ("Silva") trazia qualquer pessoa.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyTermFilters<Q extends { or: (f: string) => any }>(
  q: Q,
  query: string,
  fields: string[],
): Q {
  let out = q;
  for (const term of searchTerms(query)) {
    const like = safeLike(term).replace(/[,()]/g, " ");
    out = out.or(fields.map((field) => `${field}.ilike.${like}`).join(","));
  }
  return out;
}

export async function searchEntityImpl(
  supabase: SB,
  input: { kind: "contact" | "company" | "deal" | "lead" | "ticket"; query: string },
  /** Workspace ativo resolvido no servidor (nunca vindo da IA). */
  workspaceId: string,
) {
  if (!workspaceId) throw new Error("Workspace ativo não identificado.");
  const like = safeLike(input.query);
  const results: Array<{ id: string; label: string; extra?: string }> = [];

  if (input.kind === "contact") {
    const { data: rows } = await applyTermFilters(
      supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone, company_name")
        .eq("workspace_id", workspaceId),
      input.query,
      ["first_name", "last_name", "email", "phone", "company_name"],
    ).limit(15);
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
    const { data: rows } = await applyTermFilters(
      supabase
        .from("companies")
        .select("id, name, cnpj, description")
        .eq("workspace_id", workspaceId),
      input.query,
      ["name", "cnpj"],
    ).limit(15);
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
      .eq("workspace_id", workspaceId)
      .ilike("name", like)
      .limit(5);
    (rows ?? []).forEach((r) =>
      results.push({ id: r.id, label: r.name, extra: `R$ ${r.value} · ${r.stage}` }),
    );
  } else if (input.kind === "lead") {
    const { data: rows } = await applyTermFilters(
      supabase
        .from("leads")
        .select("id, first_name, last_name, email, phone, company_name, status")
        .eq("workspace_id", workspaceId),
      input.query,
      ["first_name", "last_name", "email", "phone", "company_name"],
    ).limit(15);
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
      .eq("workspace_id", workspaceId)
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
