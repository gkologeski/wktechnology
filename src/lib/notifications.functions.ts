import { workRpc } from "@/lib/access-control/work-core.server";
import { assertSalesRecord } from "@/lib/access-control/sales-core.server";
// Server functions for in-app notifications.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { scopeNotifications } from "@/lib/notification-cursor";
import {
  activityNotificationContent,
  parseNotificationCenterPage,
} from "@/lib/notification-center";
import type { NotificationCategory } from "@/lib/notification-catalog";
import {
  DEFAULT_NOTIFICATION_PREFS as DEFAULT_PREFS,
  normalizeNotificationPrefs as mergeWithDefaults,
  notificationPrefsPatchSchema,
  applyNotificationPrefsPatch,
  type NotificationPrefs,
} from "@/lib/notification-preferences";
import type { Json } from "@/integrations/supabase/types";

// Keep the existing import surface for callers compiled against the legacy module.
export type { NotificationCategory } from "@/lib/notification-catalog";
export type { NotificationPrefs } from "@/lib/notification-preferences";

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        cursor: z
          .object({ createdAt: z.string().datetime({ offset: true }), id: z.string().uuid() })
          .nullish(),
        cutoff: z.string().datetime({ offset: true }).nullish(),
      })
      .optional()
      .parse(i),
  )
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const workspace = await notificationWorkspace(supabase, userId);
    return parseNotificationCenterPage(
      await workRpc(supabase, "notification_center_list", {
        p_workspace: workspace,
        p_cursor: input?.cursor ?? null,
        p_cutoff: input?.cutoff ?? input?.cursor?.createdAt ?? null,
      }),
    );
  });

async function notificationWorkspace(
  supabase: Parameters<typeof workRpc>[0],
  userId: string,
  write = false,
) {
  if (!z.string().uuid().safeParse(userId).success) throw new Error("Sessão inválida.");
  const c = await workRpc<{ actor?: string; workspace?: string; read_only?: boolean }>(
    supabase,
    "work_access_context",
    {},
  );
  if (!c.workspace || c.actor !== userId)
    throw new Error("Membro ativo e workspace selecionado são obrigatórios.");
  if (write && c.read_only === true) throw new Error("Esta sessão permite somente leitura.");
  return c.workspace;
}

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const workspace = await notificationWorkspace(context.supabase, context.userId);
    const result = await workRpc<{ updated: number }>(
      context.supabase,
      "notification_center_mark",
      {
        p_workspace: workspace,
        p_ids: [data.id],
        p_cutoff: new Date().toISOString(),
        p_read: true,
      },
    );
    return { ok: true, updated: result.updated };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(100),
        cutoff: z.string().datetime({ offset: true }),
      })
      .strict()
      .optional()
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const workspace = await notificationWorkspace(context.supabase, context.userId);
    if (!data)
      throw new Error("Abra a central para marcar apenas as notificações visíveis como lidas.");
    const result = await workRpc<{ updated: number }>(
      context.supabase,
      "notification_center_mark",
      {
        p_workspace: workspace,
        p_ids: data.ids,
        p_cutoff: data.cutoff,
        p_read: true,
      },
    );
    return { ok: true, updated: result.updated };
  });

// ============ Notification Preferences ============

export const getMyNotificationPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    await notificationWorkspace(context.supabase, userId);
    // notification_preferences is not exposed to authenticated clients via the
    // Data API (column-level GRANT restricted). Read with the service-role
    // client, scoped to the current user only.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await scopeNotifications(
      supabaseAdmin.from("profiles").select("notification_preferences"),
      userId,
      "id",
    ).maybeSingle();
    if (error) throw new Error(error.message);
    return { prefs: mergeWithDefaults(data?.notification_preferences) };
  });

export const updateMyNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ prefs: notificationPrefsPatchSchema }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await notificationWorkspace(context.supabase, userId, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Older clients send only seven categories. Merge over the current server value,
    // retaining future JSON fields. Compare-and-swap prevents concurrent saves losing them.
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await scopeNotifications(
        supabaseAdmin.from("profiles").select("notification_preferences"),
        userId,
        "id",
      ).maybeSingle();
      if (current.error) throw new Error(current.error.message);
      if (!current.data) throw new Error("Perfil não encontrado para salvar preferências.");
      const stored = current.data.notification_preferences;
      let update = scopeNotifications(
        supabaseAdmin.from("profiles").update({
          notification_preferences: applyNotificationPrefsPatch(stored, data.prefs) as Json,
        }),
        userId,
        "id",
      );
      // Column is jsonb NOT NULL; JavaScript null represents JSON null, not SQL NULL.
      update = update.eq("notification_preferences", JSON.stringify(stored));
      const saved = await update.select("id").maybeSingle();
      if (saved.error) throw new Error(saved.error.message);
      if (saved.data) return { ok: true };
    }
    throw new Error(
      "As preferências foram alteradas em outra sessão. Recarregue e tente novamente.",
    );
  });

// ============ Activity event → notifications + email ============

function snippetFromHtml(html: string | null | undefined, maxLen = 180): string {
  if (!html) return "";
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

function resolveLink(a: {
  related_deal_id?: string | null;
  related_contact_id?: string | null;
  related_company_id?: string | null;
  related_lead_id?: string | null;
  related_ticket_id?: string | null;
}): { link: string | null; entity: string | null; entity_id: string | null } {
  if (a.related_deal_id)
    return { link: `/deals/${a.related_deal_id}`, entity: "deal", entity_id: a.related_deal_id };
  if (a.related_ticket_id)
    return {
      link: `/tickets/${a.related_ticket_id}`,
      entity: "ticket",
      entity_id: a.related_ticket_id,
    };
  if (a.related_contact_id)
    return {
      link: `/contacts/${a.related_contact_id}`,
      entity: "contact",
      entity_id: a.related_contact_id,
    };
  if (a.related_company_id)
    return {
      link: `/companies/${a.related_company_id}`,
      entity: "company",
      entity_id: a.related_company_id,
    };
  if (a.related_lead_id)
    return { link: `/leads/${a.related_lead_id}`, entity: "lead", entity_id: a.related_lead_id };
  return { link: null, entity: null, entity_id: null };
}

export const notifyActivityEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ activityId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSalesRecord(supabase, "activities", data.activityId, "update");
    const { data: activity, error: aerr } = await supabase
      .from("activities")
      .select(
        "id, owner_id, workspace_id, created_by, type, subject, body, mentions, related_deal_id, related_contact_id, related_company_id, related_lead_id, related_ticket_id",
      )
      .eq("id", data.activityId)
      .maybeSingle();
    if (aerr || !activity) return { ok: false, reason: "not_found" };

    const a = activity as unknown as {
      id: string;
      owner_id: string;
      workspace_id: string;
      created_by: string;
      type: string;
      subject: string | null;
      body: string | null;
      mentions: string[] | null;
      related_deal_id: string | null;
      related_contact_id: string | null;
      related_company_id: string | null;
      related_lead_id: string | null;
      related_ticket_id: string | null;
    };

    const author = a.created_by ?? userId;
    // Author display name
    const { data: authorProf } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", author)
      .maybeSingle();
    const authorName = authorProf?.full_name ?? "Alguém";

    const link = resolveLink(a);
    const snippet = snippetFromHtml(a.subject ?? a.body ?? "");

    type Target = { userId: string; category: NotificationCategory };
    const targets: Target[] = [];
    const mentionIds = (a.mentions ?? []).filter((id) => id && id !== author);
    for (const id of mentionIds) targets.push({ userId: id, category: "mention" });
    if (a.type === "task" && a.owner_id && a.owner_id !== author) {
      targets.push({ userId: a.owner_id, category: "assignment" });
    }

    const { data: activeMembers } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", a.workspace_id)
      .eq("status", "active");
    const active = new Set((activeMembers ?? []).map((m) => m.user_id));
    for (let i = targets.length - 1; i >= 0; i--)
      if (!active.has(targets[i].userId)) targets.splice(i, 1);
    const { supabaseAdmin: recipientGuard } = await import("@/integrations/supabase/client.server");
    const visibility = await Promise.all(
      targets.map(async (target) => ({
        id: target.userId,
        allowed: await workRpc<boolean>(recipientGuard, "sales_notification_allowed", {
          p_actor: userId,
          p_recipient: target.userId,
          p_table: "activities",
          p_id: a.id,
        }),
      })),
    );
    const readable = new Set(visibility.filter((v) => v.allowed).map((v) => v.id));
    for (let i = targets.length - 1; i >= 0; i--)
      if (!readable.has(targets[i].userId)) targets.splice(i, 1);
    if (targets.length === 0) return { ok: true, sent: 0 };

    // Fetch preferences for all targets
    const uniqueIds = Array.from(new Set(targets.map((t) => t.userId)));
    // notification_preferences is server-only (column-level GRANT restricted);
    // use the admin client and scope by the mention/assignment target ids only.
    const { supabaseAdmin: notifAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prefRows } = await notifAdmin
      .from("profiles")
      .select("id, full_name, notification_preferences")
      .in("id", uniqueIds);
    const prefMap = new Map<string, { full_name: string | null; prefs: NotificationPrefs }>();
    for (const row of prefRows ?? []) {
      prefMap.set((row as { id: string }).id, {
        full_name: (row as { full_name: string | null }).full_name,
        prefs: mergeWithDefaults(
          (row as { notification_preferences: unknown }).notification_preferences,
        ),
      });
    }

    // Build origin for email link (server-only helper loaded inside the handler)
    const { getRequestOrigin } = await import("@/lib/request-origin.server");
    const origin = getRequestOrigin();

    const fullLink = link.link ? `${origin}${link.link}` : origin || undefined;

    // Insert in-app notifications + collect email targets
    const inappRows: Array<Record<string, unknown>> = [];
    const emailJobs: Array<{
      to: string;
      recipientName: string | null;
      category: NotificationCategory;
    }> = [];

    for (const t of targets) {
      const p = prefMap.get(t.userId);
      const prefs = p?.prefs ?? DEFAULT_PREFS;
      const channel = prefs[t.category];
      const title =
        t.category === "assignment"
          ? `${authorName} atribuiu uma tarefa a você`
          : `${authorName} mencionou você`;
      if (channel.inapp) {
        inappRows.push({
          owner_id: a.workspace_id,
          user_id: t.userId,
          type: t.category,
          title,
          ...activityNotificationContent(a.id, a.workspace_id),
        });
      }
      if (channel.email) {
        emailJobs.push({ to: t.userId, recipientName: p?.full_name ?? null, category: t.category });
      }
    }

    if (inappRows.length > 0) {
      // Use service role to insert: client-side inserts are disallowed by RLS
      // to prevent workspace members from spoofing notifications to peers.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: insertErr } = await supabaseAdmin
        .from("notifications")
        .insert(inappRows as never);
      if (insertErr) console.error("notify insert failed", insertErr.message);
    }

    // Send emails (admin needed to read auth.users.email)
    if (emailJobs.length > 0) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendTransactionalEmailFromServer } = await import("@/lib/email-send.server");
        for (const job of emailJobs) {
          // Resolve email
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(job.to);
          const email = u?.user?.email;
          if (!email) continue;
          try {
            const res = await sendTransactionalEmailFromServer({
              supabase: supabaseAdmin,
              templateName: "mention-notification",
              recipientEmail: email,
              idempotencyKey: `${job.category}:${a.id}:${job.to}`,
              templateData: {
                recipientName: job.recipientName,
                mentionerName: authorName,
                category: job.category,
                snippet,
                link: fullLink,
              },
            });
            if (res.status === "error") console.error("send email failed", res.error);
          } catch (e) {
            console.error("send email failed", e);
          }
        }
      } catch (e) {
        console.error("admin import failed", e);
      }
    }

    return { ok: true, sent: targets.length };
  });

// ============ Activity comment → notifications ============

export const notifyActivityCommentEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        commentId: z.string().uuid(),
        activityId: z.string().uuid(),
        mentionIds: z.array(z.string().uuid()).default([]),
        previousMentionIds: z.array(z.string().uuid()).default([]),
        bodySnippet: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSalesRecord(supabase, "activities", data.activityId, "update");

    const { data: activity, error: aerr } = await supabase
      .from("activities")
      .select(
        "id, owner_id, workspace_id, created_by, subject, body, related_deal_id, related_contact_id, related_company_id, related_lead_id, related_ticket_id",
      )
      .eq("id", data.activityId)
      .maybeSingle();
    if (aerr || !activity) return { ok: false, reason: "not_found" };

    const a = activity as unknown as {
      id: string;
      owner_id: string | null;
      workspace_id: string;
      created_by: string | null;
      subject: string | null;
      body: string | null;
      related_deal_id: string | null;
      related_contact_id: string | null;
      related_company_id: string | null;
      related_lead_id: string | null;
      related_ticket_id: string | null;
    };

    const { data: savedComment } = await supabase
      .from("activity_comments")
      .select("body,mentions,author_id")
      .eq("id", data.commentId)
      .eq("activity_id", data.activityId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!savedComment || savedComment.author_id !== userId)
      throw new Error("Comentário indisponível para notificação.");
    const author = userId;
    const { data: authorProf } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", author)
      .maybeSingle();
    const authorName = authorProf?.full_name ?? "Alguém";

    // Diff mentions vs previous (edits only notify new mentions)
    const prev = new Set(data.previousMentionIds ?? []);
    const newMentions = (savedComment.mentions ?? []).filter(
      (id) => id && id !== author && !prev.has(id),
    );

    type Target = { userId: string; category: NotificationCategory };
    const seen = new Set<string>();
    const targets: Target[] = [];
    for (const id of newMentions) {
      if (seen.has(id)) continue;
      seen.add(id);
      targets.push({ userId: id, category: "mention" });
    }
    // Only notify activity owner/creator on the first insert (no previous mentions)
    const isFirstInsert = (data.previousMentionIds ?? []).length === 0;
    if (isFirstInsert) {
      const stakeholders = [a.owner_id, a.created_by].filter(
        (id): id is string => !!id && id !== author,
      );
      for (const id of stakeholders) {
        if (seen.has(id)) continue;
        seen.add(id);
        targets.push({ userId: id, category: "message" });
      }
    }

    const { supabaseAdmin: recipientGuard } = await import("@/integrations/supabase/client.server");
    const visibility = await Promise.all(
      targets.map(async (target) => ({
        id: target.userId,
        allowed: await workRpc<boolean>(recipientGuard, "sales_notification_allowed", {
          p_actor: userId,
          p_recipient: target.userId,
          p_table: "activities",
          p_id: a.id,
        }),
      })),
    );
    const readable = new Set(visibility.filter((v) => v.allowed).map((v) => v.id));
    for (let i = targets.length - 1; i >= 0; i--)
      if (!readable.has(targets[i].userId)) targets.splice(i, 1);
    if (targets.length === 0) return { ok: true, sent: 0 };

    // Só notifica membros ativos do workspace da atividade.
    {
      const { supabaseAdmin: memAdmin } = await import("@/integrations/supabase/client.server");
      const { data: mem } = await memAdmin
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", a.workspace_id)
        .eq("status", "active")
        .in("user_id", Array.from(new Set(targets.map((t) => t.userId))));
      const allowed = new Set((mem ?? []).map((m) => (m as { user_id: string }).user_id));
      for (let i = targets.length - 1; i >= 0; i--) {
        if (!allowed.has(targets[i].userId)) targets.splice(i, 1);
      }
    }
    if (targets.length === 0) return { ok: true, sent: 0 };

    const uniqueIds = Array.from(new Set(targets.map((t) => t.userId)));
    const { supabaseAdmin: prefAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prefRows } = await prefAdmin
      .from("profiles")
      .select("id, notification_preferences")
      .in("id", uniqueIds);
    const prefMap = new Map<string, NotificationPrefs>();
    for (const row of prefRows ?? []) {
      prefMap.set(
        (row as { id: string }).id,
        mergeWithDefaults((row as { notification_preferences: unknown }).notification_preferences),
      );
    }

    const inappRows: Array<Record<string, unknown>> = [];
    for (const t of targets) {
      const prefs = prefMap.get(t.userId) ?? DEFAULT_PREFS;
      if (!prefs[t.category].inapp) continue;
      const title =
        t.category === "mention"
          ? `${authorName} mencionou você em um comentário`
          : `${authorName} comentou em uma atividade`;
      inappRows.push({
        owner_id: a.workspace_id,
        user_id: t.userId,
        type: t.category,
        title,
        ...activityNotificationContent(a.id, a.workspace_id, true),
      });
    }

    if (inappRows.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: insertErr } = await supabaseAdmin
        .from("notifications")
        .insert(inappRows as never);
      if (insertErr) console.error("notify comment insert failed", insertErr.message);
    }

    return { ok: true, sent: inappRows.length };
  });
