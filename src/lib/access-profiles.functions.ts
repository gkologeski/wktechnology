// Perfis de acesso configuráveis (HubSpot-style). Server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const ACCESS_OBJECTS: Array<{ key: string; label: string; category: "crm" | "marketing" | "sales" | "service" }> = [
  { key: "contacts",   label: "Contatos",   category: "crm" },
  { key: "companies",  label: "Empresas",   category: "crm" },
  { key: "leads",      label: "Leads",      category: "crm" },
  { key: "deals",      label: "Negócios",   category: "sales" },
  { key: "quotes",     label: "Cotações",   category: "sales" },
  { key: "products",   label: "Produtos",   category: "sales" },
  { key: "tickets",    label: "Tickets",    category: "service" },
  { key: "tasks",      label: "Tarefas",    category: "crm" },
  { key: "notes",      label: "Notas",      category: "crm" },
  { key: "calls",      label: "Chamadas",   category: "crm" },
  { key: "meetings",   label: "Reuniões",   category: "crm" },
  { key: "emails",     label: "E-mails do CRM", category: "crm" },
  { key: "activities", label: "Atividades", category: "crm" },
];

export const ACCESS_TOOLS: Array<{ key: string; label: string; description: string; category: "crm" | "marketing" | "sales" | "service" | "account" }> = [
  { key: "communicate",          label: "Comunicar",                description: "Enviar e-mails, registrar chamadas, agendar reuniões.", category: "crm" },
  { key: "import",               label: "Importar",                 description: "Importar registros em massa ou um de cada vez.", category: "crm" },
  { key: "export",               label: "Exportar",                 description: "Exportar registros do CRM.", category: "crm" },
  { key: "bulk_delete",          label: "Exclusão em massa",        description: "Excluir registros em massa.", category: "crm" },
  { key: "manage_workflows",     label: "Gerenciar workflows",      description: "Criar e editar automações.", category: "marketing" },
  { key: "manage_properties",    label: "Gerenciar propriedades",   description: "Criar e editar propriedades dos objetos.", category: "account" },
  { key: "manage_pipelines",     label: "Gerenciar pipelines",      description: "Criar e editar pipelines e estágios.", category: "sales" },
  { key: "access_logs",          label: "Acessar logs de auditoria", description: "Visualizar histórico completo de alterações.", category: "account" },
  { key: "manage_integrations",  label: "Gerenciar integrações",    description: "Conectar e configurar integrações externas.", category: "account" },
  { key: "manage_billing",       label: "Gerenciar assinatura",     description: "Acessar billing e cobrança.", category: "account" },
  { key: "manage_users",         label: "Gerenciar usuários",       description: "Convidar, editar e remover membros da equipe.", category: "account" },
];

export const SCOPE_LABELS: Record<"none" | "own" | "team" | "all", string> = {
  none: "Nenhum",
  own: "Próprios",
  team: "Equipe",
  all: "Todos",
};

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
      ...(p as { id: string; name: string; description: string | null; is_system: boolean; base_role: "admin" | "manager" | "member"; created_at: string }),
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
      supabase.from("access_profile_permissions").select("object_key, view_scope, edit_scope, delete_scope, create_enabled").eq("profile_id", data.id),
      supabase.from("access_profile_tools").select("tool_key, enabled").eq("profile_id", data.id),
    ]);

    return {
      profile: profile as { id: string; name: string; description: string | null; is_system: boolean; base_role: "admin" | "manager" | "member"; workspace_owner_id: string },
      permissions: (perms ?? []) as Array<{ object_key: string; view_scope: "none"|"own"|"team"|"all"; edit_scope: "none"|"own"|"team"|"all"; delete_scope: "none"|"own"|"team"|"all"; create_enabled: boolean }>,
      tools: (tools ?? []) as Array<{ tool_key: string; enabled: boolean }>,
    };
  });

// ---------------- CREATE ----------------
export const createAccessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    name: z.string().min(2).max(60),
    description: z.string().max(300).optional(),
    base_role: BaseRole.default("member"),
    copy_from: z.string().uuid().optional(),
  }).parse(i))
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
        supabase.from("access_profile_permissions").select("object_key, view_scope, edit_scope, delete_scope, create_enabled").eq("profile_id", data.copy_from),
        supabase.from("access_profile_tools").select("tool_key, enabled").eq("profile_id", data.copy_from),
      ]);
      if (srcPerms?.length) {
        await supabase.from("access_profile_permissions").insert(
          srcPerms.map((p) => ({ ...(p as object), profile_id: newId })) as never,
        );
      }
      if (srcTools?.length) {
        await supabase.from("access_profile_tools").insert(
          srcTools.map((t) => ({ ...(t as object), profile_id: newId })) as never,
        );
      }
    } else {
      // start with empty permissions for all objects + tools
      await supabase.from("access_profile_permissions").insert(
        ACCESS_OBJECTS.map((o) => ({
          profile_id: newId,
          object_key: o.key,
          view_scope: "own",
          edit_scope: "own",
          delete_scope: "none",
          create_enabled: true,
        })) as never,
      );
      await supabase.from("access_profile_tools").insert(
        ACCESS_TOOLS.map((t) => ({ profile_id: newId, tool_key: t.key, enabled: false })) as never,
      );
    }

    return { id: newId };
  });

// ---------------- UPDATE (name/desc + bulk perms/tools) ----------------
export const updateAccessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(),
    name: z.string().min(2).max(60).optional(),
    description: z.string().max(300).nullable().optional(),
    base_role: BaseRole.optional(),
    permissions: z.array(z.object({
      object_key: z.string().min(1).max(50),
      view_scope: Scope,
      edit_scope: Scope,
      delete_scope: Scope,
      create_enabled: z.boolean(),
    })).optional(),
    tools: z.array(z.object({
      tool_key: z.string().min(1).max(50),
      enabled: z.boolean(),
    })).optional(),
  }).parse(i))
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
    if (data.base_role !== undefined && !(existing as { is_system: boolean }).is_system) patch.base_role = data.base_role;
    if (Object.keys(patch).length) {
      const { error } = await supabase.from("access_profiles").update(patch as never).eq("id", data.id);
      if (error) throw new Error(error.message);
    }

    if (data.permissions?.length) {
      for (const p of data.permissions) {
        const { error } = await supabase
          .from("access_profile_permissions")
          .upsert({ profile_id: data.id, ...p } as never, { onConflict: "profile_id,object_key" });
        if (error) throw new Error(error.message);
      }
    }
    if (data.tools?.length) {
      for (const t of data.tools) {
        const { error } = await supabase
          .from("access_profile_tools")
          .upsert({ profile_id: data.id, ...t } as never, { onConflict: "profile_id,tool_key" });
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
    if ((existing as { is_system: boolean }).is_system) throw new Error("Perfis de sistema não podem ser excluídos");

    const { count } = await supabase
      .from("team_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_owner_id", userId)
      .eq("access_profile_id", data.id);
    if ((count ?? 0) > 0) throw new Error("Há usuários atribuídos a este perfil. Mova-os antes de excluir.");

    const { error } = await supabase.from("access_profiles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- ASSIGN PROFILE TO USER ----------------
export const assignProfileToUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    user_id: z.string().uuid(),
    profile_id: z.string().uuid(),
  }).parse(i))
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
    await supabase.from("user_roles").delete()
      .eq("workspace_owner_id", userId).eq("user_id", data.user_id);
    await supabase.from("user_roles").insert({
      workspace_owner_id: userId, user_id: data.user_id, role: baseRole,
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

    const ids = Array.from(new Set([userId, ...((members ?? []).map((m) => (m as { member_user_id: string }).member_user_id))]));
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids);
    const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailById = new Map((authList?.users ?? []).map((u) => [u.id, u.email ?? ""]));
    const nameById = new Map((profiles ?? []).map((p) => [(p as { id: string }).id, (p as { full_name: string | null }).full_name ?? ""]));

    return ids.map((id) => {
      const member = (members ?? []).find((m) => (m as { member_user_id: string }).member_user_id === id) as
        | { access_profile_id: string | null } | undefined;
      return {
        user_id: id,
        full_name: nameById.get(id) || (id === userId ? "Você (owner)" : id.slice(0, 8)),
        is_owner: id === userId,
        access_profile_id: member?.access_profile_id ?? null,
      };
    });
  });
