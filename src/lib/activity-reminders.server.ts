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

function inappEnabled(prefs: unknown): boolean {
  const obj = (prefs && typeof prefs === "object" ? prefs : {}) as Record<string, unknown>;
  const task = (obj.task && typeof obj.task === "object" ? obj.task : {}) as Record<
    string,
    unknown
  >;
  return task.inapp !== false;
}

function formatWhen(due: string): string {
  return new Date(due).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export async function tickActivityReminders(limit = 200): Promise<{
  scanned: number;
  notified: number;
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
  let skipped = 0;

  const due = rows.filter((a) => {
    if (!a.due_date) return false;
    const remindAt = new Date(a.due_date).getTime() - (a.remind_before_minutes ?? 0) * 60_000;
    return remindAt <= now;
  });

  if (due.length === 0) return { scanned: rows.length, notified: 0, skipped: 0 };

  const targetIds = Array.from(
    new Set(due.flatMap((a) => [a.owner_id].filter(Boolean) as string[])),
  );
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, notification_preferences")
    .in("id", targetIds);
  const prefsById = new Map<string, unknown>(
    (profiles ?? []).map((p: { id: string; notification_preferences: unknown }) => [
      p.id,
      p.notification_preferences,
    ]),
  );

  const notifications: Array<Record<string, unknown>> = [];
  for (const a of due) {
    const userId = a.owner_id;
    if (!userId || !a.workspace_id) {
      skipped += 1;
      continue;
    }
    if (!inappEnabled(prefsById.get(userId))) {
      skipped += 1;
      continue;
    }
    const link = resolveLink(a);
    const isTask = (a.type ?? "") === "task";
    notifications.push({
      owner_id: a.workspace_id,
      user_id: userId,
      type: "task",
      title: isTask ? "Lembrete de tarefa" : "Lembrete de atividade",
      body: `${a.subject || "(sem assunto)"} — ${a.due_date ? formatWhen(a.due_date) : ""}`.trim(),
      link: link.link,
      entity: link.entity,
      entity_id: link.entity_id,
    });
  }

  if (notifications.length > 0) {
    const { error: insErr } = await admin.from("notifications").insert(notifications);
    if (insErr) throw new Error(insErr.message);
    notified = notifications.length;
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

  return { scanned: rows.length, notified, skipped };
}
