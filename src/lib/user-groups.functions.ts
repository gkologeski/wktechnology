// Server fns para CRUD de equipes nomeadas (user_groups) no workspace ativo.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getActiveWorkspaceId(userId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  const activeId =
    (profile as { active_workspace_id?: string | null } | null)?.active_workspace_id ?? null;
  if (activeId) return activeId;
  const { data: m } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  const id = (m as { workspace_id?: string } | null)?.workspace_id;
  if (!id) throw new Error("Nenhum workspace ativo.");
  return id;
}

async function assertAdmin(workspaceId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || (data as { role: string }).role !== "admin") {
    throw new Error("Apenas admins do workspace podem gerenciar equipes.");
  }
}

export const listUserGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await getActiveWorkspaceId(userId);

    const { data: groups, error } = await supabase
      .from("user_groups")
      .select("id, name, color, description, workspace_id, created_at")
      .eq("workspace_id", workspaceId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);

    const list = (groups ?? []) as Array<{
      id: string;
      name: string;
      color: string | null;
      description: string | null;
      workspace_id: string;
      created_at: string;
    }>;
    const ids = list.map((g) => g.id);
    let membersByGroup: Record<string, string[]> = {};
    if (ids.length) {
      const { data: mem, error: mErr } = await supabase
        .from("user_group_members")
        .select("group_id, user_id")
        .in("group_id", ids);
      if (mErr) throw new Error(mErr.message);
      membersByGroup = (mem ?? []).reduce<Record<string, string[]>>((acc, r) => {
        const row = r as { group_id: string; user_id: string };
        (acc[row.group_id] ??= []).push(row.user_id);
        return acc;
      }, {});
    }
    return { groups: list.map((g) => ({ ...g, member_ids: membersByGroup[g.id] ?? [] })) };
  });

export const createUserGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        name: z.string().min(1).max(80),
        color: z.string().max(20).optional().nullable(),
        description: z.string().max(500).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await getActiveWorkspaceId(context.userId);
    await assertAdmin(workspaceId, context.userId);
    const { data: row, error } = await context.supabase
      .from("user_groups")
      .insert({
        workspace_id: workspaceId,
        name: data.name.trim(),
        color: data.color ?? null,
        description: data.description ?? null,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const updateUserGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(80),
        color: z.string().max(20).optional().nullable(),
        description: z.string().max(500).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_groups")
      .update({
        name: data.name.trim(),
        color: data.color ?? null,
        description: data.description ?? null,
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUserGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_groups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setGroupMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        group_id: z.string().uuid(),
        user_ids: z.array(z.string().uuid()).max(500),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error: dErr } = await context.supabase
      .from("user_group_members")
      .delete()
      .eq("group_id", data.group_id);
    if (dErr) throw new Error(dErr.message);
    if (data.user_ids.length) {
      const rows = data.user_ids.map((uid) => ({ group_id: data.group_id, user_id: uid }));
      const { error: iErr } = await context.supabase
        .from("user_group_members")
        .insert(rows as never);
      if (iErr) throw new Error(iErr.message);
    }
    return { ok: true };
  });
