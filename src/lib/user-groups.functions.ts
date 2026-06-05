// Server fns para CRUD de equipes nomeadas (user_groups) no workspace ativo.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listUserGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: groups, error } = await supabase
      .from("user_groups")
      .select("id, name, color, description, workspace_owner_id, created_at")
      .eq("workspace_owner_id", userId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (groups ?? []).map((g) => g.id);
    let membersByGroup: Record<string, string[]> = {};
    if (ids.length) {
      const { data: mem, error: mErr } = await supabase
        .from("user_group_members")
        .select("group_id, user_id")
        .in("group_id", ids);
      if (mErr) throw new Error(mErr.message);
      membersByGroup = (mem ?? []).reduce<Record<string, string[]>>((acc, r) => {
        (acc[r.group_id] ??= []).push(r.user_id);
        return acc;
      }, {});
    }
    return { groups: (groups ?? []).map((g) => ({ ...g, member_ids: membersByGroup[g.id] ?? [] })) };
  });

export const createUserGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    name: z.string().min(1).max(80),
    color: z.string().max(20).optional().nullable(),
    description: z.string().max(500).optional().nullable(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("user_groups")
      .insert({
        workspace_owner_id: userId,
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
  .inputValidator((i) => z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(80),
    color: z.string().max(20).optional().nullable(),
    description: z.string().max(500).optional().nullable(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("user_groups")
      .update({ name: data.name.trim(), color: data.color ?? null, description: data.description ?? null } as never)
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
  .inputValidator((i) => z.object({
    group_id: z.string().uuid(),
    user_ids: z.array(z.string().uuid()).max(500),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error: dErr } = await supabase.from("user_group_members").delete().eq("group_id", data.group_id);
    if (dErr) throw new Error(dErr.message);
    if (data.user_ids.length) {
      const rows = data.user_ids.map((uid) => ({ group_id: data.group_id, user_id: uid }));
      const { error: iErr } = await supabase.from("user_group_members").insert(rows as never);
      if (iErr) throw new Error(iErr.message);
    }
    return { ok: true };
  });
