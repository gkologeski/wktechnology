// Server functions para Roles & Permissions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleEnum = z.enum(["admin", "manager", "member"]);
export type AppRole = z.infer<typeof RoleEnum>;

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Gestor",
  member: "Membro",
};

/** Lista membros do workspace + role atual (mais alta) de cada um. */
export const listWorkspaceRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: members } = await supabase
      .from("team_members")
      .select("member_user_id")
      .eq("workspace_owner_id", userId);

    const ids = Array.from(
      new Set([userId, ...(members ?? []).map((m) => m.member_user_id as string)]),
    );

    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, full_name").in("id", ids),
      supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("workspace_owner_id", userId)
        .in("user_id", ids),
    ]);

    const nameById = new Map(
      (profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? ""]),
    );
    const rank: Record<AppRole, number> = { admin: 3, manager: 2, member: 1 };
    const roleByUser = new Map<string, AppRole>();
    for (const r of roles ?? []) {
      const role = r.role as AppRole;
      const cur = roleByUser.get(r.user_id as string);
      if (!cur || rank[role] > rank[cur]) roleByUser.set(r.user_id as string, role);
    }

    return ids.map((id) => ({
      user_id: id,
      full_name: nameById.get(id) || (id === userId ? "Você (owner)" : id.slice(0, 8)),
      is_owner: id === userId,
      role: (id === userId ? "admin" : (roleByUser.get(id) ?? "member")) as AppRole,
    }));
  });

/** Define o role de um usuário no workspace (substitui os anteriores). */
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        user_id: z.string().uuid(),
        role: RoleEnum,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id === userId) {
      throw new Error("O owner do workspace sempre é admin");
    }
    // limpa roles anteriores deste usuário neste workspace e insere o novo
    const { error: delErr } = await supabase
      .from("user_roles")
      .delete()
      .eq("workspace_owner_id", userId)
      .eq("user_id", data.user_id);
    if (delErr) throw new Error(delErr.message);

    const { error } = await supabase.from("user_roles").insert({
      workspace_owner_id: userId,
      user_id: data.user_id,
      role: data.role,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Role do usuário atual no workspace (owner = admin). */
export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ workspace_owner_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.workspace_owner_id === userId) return { role: "admin" as AppRole };
    const { data: rows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("workspace_owner_id", data.workspace_owner_id)
      .eq("user_id", userId);
    const rank: Record<AppRole, number> = { admin: 3, manager: 2, member: 1 };
    let best: AppRole = "member";
    for (const r of rows ?? []) {
      const role = r.role as AppRole;
      if (rank[role] > rank[best]) best = role;
    }
    return { role: best };
  });
