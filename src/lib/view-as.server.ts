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
  // Cada visita recebe uma conta exclusiva: nunca reativar sessões ou dados antigos.
  const email = `ver-como+${randomBytes(12).toString("hex")}@teste.wktechnology.invalid`;
  const fullName = `[Teste] ${roleName}`;
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: randomBytes(24).toString("base64url"),
    user_metadata: { full_name: fullName, is_test_user: true },
  });
  if (created.error || !created.data.user) throw new Error("Não foi possível criar o usuário de teste.");
  const uid = created.data.user.id;
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

/** Executado pelo mesmo tick autenticado dos Workflows, sem expor limpeza ao navegador. */
/** Ordem de exclusão (filhos → pais) dos registros criados no modo papel. */
const TEST_RECORD_DELETE_ORDER = ["activities", "deals", "contacts", "leads", "companies"] as const;

/**
 * Remove uma conta de teste de papel: desativa, apaga os registros listados em
 * `view_as_test_records` (nunca por nome/data) e só então apaga a conta.
 * Em falha, mantém a conta desativada para nova tentativa no próximo tick.
 */
async function cleanupTestUser(uid: string, workspaceId: string, now: string): Promise<"removed" | "blocked" | "skip"> {
  const { data: member } = await admin.from("workspace_members")
    .select("user_id, is_test_user")
    .eq("workspace_id", workspaceId).eq("user_id", uid).maybeSingle();
  if (!member?.is_test_user) return "skip";
  const { data: active } = await admin.from("view_as_sessions").select("id")
    .eq("target_user_id", uid).eq("mode", "role")
    .gt("expires_at", now).is("ended_at", null).limit(1);
  if (active?.length) return "skip";
  const { error: disableError } = await admin.from("workspace_members")
    .update({ status: "inactive" }).eq("workspace_id", workspaceId)
    .eq("user_id", uid).eq("is_test_user", true);
  if (disableError) return "blocked";

  const { data: sessions } = await admin.from("view_as_sessions").select("id")
    .eq("target_user_id", uid).eq("mode", "role");
  const sessionIds = (sessions ?? []).map((s) => s.id as string);
  if (sessionIds.length) {
    const { data: records, error: recErr } = await admin.from("view_as_test_records")
      .select("table_name, record_id").in("session_id", sessionIds);
    if (recErr) return "blocked";
    for (const table of TEST_RECORD_DELETE_ORDER) {
      const ids = (records ?? []).filter((r) => r.table_name === table).map((r) => r.record_id as string);
      if (!ids.length) continue;
      const { error: delErr } = await admin.from(table).delete().in("id", ids);
      if (delErr) {
        console.warn("[view-as] Falha ao apagar registros de teste", table, delErr.message);
        return "blocked";
      }
    }
    await admin.from("view_as_test_records").delete().in("session_id", sessionIds);
  }

  const { error: roleError } = await admin.from("user_job_roles").delete()
    .eq("workspace_id", workspaceId).eq("user_id", uid);
  if (roleError) return "blocked";
  const { error: memberError } = await admin.from("workspace_members").delete()
    .eq("workspace_id", workspaceId).eq("user_id", uid).eq("is_test_user", true);
  if (memberError) return "blocked";
  const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
  if (deleteError) return "blocked";
  await admin.from("view_as_sessions").update({ ended_at: now })
    .eq("target_user_id", uid).eq("mode", "role").is("ended_at", null);
  return "removed";
}

export async function cleanupExpiredRoleViews(): Promise<{ removed: number; blocked: number }> {
  const now = new Date().toISOString();
  const { data: expired, error } = await admin
    .from("view_as_sessions")
    .select("id, target_user_id, workspace_id")
    .eq("mode", "role")
    .or(`expires_at.lt.${now},ended_at.not.is.null`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  let removed = 0;
  let blocked = 0;
  const seen = new Set<string>();
  for (const v of expired ?? []) {
    const uid = v.target_user_id as string;
    if (seen.has(uid)) continue;
    seen.add(uid);
    const r = await cleanupTestUser(uid, v.workspace_id as string, now);
    if (r === "removed") removed++;
    if (r === "blocked") blocked++;
  }
  return { removed, blocked };
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
  // O usuário real opera com suas permissões; o papel permanece sem gravação
  // até existir um isolamento integral de dados e efeitos externos de teste.
  const readOnly = mode === "role";
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
  // Papel de teste: apaga registros e conta imediatamente (o tick repete em falha).
  await cleanupTestUser(v.target_user_id, v.workspace_id, new Date().toISOString()).catch((e) =>
    console.warn("[view-as] Limpeza ao sair falhou:", (e as Error).message),
  );
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
