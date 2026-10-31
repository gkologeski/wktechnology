// Opções dos filtros derivados (cargo resumido, área, nível, porte): valores distintos via RPC
// SECURITY INVOKER — a RLS do usuário decide quais linhas entram.
import type { SupabaseClient } from "@supabase/supabase-js";
import { DERIVED_CRM_FIELDS } from "./derived-fields";
import { assertSalesAnyArea } from "@/lib/access-control/sales-core.server";

const RESOURCE = {
  leads: "techsales.leads",
  contacts: "techsales.contacts",
  companies: "techsales.companies",
} as const;

export type DerivedOptionsEntity = "leads" | "contacts" | "companies";

export function assertDerivedOptionColumn(entity: DerivedOptionsEntity, column: string): void {
  const ok =
    DERIVED_CRM_FIELDS.has(column) &&
    (entity === "companies" ? column === "size_description" : column !== "size_description");
  if (!ok) throw new Error("Campo não permitido.");
}

export async function loadDerivedFilterOptions(
  sb: SupabaseClient,
  workspaceId: string,
  entity: DerivedOptionsEntity,
  column: string,
): Promise<string[]> {
  assertDerivedOptionColumn(entity, column);
  await assertSalesAnyArea(sb, RESOURCE[entity], "view");
  const { data, error } = await sb.rpc(
    "whatsapp_campaign_filter_values" as never,
    {
      p_entity: entity,
      p_workspace: workspaceId,
      p_column: column,
      p_custom_key: null,
      p_search: null,
      p_limit: 500,
    } as never,
  );
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown[])
    .map((r) => (r && typeof r === "object" ? Object.values(r as Record<string, unknown>)[0] : r))
    .filter((v): v is string => typeof v === "string" && v.trim() !== "");
}
