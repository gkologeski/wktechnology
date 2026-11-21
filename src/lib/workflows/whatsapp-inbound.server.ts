import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";
import { assertSalesArea } from "@/lib/access-control/sales-core.server";

const numberId = z.string().regex(/^[0-9]{5,30}$/);
const sourceSchema = z
  .object({
    id: z
      .string()
      .regex(/^(cloud|lovable):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
    label: z.string().max(160),
    numbers: z
      .array(
        z.object({ id: numberId, label: z.string().max(160), phone: z.string().max(160) }).strict(),
      )
      .max(100),
  })
  .strict();
const sourceContextSchema = z
  .object({ workspace_id: z.string().uuid(), sources: z.array(sourceSchema).max(100) })
  .strict();

/** Caller/RLS-bound metadata only; the RPC never returns transport credentials or customer data. */
export async function loadWorkflowWhatsAppSources(client: SupabaseClient, workspaceId: string) {
  z.string().uuid().parse(workspaceId);
  await assertSalesArea(client, "system.workflows", "view");
  await assertSalesArea(client, "techsales.inbox.whatsapp", "view");
  const result = sourceContextSchema.parse(
    await workRpc(client, "notification_whatsapp_sources", { p_workspace: workspaceId }),
  );
  if (result.workspace_id !== workspaceId)
    throw new Error("As contas de WhatsApp não correspondem ao workspace ativo.");
  if (new Set(result.sources.map((source) => source.id)).size !== result.sources.length)
    throw new Error("O catálogo de contas de WhatsApp exige uma nova consulta.");
  for (const source of result.sources)
    if (new Set(source.numbers.map((number) => number.id)).size !== source.numbers.length)
      throw new Error("O catálogo de números de WhatsApp exige uma nova consulta.");
  return result;
}

/** Service-only producer: retrying a persisted webhook must reconcile, never mint another occurrence. */
export async function recordWorkflowWhatsAppReceived(
  client: SupabaseClient,
  messageId: string,
  webhookId: string,
) {
  z.string().uuid().parse(messageId);
  z.string().uuid().parse(webhookId);
  return z
    .string()
    .uuid()
    .nullable()
    .parse(
      await workRpc(client, "notification_whatsapp_received", {
        p_message: messageId,
        p_webhook: webhookId,
      }),
    );
}
