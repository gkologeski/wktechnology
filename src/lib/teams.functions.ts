// Server functions para Teams (gerenciar membros do workspace).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TeamRole = z.enum(["admin", "manager", "member"]);
export type TeamRole = z.infer<typeof TeamRole>;

/** URL canônica de produção do CRM — usada para links de convite por email. */
const CANONICAL_APP_URL = "https://crm.wktechnology.com.br";

/**
 * Resolve o origin para o link do convite. Se vier de um host do Lovable
 * (preview/sandbox/dev), substitui pela URL canônica de produção para que
 * o convidado caia no CRM e não no editor do Lovable.
 */
function resolveInviteOrigin(origin: string | undefined): string {
  if (!origin) return CANONICAL_APP_URL;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (host.endsWith("lovable.app") || host.endsWith("lovable.dev") || host.endsWith("lovableproject.com")) {
      return CANONICAL_APP_URL;
    }
    return origin.replace(/\/+$/, "");
  } catch {
    return CANONICAL_APP_URL;
  }
}

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
      .select("id, member_user_id, role, created_at, invited_at")
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

    // Buscar email + status de confirmação via admin (auth.users)
    const emailById = new Map<string, string>();
    const confirmedById = new Map<string, boolean>();
    await Promise.all(
      ids.map(async (id) => {
        try {
          const { data } = await supabaseAdmin.auth.admin.getUserById(id);
          if (data.user?.email) emailById.set(id, data.user.email);
          confirmedById.set(id, Boolean(data.user?.email_confirmed_at || data.user?.last_sign_in_at));
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
      pending: false,
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
      pending: !confirmedById.get(m.member_user_id as string),
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
      redirect_origin: z.string().trim().url().max(255).optional(),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const target = data.email.trim().toLowerCase();
    const redirectTo = data.redirect_origin
      ? `${data.redirect_origin.replace(/\/+$/, "")}/accept-invite`
      : undefined;

    // ---- Enforcement: limite de usuários do plano ----
    // O owner do workspace conta como 1 usuário. Comparamos
    // (1 owner + nº de team_members atuais) com get_entitlement_limit('users.max').
    {
      const [{ data: limitRow }, { count: currentMembers }] = await Promise.all([
        supabaseAdmin.rpc("get_entitlement_limit", {
          _workspace: userId, _key: "users.max",
        } as never),
        supabaseAdmin
          .from("team_members")
          .select("id", { count: "exact", head: true })
          .eq("workspace_owner_id", userId),
      ]);
      const limit = (limitRow as number | null) ?? null; // null = ilimitado
      const used = 1 + (currentMembers ?? 0); // +1 = owner
      if (limit !== null && used + 1 > limit) {
        throw new Error(
          `plan_limit_exceeded:users — seu plano permite até ${limit} usuário(s) e você já está no limite. Faça upgrade em Configurações → Planos e cobrança.`
        );
      }
    }



    // Achar user_id por email via admin
    let foundId: string | null = null;
    let alreadyConfirmed = false;
    let page = 1;
    while (page <= 20) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      const u = list.users.find((u) => (u.email ?? "").toLowerCase() === target);
      if (u) {
        foundId = u.id;
        alreadyConfirmed = Boolean(u.email_confirmed_at || u.last_sign_in_at);
        break;
      }
      if (list.users.length < 200) break;
      page++;
    }

    // Se não existir OU existir mas ainda não confirmou, envia (re)convite
    if (!foundId || !alreadyConfirmed) {
      const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(target, {
        data: { full_name: data.full_name, phone: data.phone },
        redirectTo,
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

/** Reenvia o email de convite para um membro pendente. */
export const resendTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      member_user_id: z.string().uuid(),
      redirect_origin: z.string().trim().url().max(255).optional(),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // garante que o usuário é membro do workspace
    const { data: tm, error: tmErr } = await supabaseAdmin
      .from("team_members")
      .select("id")
      .eq("workspace_owner_id", userId)
      .eq("member_user_id", data.member_user_id)
      .maybeSingle();
    if (tmErr) throw new Error(tmErr.message);
    if (!tm) throw new Error("Membro não encontrado neste workspace.");

    const { data: u, error: uErr } = await supabaseAdmin.auth.admin.getUserById(data.member_user_id);
    if (uErr || !u.user?.email) throw new Error(uErr?.message ?? "Email do usuário não encontrado.");

    const redirectTo = data.redirect_origin
      ? `${data.redirect_origin.replace(/\/+$/, "")}/accept-invite`
      : undefined;
    const meta = (u.user.user_metadata ?? {}) as { full_name?: string; phone?: string };
    const { error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(u.user.email, {
      data: { full_name: meta.full_name, phone: meta.phone },
      redirectTo,
    });
    if (invErr) throw new Error(invErr.message);
    return { ok: true };
  });

/** Chamado pela página /accept-invite após o usuário definir senha — grava nome/telefone no profile. */
export const completeInviteProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      full_name: z.string().trim().min(2).max(120),
      phone: z.string().trim().min(8).max(32),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      full_name: data.full_name,
      phone: data.phone,
    } as never, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
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
