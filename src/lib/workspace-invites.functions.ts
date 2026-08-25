// Server fns para convites do workspace (token-based, gerenciados pelo admin do workspace).
import * as React from "react";
import { render as renderEmail } from "@react-email/render";
import { sendLovableEmail } from "@lovable.dev/email-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { getOrCreateEmailUnsubscribeToken } from "@/lib/email-unsubscribe.server";

const SENDER_DOMAIN = "notify.crm.wktechnology.com.br";
const FROM_DOMAIN = "notify.crm.wktechnology.com.br";
const FROM_NAME = "WK Technology";

async function sendWorkspaceInviteEmail(args: {
  to: string;
  inviteUrl: string;
  workspaceName: string;
  inviterName: string;
  role: string;
  expiresAt: string;
  inviteId: string;
  branding?: {
    brand_name?: string | null;
    logo_url?: string | null;
    primary_color?: string | null;
  } | null;
  settings?: {
    subject?: string | null;
    greeting?: string | null;
    body_intro?: string | null;
    cta_label?: string | null;
    footer_note?: string | null;
    expires_note?: string | null;
    product_name?: string | null;
  } | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const messageId = crypto.randomUUID();
  const templateName = "workspace-invite";
  const template = TEMPLATES[templateName];
  const templateData = {
    inviteeEmail: args.to,
    workspaceName: args.workspaceName,
    inviterName: args.inviterName,
    roleLabel: args.role,
    inviteUrl: args.inviteUrl,
    expiresAt: args.expiresAt,
    // Branding
    brandName: args.branding?.brand_name || args.workspaceName,
    logoUrl: args.branding?.logo_url || undefined,
    primaryColor: args.branding?.primary_color || undefined,
    // Textos customizáveis
    productName: args.settings?.product_name || "TechERP",
    subject: args.settings?.subject || undefined,
    greeting: args.settings?.greeting || undefined,
    bodyIntro: args.settings?.body_intro || undefined,
    ctaLabel: args.settings?.cta_label || undefined,
    footerNote: args.settings?.footer_note || undefined,
    expiresNote: args.settings?.expires_note || undefined,
  };

  try {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
    if (!template) throw new Error("Template workspace-invite não registrado");
    const unsubscribeToken = await getOrCreateEmailUnsubscribeToken(args.to);

    const element = React.createElement(template.component, templateData);
    const html = await renderEmail(element);
    const text = await renderEmail(element, { plainText: true });
    const subject =
      typeof template.subject === "function" ? template.subject(templateData) : template.subject;

    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: args.to,
      status: "pending",
    } as never);

    await sendLovableEmail(
      {
        to: args.to,
        from: `${FROM_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: "transactional",
        label: templateName,
        idempotency_key: `workspace-invite:${args.inviteId}`,
        message_id: messageId,
        unsubscribe_token: unsubscribeToken,
      },
      { apiKey, sendUrl: process.env.LOVABLE_SEND_URL },
    );

    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: args.to,
      status: "sent",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("workspace-invite email failed", message);
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: args.to,
      status: "failed",
      error_message: message,
    } as never);
    throw new Error(`Falha ao enviar convite por e-mail: ${message}`);
  }
}

async function loadInviteContext(workspaceId: string, inviterId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: ws }, { data: prof }, { data: branding }, { data: settings }] = await Promise.all([
    supabaseAdmin.from("workspaces").select("name").eq("id", workspaceId).maybeSingle(),
    supabaseAdmin.from("profiles").select("full_name").eq("id", inviterId).maybeSingle(),
    supabaseAdmin
      .from("workspace_branding")
      .select("brand_name, logo_url, primary_color")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabaseAdmin
      .from("workspace_invite_settings")
      .select("subject, greeting, body_intro, cta_label, footer_note, expires_note, product_name")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
  ]);
  return {
    workspaceName: (ws?.name as string) ?? "WK Technology",
    inviterName: (prof?.full_name as string) ?? "Sua equipe",
    branding: (branding ?? null) as {
      brand_name?: string | null;
      logo_url?: string | null;
      primary_color?: string | null;
    } | null,
    settings: (settings ?? null) as {
      subject?: string | null;
      greeting?: string | null;
      body_intro?: string | null;
      cta_label?: string | null;
      footer_note?: string | null;
      expires_note?: string | null;
      product_name?: string | null;
    } | null,
  };
}

const Role = z.enum(["admin", "manager", "member"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveActiveWorkspace(supabase: any, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.active_workspace_id) return profile.active_workspace_id as string;
  const { data: m } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!m?.workspace_id) throw new Error("Usuário não pertence a nenhum workspace.");
  return m.workspace_id as string;
}

async function assertWorkspaceAdmin(workspaceId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.role !== "admin")
    throw new Error("Apenas admins do workspace podem fazer isso.");
}

function randomToken(): string {
  // 32 bytes base64url
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Lista membros + convites pendentes do workspace ativo. */
export const listWorkspaceTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);

    const { data: members } = await supabaseAdmin
      .from("workspace_members")
      .select("user_id, role, joined_at")
      .eq("workspace_id", workspaceId);

    const ids = (members ?? []).map((m) => m.user_id as string);
    const profileMap = new Map<string, { name: string; phone: string }>();
    const emailMap = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", ids);
      for (const p of profs ?? []) {
        profileMap.set(p.id as string, {
          name: (p.full_name as string) ?? "",
          phone: ((p as { phone?: string | null }).phone ?? "") as string,
        });
      }
      await Promise.all(
        ids.map(async (id) => {
          try {
            const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
            if (u.user?.email) emailMap.set(id, u.user.email);
          } catch {
            /* ignore */
          }
        }),
      );
    }

    const { data: invites } = await supabaseAdmin
      .from("workspace_invites")
      .select("id, email, role, expires_at, created_at, accepted_at")
      .eq("workspace_id", workspaceId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });

    return {
      workspace_id: workspaceId,
      members: (members ?? []).map((m) => ({
        user_id: m.user_id as string,
        role: m.role as "admin" | "manager" | "member",
        joined_at: m.joined_at as string,
        full_name: profileMap.get(m.user_id as string)?.name ?? "",
        phone: profileMap.get(m.user_id as string)?.phone ?? "",
        email: emailMap.get(m.user_id as string) ?? "",
      })),
      invites: (invites ?? []).map((i) => ({
        id: i.id as string,
        email: i.email as string,
        role: i.role as "admin" | "manager" | "member",
        expires_at: i.expires_at as string,
        created_at: i.created_at as string,
      })),
    };
  });

/** Cria convite por token (admin do workspace ativo). Retorna a URL pública. */
export const createWorkspaceInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        role: Role,
        permission_set_id: z
          .string({ required_error: "Selecione um conjunto de permissões" })
          .uuid("Selecione um conjunto de permissões"),
        redirect_origin: z.string().trim().url().max(255),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    await assertWorkspaceAdmin(workspaceId, userId);

    const email = data.email.toLowerCase();
    const token = randomToken();

    // Valida que o conjunto de permissões pertence ao workspace (ou é system).
    {
      const { data: ws } = await supabaseAdmin
        .from("workspaces")
        .select("created_by")
        .eq("id", workspaceId)
        .maybeSingle();
      const workspaceOwnerId = (ws as { created_by?: string } | null)?.created_by ?? userId;
      const { data: set } = await supabaseAdmin
        .from("permission_sets")
        .select("id, is_system, owner_id")
        .eq("id", data.permission_set_id)
        .maybeSingle();
      const setRow = set as { is_system?: boolean; owner_id?: string | null } | null;
      const belongs = !!setRow && (setRow.is_system || setRow.owner_id === workspaceOwnerId);
      if (!belongs) throw new Error("Conjunto de permissões inválido para este workspace.");
    }

    // ---- Enforcement: limite de usuários do plano ----
    // Owner conta como 1. Comparamos (membros atuais + 1) com get_entitlement_limit('users.max').
    {
      const [{ data: limitRow }, { count: currentMembers }] = await Promise.all([
        supabaseAdmin.rpc("get_entitlement_limit", {
          _workspace: workspaceId,
          _key: "users.max",
        } as never),
        supabaseAdmin
          .from("workspace_members")
          .select("workspace_id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId),
      ]);
      const limit = (limitRow as number | null) ?? null; // null = ilimitado
      const used = currentMembers ?? 0;
      if (limit !== null && used + 1 > limit) {
        throw new Error(
          `plan_limit_exceeded:users — seu plano permite até ${limit} usuário(s) e você já está no limite. Faça upgrade em Configurações → Planos e cobrança.`,
        );
      }
    }

    // Revoga qualquer convite pendente do mesmo email para o mesmo workspace
    await supabaseAdmin
      .from("workspace_invites")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("email", email)
      .is("accepted_at", null);

    const { data: inserted, error } = await supabaseAdmin
      .from("workspace_invites")
      .insert({
        workspace_id: workspaceId,
        email,
        role: data.role,
        token,
        invited_by: userId,
        permission_set_id: data.permission_set_id,
      } as never)
      .select("id, expires_at")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Falha ao criar convite.");

    const url = `${data.redirect_origin.replace(/\/+$/, "")}/accept-invite/${token}`;
    const ctx = await loadInviteContext(workspaceId, userId);
    await sendWorkspaceInviteEmail({
      to: email,
      inviteUrl: url,
      workspaceName: ctx.workspaceName,
      inviterName: ctx.inviterName,
      role: data.role,
      expiresAt: (inserted as { expires_at: string }).expires_at,
      inviteId: (inserted as { id: string }).id,
      branding: ctx.branding,
      settings: ctx.settings,
    });

    await supabaseAdmin.from("audit_logs").insert({
      workspace_owner_id: workspaceId,
      actor_user_id: userId,
      entity: "workspace_invite",
      entity_id: (inserted as { id: string }).id,
      action: "invite.created",
      after: { email, role: data.role, permission_set_id: data.permission_set_id },
    } as never);

    return { ok: true, url, token, email, emailed: true };
  });

/** Reenvia o e-mail de um convite pendente (sem regenerar o token). */
export const resendWorkspaceInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        invite_id: z.string().uuid(),
        redirect_origin: z.string().trim().url().max(255),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    await assertWorkspaceAdmin(workspaceId, userId);

    const { data: inv, error } = await supabaseAdmin
      .from("workspace_invites")
      .select("id, email, role, token, expires_at, accepted_at, permission_set_id")
      .eq("id", data.invite_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Convite não encontrado.");
    if (inv.accepted_at) throw new Error("Este convite já foi aceito.");
    if (!(inv as { permission_set_id?: string | null }).permission_set_id) {
      throw new Error(
        "Este convite foi criado sem conjunto de permissões. Revogue e crie um novo.",
      );
    }

    const url = `${data.redirect_origin.replace(/\/+$/, "")}/accept-invite/${inv.token as string}`;
    const ctx = await loadInviteContext(workspaceId, userId);
    await sendWorkspaceInviteEmail({
      to: inv.email as string,
      inviteUrl: url,
      workspaceName: ctx.workspaceName,
      inviterName: ctx.inviterName,
      role: inv.role as string,
      expiresAt: inv.expires_at as string,
      inviteId: inv.id as string,
      branding: ctx.branding,
      settings: ctx.settings,
    });

    await supabaseAdmin.from("audit_logs").insert({
      workspace_owner_id: workspaceId,
      actor_user_id: userId,
      entity: "workspace_invite",
      entity_id: inv.id as string,
      action: "invite.resent",
      after: { email: inv.email, role: inv.role },
    } as never);

    return { ok: true, url };
  });

/** Revoga convite pendente (admin do workspace ativo). */
export const revokeWorkspaceInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ invite_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    await assertWorkspaceAdmin(workspaceId, userId);
    const { data: invRow } = await supabaseAdmin
      .from("workspace_invites")
      .select("id, email, role")
      .eq("id", data.invite_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    const { error } = await supabaseAdmin
      .from("workspace_invites")
      .delete()
      .eq("id", data.invite_id)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      workspace_owner_id: workspaceId,
      actor_user_id: userId,
      entity: "workspace_invite",
      entity_id: data.invite_id,
      action: "invite.revoked",
      before: invRow ? { email: invRow.email, role: invRow.role } : null,
    } as never);
    return { ok: true };
  });

const ASSIGNED_TABLES = ["contacts", "companies", "leads", "deals"] as const;

/** Conta registros atribuídos a um membro no workspace ativo. */
export const countAssignedToMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    await assertWorkspaceAdmin(workspaceId, userId);
    const counts: Record<string, number> = {};
    for (const t of ASSIGNED_TABLES) {
      const { count } = await supabaseAdmin
        .from(t)
        .select("id", { head: true, count: "exact" })
        .eq("workspace_id", workspaceId)
        .eq("assigned_user_id", data.user_id);
      counts[t] = count ?? 0;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return { counts, total };
  });

/** Remove membro do workspace ativo (admin). Opcionalmente reatribui registros. */
export const removeWorkspaceMemberFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        user_id: z.string().uuid(),
        reassign_to: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    await assertWorkspaceAdmin(workspaceId, userId);
    if (data.user_id === userId) throw new Error("Você não pode remover a si mesmo.");

    const reassignTo = data.reassign_to ?? null;
    if (reassignTo) {
      if (reassignTo === data.user_id) throw new Error("Reatribua para um membro diferente.");
      const { data: target } = await supabaseAdmin
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", reassignTo)
        .maybeSingle();
      if (!target) throw new Error("Membro de destino não pertence ao workspace.");
    }

    let reassigned = 0;
    for (const t of ASSIGNED_TABLES) {
      const update = reassignTo ? { assigned_user_id: reassignTo } : { assigned_user_id: null };
      const { count, error: uErr } = await supabaseAdmin
        .from(t)
        .update(update as never, { count: "exact" })
        .eq("workspace_id", workspaceId)
        .eq("assigned_user_id", data.user_id);
      if (uErr) throw new Error(uErr.message);
      reassigned += count ?? 0;
    }

    const { error } = await supabaseAdmin
      .from("workspace_members")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true, reassigned };
  });

/** Atualiza papel de um membro (admin). */
export const updateWorkspaceMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid(), role: Role }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    await assertWorkspaceAdmin(workspaceId, userId);
    const { error } = await supabaseAdmin
      .from("workspace_members")
      .update({ role: data.role } as never)
      .eq("workspace_id", workspaceId)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** PÚBLICA: lê convite por token (sem auth). Retorna dados básicos do workspace. */
export const lookupInviteByToken = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ token: z.string().min(10).max(200) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("workspace_invites")
      .select("id, workspace_id, email, role, expires_at, accepted_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!inv) return { valid: false as const, reason: "not_found" as const };
    if (inv.accepted_at) return { valid: false as const, reason: "accepted" as const };
    if (new Date(inv.expires_at as string).getTime() < Date.now())
      return { valid: false as const, reason: "expired" as const };

    const [{ data: ws }, { data: branding }, { data: settings }] = await Promise.all([
      supabaseAdmin
        .from("workspaces")
        .select("name, slug")
        .eq("id", inv.workspace_id as string)
        .maybeSingle(),
      supabaseAdmin
        .from("workspace_branding")
        .select("brand_name, logo_url, primary_color")
        .eq("workspace_id", inv.workspace_id as string)
        .maybeSingle(),
      supabaseAdmin
        .from("workspace_invite_settings")
        .select("product_name")
        .eq("workspace_id", inv.workspace_id as string)
        .maybeSingle(),
    ]);

    // Verifica se já existe usuário com esse email
    const target = (inv.email as string).toLowerCase();
    let userExists = false;
    let page = 1;
    while (page <= 20) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) break;
      if (list.users.some((u) => (u.email ?? "").toLowerCase() === target)) {
        userExists = true;
        break;
      }
      if (list.users.length < 200) break;
      page++;
    }

    return {
      valid: true as const,
      email: inv.email as string,
      role: inv.role as "admin" | "manager" | "member",
      workspace: {
        id: inv.workspace_id as string,
        name: (ws?.name as string) ?? "",
        slug: (ws?.slug as string) ?? "",
      },
      branding: {
        brand_name: (branding?.brand_name as string) ?? null,
        logo_url: (branding?.logo_url as string) ?? null,
        primary_color: (branding?.primary_color as string) ?? null,
      },
      product_name: (settings?.product_name as string) ?? "TechERP",
      user_exists: userExists,
    };
  });

/** PÚBLICA: consome convite — cria usuário (se necessário) e adiciona ao workspace. */
export const consumeInvite = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        token: z.string().min(10).max(200),
        password: z.string().min(8).max(200),
        full_name: z.string().trim().min(2).max(120),
        phone: z.string().trim().min(8).max(32),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("workspace_invites")
      .select("id, workspace_id, email, role, expires_at, accepted_at, permission_set_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!inv) throw new Error("Convite não encontrado.");
    if (inv.accepted_at) throw new Error("Este convite já foi utilizado.");
    if (new Date(inv.expires_at as string).getTime() < Date.now())
      throw new Error("Convite expirado.");

    const email = (inv.email as string).toLowerCase();

    // Encontra ou cria o usuário no Auth
    let userId: string | null = null;
    let page = 1;
    while (page <= 20) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw new Error(error.message);
      const u = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
      if (u) {
        userId = u.id;
        break;
      }
      if (list.users.length < 200) break;
      page++;
    }

    if (!userId) {
      const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.full_name, phone: data.phone },
      });
      if (cErr || !created.user) throw new Error(cErr?.message ?? "Falha ao criar usuário.");
      userId = created.user.id;
    } else {
      // Atualiza senha + metadata para garantir login
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.full_name, phone: data.phone },
      });
    }

    // Garante profile
    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        full_name: data.full_name,
        phone: data.phone,
        active_workspace_id: inv.workspace_id,
      } as never,
      { onConflict: "id" },
    );

    // Adiciona como membro
    const { error: mErr } = await supabaseAdmin.from("workspace_members").insert({
      workspace_id: inv.workspace_id,
      user_id: userId,
      role: inv.role,
      invited_by: null,
    } as never);
    if (mErr && mErr.code !== "23505") throw new Error(mErr.message);

    // Atribui o job_role padrão para que user_has_permission retorne true.
    // Sem isso, RLS bloqueia inserts em activities/deals/etc. para membros novos.
    const jobRoleId =
      inv.role === "owner"
        ? "aaaaaaaa-0000-4000-8000-000000000009"
        : inv.role === "admin"
          ? "aaaaaaaa-0000-4000-8000-000000000008"
          : inv.role === "manager"
            ? "aaaaaaaa-0000-4000-8000-000000000002"
            : "aaaaaaaa-0000-4000-8000-000000000001"; // member -> Vendedor

    // Convenção do RBAC: owner_id nessas tabelas é o auth.uid do criador do
    // workspace (é o que as policies exigem para escrita/gestão).
    const { data: wsRow } = await supabaseAdmin
      .from("workspaces")
      .select("created_by")
      .eq("id", inv.workspace_id as string)
      .maybeSingle();
    const workspaceOwnerId =
      (wsRow as { created_by?: string } | null)?.created_by ?? (inv.workspace_id as string);

    const { error: jrErr } = await supabaseAdmin.from("user_job_roles").insert({
      user_id: userId,
      role_id: jobRoleId,
      owner_id: workspaceOwnerId,
      workspace_id: inv.workspace_id as string,
      is_primary: true,
    } as never);
    if (jrErr && jrErr.code !== "23505") throw new Error(jrErr.message);

    // Aplica o conjunto de permissões escolhido no convite (se houver).
    const chosenSetId = (inv as { permission_set_id?: string | null }).permission_set_id ?? null;
    if (chosenSetId) {
      const { error: upsErr } = await supabaseAdmin.from("user_permission_sets").insert({
        user_id: userId,
        owner_id: workspaceOwnerId,
        workspace_id: inv.workspace_id as string,
        set_id: chosenSetId,
      } as never);

      if (upsErr && upsErr.code !== "23505") throw new Error(upsErr.message);
    }

    // Marca convite como aceito
    await supabaseAdmin
      .from("workspace_invites")
      .update({ accepted_at: new Date().toISOString() } as never)
      .eq("id", inv.id as string);

    return { ok: true, email };
  });

/** Revoga em massa convites pendentes sem conjunto de permissões definido. */
export const bulkRevokeInvalidWorkspaceInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    await assertWorkspaceAdmin(workspaceId, userId);

    const { data: rows, error: selErr } = await supabaseAdmin
      .from("workspace_invites")
      .select("id, email, role")
      .eq("workspace_id", workspaceId)
      .is("accepted_at", null)
      .is("permission_set_id", null);
    if (selErr) throw new Error(selErr.message);
    const ids = ((rows ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (ids.length === 0) return { ok: true, revoked: 0 };

    const { error: delErr } = await supabaseAdmin.from("workspace_invites").delete().in("id", ids);
    if (delErr) throw new Error(delErr.message);

    await supabaseAdmin.from("audit_logs").insert({
      workspace_owner_id: workspaceId,
      actor_user_id: userId,
      entity: "workspace_invite",
      entity_id: null,
      action: "invite.bulk_revoked_missing_permission",
      after: { count: ids.length },
    } as never);

    return { ok: true, revoked: ids.length };
  });
