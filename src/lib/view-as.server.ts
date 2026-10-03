// Regras do "Ver como" (server-only). O chamador sempre é verificado como
// proprietário/admin do workspace ativo antes de qualquer operação privilegiada.
import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import type { ViewAsOptions, ViewAsStart } from "@/lib/view-as.functions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;
const TTL_MS = 60 * 60 * 1000;

async function assertAdmin(supabase: SupabaseClient<any>, userId: string): Promise<string> {
  const workspaceId = await resolveActiveWorkspace(userId);
  const { data, error } = await supabase.rpc("is_workspace_admin_of", {
    _owner: workspaceId,
    _user: userId,
  });
  if (error || data !== true) {
    throw new Error("Apenas proprietários e administradores do workspace podem usar o Ver como.");
  }
  return workspaceId;
}

async function adminIds(workspaceId: string): Promise<Set<string>> {
  const set = new Set<string>();
  const { data: ws } = await admin
    .from("workspaces")
    .select("created_by")
    .eq("id", workspaceId)
    .maybeSingle();
  if (ws?.created_by) set.add(ws.created_by);
  const { data: ms } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .in("role", ["owner", "admin"]);
  (ms ?? []).forEach((m: { user_id: string }) => set.add(m.user_id));
  const { data: pa } = await admin.from("platform_admins").select("user_id");
  (pa ?? []).forEach((m: { user_id: string }) => set.add(m.user_id));
  return set;
}

async function audit(
  workspaceId: string | null,
  actorId: string,
  action: string,
  targetUserId: string | null,
  details: Record<string, unknown>,
) {
  await admin.from("access_audit_log").insert({
    workspace_id: workspaceId,
    actor_id: actorId,
    action,
    entity_type: "view_as",
    target_user_id: targetUserId,
    details,
  });
}

export async function listOptions(
  supabase: SupabaseClient<any>,
  userId: string,
): Promise<ViewAsOptions> {
  const workspaceId = await assertAdmin(supabase, userId);
  const blocked = await adminIds(workspaceId);
  const { data: members } = await admin
    .from("workspace_members")
    .select("user_id, role, status, is_test_user")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .eq("is_test_user", false);
  const ids = (members ?? [])
    .map((m: { user_id: string }) => m.user_id)
    .filter((id: string) => !blocked.has(id));
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const { data: links } = ids.length
    ? await admin
        .from("user_job_roles")
        .select("user_id, job_roles(name)")
        .eq("workspace_id", workspaceId)
        .in("user_id", ids)
    : { data: [] };
  const roleOf = new Map<string, string>();
  (links ?? []).forEach((l: { user_id: string; job_roles: { name: string } | null }) => {
    if (l.job_roles?.name && !roleOf.has(l.user_id)) roleOf.set(l.user_id, l.job_roles.name);
  });
  const users = (profiles ?? [])
    .map((p: { id: string; full_name: string | null }) => ({
      id: p.id,
      label: p.full_name?.trim() || "Sem nome",
      detail: roleOf.get(p.id) ?? null,
    }))
    .sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, "pt-BR"));
  const { data: roles } = await admin
    .from("job_roles")
    .select("id, name, description")
    .eq("workspace_id", workspaceId)
    .order("name");
  return {
    users,
    roles: (roles ?? []).map((r: { id: string; name: string; description: string | null }) => ({
      id: r.id,
      label: r.name,
      detail: r.description,
    })),
  };
}

async function ensureTestUser(workspaceId: string, roleId: string, roleName: string) {
  const { data: existing } = await admin
    .from("user_job_roles")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("role_id", roleId);
  const candidates = (existing ?? []).map((r: { user_id: string }) => r.user_id);
  if (candidates.length) {
    const { data: tm } = await admin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .eq("is_test_user", true)
      .in("user_id", candidates)
      .limit(1)
      .maybeSingle();
    if (tm?.user_id) return tm.user_id as string;
  }
  const email = `ver-como+${roleId.slice(0, 8)}-${workspaceId.slice(0, 8)}@teste.wktechnology.invalid`;
  const fullName = `[Teste] ${roleName}`;
  let uid: string | null = null;
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: randomBytes(24).toString("base64url"),
    user_metadata: { full_name: fullName, is_test_user: true },
  });
  if (created.error) {
    // Já existe (ex.: membro removido manualmente): reaproveita pelo e-mail.
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    uid = link.data?.user?.id ?? null;
    if (!uid) throw new Error("Não foi possível criar o usuário de teste.");
  } else {
    uid = created.data.user.id as string;
  }
  await admin
    .from("profiles")
    .upsert({ id: uid, full_name: fullName, active_workspace_id: workspaceId });
  const { error: mErr } = await admin.from("workspace_members").upsert(
    {
      workspace_id: workspaceId,
      user_id: uid,
      role: "member",
      status: "active",
      is_test_user: true,
    },
    { onConflict: "workspace_id,user_id" },
  );
  if (mErr) throw new Error(`Falha ao preparar usuário de teste: ${mErr.message}`);
  await admin.from("user_job_roles").delete().eq("workspace_id", workspaceId).eq("user_id", uid);
  const { error: rErr } = await admin.from("user_job_roles").insert({
    user_id: uid,
    owner_id: workspaceId,
    workspace_id: workspaceId,
    role_id: roleId,
    is_primary: true,
  });
  if (rErr) throw new Error(`Falha ao aplicar o papel ao usuário de teste: ${rErr.message}`);
  return uid;
}

export async function start(
  supabase: SupabaseClient<any>,
  userId: string,
  input: { user_id: string } | { role_id: string },
): Promise<ViewAsStart> {
  const workspaceId = await assertAdmin(supabase, userId);
  let targetId: string;
  let label: string;
  let mode: "user" | "role";
  let roleId: string | null = null;

  if ("user_id" in input) {
    mode = "user";
    targetId = input.user_id;
    if (targetId === userId) throw new Error("Escolha outro usuário.");
    const blocked = await adminIds(workspaceId);
    if (blocked.has(targetId)) {
      throw new Error("Não é possível ver como outro administrador ou proprietário.");
    }
    const { data: m } = await admin
      .from("workspace_members")
      .select("status, is_test_user")
      .eq("workspace_id", workspaceId)
      .eq("user_id", targetId)
      .maybeSingle();
    if (!m || m.status !== "active" || m.is_test_user) {
      throw new Error("Usuário não é membro ativo deste workspace.");
    }
    const { data: p } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", targetId)
      .maybeSingle();
    label = p?.full_name?.trim() || "usuário";
  } else {
    mode = "role";
    roleId = input.role_id;
    const { data: role } = await admin
      .from("job_roles")
      .select("id, name")
      .eq("id", roleId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!role) throw new Error("Papel não encontrado neste workspace.");
    targetId = await ensureTestUser(workspaceId, role.id, role.name);
    label = `papel ${role.name}`;
  }

  const { data: u, error: uErr } = await admin.auth.admin.getUserById(targetId);
  if (uErr || !u?.user?.email) throw new Error("Usuário sem e-mail de acesso.");
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
  const tokenHash = link.data?.properties?.hashed_token as string | undefined;
  if (link.error || !tokenHash) throw new Error("Não foi possível iniciar o Ver como.");

  const nonce = randomBytes(24).toString("base64url");
  const readOnly = mode === "user";
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
  const { data: row, error } = await admin
    .from("view_as_sessions")
    .insert({
      workspace_id: workspaceId,
      admin_id: userId,
      target_user_id: targetId,
      mode,
      role_id: roleId,
      read_only: readOnly,
      nonce,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await audit(workspaceId, userId, "view_as_start", targetId, {
    mode,
    role_id: roleId,
    view_id: row.id,
  });
  return { viewId: row.id, nonce, tokenHash, label, mode, readOnly, expiresAt };
}

export async function bind(
  userId: string,
  sessionId: string | null,
  viewId: string,
  nonce: string,
): Promise<{ ok: true }> {
  if (!sessionId) throw new Error("Sessão inválida.");
  const { data: v } = await admin
    .from("view_as_sessions")
    .select("id, target_user_id, nonce, session_id, ended_at, expires_at")
    .eq("id", viewId)
    .maybeSingle();
  if (
    !v ||
    v.target_user_id !== userId ||
    v.nonce !== nonce ||
    v.session_id ||
    v.ended_at ||
    new Date(v.expires_at).getTime() < Date.now()
  ) {
    throw new Error("Não foi possível confirmar o Ver como.");
  }
  const { error } = await admin
    .from("view_as_sessions")
    .update({ session_id: sessionId })
    .eq("id", viewId)
    .is("session_id", null);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function end(userId: string, viewId: string, jwt: string): Promise<{ ok: true }> {
  const { data: v } = await admin
    .from("view_as_sessions")
    .select("id, workspace_id, admin_id, target_user_id, ended_at")
    .eq("id", viewId)
    .maybeSingle();
  if (!v || v.target_user_id !== userId) return { ok: true };
  if (!v.ended_at) {
    await admin
      .from("view_as_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", viewId);
    await audit(v.workspace_id, v.admin_id, "view_as_end", v.target_user_id, { view_id: viewId });
  }
  // Encerra apenas a sessão criada para o Ver como (a pessoa continua conectada).
  if (jwt) await admin.auth.admin.signOut(jwt, "local").catch(() => {});
  return { ok: true };
}

/** Registra uma gravação barrada no modo só leitura. */
export async function logBlockedWrite(viewId: string, details: Record<string, unknown>) {
  const { data: v } = await admin
    .from("view_as_sessions")
    .select("workspace_id, admin_id, target_user_id")
    .eq("id", viewId)
    .maybeSingle();
  if (v)
    await audit(v.workspace_id, v.admin_id, "view_as_write_blocked", v.target_user_id, details);
}
