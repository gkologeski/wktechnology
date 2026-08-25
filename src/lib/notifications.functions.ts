// Server functions for in-app notifications.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, entity, entity_id, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const unread = (data ?? []).filter((n) => !n.read_at).length;
    return { items: data ?? [], unread };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    return { ok: true };
  });

// ============ Notification Preferences ============

const CATEGORIES = [
  "mention",
  "assignment",
  "deal_stage",
  "ticket",
  "task",
  "sla",
  "message",
] as const;

const channelSchema = z.object({
  inapp: z.boolean(),
  email: z.boolean(),
  sound: z.boolean(),
  shake: z.boolean(),
});

const prefsSchema = z.object(
  Object.fromEntries(CATEGORIES.map((c) => [c, channelSchema])) as Record<
    (typeof CATEGORIES)[number],
    typeof channelSchema
  >,
);

export type NotificationCategory = (typeof CATEGORIES)[number];
export type NotificationPrefs = z.infer<typeof prefsSchema>;

const DEFAULT_PREFS: NotificationPrefs = {
  mention: { inapp: true, email: true, sound: true, shake: true },
  assignment: { inapp: true, email: true, sound: true, shake: true },
  deal_stage: { inapp: true, email: false, sound: false, shake: false },
  ticket: { inapp: true, email: true, sound: true, shake: true },
  task: { inapp: true, email: false, sound: true, shake: false },
  sla: { inapp: true, email: true, sound: true, shake: true },
  message: { inapp: true, email: false, sound: true, shake: true },
};

function mergeWithDefaults(raw: unknown): NotificationPrefs {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = {} as NotificationPrefs;
  for (const c of CATEGORIES) {
    const v = (obj[c] && typeof obj[c] === "object" ? obj[c] : {}) as Record<string, unknown>;
    out[c] = {
      inapp: v.inapp !== false,
      email: v.email !== false ? Boolean(v.email ?? DEFAULT_PREFS[c].email) : false,
      sound: v.sound !== false ? Boolean(v.sound ?? DEFAULT_PREFS[c].sound) : false,
      shake: v.shake !== false ? Boolean(v.shake ?? DEFAULT_PREFS[c].shake) : false,
    };
    // Apply defaults strictly if undefined
    if (v.inapp === undefined) out[c].inapp = DEFAULT_PREFS[c].inapp;
    if (v.email === undefined) out[c].email = DEFAULT_PREFS[c].email;
    if (v.sound === undefined) out[c].sound = DEFAULT_PREFS[c].sound;
    if (v.shake === undefined) out[c].shake = DEFAULT_PREFS[c].shake;
  }
  return out;
}

export const getMyNotificationPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    // notification_preferences is not exposed to authenticated clients via the
    // Data API (column-level GRANT restricted). Read with the service-role
    // client, scoped to the current user only.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("notification_preferences")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { prefs: mergeWithDefaults(data?.notification_preferences) };
  });

export const updateMyNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ prefs: prefsSchema }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ notification_preferences: data.prefs })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
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
    const { getRequestOrigin, getRequestAuthorization } =
      await import("@/lib/request-origin.server");
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
          body: snippet || null,
          link: link.link,
          entity: link.entity,
          entity_id: link.entity_id,
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
        const bearer = getRequestAuthorization();
        const sendUrl = origin ? `${origin}/lovable/email/transactional/send` : "";
        for (const job of emailJobs) {
          // Resolve email
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(job.to);
          const email = u?.user?.email;
          if (!email || !sendUrl) continue;
          try {
            await fetch(sendUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(bearer ? { Authorization: bearer } : {}),
              },
              body: JSON.stringify({
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
              }),
            });
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

    const author = userId;
    const { data: authorProf } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", author)
      .maybeSingle();
    const authorName = authorProf?.full_name ?? "Alguém";

    const link = resolveLink(a);
    const snippet = snippetFromHtml(data.bodySnippet ?? "");
    const activityLabel = snippetFromHtml(a.subject ?? a.body ?? "", 80);

    // Diff mentions vs previous (edits only notify new mentions)
    const prev = new Set(data.previousMentionIds ?? []);
    const newMentions = (data.mentionIds ?? []).filter(
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
          : `${authorName} comentou em ${activityLabel || "uma atividade"}`;
      inappRows.push({
        owner_id: a.workspace_id,
        user_id: t.userId,
        type: t.category,
        title,
        body: snippet || null,
        link: link.link,
        entity: link.entity,
        entity_id: link.entity_id,
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
