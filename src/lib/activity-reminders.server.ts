// Motor de lembretes de tarefas/atividades com data futura.
//
// Regra: a atividade define `remind_before_minutes` (minutos antes do
// `due_date`). Quando o horário do lembrete chega, notificamos o responsável
// (owner_id e/ou assigned_user_id) respeitando as preferências de notificação
// da categoria "task". `reminder_sent_at` garante idempotência.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

type ActivityRow = {
  id: string;
  owner_id: string | null;
  workspace_id: string | null;
  type: string | null;
  subject: string | null;
  due_date: string | null;
  remind_before_minutes: number | null;
  related_deal_id: string | null;
  related_contact_id: string | null;
  related_company_id: string | null;
  related_lead_id: string | null;
  related_ticket_id: string | null;
};

function resolveLink(a: ActivityRow): {
  link: string | null;
  entity: string | null;
  entity_id: string | null;
} {
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
  return { link: "/tasks", entity: null, entity_id: null };
}

function taskPrefs(prefs: unknown): Record<string, unknown> {
  const obj = (prefs && typeof prefs === "object" ? prefs : {}) as Record<string, unknown>;
  return (obj.task && typeof obj.task === "object" ? obj.task : {}) as Record<string, unknown>;
}

function inappEnabled(prefs: unknown): boolean {
  return taskPrefs(prefs).inapp !== false;
}

function emailEnabled(prefs: unknown): boolean {
  // Padrão do sistema para a categoria "task" é e-mail desligado; o lembrete só
  // sai por e-mail quando o usuário habilitou explicitamente.
  return taskPrefs(prefs).email === true;
}

function activityLabel(type: string | null): string {
  switch (type) {
    case "meeting":
      return "reunião";
    case "call":
      return "ligação";
    case "task":
      return "tarefa";
    default:
      return "atividade";
  }
}

function formatWhen(due: string): string {
  return new Date(due).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export async function tickActivityReminders(limit = 200): Promise<{
  scanned: number;
  notified: number;
  emailed: number;
  skipped: number;
}> {
  const now = Date.now();
  // Janela de busca: lembretes de até 1 dia antes + tolerância de atraso de 6h.
  const horizon = new Date(now + 25 * 60 * 60 * 1000).toISOString();
  const floor = new Date(now - 6 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("activities")
    .select(
      "id, owner_id, workspace_id, type, subject, due_date, remind_before_minutes, related_deal_id, related_contact_id, related_company_id, related_lead_id, related_ticket_id",
    )
    .not("remind_before_minutes", "is", null)
    .is("reminder_sent_at", null)
    .is("deleted_at", null)
    .eq("completed", false)
    .not("due_date", "is", null)
    .gte("due_date", floor)
    .lte("due_date", horizon)
    .order("due_date", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ActivityRow[];
  let notified = 0;
  let emailed = 0;
  let skipped = 0;

  const due = rows.filter((a) => {
    if (!a.due_date) return false;
    const remindAt = new Date(a.due_date).getTime() - (a.remind_before_minutes ?? 0) * 60_000;
    return remindAt <= now;
  });

  if (due.length === 0) return { scanned: rows.length, notified: 0, emailed: 0, skipped: 0 };

  const targetIds = Array.from(
    new Set(due.flatMap((a) => [a.owner_id].filter(Boolean) as string[])),
  );
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, notification_preferences")
    .in("id", targetIds);
  type ProfileRow = { id: string; full_name: string | null; notification_preferences: unknown };
  const profileById = new Map<string, ProfileRow>(
    ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]),
  );

  const notifications: Array<Record<string, unknown>> = [];
  const emailJobs: Array<{
    activity: ActivityRow;
    userId: string;
    recipientName: string | null;
    link: string | null;
  }> = [];

  for (const a of due) {
    const userId = a.owner_id;
    if (!userId || !a.workspace_id) {
      skipped += 1;
      continue;
    }
    const profile = profileById.get(userId);
    const prefs = profile?.notification_preferences;
    const wantsInapp = inappEnabled(prefs);
    const wantsEmail = emailEnabled(prefs);
    if (!wantsInapp && !wantsEmail) {
      skipped += 1;
      continue;
    }
    const link = resolveLink(a);
    const label = activityLabel(a.type);
    if (wantsInapp) {
      notifications.push({
        owner_id: a.workspace_id,
        user_id: userId,
        type: "task",
        title: `Lembrete de ${label}`,
        body: `${a.subject || "(sem assunto)"} — ${a.due_date ? formatWhen(a.due_date) : ""}`.trim(),
        link: link.link,
        entity: link.entity,
        entity_id: link.entity_id,
      });
    }
    if (wantsEmail) {
      emailJobs.push({
        activity: a,
        userId,
        recipientName: profile?.full_name ?? null,
        link: link.link,
      });
    }
  }

  if (notifications.length > 0) {
    const { error: insErr } = await admin.from("notifications").insert(notifications);
    if (insErr) throw new Error(insErr.message);
    notified = notifications.length;
  }

  // E-mails de lembrete (falhas não impedem a notificação no app).
  if (emailJobs.length > 0) {
    try {
      const [{ sendTransactionalEmailFromServer }, { trackingBaseUrl }] = await Promise.all([
        import("@/lib/email-send.server"),
        import("@/lib/email-tracking.server"),
      ]);
      const base = trackingBaseUrl();
      for (const job of emailJobs) {
        try {
          const { data: u } = await admin.auth.admin.getUserById(job.userId);
          const to = u?.user?.email as string | undefined;
          if (!to) continue;
          const res = await sendTransactionalEmailFromServer({
            supabase: admin,
            templateName: "activity-reminder",
            recipientEmail: to,
            idempotencyKey: `activity-reminder:${job.activity.id}:${job.userId}`,
            templateData: {
              activityType: job.activity.type ?? "task",
              activityLabel: activityLabel(job.activity.type),
              subject: job.activity.subject ?? "(sem assunto)",
              dueAt: job.activity.due_date ? formatWhen(job.activity.due_date) : null,
              recipientName: job.recipientName,
              link: job.link ? `${base}${job.link}` : null,
            },
          });
          if (res.status === "sent") emailed += 1;
          else if (res.status === "error")
            console.error("[activity-reminders] email error", res.error);
        } catch (e) {
          console.error("[activity-reminders] email failed", e);
        }
      }
    } catch (e) {
      console.error("[activity-reminders] email pipeline unavailable", e);
    }
  }

  // Marca como enviado (inclusive os pulados por preferência, para não reprocessar).
  const { error: updErr } = await admin
    .from("activities")
    .update({ reminder_sent_at: new Date().toISOString() })
    .in(
      "id",
      due.map((a) => a.id),
    );
  if (updErr) throw new Error(updErr.message);

  return { scanned: rows.length, notified, emailed, skipped };
}
