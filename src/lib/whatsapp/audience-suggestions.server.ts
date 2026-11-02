import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { assertSalesAnyArea } from "@/lib/access-control/sales-core.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { loadServerFilterFields } from "./campaign-audience.server";
import {
  isSuggestField,
  distinctValues,
  filterColumnPath,
  CUSTOM_FIELD_PREFIX,
} from "./campaign-audience";
const inputSchema = z
  .object({
    entity: z.enum(["leads", "contacts", "companies", "deals"]),
    column: z.string().max(60),
    search: z.string().max(100).optional(),
  })
  .strict();
/** Shared audience purpose, not permission to view or operate a WhatsApp campaign. */
export async function audienceFieldSuggestions(
  client: SupabaseClient,
  actor: string,
  input: z.infer<typeof inputSchema>,
) {
  const data = inputSchema.parse(input);
  await assertSalesAnyArea(
    client,
    ["techsales.marketing.campaigns", "system.automation.sequences"],
    "view",
  );
  const context = await workRpc<{ workspace: string; actor: string }>(
    client,
    "sales_access_context",
    {},
  );
  if (!context.workspace || context.actor !== actor) throw Error("Workspace indisponível.");
  const fields = await loadServerFilterFields(client, context.workspace, actor);
  if (!isSuggestField(data.entity, data.column, fields)) throw Error("Campo não permitido.");
  filterColumnPath(data.column);
  const custom = data.column.startsWith(CUSTOM_FIELD_PREFIX),
    term = (data.search ?? "").replace(/[%_,()]/g, " ").trim();
  const rows = await workRpc<unknown[]>(client, "whatsapp_campaign_filter_values", {
    p_entity: data.entity,
    p_workspace: context.workspace,
    p_column: custom ? "custom_fields" : data.column,
    p_custom_key: custom ? data.column.slice(CUSTOM_FIELD_PREFIX.length) : null,
    p_search: term || null,
    p_limit: 200,
  });
  return distinctValues(
    (rows || []).map((r) =>
      r && typeof r === "object" ? Object.values(r as Record<string, unknown>)[0] : r,
    ),
  );
}
