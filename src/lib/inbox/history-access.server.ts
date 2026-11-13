import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSalesArea } from "@/lib/access-control/sales-core.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { linkedinInboxAccess } from "@/lib/unipile/inbox-access";
export async function authorizeHistoryChannel(
  client: SupabaseClient,
  actor: string,
  channel: "email" | "whatsapp" | "chat" | "linkedin",
) {
  if (channel !== "linkedin") {
    await assertSalesArea(client, `techsales.inbox.${channel}`, "view");
    return;
  }
  const ctx = await workRpc<Parameters<typeof linkedinInboxAccess>[0]>(
    client,
    "work_access_context",
    {},
  );
  linkedinInboxAccess(ctx, actor, "view");
}
