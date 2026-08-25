// Perfis de acesso configuráveis (HubSpot-style). Server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TOOL_REQUIRED_ENTITLEMENT } from "@/lib/entitlements";

import { ACCESS_OBJECTS, ACCESS_TOOLS } from "./access-profiles.constants";
export { ACCESS_OBJECTS, ACCESS_TOOLS, SCOPE_LABELS } from "./access-profiles.constants";

const Scope = z.enum(["none", "own", "team", "all"]);
const BaseRole = z.enum(["admin", "manager", "member"]);

// ---------------- LIST ----------------
export const listAccessProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // ensure seeded
    await supabase.rpc("seed_access_profiles", { _workspace: userId } as never);

    const { data: profiles, error } = await supabase
      .from("access_profiles")
      .select("id, name, description, is_system, base_role, created_at")
      .eq("workspace_owner_id", userId)
      .order("is_system", { ascending: false })
      .order("name");
    if (error) throw new Error(error.message);

    const { data: members } = await supabase
      .from("team_members")
      .select("access_profile_id")
      .eq("workspace_owner_id", userId);

    const counts = new Map<string, number>();
    for (const m of members ?? []) {
      const id = (m as { access_profile_id: string | null }).access_profile_id;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    return (profiles ?? []).map((p) => ({
      ...(p as {
        id: string;
        name: string;
        description: string | null;
        is_system: boolean;
        base_role: "admin" | "manager" | "member";
        created_at: string;
      }),
      user_count: counts.get((p as { id: string }).id) ?? 0,
    }));
  });

// ---------------- GET ONE ----------------
export const getAccessProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile, error } = await supabase
      .from("access_profiles")
      .select("id, name, description, is_system, base_role, workspace_owner_id")
      .eq("id", data.id)
      .eq("workspace_owner_id", userId)
      .single();
    if (error || !profile) throw new Error("Perfil não encontrado");

    const [{ data: perms }, { data: tools }] = await Promise.all([
      supabase
        .from("access_profile_permissions")
        .select("object_key, view_scope, edit_scope, delete_scope, create_enabled, module_id")
        .eq("profile_id", data.id),
      supabase.from("access_profile_tools").select("tool_key, enabled").eq("profile_id", data.id),
    ]);

    return {
      profile: profile as {
        id: string;
        name: string;
        description: string | null;
        is_system: boolean;
        base_role: "admin" | "manager" | "member";
        workspace_owner_id: string;
      },
      permissions: (perms ?? []) as Array<{
        object_key: string;
        view_scope: "none" | "own" | "team" | "all";
        edit_scope: "none" | "own" | "team" | "all";
        delete_scope: "none" | "own" | "team" | "all";
        create_enabled: boolean;
        module_id: string | null;
      }>,
      tools: (tools ?? []) as Array<{ tool_key: string; enabled: boolean }>,
    };
  });

// ---------------- CREATE ----------------
export const createAccessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        name: z.string().min(2).max(60),
        description: z.string().max(300).optional(),
        base_role: BaseRole.default("member"),
        copy_from: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: created, error } = await supabase
      .from("access_profiles")
      .insert({
        workspace_owner_id: userId,
        name: data.name,
        description: data.description ?? null,
        base_role: data.base_role,
        is_system: false,
      } as never)
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Falha ao criar perfil");

    const newId = (created as { id: string }).id;

    if (data.copy_from) {
      const [{ data: srcPerms }, { data: srcTools }] = await Promise.all([
        supabase
          .from("access_profile_permissions")
          .select("object_key, view_scope, edit_scope, delete_scope, create_enabled, module_id")
          .eq("profile_id", data.copy_from),
        supabase
          .from("access_profile_tools")
          .select("tool_key, enabled")
          .eq("profile_id", data.copy_from),
      ]);
      if (srcPerms?.length) {
        await supabase
          .from("access_profile_permissions")
          .insert(srcPerms.map((p) => ({ ...(p as object), profile_id: newId })) as never);
      }
      if (srcTools?.length) {
        await supabase
          .from("access_profile_tools")
          .insert(srcTools.map((t) => ({ ...(t as object), profile_id: newId })) as never);
      }
    } else {
      // start with empty permissions for all objects + tools
      await supabase.from("access_profile_permissions").insert(
        ACCESS_OBJECTS.map((o) => ({
          profile_id: newId,
          object_key: o.key,
          module_id: o.module ?? null,
          view_scope: "own",
          edit_scope: "own",
          delete_scope: "none",
          create_enabled: true,
        })) as never,
      );
      await supabase.from("access_profile_tools").insert(
        ACCESS_TOOLS.map((t) => ({
          profile_id: newId,
          tool_key: t.key,
          enabled: false,
        })) as never,
      );
    }

    return { id: newId };
  });

// ---------------- UPDATE (name/desc + bulk perms/tools) ----------------
export const updateAccessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(2).max(60).optional(),
        description: z.string().max(300).nullable().optional(),
        base_role: BaseRole.optional(),
        permissions: z
          .array(
            z.object({
              object_key: z.string().min(1).max(50),
              view_scope: Scope,
              edit_scope: Scope,
              delete_scope: Scope,
              create_enabled: z.boolean(),
            }),
          )
          .optional(),
        tools: z
          .array(
            z.object({
              tool_key: z.string().min(1).max(50),
              enabled: z.boolean(),
            }),
          )
          .optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // ownership check
    const { data: existing } = await supabase
      .from("access_profiles")
      .select("id, is_system")
      .eq("id", data.id)
      .eq("workspace_owner_id", userId)
      .single();
    if (!existing) throw new Error("Perfil não encontrado");

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.base_role !== undefined && !(existing as { is_system: boolean }).is_system)
      patch.base_role = data.base_role;
    if (Object.keys(patch).length) {
      const { error } = await supabase
        .from("access_profiles")
        .update(patch as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    }

    if (data.permissions?.length) {
      for (const p of data.permissions) {
        const objDef = ACCESS_OBJECTS.find((o) => o.key === p.object_key);
        const module_id = objDef?.module ?? null;
        const { error } = await supabase
          .from("access_profile_permissions")
          .upsert({ profile_id: data.id, module_id, ...p } as never, {
            onConflict: "profile_id,object_key",
          });
        if (error) throw new Error(error.message);
      }
    }
    if (data.tools?.length) {
      // Server-side enforcement: tools cuja entitlement não é habilitada
      // pelo plano atual do workspace são forçadas a enabled=false.
      for (const t of data.tools) {
        let enabled = t.enabled;
        const reqKey = TOOL_REQUIRED_ENTITLEMENT[t.tool_key];
        if (reqKey) {
          const { data: ok } = await supabase.rpc("has_entitlement", {
            _workspace: userId,
            _key: reqKey,
          } as never);
          if (!ok) enabled = false;
        }
        const { error } = await supabase
          .from("access_profile_tools")
          .upsert({ profile_id: data.id, tool_key: t.tool_key, enabled } as never, {
            onConflict: "profile_id,tool_key",
          });
        if (error) throw new Error(error.message);
      }
    }
    return { ok: true };
  });

// ---------------- DELETE ----------------
export const deleteAccessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: existing } = await supabase
      .from("access_profiles")
      .select("id, is_system")
      .eq("id", data.id)
      .eq("workspace_owner_id", userId)
      .single();
    if (!existing) throw new Error("Perfil não encontrado");
    if ((existing as { is_system: boolean }).is_system)
      throw new Error("Perfis de sistema não podem ser excluídos");

    const { count } = await supabase
      .from("team_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_owner_id", userId)
      .eq("access_profile_id", data.id);
    if ((count ?? 0) > 0)
      throw new Error("Há usuários atribuídos a este perfil. Mova-os antes de excluir.");

    const { error } = await supabase.from("access_profiles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- ASSIGN PROFILE TO USER ----------------
export const assignProfileToUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        user_id: z.string().uuid(),
        profile_id: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id === userId) throw new Error("O owner sempre é Admin");

    // verify profile belongs to workspace
    const { data: profile } = await supabase
      .from("access_profiles")
      .select("id, base_role")
      .eq("id", data.profile_id)
      .eq("workspace_owner_id", userId)
      .single();
    if (!profile) throw new Error("Perfil inválido");

    // update team_members.access_profile_id
    const { error: upErr } = await supabase
      .from("team_members")
      .update({ access_profile_id: data.profile_id } as never)
      .eq("workspace_owner_id", userId)
      .eq("member_user_id", data.user_id);
    if (upErr) throw new Error(upErr.message);

    // sync user_roles based on base_role for backward compatibility
    const baseRole = (profile as { base_role: "admin" | "manager" | "member" }).base_role;
    await supabase
      .from("user_roles")
      .delete()
      .eq("workspace_owner_id", userId)
      .eq("user_id", data.user_id);
    await supabase.from("user_roles").insert({
      workspace_owner_id: userId,
      user_id: data.user_id,
      role: baseRole,
    } as never);

    return { ok: true };
  });

// ---------------- LIST USERS WITH PROFILE ASSIGNMENTS ----------------
export const listProfileAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: members } = await supabase
      .from("team_members")
      .select("member_user_id, access_profile_id")
      .eq("workspace_owner_id", userId);

    const ids = Array.from(
      new Set([
        userId,
        ...(members ?? []).map((m) => (m as { member_user_id: string }).member_user_id),
      ]),
    );
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailById = new Map((authList?.users ?? []).map((u) => [u.id, u.email ?? ""]));
    const nameById = new Map(
      (profiles ?? []).map((p) => [
        (p as { id: string }).id,
        (p as { full_name: string | null }).full_name ?? "",
      ]),
    );

    return ids.map((id) => {
      const member = (members ?? []).find(
        (m) => (m as { member_user_id: string }).member_user_id === id,
      ) as { access_profile_id: string | null } | undefined;
      const name =
        nameById.get(id) || emailById.get(id) || (id === userId ? "Você (owner)" : id.slice(0, 8));
      return {
        user_id: id,
        full_name: name,
        is_owner: id === userId,
        access_profile_id: member?.access_profile_id ?? null,
      };
    });
  });

// ---------------- ACCESS MATRIX (todos os perfis × objetos × ferramentas) ----------------
export const getAccessMatrix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.rpc("seed_access_profiles", { _workspace: userId } as never);

    const { data: profiles } = await supabase
      .from("access_profiles")
      .select("id, name, description, is_system, base_role")
      .eq("workspace_owner_id", userId)
      .order("is_system", { ascending: false })
      .order("base_role")
      .order("name");

    const ids = (profiles ?? []).map((p) => (p as { id: string }).id);
    if (!ids.length) return { profiles: [], permissions: {}, tools: {} };

    const [{ data: perms }, { data: tools }, { data: members }] = await Promise.all([
      supabase
        .from("access_profile_permissions")
        .select("profile_id, object_key, view_scope, edit_scope, delete_scope, create_enabled")
        .in("profile_id", ids),
      supabase
        .from("access_profile_tools")
        .select("profile_id, tool_key, enabled")
        .in("profile_id", ids),
      supabase.from("team_members").select("access_profile_id").eq("workspace_owner_id", userId),
    ]);

    const counts = new Map<string, number>();
    for (const m of members ?? []) {
      const id = (m as { access_profile_id: string | null }).access_profile_id;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    const permsByProfile: Record<
      string,
      Record<
        string,
        { view_scope: string; edit_scope: string; delete_scope: string; create_enabled: boolean }
      >
    > = {};
    for (const p of perms ?? []) {
      const row = p as {
        profile_id: string;
        object_key: string;
        view_scope: string;
        edit_scope: string;
        delete_scope: string;
        create_enabled: boolean;
      };
      (permsByProfile[row.profile_id] ??= {})[row.object_key] = {
        view_scope: row.view_scope,
        edit_scope: row.edit_scope,
        delete_scope: row.delete_scope,
        create_enabled: row.create_enabled,
      };
    }
    const toolsByProfile: Record<string, Record<string, boolean>> = {};
    for (const t of tools ?? []) {
      const row = t as { profile_id: string; tool_key: string; enabled: boolean };
      (toolsByProfile[row.profile_id] ??= {})[row.tool_key] = row.enabled;
    }

    return {
      profiles: (profiles ?? []).map((p) => ({
        ...(p as {
          id: string;
          name: string;
          description: string | null;
          is_system: boolean;
          base_role: "admin" | "manager" | "member";
        }),
        user_count: counts.get((p as { id: string }).id) ?? 0,
      })),
      permissions: permsByProfile,
      tools: toolsByProfile,
    };
  });
