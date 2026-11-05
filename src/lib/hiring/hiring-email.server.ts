import { workRpc } from "@/lib/access-control/work-core.server";
import { CANONICAL_APP_ORIGIN } from "@/lib/platform-domains";
import type { SupabaseClient } from "@supabase/supabase-js";
/** Cron-only service boundary; rows are claimed transactionally with current eligibility. */
export async function dispatchHiringEmails(client: SupabaseClient) {
  const rows = await workRpc<
    { step_id: string; recipient_id: string; job_id: string; workspace_id: string }[]
  >(client, "hiring_email_claim", {});
  let sent = 0,
    failed = 0;
  for (const row of rows) {
    try {
      const { data, error } = await client.auth.admin.getUserById(row.recipient_id);
      if (error || !data.user?.email) throw new Error("Aprovador sem e-mail disponível.");
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const result = await sendTemplateEmail("hiring-demand-approval", data.user.email, {
        templateData: {
          profiles: [],
          link: `${CANONICAL_APP_ORIGIN}/jobs/${row.job_id}?tab=hiring`,
          requesterName: "TechHire",
          dealName: "Demanda de contratação",
        },
        idempotencyKey: `hiring-approval-${row.step_id}`,
      });
      const { error: updateError } = await client
        .from("hiring_email_outbox" as never)
        .update({
          status: result.sent ? "sent" : "suppressed",
          last_error: null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("step_id", row.step_id)
        .eq("workspace_id", row.workspace_id);
      if (updateError) throw new Error("Não foi possível registrar entrega.");
      if (result.sent) sent++;
    } catch {
      failed++;
      await client
        .from("hiring_email_outbox" as never)
        .update({
          status: "failed",
          last_error: "Falha de entrega; retentativa automática limitada a cinco tentativas.",
          updated_at: new Date().toISOString(),
        } as never)
        .eq("step_id", row.step_id)
        .eq("workspace_id", row.workspace_id);
    }
  }
  return { claimed: rows.length, sent, failed };
}
