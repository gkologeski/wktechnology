// Server functions para o construtor de Workflows resolverem referências
// (empresas, pipelines, usuários) respeitando as policies RLS do usuário atual.
//
// - Busca livre por nome via `q` (ilike) para popular combobox.
// - Hidratação por `ids` para exibir rótulos de valores já salvos.
//
// Usa `context.supabase` (cliente autenticado, RLS aplica). Para `searchUsers`
// com `ids`, hidrata nomes/e-mails de usuários fora do workspace via
// supabaseAdmin — apenas para os IDs recebidos (não é busca livre, evita
// vazar diretório completo).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RefInput = z.object({
  q: z.string().trim().max(120).optional(),
  ids: z.array(z.string().uuid()).max(50).optional(),
});

const LIMIT = 50;

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export const searchCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RefInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.ids && data.ids.length > 0) {
      const { data: rows, error } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", data.ids);
      if (error) throw new Error(error.message);
      return (rows ?? []) as Array<{ id: string; name: string }>;
    }
    const q = data.q?.trim();
    let query = supabase.from("companies").select("id, name").order("name").limit(LIMIT);
    if (q) query = query.ilike("name", `%${escapeLike(q)}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{ id: string; name: string }>;
  });

export const searchPipelines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RefInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.ids && data.ids.length > 0) {
      const { data: rows, error } = await supabase
        .from("pipelines")
        .select("id, name")
        .in("id", data.ids);
      if (error) throw new Error(error.message);
      return (rows ?? []) as Array<{ id: string; name: string }>;
    }
    const q = data.q?.trim();
    let query = supabase.from("pipelines").select("id, name").order("name").limit(LIMIT);
    if (q) query = query.ilike("name", `%${escapeLike(q)}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{ id: string; name: string }>;
  });

export const searchContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RefInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const toName = (r: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    }) => {
      const full = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim();
      return { id: r.id, name: full || (r.email ?? "") || "" };
    };
    if (data.ids && data.ids.length > 0) {
      const { data: rows, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email")
        .in("id", data.ids);
      if (error) throw new Error(error.message);
      return (rows ?? []).map(toName);
    }
    const q = data.q?.trim();
    let query = supabase
      .from("contacts")
      .select("id, first_name, last_name, email")
      .order("last_name", { ascending: true, nullsFirst: false })
      .order("first_name", { ascending: true, nullsFirst: false })
      .limit(LIMIT);
    if (q) {
      const like = `%${escapeLike(q)}%`;
      query = query.or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map(toName);
  });

/**
 * Busca / hidrata usuários para uso no FkPicker.
 *
 * - Sugestões livres (`q`): retorna somente membros do workspace atual
 *   (mesma fonte de `listWorkspaceMembers`), filtrados por nome.
 * - Hidratação por `ids`: se algum ID não estiver no workspace atual,
 *   busca `profiles.full_name` + `auth.users.email` via supabaseAdmin
 *   APENAS para esses IDs — sem listar diretório completo.
 */
export const searchUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RefInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Coleta membros do workspace atual (mesma lógica que listWorkspaceMembers).
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_workspace_id")
      .eq("id", userId)
      .maybeSingle();
    let activeWorkspaceId =
      (profile as { active_workspace_id: string | null } | null)?.active_workspace_id ?? null;
    if (!activeWorkspaceId) {
      const { data: firstMembership } = await supabaseAdmin
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      activeWorkspaceId = (firstMembership?.workspace_id as string | undefined) ?? null;
    }

    const memberIds = new Set<string>([userId]);
    if (activeWorkspaceId) {
      const { data: wsMembers } = await supabaseAdmin
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", activeWorkspaceId);
      (wsMembers ?? []).forEach((m) => memberIds.add(m.user_id as string));
      const { data: ws } = await supabaseAdmin
        .from("workspaces")
        .select("owner_id")
        .eq("id", activeWorkspaceId)
        .maybeSingle();
      const ownerId = (ws as { owner_id: string | null } | null)?.owner_id ?? null;
      if (ownerId) memberIds.add(ownerId);
    }
    // Fallback legado
    const { data: legacyMembers } = await supabaseAdmin
      .from("team_members")
      .select("member_user_id, workspace_owner_id")
      .or(`workspace_owner_id.eq.${userId},member_user_id.eq.${userId}`);
    (legacyMembers ?? []).forEach((m) => {
      memberIds.add(m.member_user_id as string);
      memberIds.add(m.workspace_owner_id as string);
    });

    // IDs a resolver: workspace members + ids externos pedidos.
    const wanted = new Set<string>();
    if (data.ids && data.ids.length > 0) {
      data.ids.forEach((id) => wanted.add(id));
    }
    memberIds.forEach((id) => wanted.add(id));

    const idList = Array.from(wanted);
    if (idList.length === 0) return [];

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", idList);
    const nameById = new Map(
      (profiles ?? []).map((p) => [p.id as string, ((p.full_name as string | null) ?? "").trim()]),
    );

    // Precisamos de e-mail como fallback: busca em auth.users APENAS para
    // ids que faltam nome.
    const missingName = idList.filter((id) => !nameById.get(id));
    const emailById = new Map<string, string>();
    if (missingName.length > 0) {
      // getUserById um a um — a Admin API não suporta filtro por id-set.
      // Lista sempre pequena (usuários fora do workspace referenciados no workflow).
      const lookups = await Promise.all(
        missingName.map((id) => supabaseAdmin.auth.admin.getUserById(id).catch(() => null)),
      );
      lookups.forEach((res, i) => {
        const email = res?.data?.user?.email;
        if (email) emailById.set(missingName[i], email);
      });
    }

    const results = idList.map((id) => {
      // Fallback em cascata: nome do perfil → e-mail → identificador curto.
      // Nunca devolvemos o UUID cru para a interface.
      const name = nameById.get(id) || emailById.get(id) || `Usuário ${id.slice(0, 8)}`;
      return { id, name, is_member: memberIds.has(id) };
    });

    // Filtra por q se veio, e prioriza membros do workspace nas sugestões livres.
    const q = data.q?.trim().toLowerCase();
    let filtered = data.ids && data.ids.length > 0 ? results : results.filter((r) => r.is_member);
    if (q) filtered = filtered.filter((r) => r.name.toLowerCase().includes(q));
    filtered.sort((a, b) => a.name.localeCompare(b.name));
    return filtered.slice(0, LIMIT);
  });

// ---------------------------------------------------------------------------
// Busca de registros de qualquer entidade suportada por Workflows.
// Usada pelo diálogo "Testar workflow" para permitir seleção de um registro
// sem que o usuário precise digitar UUID. Respeita RLS (context.supabase).
// ---------------------------------------------------------------------------

const WorkflowEntityEnum = z.enum([
  "leads",
  "contacts",
  "companies",
  "deals",
  "tickets",
  "ats_jobs",
  "ats_candidates",
  "ats_applications",
  "ats_interviews",
]);

const EntitySearchInput = z.object({
  entity: WorkflowEntityEnum,
  q: z.string().trim().max(120).optional(),
  ids: z.array(z.string().uuid()).max(50).optional(),
});

type EntityRecord = { id: string; label: string };

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const searchEntityRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => EntitySearchInput.parse(i))
  .handler(async ({ data, context }): Promise<EntityRecord[]> => {
    const { supabase } = context;
    const q = data.q?.trim();
    const like = q ? `%${escapeLike(q)}%` : null;
    const ids = data.ids && data.ids.length > 0 ? data.ids : null;

    switch (data.entity) {
      case "leads": {
        let query = supabase
          .from("leads")
          .select("id, first_name, last_name, email, company_name, updated_at")
          .order("updated_at", { ascending: false })
          .limit(LIMIT);
        if (ids) query = query.in("id", ids);
        else if (like)
          query = query.or(
            `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},company_name.ilike.${like}`,
          );
        const { data: rows, error } = await query;
        if (error) throw new Error(error.message);
        return (rows ?? []).map((r) => {
          const name = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim();
          const company = (r.company_name as string | null) ?? "";
          const base = name || (r.email as string | null) || "";
          return {
            id: r.id as string,
            label: company ? `${base} — ${company}` : base || "(sem nome)",
          };
        });
      }
      case "contacts": {
        let query = supabase
          .from("contacts")
          .select("id, first_name, last_name, email, updated_at")
          .order("updated_at", { ascending: false })
          .limit(LIMIT);
        if (ids) query = query.in("id", ids);
        else if (like)
          query = query.or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`);
        const { data: rows, error } = await query;
        if (error) throw new Error(error.message);
        return (rows ?? []).map((r) => {
          const name = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim();
          return {
            id: r.id as string,
            label: name || (r.email as string | null) || "(sem nome)",
          };
        });
      }
      case "companies": {
        let query = supabase
          .from("companies")
          .select("id, name, updated_at")
          .order("updated_at", { ascending: false })
          .limit(LIMIT);
        if (ids) query = query.in("id", ids);
        else if (like) query = query.ilike("name", like);
        const { data: rows, error } = await query;
        if (error) throw new Error(error.message);
        return (rows ?? []).map((r) => ({
          id: r.id as string,
          label: (r.name as string | null) || "(sem nome)",
        }));
      }
      case "deals": {
        let query = supabase
          .from("deals")
          .select("id, name, updated_at")
          .order("updated_at", { ascending: false })
          .limit(LIMIT);
        if (ids) query = query.in("id", ids);
        else if (like) query = query.ilike("name", like);
        const { data: rows, error } = await query;
        if (error) throw new Error(error.message);
        return (rows ?? []).map((r) => ({
          id: r.id as string,
          label: (r.name as string | null) || "(sem nome)",
        }));
      }
      case "tickets": {
        let query = supabase
          .from("tickets")
          .select("id, subject, updated_at")
          .order("updated_at", { ascending: false })
          .limit(LIMIT);
        if (ids) query = query.in("id", ids);
        else if (like) query = query.ilike("subject", like);
        const { data: rows, error } = await query;
        if (error) throw new Error(error.message);
        return (rows ?? []).map((r) => ({
          id: r.id as string,
          label: (r.subject as string | null) || "(sem assunto)",
        }));
      }
      case "ats_jobs": {
        let query = supabase
          .from("ats_jobs")
          .select("id, title, updated_at")
          .order("updated_at", { ascending: false })
          .limit(LIMIT);
        if (ids) query = query.in("id", ids);
        else if (like) query = query.ilike("title", like);
        const { data: rows, error } = await query;
        if (error) throw new Error(error.message);
        return (rows ?? []).map((r) => ({
          id: r.id as string,
          label: (r.title as string | null) || "(sem título)",
        }));
      }
      case "ats_candidates": {
        let query = supabase
          .from("ats_candidates")
          .select("id, full_name, email, updated_at")
          .order("updated_at", { ascending: false })
          .limit(LIMIT);
        if (ids) query = query.in("id", ids);
        else if (like) query = query.or(`full_name.ilike.${like},email.ilike.${like}`);
        const { data: rows, error } = await query;
        if (error) throw new Error(error.message);
        return (rows ?? []).map((r) => ({
          id: r.id as string,
          label:
            ((r.full_name as string | null) ?? "").trim() ||
            (r.email as string | null) ||
            "(sem nome)",
        }));
      }
      case "ats_applications": {
        let query = supabase
          .from("ats_applications")
          .select("id, updated_at, candidate:ats_candidates(full_name, email), job:ats_jobs(title)")
          .order("updated_at", { ascending: false })
          .limit(LIMIT);
        if (ids) query = query.in("id", ids);
        const { data: rows, error } = await query;
        if (error) throw new Error(error.message);
        type Row = {
          id: string;
          candidate: { full_name: string | null; email: string | null } | null;
          job: { title: string | null } | null;
        };
        let mapped = ((rows ?? []) as unknown as Row[]).map((r) => {
          const cand = (r.candidate?.full_name ?? "").trim() || r.candidate?.email || "Candidato";
          const job = r.job?.title || "Vaga";
          return { id: r.id, label: `${cand} — ${job}` };
        });
        if (!ids && q) {
          const needle = q.toLowerCase();
          mapped = mapped.filter((m) => m.label.toLowerCase().includes(needle));
        }
        return mapped;
      }
      case "ats_interviews": {
        let query = supabase
          .from("ats_interviews")
          .select(
            "id, scheduled_at, updated_at, candidate:ats_candidates(full_name, email), job:ats_jobs(title)",
          )
          .order("scheduled_at", { ascending: false, nullsFirst: false })
          .limit(LIMIT);
        if (ids) query = query.in("id", ids);
        const { data: rows, error } = await query;
        if (error) throw new Error(error.message);
        type Row = {
          id: string;
          scheduled_at: string | null;
          candidate: { full_name: string | null; email: string | null } | null;
          job: { title: string | null } | null;
        };
        let mapped = ((rows ?? []) as unknown as Row[]).map((r) => {
          const cand = (r.candidate?.full_name ?? "").trim() || r.candidate?.email || "Candidato";
          const when = fmtDate(r.scheduled_at);
          const job = r.job?.title;
          const parts = [cand, job, when].filter(Boolean);
          return { id: r.id, label: parts.join(" — ") };
        });
        if (!ids && q) {
          const needle = q.toLowerCase();
          mapped = mapped.filter((m) => m.label.toLowerCase().includes(needle));
        }
        return mapped;
      }
    }
  });

/** Empresas do grupo (legal_entities) — usado em `contracting_legal_entity_id`. */
export const searchLegalEntities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RefInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const toName = (r: {
      id: string;
      name: string | null;
      trade_name: string | null;
      cnpj: string | null;
    }) => ({
      id: r.id,
      name:
        [(r.trade_name ?? "").trim() || (r.name ?? "").trim(), r.cnpj ?? ""]
          .filter(Boolean)
          .join(" · ") || "Empresa sem nome",
    });
    if (data.ids && data.ids.length > 0) {
      const { data: rows, error } = await supabase
        .from("legal_entities")
        .select("id, name, trade_name, cnpj")
        .in("id", data.ids);
      if (error) throw new Error(error.message);
      return (rows ?? []).map(toName);
    }
    const q = data.q?.trim();
    let query = supabase
      .from("legal_entities")
      .select("id, name, trade_name, cnpj")
      .order("name")
      .limit(LIMIT);
    if (q) {
      const like = `%${escapeLike(q)}%`;
      query = query.or(`name.ilike.${like},trade_name.ilike.${like},cnpj.ilike.${like}`);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map(toName);
  });

/** Contratos — usado em `parent_contract_id` (contrato-pai / aditivo). */
export const searchContracts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RefInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const toName = (r: { id: string; number: string | null; title: string | null }) => ({
      id: r.id,
      name: [r.number, (r.title ?? "").trim()].filter(Boolean).join(" — ") || "Contrato sem título",
    });
    if (data.ids && data.ids.length > 0) {
      const { data: rows, error } = await supabase
        .from("contracts")
        .select("id, number, title")
        .in("id", data.ids);
      if (error) throw new Error(error.message);
      return (rows ?? []).map(toName);
    }
    const q = data.q?.trim();
    let query = supabase
      .from("contracts")
      .select("id, number, title")
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    if (q) {
      const like = `%${escapeLike(q)}%`;
      query = query.or(`title.ilike.${like},number.ilike.${like}`);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map(toName);
  });
