// Server functions para Teams (gerenciar membros do workspace).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TeamRole = z.enum(["admin", "manager", "member"]);
export type TeamRole = z.infer<typeof TeamRole>;

type ActiveWorkspace = { id: string; created_by: string | null };

/** URL canônica de produção do CRM — usada para links de convite por email. */
const CANONICAL_APP_URL = "https://app.wktechnology.com.br";

/**
 * Resolve o origin para o link do convite. Se vier de um host do Lovable
 * (preview/sandbox/dev), substitui pela URL canônica de produção para que
 * o convidado caia no CRM e não no editor do Lovable.
 */
function resolveInviteOrigin(origin: string | undefined): string {
  if (!origin) return CANONICAL_APP_URL;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (
      host.endsWith("lovable.app") ||
      host.endsWith("lovable.dev") ||
      host.endsWith("lovableproject.com")
    ) {
      return CANONICAL_APP_URL;
    }
    return origin.replace(/\/+$/, "");
  } catch {
    return CANONICAL_APP_URL;
  }
}

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  admin: "Admin",
  manager: "Gestor",
  member: "Membro",
};

async function isPlatformAdmin(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

async function resolveActiveWorkspace(userId: string): Promise<ActiveWorkspace> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = await isPlatformAdmin(userId);
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();

  const activeId =
    (profile as { active_workspace_id?: string | null } | null)?.active_workspace_id ?? null;
  if (activeId) {
    if (admin) {
      const { data: ws, error } = await supabaseAdmin
        .from("workspaces")
        .select("id, created_by")
        .eq("id", activeId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (ws) return { id: ws.id as string, created_by: (ws.created_by as string | null) ?? null };
    }

    const { data: membership, error: memErr } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", activeId)
      .eq("user_id", userId)
      .maybeSingle();
    if (memErr) throw new Error(memErr.message);
    if (membership) {
      const { data: ws, error } = await supabaseAdmin
        .from("workspaces")
        .select("id, created_by")
        .eq("id", activeId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (ws) return { id: ws.id as string, created_by: (ws.created_by as string | null) ?? null };
    }
  }

  const { data: first, error } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id, workspaces:workspace_id(id, created_by)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const workspace = (
    first as { workspaces?: { id: string; created_by: string | null } | null } | null
  )?.workspaces;
  if (workspace) return { id: workspace.id, created_by: workspace.created_by };

  throw new Error("Nenhum workspace ativo encontrado.");
}

async function assertCanManageWorkspace(workspaceId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (await isPlatformAdmin(userId)) return;
  const { data, error } = await supabaseAdmin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.role !== "admin")
    throw new Error("Apenas admins do workspace podem gerenciar usuários.");
}

async function assertTargetMember(workspaceId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Membro não encontrado neste workspace.");
}

async function syncLegacyRole(workspaceId: string, userId: string, role: TeamRole) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("team_members").upsert(
    {
      workspace_owner_id: workspaceId,
      member_user_id: userId,
      role,
    } as never,
    { onConflict: "workspace_owner_id,member_user_id" },
  );
}

/** Lista membros + email (do auth.users via admin) + cargos funcionais. */
export const listTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const workspace = await resolveActiveWorkspace(userId);
    await assertCanManageWorkspace(workspace.id, userId);

    const { data: members, error: membersErr } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id, user_id, role, joined_at")
      .eq("workspace_id", workspace.id)
      .order("joined_at", { ascending: true });
    if (membersErr) throw new Error(membersErr.message);

    const ids = Array.from(new Set((members ?? []).map((m) => m.user_id as string)));

    // Use admin client: profiles RLS only allows reading own row, but the
    // workspace owner needs name/phone of every member to render the list.
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", ids);
    const nameById = new Map(
      (profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? ""]),
    );
    const phoneById = new Map(
      (profiles ?? []).map((p) => [
        p.id as string,
        ((p as { phone?: string | null }).phone ?? "") as string,
      ]),
    );

    // Buscar email + status de confirmação via admin (auth.users)
    const emailById = new Map<string, string>();
    const confirmedById = new Map<string, boolean>();
    await Promise.all(
      ids.map(async (id) => {
        try {
          const { data } = await supabaseAdmin.auth.admin.getUserById(id);
          if (data.user?.email) emailById.set(id, data.user.email);
          confirmedById.set(
            id,
            Boolean(data.user?.email_confirmed_at || data.user?.last_sign_in_at),
          );
        } catch {
          /* ignore */
        }
      }),
    );

    // Cargos funcionais (user_job_roles) e pacotes extras (user_permission_sets).
    // owner_id nessas tabelas é o auth.uid do criador do workspace, então usamos
    // supabaseAdmin para ler todos os membros do workspace.
    const workspaceOwnerId = workspace.created_by ?? userId;
    const { data: userJobRoles } = await supabaseAdmin
      .from("user_job_roles")
      .select("user_id, role_id, is_primary")
      .eq("owner_id", workspaceOwnerId)
      .in("user_id", ids);
    const { data: userPermissionSets } = await supabaseAdmin
      .from("user_permission_sets")
      .select("user_id, set_id")
      .eq("owner_id", workspaceOwnerId)
      .in("user_id", ids);

    const primaryRoleByUser = new Map<string, string>();
    const roleIdsByUser = new Map<string, string[]>();
    for (const r of (userJobRoles ?? []) as Array<{
      user_id: string;
      role_id: string;
      is_primary: boolean;
    }>) {
      const arr = roleIdsByUser.get(r.user_id) ?? [];
      arr.push(r.role_id);
      roleIdsByUser.set(r.user_id, arr);
      if (r.is_primary) primaryRoleByUser.set(r.user_id, r.role_id);
    }
    const extraSetIdsByUser = new Map<string, string[]>();
    for (const s of (userPermissionSets ?? []) as Array<{ user_id: string; set_id: string }>) {
      const arr = extraSetIdsByUser.get(s.user_id) ?? [];
      arr.push(s.set_id);
      extraSetIdsByUser.set(s.user_id, arr);
    }

    const memberRows = (members ?? []).map((m) => ({
      id: `${m.workspace_id as string}:${m.user_id as string}`,
      user_id: m.user_id as string,
      full_name: nameById.get(m.user_id as string) || "",
      phone: phoneById.get(m.user_id as string) ?? "",
      email: emailById.get(m.user_id as string) ?? "",
      role: m.role as TeamRole,
      is_owner: (m.user_id as string) === userId,
      pending: !confirmedById.get(m.user_id as string),
      created_at: m.joined_at as string,
      primary_role_id: primaryRoleByUser.get(m.user_id as string) ?? null,
      role_ids: roleIdsByUser.get(m.user_id as string) ?? [],
      extra_set_ids: extraSetIdsByUser.get(m.user_id as string) ?? [],
    }));

    return memberRows;
  });

/** Lista convites pendentes por token (workspace_invites) do workspace ativo. */
export const listPendingTeamInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const workspace = await resolveActiveWorkspace(userId);
    await assertCanManageWorkspace(workspace.id, userId);

    const { data: invites, error } = await supabaseAdmin
      .from("workspace_invites")
      .select("id, email, role, expires_at, created_at, accepted_at, permission_set_id")
      .eq("workspace_id", workspace.id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const setIds = Array.from(
      new Set(
        ((invites ?? []) as Array<{ permission_set_id: string | null }>)
          .map((i) => i.permission_set_id)
          .filter((v): v is string => !!v),
      ),
    );
    const setNameById = new Map<string, string>();
    if (setIds.length) {
      const { data: sets } = await supabaseAdmin
        .from("permission_sets")
        .select("id, name")
        .in("id", setIds);
      for (const s of (sets ?? []) as Array<{ id: string; name: string }>) {
        setNameById.set(s.id, s.name);
      }
    }

    return (invites ?? []).map((i) => ({
      id: i.id as string,
      email: i.email as string,
      role: i.role as TeamRole,
      expires_at: i.expires_at as string,
      created_at: i.created_at as string,
      permission_set_id: (i as { permission_set_id: string | null }).permission_set_id ?? null,
      permission_set_name: (i as { permission_set_id: string | null }).permission_set_id
        ? (setNameById.get((i as { permission_set_id: string }).permission_set_id) ?? null)
        : null,
    }));
  });

const ASSIGNED_TABLES = ["contacts", "companies", "leads", "deals"] as const;

/** Conta registros atribuídos (assigned_user_id) a um membro no workspace ativo. */
export const countAssignedToTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ member_user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const workspace = await resolveActiveWorkspace(userId);
    await assertCanManageWorkspace(workspace.id, userId);
    const counts: Record<string, number> = {};
    for (const t of ASSIGNED_TABLES) {
      const { count } = await supabaseAdmin
        .from(t)
        .select("id", { head: true, count: "exact" })
        .eq("workspace_id", workspace.id)
        .eq("assigned_user_id", data.member_user_id);
      counts[t] = count ?? 0;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return { counts, total };
  });

/** Convida (adiciona) um membro pelo email. Usuário precisa já existir no sistema. */
export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        full_name: z.string().trim().min(2, "Nome completo é obrigatório").max(120),
        phone: z.string().trim().min(8, "Telefone celular é obrigatório").max(32),
        role: TeamRole,
        redirect_origin: z.string().trim().url().max(255).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const workspace = await resolveActiveWorkspace(userId);
    await assertCanManageWorkspace(workspace.id, userId);
    const target = data.email.trim().toLowerCase();
    const redirectTo = `${resolveInviteOrigin(data.redirect_origin)}/accept-invite`;

    // ---- Enforcement: limite de usuários do plano ----
    // O owner do workspace conta como 1 usuário. Comparamos
    // (1 owner + nº de team_members atuais) com get_entitlement_limit('users.max').
    {
      const [{ data: limitRow }, { count: currentMembers }] = await Promise.all([
        supabaseAdmin.rpc("get_entitlement_limit", {
          _workspace: workspace.id,
          _key: "users.max",
        } as never),
        supabaseAdmin
          .from("workspace_members")
          .select("workspace_id", { count: "exact", head: true })
          .eq("workspace_id", workspace.id),
      ]);
      const limit = (limitRow as number | null) ?? null; // null = ilimitado
      const used = currentMembers ?? 0;
      if (limit !== null && used + 1 > limit) {
        throw new Error(
          `plan_limit_exceeded:users — seu plano permite até ${limit} usuário(s) e você já está no limite. Faça upgrade em Configurações → Planos e cobrança.`,
        );
      }
    }

    // Achar user_id por email via admin
    let foundId: string | null = null;
    let alreadyConfirmed = false;
    let page = 1;
    while (page <= 20) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw new Error(error.message);
      const u = list.users.find((u) => (u.email ?? "").toLowerCase() === target);
      if (u) {
        foundId = u.id;
        alreadyConfirmed = Boolean(u.email_confirmed_at || u.last_sign_in_at);
        break;
      }
      if (list.users.length < 200) break;
      page++;
    }

    // Se não existir OU existir mas ainda não confirmou, envia (re)convite
    if (!foundId || !alreadyConfirmed) {
      const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        target,
        {
          data: { full_name: data.full_name, phone: data.phone },
          redirectTo,
        },
      );
      if (invErr || !invited?.user) {
        throw new Error(invErr?.message ?? "Falha ao enviar convite por email.");
      }
      foundId = invited.user.id;
    }
    if (foundId === userId) throw new Error("Você já é membro deste workspace.");

    // Garante profile com nome e telefone
    await supabaseAdmin.from("profiles").upsert(
      {
        id: foundId,
        full_name: data.full_name,
        phone: data.phone,
      } as never,
      { onConflict: "id" },
    );

    const { error: insErr } = await supabaseAdmin.from("workspace_members").insert({
      workspace_id: workspace.id,
      user_id: foundId,
      role: data.role,
      invited_by: userId,
    } as never);
    if (insErr) {
      if (insErr.code === "23505") throw new Error("Esse usuário já é membro do workspace.");
      throw new Error(insErr.message);
    }

    // Espelha no user_roles
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("workspace_owner_id", workspace.id)
      .eq("user_id", foundId);
    await supabaseAdmin.from("user_roles").insert({
      workspace_owner_id: workspace.id,
      user_id: foundId,
      role: data.role,
    } as never);
    await syncLegacyRole(workspace.id, foundId, data.role);

    return { ok: true, user_id: foundId };
  });

/** Reenvia o email de convite para um membro pendente. */
export const resendTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        member_user_id: z.string().uuid(),
        redirect_origin: z.string().trim().url().max(255).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const workspace = await resolveActiveWorkspace(userId);
    await assertCanManageWorkspace(workspace.id, userId);
    // garante que o usuário é membro do workspace
    const { data: tm, error: tmErr } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", workspace.id)
      .eq("user_id", data.member_user_id)
      .maybeSingle();
    if (tmErr) throw new Error(tmErr.message);
    if (!tm) throw new Error("Membro não encontrado neste workspace.");

    const { data: u, error: uErr } = await supabaseAdmin.auth.admin.getUserById(
      data.member_user_id,
    );
    if (uErr || !u.user?.email)
      throw new Error(uErr?.message ?? "Email do usuário não encontrado.");

    const redirectTo = `${resolveInviteOrigin(data.redirect_origin)}/accept-invite`;
    const meta = (u.user.user_metadata ?? {}) as { full_name?: string; phone?: string };
    const { error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(u.user.email, {
      data: { full_name: meta.full_name, phone: meta.phone },
      redirectTo,
    });
    if (invErr) throw new Error(invErr.message);
    return { ok: true };
  });

/** Chamado pela página /accept-invite após o usuário definir senha — grava nome/telefone no profile. */
export const completeInviteProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        full_name: z.string().trim().min(2).max(120),
        phone: z.string().trim().min(8).max(32),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    // 1) Garante nome/telefone no profile
    const { error } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        full_name: data.full_name,
        phone: data.phone,
      } as never,
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);

    // 2) Recupera email do auth para casar com convites pendentes
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = (u?.user?.email ?? "").toLowerCase();

    // 3) Consome convites pendentes em workspace_invites pelo email
    if (email) {
      const { data: invites } = await supabaseAdmin
        .from("workspace_invites")
        .select("id, workspace_id, role, expires_at, accepted_at")
        .ilike("email", email)
        .is("accepted_at", null);
      const now = Date.now();
      for (const inv of invites ?? []) {
        if (inv.expires_at && new Date(inv.expires_at as string).getTime() < now) continue;
        const { error: mErr } = await supabaseAdmin.from("workspace_members").insert({
          workspace_id: inv.workspace_id,
          user_id: userId,
          role: inv.role,
          invited_by: null,
        } as never);
        if (mErr && mErr.code !== "23505") continue;
        await supabaseAdmin
          .from("workspace_invites")
          .update({ accepted_at: new Date().toISOString() } as never)
          .eq("id", inv.id as string);
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("workspace_owner_id", inv.workspace_id as string)
          .eq("user_id", userId);
        await supabaseAdmin.from("user_roles").insert({
          workspace_owner_id: inv.workspace_id,
          user_id: userId,
          role: inv.role,
        } as never);
      }
    }

    // 4) Garante active_workspace_id apontando para um workspace do qual é membro
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("active_workspace_id")
      .eq("id", userId)
      .maybeSingle();
    const currentActive =
      (prof as { active_workspace_id?: string | null } | null)?.active_workspace_id ?? null;

    const { data: memberships } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id, joined_at")
      .eq("user_id", userId)
      .order("joined_at", { ascending: true });
    const memberIds = (memberships ?? []).map((m) => m.workspace_id as string);

    if (memberIds.length > 0) {
      const validActive =
        currentActive && memberIds.includes(currentActive) ? currentActive : memberIds[0];
      if (validActive !== currentActive) {
        await supabaseAdmin.from("profiles").upsert(
          {
            id: userId,
            active_workspace_id: validActive,
          } as never,
          { onConflict: "id" },
        );
      }
    }

    return { ok: true };
  });

export const updateTeamMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ member_user_id: z.string().uuid(), role: TeamRole }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const workspace = await resolveActiveWorkspace(userId);
    await assertCanManageWorkspace(workspace.id, userId);
    if (data.member_user_id === userId) throw new Error("Você não pode alterar seu próprio papel.");
    await assertTargetMember(workspace.id, data.member_user_id);

    const { error } = await supabaseAdmin
      .from("workspace_members")
      .update({ role: data.role } as never)
      .eq("workspace_id", workspace.id)
      .eq("user_id", data.member_user_id);
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("workspace_owner_id", workspace.id)
      .eq("user_id", data.member_user_id);
    await supabaseAdmin.from("user_roles").insert({
      workspace_owner_id: workspace.id,
      user_id: data.member_user_id,
      role: data.role,
    } as never);
    await syncLegacyRole(workspace.id, data.member_user_id, data.role);
    return { ok: true };
  });

/** Atualiza nome, telefone e papel de um membro do workspace. */
export const updateTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        member_user_id: z.string().uuid(),
        full_name: z.string().trim().min(2, "Nome completo é obrigatório").max(120),
        phone: z.string().trim().min(8, "Telefone celular é obrigatório").max(32),
        role: TeamRole,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const workspace = await resolveActiveWorkspace(userId);
    await assertCanManageWorkspace(workspace.id, userId);
    const isOwner = data.member_user_id === userId;
    await assertTargetMember(workspace.id, data.member_user_id);

    const { error: pErr } = await supabaseAdmin.from("profiles").upsert(
      {
        id: data.member_user_id,
        full_name: data.full_name,
        phone: data.phone,
      } as never,
      { onConflict: "id" },
    );
    if (pErr) throw new Error(pErr.message);

    try {
      await supabaseAdmin.auth.admin.updateUserById(data.member_user_id, {
        user_metadata: { full_name: data.full_name, phone: data.phone },
      });
    } catch {
      /* ignore */
    }

    if (!isOwner) {
      const { error } = await supabaseAdmin
        .from("workspace_members")
        .update({ role: data.role } as never)
        .eq("workspace_id", workspace.id)
        .eq("user_id", data.member_user_id);
      if (error) throw new Error(error.message);

      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("workspace_owner_id", workspace.id)
        .eq("user_id", data.member_user_id);
      await supabaseAdmin.from("user_roles").insert({
        workspace_owner_id: workspace.id,
        user_id: data.member_user_id,
        role: data.role,
      } as never);
      await syncLegacyRole(workspace.id, data.member_user_id, data.role);
    }
    return { ok: true };
  });

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        member_user_id: z.string().uuid(),
        reassign_to: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const workspace = await resolveActiveWorkspace(userId);
    await assertCanManageWorkspace(workspace.id, userId);
    if (data.member_user_id === userId) throw new Error("Você não pode remover a si mesmo.");

    const reassignTo = data.reassign_to ?? null;
    if (reassignTo) {
      if (reassignTo === data.member_user_id)
        throw new Error("Reatribua para um membro diferente.");
      const { data: target } = await supabaseAdmin
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspace.id)
        .eq("user_id", reassignTo)
        .maybeSingle();
      if (!target) throw new Error("Membro de destino não pertence ao workspace.");
    }

    // Reatribui (ou zera) registros com assigned_user_id apontando para o membro removido.
    let reassigned = 0;
    for (const t of ASSIGNED_TABLES) {
      const update = reassignTo ? { assigned_user_id: reassignTo } : { assigned_user_id: null };
      const { count, error: uErr } = await supabaseAdmin
        .from(t)
        .update(update as never, { count: "exact" })
        .eq("workspace_id", workspace.id)
        .eq("assigned_user_id", data.member_user_id);
      if (uErr) throw new Error(uErr.message);
      reassigned += count ?? 0;
    }

    const { error } = await supabaseAdmin
      .from("workspace_members")
      .delete()
      .eq("workspace_id", workspace.id)
      .eq("user_id", data.member_user_id);
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("workspace_owner_id", workspace.id)
      .eq("user_id", data.member_user_id);
    await supabaseAdmin
      .from("team_members")
      .delete()
      .eq("workspace_owner_id", workspace.id)
      .eq("member_user_id", data.member_user_id);
    return { ok: true, reassigned };
  });

/** Lista cargos funcionais (job_roles) disponíveis no workspace. */
export const listWorkspaceJobRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const workspace = await resolveActiveWorkspace(userId);
    await assertCanManageWorkspace(workspace.id, userId);

    const { data: roles, error } = await supabaseAdmin
      .from("job_roles")
      .select("id, name, description, color, is_system, data_scope")
      .or(`is_system.eq.true,and(is_system.eq.false,owner_id.eq.${workspace.created_by ?? userId})`)
      .order("is_system", { ascending: false })
      .order("name");
    if (error) throw new Error(error.message);

    return (roles ?? []) as Array<{
      id: string;
      name: string;
      description: string | null;
      color: string | null;
      is_system: boolean;
      data_scope: string;
    }>;
  });

/** Lista pacotes de permissões disponíveis no workspace. */
export const listWorkspacePermissionSets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const workspace = await resolveActiveWorkspace(userId);
    await assertCanManageWorkspace(workspace.id, userId);

    const { data: sets, error: setsErr } = await supabaseAdmin
      .from("permission_sets")
      .select("id, name, module, description, is_system, owner_id")
      .or(`is_system.eq.true,and(is_system.eq.false,owner_id.eq.${workspace.created_by ?? userId})`)
      .order("module")
      .order("name");
    if (setsErr) throw new Error(setsErr.message);

    const ids = (sets ?? []).map((s) => s.id as string);
    const { data: items } = await supabaseAdmin
      .from("permission_set_items")
      .select("set_id, permission_key")
      .in("set_id", ids);
    const keysBySet = new Map<string, string[]>();
    for (const it of (items ?? []) as Array<{ set_id: string; permission_key: string }>) {
      const arr = keysBySet.get(it.set_id) ?? [];
      arr.push(it.permission_key);
      keysBySet.set(it.set_id, arr);
    }

    return (sets ?? []).map((s) => ({
      id: s.id as string,
      name: s.name as string,
      module: s.module as string,
      description: (s.description ?? null) as string | null,
      is_system: Boolean(s.is_system),
      permission_keys: keysBySet.get(s.id as string) ?? [],
    }));
  });

const SetMemberJobRolesInput = z.object({
  member_user_id: z.string().uuid(),
  primary_role_id: z.string().uuid().nullable(),
  extra_role_ids: z.array(z.string().uuid()).default([]),
  extra_set_ids: z.array(z.string().uuid()).default([]),
});

/** Define o cargo principal, cargos extras e pacotes extras de um membro.
 *  Usa supabaseAdmin porque as RLS de user_job_roles/user_permission_sets
 *  restringem escrita ao owner_id (criador do workspace), mas a tela de
 *  membros permite que qualquer admin do workspace gerencie atribuições.
 */
export const setMemberJobRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SetMemberJobRolesInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const workspace = await resolveActiveWorkspace(userId);
    await assertCanManageWorkspace(workspace.id, userId);
    await assertTargetMember(workspace.id, data.member_user_id);

    const workspaceOwnerId = workspace.created_by ?? userId;

    // Reconstrói user_job_roles
    const { error: delErr } = await supabaseAdmin
      .from("user_job_roles")
      .delete()
      .eq("owner_id", workspaceOwnerId)
      .eq("user_id", data.member_user_id);
    if (delErr) throw new Error(delErr.message);

    const roleRows: Array<{
      user_id: string;
      owner_id: string;
      workspace_id: string;
      role_id: string;
      is_primary: boolean;
    }> = [];
    const seen = new Set<string>();
    if (data.primary_role_id) {
      roleRows.push({
        user_id: data.member_user_id,
        owner_id: workspaceOwnerId,
        workspace_id: workspace.id,
        role_id: data.primary_role_id,
        is_primary: true,
      });
      seen.add(data.primary_role_id);
    }
    for (const rid of data.extra_role_ids) {
      if (seen.has(rid)) continue;
      roleRows.push({
        user_id: data.member_user_id,
        owner_id: workspaceOwnerId,
        workspace_id: workspace.id,
        role_id: rid,
        is_primary: false,
      });
      seen.add(rid);
    }
    if (roleRows.length > 0) {
      const { error: insErr } = await supabaseAdmin
        .from("user_job_roles")
        .insert(roleRows as never);
      if (insErr) throw new Error(insErr.message);
    }

    // Reconstrói user_permission_sets
    const { error: delSetsErr } = await supabaseAdmin
      .from("user_permission_sets")
      .delete()
      .eq("owner_id", workspaceOwnerId)
      .eq("user_id", data.member_user_id);
    if (delSetsErr) throw new Error(delSetsErr.message);

    if (data.extra_set_ids.length > 0) {
      const setRows = data.extra_set_ids.map((sid) => ({
        user_id: data.member_user_id,
        owner_id: workspaceOwnerId,
        workspace_id: workspace.id,
        set_id: sid,
      }));
      const { error: insSetsErr } = await supabaseAdmin

        .from("user_permission_sets")
        .insert(setRows as never);
      if (insSetsErr) throw new Error(insSetsErr.message);
    }

    return { ok: true };
  });
