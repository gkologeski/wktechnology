// Hidrata os itens de linha do negócio no registro avaliado, para que as
// condições `line_items.*` e os tokens `{{deal.services}}` funcionem.
// Carrega sob demanda: só quando o JSON do workflow referencia itens.
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  LINE_ITEMS_KEY,
  lineItemTokenValues,
  workflowUsesLineItems,
  type LineItemRow,
} from "./line-items";
import type { WorkflowEntity } from "./types";

type AnyRow = Record<string, unknown>;

const SELECT =
  "id, name, description, quantity, unit_price, discount_pct, discount_amount, discount_type, tax_rate, seniority, unit, position, service_catalog_id, job_profile_id, contracting_preset_id, service:service_catalog(name), job_profile:job_profiles(name), preset:contracting_presets(name)";

type Joined = LineItemRow & {
  service?: { name: string | null } | null;
  job_profile?: { name: string | null } | null;
  preset?: { name: string | null } | null;
};

export async function hydrateDealLineItems(
  supabase: SupabaseClient,
  entity: WorkflowEntity,
  after: AnyRow | null,
  workflowJson: string,
): Promise<AnyRow | null> {
  if (!after || entity !== "deals") return after;
  if (!workflowUsesLineItems(workflowJson)) return after;
  const dealId = after["id"];
  if (typeof dealId !== "string" || !dealId) return after;

  let items: LineItemRow[] = [];
  try {
    const { data } = await supabase
      .from("deal_line_items")
      .select(SELECT)
      .eq("deal_id", dealId)
      .order("position", { ascending: true });
    items = ((data ?? []) as unknown as Joined[]).map((r) => ({
      ...r,
      service_name: r.service?.name ?? null,
      job_profile_name: r.job_profile?.name ?? null,
      preset_name: r.preset?.name ?? null,
    }));
  } catch {
    items = [];
  }

  const existingDeal = after["deal"];
  return {
    ...after,
    [LINE_ITEMS_KEY]: items,
    deal: {
      ...(existingDeal && typeof existingDeal === "object" && !Array.isArray(existingDeal)
        ? (existingDeal as AnyRow)
        : {}),
      ...lineItemTokenValues(items),
    },
  };
}
