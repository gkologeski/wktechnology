import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { workRpc } from "@/lib/access-control/work-core.server";
import { assertSalesArea } from "@/lib/access-control/sales-core.server";
import { INBOX_CHANNELS, type InboxChannel } from "./inbox-channel-events";

const sourcesSchema = z
  .object({
    workspace_id: z.string().uuid(),
    channel: z.enum(INBOX_CHANNELS),
    sources: z
      .array(z.object({ id: z.string().uuid(), label: z.string().max(320) }).strict())
      .max(100),
  })
  .strict();
export async function loadWorkflowInboxSources(
  client: SupabaseClient,
  workspaceId: string,
  channel: InboxChannel,
) {
  await assertSalesArea(client, "system.workflows", "view");
  await assertSalesArea(client, `techsales.inbox.${channel}`, "view");
  const result = sourcesSchema.parse(
    await workRpc(client, "workflow_inbox_sources", {
      p_workspace: workspaceId,
      p_channel: channel,
    }),
  );
  if (result.workspace_id !== workspaceId || result.channel !== channel)
    throw new Error("Origem fora do workspace ou canal selecionado.");
  return result;
}
