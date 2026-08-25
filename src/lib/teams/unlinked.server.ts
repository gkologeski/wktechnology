// Helpers server-only para contas órfãs (usuários autenticados sem vínculo
// com nenhum workspace). Usados por src/lib/teams/unlinked.functions.ts.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type UnlinkedAccount = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  same_domain: boolean;
};

export async function isPlatformAdminUser(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

/** Workspace ativo do usuário (com fallback para o primeiro vínculo). */
export async function resolveWorkspaceId(userId: string): Promise<{
  id: string;
  created_by: string | null;
}> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  const activeId =
    (profile as { active_workspace_id?: string | null } | null)?.active_workspace_id ?? null;

  const candidateIds: string[] = [];
  if (activeId) candidateIds.push(activeId);
  const { data: first } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  const firstId = (first as { workspace_id?: string } | null)?.workspace_id;
  if (firstId) candidateIds.push(firstId);

  for (const id of candidateIds) {
    const { data: ws } = await supabaseAdmin
      .from("workspaces")
      .select("id, created_by")
      .eq("id", id)
      .maybeSingle();
    if (ws) {
      return { id: ws.id as string, created_by: (ws.created_by as string | null) ?? null };
    }
  }
  throw new Error("Nenhum workspace ativo encontrado.");
}

export async function assertWorkspaceAdmin(workspaceId: string, userId: string): Promise<void> {
  if (await isPlatformAdminUser(userId)) return;
  const { data, error } = await supabaseAdmin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || (data as { role: string }).role !== "admin") {
    throw new Error("Apenas admins do workspace podem gerenciar usuários.");
  }
}

async function listAllAuthUsers(): Promise<
  Array<{
    id: string;
    email: string | null;
    created_at: string | null;
    last_sign_in_at: string | null;
  }>
> {
  const out: Array<{
    id: string;
    email: string | null;
    created_at: string | null;
    last_sign_in_at: string | null;
  }> = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    for (const u of users) {
      out.push({
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
      });
    }
    if (users.length < 200) break;
  }
  return out;
}

function domainOf(email: string | null): string | null {
  if (!email || !email.includes("@")) return null;
  return email.split("@").pop()!.toLowerCase();
}

/** Contas com login mas sem vínculo em workspace_members nem team_members. */
export async function findUnlinkedAccounts(workspaceId: string): Promise<UnlinkedAccount[]> {
  const [{ data: wm }, { data: tm }, users, { data: profiles }] = await Promise.all([
    supabaseAdmin.from("workspace_members").select("user_id"),
    supabaseAdmin.from("team_members").select("member_user_id"),
    listAllAuthUsers(),
    supabaseAdmin.from("profiles").select("id, full_name"),
  ]);

  const linked = new Set<string>();
  for (const r of (wm as { user_id: string }[] | null) ?? []) linked.add(r.user_id);
  for (const r of (tm as { member_user_id: string }[] | null) ?? []) linked.add(r.member_user_id);

  const nameById = new Map<string, string | null>(
    ((profiles as { id: string; full_name: string | null }[] | null) ?? []).map((p) => [
      p.id,
      p.full_name,
    ]),
  );

  // Domínios de email já presentes no workspace atual, para destacar contas
  // que provavelmente pertencem à mesma organização.
  const { data: members } = await supabaseAdmin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId);
  const memberIds = new Set(
    ((members as { user_id: string }[] | null) ?? []).map((m) => m.user_id),
  );
  const domains = new Set<string>();
  for (const u of users) {
    if (memberIds.has(u.id)) {
      const d = domainOf(u.email);
      if (d) domains.add(d);
    }
  }

  return users
    .filter((u) => !linked.has(u.id))
    .map((u) => ({
      user_id: u.id,
      email: u.email,
      full_name: nameById.get(u.id) ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      same_domain: !!domainOf(u.email) && domains.has(domainOf(u.email)!),
    }))
    .sort((a, b) => {
      if (a.same_domain !== b.same_domain) return a.same_domain ? -1 : 1;
      return (a.email ?? "").localeCompare(b.email ?? "");
    });
}

/** Vincula a conta ao workspace, replicando o vínculo legado e o perfil de acesso. */
export async function linkAccountToWorkspace(input: {
  workspaceId: string;
  workspaceCreatedBy: string | null;
  userId: string;
  role: "admin" | "manager" | "member";
}): Promise<void> {
  const { workspaceId, workspaceCreatedBy, userId, role } = input;

  const { error: wmErr } = await supabaseAdmin
    .from("workspace_members")
    .upsert({ workspace_id: workspaceId, user_id: userId, role } as never, {
      onConflict: "workspace_id,user_id",
    });
  if (wmErr) throw new Error(wmErr.message);

  // Perfil de acesso equivalente ao papel escolhido (tabela legada team_members).
  let accessProfileId: string | null = null;
  if (workspaceCreatedBy) {
    const { data: ap } = await supabaseAdmin
      .from("access_profiles")
      .select("id")
      .eq("workspace_owner_id", workspaceCreatedBy)
      .eq("base_role", role)
      .limit(1)
      .maybeSingle();
    accessProfileId = (ap as { id?: string } | null)?.id ?? null;
  }

  const { error: tmErr } = await supabaseAdmin.from("team_members").upsert(
    {
      workspace_owner_id: workspaceId,
      member_user_id: userId,
      role,
      access_profile_id: accessProfileId,
    } as never,
    { onConflict: "workspace_owner_id,member_user_id" },
  );
  if (tmErr) throw new Error(tmErr.message);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  const active = (profile as { active_workspace_id?: string | null } | null)?.active_workspace_id;
  if (!active) {
    await supabaseAdmin
      .from("profiles")
      .update({ active_workspace_id: workspaceId } as never)
      .eq("id", userId);
  }
}
