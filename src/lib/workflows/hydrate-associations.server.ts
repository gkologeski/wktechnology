// Hidrata o registro do gatilho com os registros associados, para que tokens
// como `{{company.name}}` ou `{{primary_contact.email}}` resolvam em tempo de
// execução. Carrega sob demanda: só as associações realmente referenciadas
// pelo JSON do workflow.
import type { SupabaseClient } from "@supabase/supabase-js";

import { ENTITY_ASSOCIATIONS } from "./associations";
import type { WorkflowEntity } from "./types";

type AnyRow = Record<string, unknown>;

export async function hydrateTriggerAssociations(
  supabase: SupabaseClient,
  entity: WorkflowEntity,
  after: AnyRow | null,
  workflowJson: string,
): Promise<AnyRow | null> {
  if (!after) return after;
  const assocs = (ENTITY_ASSOCIATIONS[entity] ?? []).filter((a) =>
    workflowJson.includes(`{{${a.key}.`),
  );
  if (assocs.length === 0) return after;

  const out: AnyRow = { ...after };
  for (const a of assocs) {
    const id = after[a.fk_column];
    if (typeof id !== "string" || !id) {
      out[a.key] = null;
      continue;
    }
    try {
      const { data } = await supabase
        .from(a.target_table as never)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      out[a.key] = (data as AnyRow | null) ?? null;
    } catch {
      out[a.key] = null;
    }
  }
  return out;
}
