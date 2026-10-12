// Server functions for CRUD on the TechERP access control model (Phase 2).
// RLS already restricts writes to `workspace_id = auth.uid()` (owner-only),
// so these functions rely on the authenticated user's Supabase client.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { deleteByIdGuarded } from "@/lib/db/delete-guarded";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

// Fire-and-forget audit writer used by every mutation in this file.
// `workspace_id` é sempre o UUID real do workspace ativo (nunca o id do usuário).
async function logAudit(
  supabase: SB,
  userId: string,
  workspaceId: string,
  action: string,
  entity_type: string,
  entity_id: string | null,
  target_user_id: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabase.from("access_audit_log").insert({
      workspace_id: workspaceId,
      actor_id: userId,
      action,
      entity_type,
      entity_id,
      target_user_id,
      details,
    });
  } catch {
    /* audit failures never block the mutation */
  }
}

// Guarda única de TODA mutação deste arquivo (várias gravam com supabaseAdmin,
// que não passa pelas políticas view_as_ro). Ordem:
// 1) sessão "Ver como" somente leitura é barrada (falha fechada se a checagem falhar);
// 2) workspace ativo pelo resolvedor canônico (perfil + membership ativa);
// 3) membership ATIVA com papel owner/admin nesse workspace — sem exceção de
//    platform_admin nem de criador inativo;
// 4) is_workspace_admin_v2 continua exigido como confirmação adicional.
async function assertActiveWorkspaceAdmin(supabase: SB, userId: string): Promise<string> {
  const { error: roErr } = await supabase.rpc("is_read_only_view");
  if (roErr) throw new Error("Não foi possível confirmar o modo de acesso. Tente novamente.");
  const { assertNotReadOnlyView } = await import("@/lib/view-as-guard.server");
  await assertNotReadOnlyView(supabase);

  const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
  const workspaceId = await resolveActiveWorkspace(userId);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: member, error: mErr } = await supabaseAdmin
    .from("workspace_members")
    .select("role, status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (mErr) throw new Error(`Falha ao verificar administrador do workspace: ${mErr.message}`);
  const m = member as { role: string | null; status: string | null } | null;
  const activeAdmin = !!m && m.status === "active" && (m.role === "owner" || m.role === "admin");

  const { data, error } = await supabase.rpc("is_workspace_admin_v2", {
    _workspace: workspaceId,
    _user: userId,
  });
  if (error) throw new Error(`Falha ao verificar administrador do workspace: ${error.message}`);
  if (!data || !activeAdmin) {
    throw new Error("Apenas administradores do workspace ativo podem editar o controle de acesso.");
  }
  return workspaceId;
}

// Cargos atribuíveis: globais ou deste workspace (mesmo filtro de my_roles no banco).
async function assertRolesUsable(workspaceId: string, roleIds: string[]): Promise<void> {
  if (roleIds.length === 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("job_roles")
    .select("id, workspace_id")
    .in("id", roleIds);
  if (error) throw new Error(error.message);
  const ok = new Set(
    ((data ?? []) as Array<{ id: string; workspace_id: string | null }>)
      .filter((r) => r.workspace_id === null || r.workspace_id === workspaceId)
      .map((r) => r.id),
  );
  if (roleIds.some((id) => !ok.has(id))) {
    throw new Error("Há cargo que não pertence a este workspace; a atribuição não teria efeito.");
  }
}

// Pacotes atribuíveis: locais deste workspace ou globais que não sejam `__bundle__`.
async function assertSetsUsable(workspaceId: string, setIds: string[]): Promise<void> {
  if (setIds.length === 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { setUsableInWorkspace } = await import("./role-set-resolution");
  const { data, error } = await supabaseAdmin
    .from("permission_sets")
    .select("id, workspace_id, module")
    .in("id", setIds);
  if (error) throw new Error(error.message);
  const meta = new Map(
    ((data ?? []) as Array<{ id: string; workspace_id: string | null; module: string }>).map(
      (s) => [s.id, s],
    ),
  );
  if (setIds.some((id) => !setUsableInWorkspace(meta.get(id), workspaceId))) {
    throw new Error("Há pacote que não vale neste workspace; a atribuição não teria efeito.");
  }
}

async function assertNotSystemRow(
  supabase: SB,
  table: "job_roles" | "permission_sets" | "field_permission_rules",
  id: string,
): Promise<void> {
  const { data, error } = await supabase.from(table).select("is_system").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Registro não encontrado.");
  if (data.is_system) throw new Error("Registros do sistema não podem ser editados.");
}

// -------------------- Job Roles --------------------
const RoleInput = z.object({
  id: z.string().uuid().nullish(),
  name: z.string().min(1).max(80),
  description: z.string().max(400).nullish(),
  color: z.string().max(24).nullish(),
  icon: z.string().max(40).nullish(),
  data_scope: z.enum(["own", "team", "workspace", "custom"]).default("workspace"),
  set_ids: z.array(z.string().uuid()).default([]),
});

export const upsertJobRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RoleInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await assertActiveWorkspaceAdmin(supabase, userId);
    await assertSetsUsable(workspaceId, data.set_ids);
    let roleId = data.id ?? null;
    if (roleId) {
      await assertNotSystemRow(supabase, "job_roles", roleId);
      const { error } = await supabase
        .from("job_roles")
        .update({
          name: data.name,
          description: data.description ?? null,
          color: data.color ?? null,
          icon: data.icon ?? null,
          data_scope: data.data_scope,
        })
        .eq("id", roleId);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await supabase
        .from("job_roles")
        .insert({
          owner_id: userId,
          workspace_id: workspaceId,
          name: data.name,
          description: data.description ?? null,
          color: data.color ?? null,
          icon: data.icon ?? null,
          data_scope: data.data_scope,
          is_system: false,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      roleId = row.id as string;
    }
    // Replace job_role_sets
    const { error: delErr } = await supabase.from("job_role_sets").delete().eq("role_id", roleId);
    if (delErr) throw new Error(delErr.message);
    if (data.set_ids.length > 0) {
      const { error: insErr } = await supabase
        .from("job_role_sets")
        .insert(data.set_ids.map((sid) => ({ role_id: roleId!, set_id: sid })));
      if (insErr) throw new Error(insErr.message);
    }
    await logAudit(
      supabase,
      userId,
      workspaceId,
      data.id ? "role.update" : "role.create",
      "job_role",
      roleId,
      null,
      {
        name: data.name,
        data_scope: data.data_scope,
        set_ids: data.set_ids,
      },
    );
    return { id: roleId };
  });

export const deleteJobRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await assertActiveWorkspaceAdmin(supabase, userId);
    await assertNotSystemRow(supabase, "job_roles", data.id);
    await deleteByIdGuarded(
      supabase,
      "job_roles",
      data.id,
      "Você não tem permissão para excluir este cargo.",
    );
    await logAudit(supabase, userId, workspaceId, "role.delete", "job_role", data.id, null);
    return { ok: true };
  });

// -------------------- Permission Sets --------------------
const SetInput = z.object({
  id: z.string().uuid().nullish(),
  module: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  description: z.string().max(400).nullish(),
  permission_keys: z.array(z.string().min(1)).default([]),
});

export const upsertPermissionSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SetInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await assertActiveWorkspaceAdmin(supabase, userId);
    let setId = data.id ?? null;
    if (setId) {
      await assertNotSystemRow(supabase, "permission_sets", setId);
      const { error } = await supabase
        .from("permission_sets")
        .update({
          module: data.module,
          name: data.name,
          description: data.description ?? null,
        })
        .eq("id", setId);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await supabase
        .from("permission_sets")
        .insert({
          owner_id: userId,
          workspace_id: workspaceId,
          module: data.module,
          name: data.name,
          description: data.description ?? null,
          is_system: false,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      setId = row.id as string;
    }
    // Replace items
    const { error: delErr } = await supabase
      .from("permission_set_items")
      .delete()
      .eq("set_id", setId);
    if (delErr) throw new Error(delErr.message);
    if (data.permission_keys.length > 0) {
      const { error: insErr } = await supabase
        .from("permission_set_items")
        .insert(data.permission_keys.map((k) => ({ set_id: setId!, permission_key: k })));
      if (insErr) throw new Error(insErr.message);
    }
    await logAudit(
      supabase,
      userId,
      workspaceId,
      data.id ? "set.update" : "set.create",
      "permission_set",
      setId,
      null,
      {
        name: data.name,
        module: data.module,
        permission_keys: data.permission_keys,
      },
    );
    return { id: setId };
  });

export const deletePermissionSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await assertActiveWorkspaceAdmin(supabase, userId);
    await assertNotSystemRow(supabase, "permission_sets", data.id);
    await deleteByIdGuarded(
      supabase,
      "permission_sets",
      data.id,
      "Você não tem permissão para excluir este pacote de permissões.",
    );
    await logAudit(supabase, userId, workspaceId, "set.delete", "permission_set", data.id, null);
    return { ok: true };
  });

// -------------------- Field Rules --------------------
const FieldRuleInput = z.object({
  id: z.string().uuid().nullish(),
  resource: z.string().min(1).max(60),
  field: z.string().min(1).max(60),
  mode: z.enum(["hidden", "masked", "readonly"]),
  role_id: z.string().uuid().nullish(),
  set_id: z.string().uuid().nullish(),
});

export const upsertFieldRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FieldRuleInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await assertActiveWorkspaceAdmin(supabase, userId);
    if (!data.role_id && !data.set_id) {
      throw new Error("Selecione um cargo ou pacote para aplicar a regra.");
    }
    const payload = {
      owner_id: userId,
      workspace_id: workspaceId,
      resource: data.resource,
      field: data.field,
      mode: data.mode,
      role_id: data.role_id ?? null,
      set_id: data.set_id ?? null,
      is_system: false,
    };
    if (data.id) {
      await assertNotSystemRow(supabase, "field_permission_rules", data.id);
      const { error } = await supabase
        .from("field_permission_rules")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAudit(
        supabase,
        userId,
        workspaceId,
        "field_rule.update",
        "field_rule",
        data.id,
        null,
        payload,
      );
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("field_permission_rules")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const newId = row.id as string;
    await logAudit(
      supabase,
      userId,
      workspaceId,
      "field_rule.create",
      "field_rule",
      newId,
      null,
      payload,
    );
    return { id: newId };
  });

export const deleteFieldRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await assertActiveWorkspaceAdmin(supabase, userId);
    await assertNotSystemRow(supabase, "field_permission_rules", data.id);
    await deleteByIdGuarded(
      supabase,
      "field_permission_rules",
      data.id,
      "Você não tem permissão para excluir esta regra de campo.",
    );
    await logAudit(supabase, userId, workspaceId, "field_rule.delete", "field_rule", data.id, null);
    return { ok: true };
  });

// -------------------- Member Assignments --------------------
const MemberAssignInput = z.object({
  user_id: z.string().uuid(),
  primary_role_id: z.string().uuid().nullable(),
  extra_role_ids: z.array(z.string().uuid()).default([]),
  extra_set_ids: z.array(z.string().uuid()).default([]),
});

export const setMemberAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => MemberAssignInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await assertActiveWorkspaceAdmin(supabase, userId);

    const memberRow = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", data.user_id)
      .eq("status", "active")
      .maybeSingle();
    if (memberRow.error) throw new Error(memberRow.error.message);
    if (!memberRow.data) {
      throw new Error("Usuário não é membro ativo deste workspace; a atribuição não teria efeito.");
    }

    const roleIds = Array.from(
      new Set([...(data.primary_role_id ? [data.primary_role_id] : []), ...data.extra_role_ids]),
    );
    const setIds = Array.from(new Set(data.extra_set_ids));
    await assertRolesUsable(workspaceId, roleIds);
    await assertSetsUsable(workspaceId, setIds);

    // Atribuições pertencem ao workspace (owner_id = workspace_id = UUID do WS), que é
    // o que user_effective_permissions lê. Grava com o cliente do PRÓPRIO usuário: as
    // políticas 0128 exigem admin ativo do workspace da linha, owner_id consistente,
    // alvo membro ativo e cargo/pacote do workspace ou do catálogo global de sistema.
    const { error: dr } = await supabase
      .from("user_job_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("workspace_id", workspaceId);
    if (dr) throw new Error(dr.message);
    if (roleIds.length > 0) {
      const { error } = await supabase.from("user_job_roles").insert(
        roleIds.map((rid) => ({
          user_id: data.user_id,
          owner_id: workspaceId,
          workspace_id: workspaceId,
          role_id: rid,
          is_primary: rid === data.primary_role_id,
        })),
      );
      if (error) throw new Error(error.message);
    }

    const { error: ds } = await supabase
      .from("user_permission_sets")
      .delete()
      .eq("user_id", data.user_id)
      .eq("workspace_id", workspaceId);
    if (ds) throw new Error(ds.message);
    if (setIds.length > 0) {
      const { error } = await supabase.from("user_permission_sets").insert(
        setIds.map((sid) => ({
          user_id: data.user_id,
          owner_id: workspaceId,
          workspace_id: workspaceId,
          set_id: sid,
        })),
      );
      if (error) throw new Error(error.message);
    }

    await logAudit(
      supabase,
      userId,
      workspaceId,
      "member.assign",
      "workspace_member",
      null,
      data.user_id,
      {
        primary_role_id: data.primary_role_id,
        extra_role_ids: data.extra_role_ids,
        extra_set_ids: data.extra_set_ids,
      },
    );
    return { ok: true };
  });
