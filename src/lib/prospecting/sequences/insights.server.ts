import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { assertSalesArea } from "@/lib/access-control/sales-core.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { SEQUENCE_RESOURCE } from "./draft";
import { insightsInput, insightsSchema } from "./insights";
export async function sequenceInsights(
  client: SupabaseClient,
  input: z.infer<typeof insightsInput>,
) {
  const data = insightsInput.parse(input);
  await assertSalesArea(client, SEQUENCE_RESOURCE, "view");
  const ctx = await workRpc<{ workspace: string; actor: string }>(
    client,
    "sales_access_context",
    {},
  );
  if (!ctx.actor || ctx.workspace !== data.workspaceId) throw new Error("Workspace indisponível.");
  const result = await workRpc<unknown>(client, "prospecting_sequence_insights", {
    p_workspace: data.workspaceId,
    p_version: data.versionId,
  });
  return insightsSchema.parse(result);
}
