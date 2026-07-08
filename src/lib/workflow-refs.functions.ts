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
      // supabaseAdmin.auth.admin.listUsers não permite filtro por id-set —
      // fazemos uma consulta direta na tabela auth.users via rpc-safe select.
      const { data: users } = await supabaseAdmin
        .schema("auth" as never)
        .from("users" as never)
        .select("id, email")
        .in("id", missingName);
      ((users ?? []) as Array<{ id: string; email: string | null }>).forEach((u) => {
        if (u.email) emailById.set(u.id, u.email);
      });
    }

    const results = idList.map((id) => {
      const name = nameById.get(id) || emailById.get(id) || `${id.slice(0, 8)}…`;
      return { id, name, is_member: memberIds.has(id) };
    });

    // Filtra por q se veio, e prioriza membros do workspace nas sugestões livres.
    const q = data.q?.trim().toLowerCase();
    let filtered = data.ids && data.ids.length > 0 ? results : results.filter((r) => r.is_member);
    if (q) filtered = filtered.filter((r) => r.name.toLowerCase().includes(q));
    filtered.sort((a, b) => a.name.localeCompare(b.name));
    return filtered.slice(0, LIMIT);
  });
