// Server functions para o Super-Admin da plataforma (gerencia workspaces e seus admins).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

let supabaseAdmin: SupabaseClient<Database>;
async function getSupabaseAdmin(): Promise<SupabaseClient<Database>> {
  if (!supabaseAdmin) {
    const mod = await import("@/integrations/supabase/client.server");
    supabaseAdmin = mod.supabaseAdmin;
  }
  return supabaseAdmin;
}

const WsRole = z.enum(["admin", "member"]);

const CANONICAL_APP_URL = "https://ats.wktechnology.com.br";
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

async function assertPlatformAdmin(userId: string) {
  const supabaseAdmin = await getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso negado: apenas super-admins da plataforma.");
}

/** Verifica se o usuário logado é platform admin (usado para gates de UI). */
export const amIPlatformAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    const { data } = await supabaseAdmin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { is_admin: !!data };
  });

/** Lista todos os workspaces da plataforma (somente super-admin). */
export const listAllWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("workspaces")
      .select(
        "id, name, slug, logo_url, primary_color, custom_domain, status, created_at, deleted_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Conta membros por workspace
    const ids = (data ?? []).map((w) => w.id as string);
    const counts = new Map<string, number>();
    if (ids.length) {
      const { data: members } = await supabaseAdmin
        .from("workspace_members")
        .select("workspace_id")
        .in("workspace_id", ids);
      for (const m of members ?? []) {
        const k = m.workspace_id as string;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    return (data ?? []).map((w) => ({ ...w, member_count: counts.get(w.id as string) ?? 0 }));
  });

/** Cria um novo workspace e adiciona o usuário convidado como admin do workspace. */
export const createWorkspaceWithAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        name: z.string().trim().min(2).max(120),
        slug: z
          .string()
          .trim()
          .min(2)
          .max(64)
          .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen."),
        admin_email: z.string().trim().email().max(255),
        admin_name: z.string().trim().min(2).max(120),
        admin_phone: z.string().trim().min(8).max(32).optional(),
        redirect_origin: z.string().trim().url().max(255).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);

    // 1) Cria workspace
    const { data: ws, error: wsErr } = await supabaseAdmin
      .from("workspaces")
      .insert({
        name: data.name,
        slug: data.slug,
        status: "active",
        created_by: context.userId,
      } as never)
      .select("id, name, slug")
      .single();
    if (wsErr) {
      if (wsErr.code === "23505") throw new Error("Já existe um workspace com esse slug.");
      throw new Error(wsErr.message);
    }

    // 2) Acha/cria usuário no Supabase Auth
    const target = data.admin_email.toLowerCase();
    let userIdFound: string | null = null;
    let page = 1;
    while (page <= 20) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw new Error(error.message);
      const u = list.users.find((u) => (u.email ?? "").toLowerCase() === target);
      if (u) {
        userIdFound = u.id;
        break;
      }
      if (list.users.length < 200) break;
      page++;
    }

    const redirectTo = `${resolveInviteOrigin(data.redirect_origin)}/accept-invite`;

    if (!userIdFound) {
      const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        target,
        {
          data: { full_name: data.admin_name, phone: data.admin_phone ?? "" },
          redirectTo,
        },
      );
      if (invErr || !invited?.user) throw new Error(invErr?.message ?? "Falha ao enviar convite.");
      userIdFound = invited.user.id;
    }

    // 3) Garante profile
    await supabaseAdmin.from("profiles").upsert(
      {
        id: userIdFound,
        full_name: data.admin_name,
        phone: data.admin_phone ?? null,
      } as never,
      { onConflict: "id" },
    );

    // 4) Adiciona como admin do workspace
    const { error: memErr } = await supabaseAdmin.from("workspace_members").insert({
      workspace_id: ws!.id,
      user_id: userIdFound,
      role: "admin",
      invited_by: context.userId,
    } as never);
    if (memErr && memErr.code !== "23505") throw new Error(memErr.message);

    return { workspace: ws, admin_user_id: userIdFound };
  });

/** Lista membros de um workspace específico (super-admin). */
export const listWorkspaceMembersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ workspace_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const { data: members, error } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id, user_id, role, joined_at")
      .eq("workspace_id", data.workspace_id);
    if (error) throw new Error(error.message);

    const ids = (members ?? []).map((m) => m.user_id as string);
    const profilesMap = new Map<string, { name: string; phone: string }>();
    const emailMap = new Map<string, string>();
    const confirmedMap = new Map<string, boolean>();

    if (ids.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", ids);
      for (const p of profiles ?? []) {
        profilesMap.set(p.id as string, {
          name: (p.full_name as string) ?? "",
          phone: ((p as { phone?: string | null }).phone ?? "") as string,
        });
      }
      await Promise.all(
        ids.map(async (id) => {
          try {
            const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
            if (u.user?.email) emailMap.set(id, u.user.email);
            confirmedMap.set(id, Boolean(u.user?.email_confirmed_at || u.user?.last_sign_in_at));
          } catch {
            /* ignore */
          }
        }),
      );
    }

    return (members ?? []).map((m) => ({
      user_id: m.user_id as string,
      role: m.role as "admin" | "member",
      joined_at: m.joined_at as string,
      full_name: profilesMap.get(m.user_id as string)?.name ?? "",
      phone: profilesMap.get(m.user_id as string)?.phone ?? "",
      email: emailMap.get(m.user_id as string) ?? "",
      pending: !confirmedMap.get(m.user_id as string),
    }));
  });

/** Convida um usuário para um workspace existente (super-admin). */
export const inviteUserToWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        email: z.string().trim().email().max(255),
        full_name: z.string().trim().min(2).max(120),
        phone: z.string().trim().max(32).optional(),
        role: WsRole,
        redirect_origin: z.string().trim().url().max(255).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);

    const target = data.email.toLowerCase();
    let userIdFound: string | null = null;
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
        userIdFound = u.id;
        alreadyConfirmed = Boolean(u.email_confirmed_at || u.last_sign_in_at);
        break;
      }
      if (list.users.length < 200) break;
      page++;
    }

    const redirectTo = `${resolveInviteOrigin(data.redirect_origin)}/accept-invite`;

    if (!userIdFound || !alreadyConfirmed) {
      const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        target,
        {
          data: { full_name: data.full_name, phone: data.phone ?? "" },
          redirectTo,
        },
      );
      if (invErr || !invited?.user) throw new Error(invErr?.message ?? "Falha ao enviar convite.");
      userIdFound = invited.user.id;
    }

    await supabaseAdmin.from("profiles").upsert(
      {
        id: userIdFound,
        full_name: data.full_name,
        phone: data.phone ?? null,
      } as never,
      { onConflict: "id" },
    );

    const { error: memErr } = await supabaseAdmin.from("workspace_members").insert({
      workspace_id: data.workspace_id,
      user_id: userIdFound,
      role: data.role,
      invited_by: context.userId,
    } as never);
    if (memErr) {
      if (memErr.code === "23505") throw new Error("Este usuário já é membro do workspace.");
      throw new Error(memErr.message);
    }

    return { ok: true, user_id: userIdFound };
  });

/** Remove um membro de um workspace (super-admin). */
export const removeWorkspaceMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        user_id: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("workspace_members")
      .delete()
      .eq("workspace_id", data.workspace_id)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Atualiza dados visuais/básicos de um workspace (super-admin). */
export const updateWorkspaceAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        name: z.string().trim().min(2).max(120).optional(),
        slug: z
          .string()
          .trim()
          .min(2)
          .max(64)
          .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen.")
          .optional(),
        logo_url: z.string().trim().url().max(500).nullable().optional(),
        primary_color: z.string().trim().max(32).nullable().optional(),
        custom_domain: z
          .string()
          .trim()
          .max(255)
          .nullable()
          .optional()
          .transform((v) => (v === "" ? null : v)),
        status: z.enum(["active", "suspended"]).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.slug !== undefined) patch.slug = data.slug;
    if (data.logo_url !== undefined) patch.logo_url = data.logo_url;
    if (data.primary_color !== undefined) patch.primary_color = data.primary_color;
    if (data.custom_domain !== undefined) patch.custom_domain = data.custom_domain;
    if (data.status !== undefined) patch.status = data.status;
    const supabaseAdmin = await getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("workspaces")
      .update(patch as never)
      .eq("id", data.workspace_id);
    if (error) {
      if (error.code === "23505")
        throw new Error("Já existe um workspace com esse slug ou domínio.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

/** Soft-delete de workspace (super-admin). */
export const softDeleteWorkspaceAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ workspace_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    const { error } = await supabaseAdmin.rpc("soft_delete_workspace", {
      _workspace: data.workspace_id,
      _actor: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Restaura workspace soft-deletado (super-admin). */
export const restoreWorkspaceAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ workspace_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    const { error } = await supabaseAdmin.rpc("restore_workspace", {
      _workspace: data.workspace_id,
      _actor: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Exclusão definitiva (purge) — apaga workspace e todos os dados em cascata. */
export const purgeWorkspaceAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        confirm_name: z.string().trim().min(1).max(120),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    const { error } = await supabaseAdmin.rpc("purge_workspace", {
      _workspace: data.workspace_id,
      _confirm_name: data.confirm_name,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
