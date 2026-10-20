// Vínculos canônicos da conciliação (server-only). Gravação só por funções do banco
// que conferem admin ativo e Ver Como; leitura pelo cliente do usuário (RLS).
import { fail, type Db, type ReconCtx } from "./reconciliation.server";

export async function applyExactLinks(supabase: Db, ctx: ReconCtx) {
  const { data, error } = await supabase.rpc("project_links_apply_exact", {
    p_ws: ctx.workspaceId,
  });
  if (error) fail("Não foi possível aplicar os vínculos", error);
  return data as Record<string, number | string>;
}

export async function loadLinks(supabase: Db, ctx: ReconCtx) {
  const [people, sugg, projects, batches] = await Promise.all([
    supabase.rpc("project_link_people_overview", { p_ws: ctx.workspaceId }),
    supabase
      .from("project_link_suggestions")
      .select("id, kind, provider, subject_id, candidate_id, criterion, status, note, decided_at")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("projects")
      .select("id, name, company_id, metadata")
      .eq("workspace_id", ctx.workspaceId)
      .order("name")
      .limit(2000),
    supabase
      .from("project_link_batches")
      .select("id, kind, counts, created_at, actor")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const err = people.error ?? sugg.error ?? projects.error ?? batches.error;
  if (err) fail("Não foi possível carregar os vínculos", err);
  const personIds = new Set<string>();
  const companyIds = new Set<string>();
  for (const s of sugg.data ?? [])
    (s.kind === "person" ? personIds : companyIds).add(s.candidate_id);
  for (const p of people.data ?? []) for (const id of p.person_ids ?? []) personIds.add(id);
  for (const p of projects.data ?? []) if (p.company_id) companyIds.add(p.company_id);
  const [pe, co] = await Promise.all([
    personIds.size
      ? supabase
          .from("people")
          .select("id, full_name, email")
          .in("id", [...personIds])
      : Promise.resolve({
          data: [] as Array<{ id: string; full_name: string; email: string | null }>,
        }),
    companyIds.size
      ? supabase
          .from("companies")
          .select("id, name")
          .in("id", [...companyIds])
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);
  const personName = new Map((pe.data ?? []).map((r) => [r.id, r.full_name]));
  const companyName = new Map((co.data ?? []).map((r) => [r.id, r.name]));
  const userName = new Map((people.data ?? []).map((r) => [r.user_id, r.user_name]));
  const projectName = new Map((projects.data ?? []).map((r) => [r.id, r.name]));
  const sourceOf = (meta: unknown) => {
    const m = (meta ?? {}) as Record<string, unknown>;
    return m.clockify ? "clockify" : m.jibble ? "jibble" : "erp";
  };
  return {
    people: (people.data ?? []).map((r) => ({
      userId: r.user_id,
      userName: r.user_name,
      memberStatus: r.member_status,
      entries: Number(r.entries),
      entriesWithPerson: Number(r.entries_with_person),
      persons: (r.person_ids ?? []).map((id) => ({ id, name: personName.get(id) ?? null })),
      suggestions: Number(r.suggestions),
      linkedByTrace: Number(r.linked_by_trace),
    })),
    projects: (projects.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      source: sourceOf(p.metadata),
      companyId: p.company_id,
      companyName: p.company_id ? (companyName.get(p.company_id) ?? null) : null,
    })),
    suggestions: (sugg.data ?? []).map((s) => ({
      ...s,
      subjectName:
        s.kind === "person"
          ? (userName.get(s.subject_id) ?? null)
          : (projectName.get(s.subject_id) ?? null),
      candidateName:
        s.kind === "person"
          ? (personName.get(s.candidate_id) ?? null)
          : (companyName.get(s.candidate_id) ?? null),
    })),
    batches: batches.data ?? [],
  };
}

export async function decideSuggestions(
  supabase: Db,
  ctx: ReconCtx,
  input: { ids: string[]; action: "confirm" | "reject"; note: string | null },
) {
  const { data, error } = await supabase.rpc("project_link_suggestions_decide", {
    p_ws: ctx.workspaceId,
    p_ids: input.ids,
    p_action: input.action,
    p_note: input.note ?? "",
  });
  if (error) fail("Não foi possível registrar a decisão", error);
  return data as Record<string, number | string>;
}

export async function revertLinks(
  supabase: Db,
  ctx: ReconCtx,
  input: { kind: "company" | "person"; subjectIds: string[] },
) {
  const { data, error } = await supabase.rpc("project_links_revert", {
    p_ws: ctx.workspaceId,
    p_kind: input.kind,
    p_subject_ids: input.subjectIds,
  });
  if (error) fail("Não foi possível desvincular", error);
  return data as Record<string, number | string>;
}
