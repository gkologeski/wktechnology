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
async function logAudit(
  supabase: SB,
  userId: string,
  action: string,
  entity_type: string,
  entity_id: string | null,
  target_user_id: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabase.from("access_audit_log").insert({
      workspace_id: userId,
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

async function assertWorkspaceOwner(supabase: SB, userId: string): Promise<void> {
  // With RLS scoped to workspace_id = auth.uid(), the owner is the user themself.
  // We still call this to keep intent obvious and to future-proof if we widen access.
  const { data } = await supabase
    .from("workspaces")
    .select("id")
    .eq("created_by", userId)
    .limit(1)
    .maybeSingle();
  if (!data) {
    // Non-owner? Reject explicit writes. Non-owners can still read via getAccessBundle.
    throw new Error("Apenas o proprietário do workspace pode editar o controle de acesso.");
  }
}

// Resolve the real workspace UUID (distinct from userId) so member-assignment
// writes land on the same workspace_id that getAccessBundle reads.
async function resolveActiveWorkspace(supabase: SB, userId: string): Promise<string | null> {
  const m = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (m.data?.workspace_id) return m.data.workspace_id as string;
  const w = await supabase
    .from("workspaces")
    .select("id")
    .eq("created_by", userId)
    .limit(1)
    .maybeSingle();
  return (w.data?.id as string) ?? null;
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
    await assertWorkspaceOwner(supabase, userId);
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
    await assertWorkspaceOwner(supabase, userId);
    await assertNotSystemRow(supabase, "job_roles", data.id);
    await deleteByIdGuarded(
      supabase,
      "job_roles",
      data.id,
      "Você não tem permissão para excluir este cargo.",
    );
    await logAudit(supabase, userId, "role.delete", "job_role", data.id, null);
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
    await assertWorkspaceOwner(supabase, userId);
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
    await assertWorkspaceOwner(supabase, userId);
    await assertNotSystemRow(supabase, "permission_sets", data.id);
    await deleteByIdGuarded(
      supabase,
      "permission_sets",
      data.id,
      "Você não tem permissão para excluir este pacote de permissões.",
    );
    await logAudit(supabase, userId, "set.delete", "permission_set", data.id, null);
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
    await assertWorkspaceOwner(supabase, userId);
    if (!data.role_id && !data.set_id) {
      throw new Error("Selecione um cargo ou pacote para aplicar a regra.");
    }
    const payload = {
      owner_id: userId,
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
      await logAudit(supabase, userId, "field_rule.update", "field_rule", data.id, null, payload);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("field_permission_rules")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const newId = row.id as string;
    await logAudit(supabase, userId, "field_rule.create", "field_rule", newId, null, payload);
    return { id: newId };
  });

export const deleteFieldRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertWorkspaceOwner(supabase, userId);
    await assertNotSystemRow(supabase, "field_permission_rules", data.id);
    await deleteByIdGuarded(
      supabase,
      "field_permission_rules",
      data.id,
      "Você não tem permissão para excluir esta regra de campo.",
    );
    await logAudit(supabase, userId, "field_rule.delete", "field_rule", data.id, null);
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
    await assertWorkspaceOwner(supabase, userId);

    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    if (!workspaceId) {
      throw new Error("Workspace ativo não encontrado.");
    }

    // Confirm the user is a workspace member (owner is always allowed).
    let isMember = data.user_id === userId;
    if (!isMember) {
      const { data: member } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", data.user_id)
        .maybeSingle();
      if (member) isMember = true;
    }
    if (!isMember) {
      // Fallback: workspace owner (creator) may not have a workspace_members row.
      const { data: ownerRow } = await supabase
        .from("workspaces")
        .select("id")
        .eq("id", workspaceId)
        .eq("created_by", data.user_id)
        .maybeSingle();
      if (ownerRow) isMember = true;
    }
    if (!isMember) {
      throw new Error("Usuário não é membro deste workspace.");
    }

    // Rebuild user_job_roles (owner-scoped: owner_id = auth.uid() per RLS)
    const { error: dr } = await supabase
      .from("user_job_roles")
      .delete()
      .eq("owner_id", userId)
      .eq("user_id", data.user_id);
    if (dr) throw new Error(dr.message);

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
        user_id: data.user_id,
        owner_id: userId,
        workspace_id: workspaceId,
        role_id: data.primary_role_id,
        is_primary: true,
      });
      seen.add(data.primary_role_id);
    }
    for (const rid of data.extra_role_ids) {
      if (seen.has(rid)) continue;
      roleRows.push({
        user_id: data.user_id,
        owner_id: userId,
        workspace_id: workspaceId,
        role_id: rid,
        is_primary: false,
      });
      seen.add(rid);
    }
    if (roleRows.length > 0) {
      const { error } = await supabase.from("user_job_roles").insert(roleRows);
      if (error) throw new Error(error.message);
    }

    // Rebuild user_permission_sets (owner-scoped)
    const { error: ds } = await supabase
      .from("user_permission_sets")
      .delete()
      .eq("owner_id", userId)
      .eq("user_id", data.user_id);
    if (ds) throw new Error(ds.message);
    if (data.extra_set_ids.length > 0) {
      const { error } = await supabase.from("user_permission_sets").insert(
        data.extra_set_ids.map((sid) => ({
          user_id: data.user_id,
          owner_id: userId,
          set_id: sid,
        })),
      );
      if (error) throw new Error(error.message);
    }

    await logAudit(supabase, userId, "member.assign", "workspace_member", null, data.user_id, {
      primary_role_id: data.primary_role_id,
      extra_role_ids: data.extra_role_ids,
      extra_set_ids: data.extra_set_ids,
    });
    return { ok: true };
  });
