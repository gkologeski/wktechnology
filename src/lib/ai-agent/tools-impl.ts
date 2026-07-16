// Funções puras das tools de LEITURA do agente. Recebem um supabase client
// já autenticado (não dependem de getRequest()/middleware de server-fn),
// o que evita "Unauthorized" quando invocadas de dentro do streamText.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;

function safeLike(q: string) {
  return `%${q.replace(/[%_]/g, " ")}%`;
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
      .or(
        `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},company_name.ilike.${like}`,
      )
      .limit(5);
    (rows ?? []).forEach((r) =>
      results.push({
        id: r.id,
        label: [r.first_name, r.last_name].filter(Boolean).join(" ") || (r.email ?? "Contato"),
        extra: [r.email, r.phone, r.company_name].filter(Boolean).join(" · "),
      }),
    );
  } else if (input.kind === "company") {
    const { data: rows } = await supabase
      .from("companies")
      .select("id, name, cnpj, description")
      .ilike("name", like)
      .limit(5);
    (rows ?? []).forEach((r) =>
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
      .select("id, first_name, last_name, email, status")
      .or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`)
      .limit(5);
    (rows ?? []).forEach((r) =>
      results.push({
        id: r.id,
        label: [r.first_name, r.last_name].filter(Boolean).join(" ") || (r.email ?? "Lead"),
        extra: [r.email, r.status].filter(Boolean).join(" · "),
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
