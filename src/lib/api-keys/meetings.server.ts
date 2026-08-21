/**
 * Helpers server-only das rotas públicas de reuniões (`/api/public/v1/meetings`).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const MEETING_SELECT =
  "id, title, status, scheduled_at, started_at, ended_at, expires_at, public_token, room_name, related_lead_id, related_contact_id, related_deal_id, assigned_to, created_at";

/**
 * Mantém a atividade de timeline da reunião em sincronia com a reunião.
 *
 * A atividade criada no agendamento guarda `external_ids.meeting_id`; usamos
 * isso para localizá-la sem depender de colunas adicionais.
 */
export async function syncMeetingActivity(
  meetingId: string,
  options: { subjectPrefix?: string; note: string; dueDate?: string | null },
): Promise<void> {
  const { data: activity } = await supabaseAdmin
    .from("activities")
    .select("id, subject, body")
    .contains("external_ids", { meeting_id: meetingId })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!activity) return;

  const currentSubject = (activity.subject as string | null) ?? "Reunião";
  const prefix = options.subjectPrefix ? `[${options.subjectPrefix}] ` : "";
  const cleanSubject = currentSubject.replace(/^\[[^\]]+\]\s*/, "");
  const patch: {
    subject: string;
    body: string;
    due_date?: string | null;
  } = {
    subject: `${prefix}${cleanSubject}`.slice(0, 255),
    body: `${(activity.body as string | null) ?? ""}\n\n${options.note}`.trim(),
  };
  if (options.dueDate !== undefined) patch.due_date = options.dueDate;

  await supabaseAdmin.from("activities").update(patch).eq("id", activity.id);
}
