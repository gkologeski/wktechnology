// Server functions para Teams (gerenciar membros do workspace).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TeamRole = z.enum(["admin", "manager", "member"]);
export type TeamRole = z.infer<typeof TeamRole>;

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  admin: "Admin",
  manager: "Gestor",
  member: "Membro",
};

/** Lista membros + email (do auth.users via admin). */
export const listTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: members } = await supabase
      .from("team_members")
      .select("id, member_user_id, role, created_at")
      .eq("workspace_owner_id", userId)
      .order("created_at", { ascending: true });

    const ids = Array.from(new Set([userId, ...(members ?? []).map((m) => m.member_user_id as string)]));

    // Use admin client: profiles RLS only allows reading own row, but the
    // workspace owner needs name/phone of every member to render the list.
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", ids);
    const nameById = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? ""]));
    const phoneById = new Map((profiles ?? []).map((p) => [p.id as string, ((p as { phone?: string | null }).phone ?? "") as string]));

    // Buscar emails via admin (auth.users)
    const emailById = new Map<string, string>();
    await Promise.all(
      ids.map(async (id) => {
        try {
          const { data } = await supabaseAdmin.auth.admin.getUserById(id);
          if (data.user?.email) emailById.set(id, data.user.email);
        } catch { /* ignore */ }
      })
    );

    const ownerRow = {
      id: "owner",
      user_id: userId,
      full_name: nameById.get(userId) || "Você",
      phone: phoneById.get(userId) ?? "",
      email: emailById.get(userId) ?? "",
      role: "admin" as TeamRole,
      is_owner: true,
      created_at: null as string | null,
    };

    const memberRows = (members ?? []).map((m) => ({
      id: m.id as string,
      user_id: m.member_user_id as string,
      full_name: nameById.get(m.member_user_id as string) || "",
      phone: phoneById.get(m.member_user_id as string) ?? "",
      email: emailById.get(m.member_user_id as string) ?? "",
      role: m.role as TeamRole,
      is_owner: false,
      created_at: m.created_at as string,
    }));

    return [ownerRow, ...memberRows];
  });

/** Convida (adiciona) um membro pelo email. Usuário precisa já existir no sistema. */
export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      email: z.string().trim().email().max(255),
      full_name: z.string().trim().min(2, "Nome completo é obrigatório").max(120),
      phone: z.string().trim().min(8, "Telefone celular é obrigatório").max(32),
      role: TeamRole,
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Achar user_id por email via admin
    let foundId: string | null = null;
    let page = 1;
    const target = data.email.trim().toLowerCase();
    while (page <= 20) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      const u = list.users.find((u) => (u.email ?? "").toLowerCase() === target);
      if (u) { foundId = u.id; break; }
      if (list.users.length < 200) break;
      page++;
    }
    // Se não existir, dispara convite por email (cria o usuário e envia link de cadastro)
    if (!foundId) {
      const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(target, {
        data: { full_name: data.full_name, phone: data.phone },
      });
      if (invErr || !invited?.user) {
        throw new Error(invErr?.message ?? "Falha ao enviar convite por email.");
      }
      foundId = invited.user.id;
    }
    if (foundId === userId) throw new Error("Você já é o owner do workspace.");

    // Garante profile com nome e telefone
    await supabaseAdmin.from("profiles").upsert({
      id: foundId,
      full_name: data.full_name,
      phone: data.phone,
    } as never, { onConflict: "id" });

    const { error: insErr } = await supabase
      .from("team_members")
      .insert({ workspace_owner_id: userId, member_user_id: foundId, role: data.role } as never);
    if (insErr) {
      if (insErr.code === "23505") throw new Error("Esse usuário já é membro do workspace.");
      throw new Error(insErr.message);
    }

    // Espelha no user_roles
    await supabase.from("user_roles").delete()
      .eq("workspace_owner_id", userId).eq("user_id", foundId);
    await supabase.from("user_roles").insert({
      workspace_owner_id: userId, user_id: foundId, role: data.role,
    } as never);

    return { ok: true, user_id: foundId };
  });


export const updateTeamMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ member_user_id: z.string().uuid(), role: TeamRole }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("team_members")
      .update({ role: data.role } as never)
      .eq("workspace_owner_id", userId)
      .eq("member_user_id", data.member_user_id);
    if (error) throw new Error(error.message);

    await supabase.from("user_roles").delete()
      .eq("workspace_owner_id", userId).eq("user_id", data.member_user_id);
    await supabase.from("user_roles").insert({
      workspace_owner_id: userId, user_id: data.member_user_id, role: data.role,
    } as never);
    return { ok: true };
  });

/** Atualiza nome, telefone e papel de um membro do workspace. */
export const updateTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      member_user_id: z.string().uuid(),
      full_name: z.string().trim().min(2, "Nome completo é obrigatório").max(120),
      phone: z.string().trim().min(8, "Telefone celular é obrigatório").max(32),
      role: TeamRole,
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const isOwner = data.member_user_id === userId;

    const { error: pErr } = await supabaseAdmin.from("profiles").upsert({
      id: data.member_user_id,
      full_name: data.full_name,
      phone: data.phone,
    } as never, { onConflict: "id" });
    if (pErr) throw new Error(pErr.message);

    try {
      await supabaseAdmin.auth.admin.updateUserById(data.member_user_id, {
        user_metadata: { full_name: data.full_name, phone: data.phone },
      });
    } catch { /* ignore */ }

    if (!isOwner) {
      const { error } = await supabase
        .from("team_members")
        .update({ role: data.role } as never)
        .eq("workspace_owner_id", userId)
        .eq("member_user_id", data.member_user_id);
      if (error) throw new Error(error.message);

      await supabase.from("user_roles").delete()
        .eq("workspace_owner_id", userId).eq("user_id", data.member_user_id);
      await supabase.from("user_roles").insert({
        workspace_owner_id: userId, user_id: data.member_user_id, role: data.role,
      } as never);
    }
    return { ok: true };
  });

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ member_user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("workspace_owner_id", userId)
      .eq("member_user_id", data.member_user_id);
    if (error) throw new Error(error.message);

    await supabase.from("user_roles").delete()
      .eq("workspace_owner_id", userId).eq("user_id", data.member_user_id);
    return { ok: true };
  });
