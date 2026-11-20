// Hidrata o registro do gatilho com os registros associados, para que tokens
// como `{{company.name}}` ou `{{primary_contact.email}}` resolvam em tempo de
// execução. Carrega sob demanda: só as associações realmente referenciadas
// pelo JSON do workflow.
import type { SupabaseClient } from "@supabase/supabase-js";
import { WORK_COST_PUBLIC_COLUMNS } from "@/lib/access-control/work-cost-projection";
import { sanitizeWorkflowSnapshot } from "./engine/authorization.server";

import { ENTITY_ASSOCIATIONS } from "./associations";
import type { WorkflowEntity } from "./types";

type AnyRow = Record<string, unknown>;

export async function hydrateTriggerAssociations(
  supabase: SupabaseClient,
  entity: WorkflowEntity,
  after: AnyRow | null,
  workflowJson: string,
): Promise<AnyRow | null> {
  const safeAfter = sanitizeWorkflowSnapshot(after, entity);
  if (!safeAfter) return safeAfter;
  const assocs = (ENTITY_ASSOCIATIONS[entity] ?? []).filter((a) =>
    workflowJson.includes(`{{${a.key}.`),
  );
  if (assocs.length === 0) return safeAfter;

  const out: AnyRow = { ...safeAfter };
  for (const a of assocs) {
    const id = safeAfter[a.fk_column];
    if (typeof id !== "string" || !id) {
      out[a.key] = null;
      continue;
    }
    try {
      const { data } = await supabase
        .from(a.target_table as never)
        .select(a.target_table === "projects" ? WORK_COST_PUBLIC_COLUMNS.projects : "*")
        .eq("id", id)
        .maybeSingle();
      out[a.key] = sanitizeWorkflowSnapshot((data as AnyRow | null) ?? null, a.target_table);
    } catch {
      out[a.key] = null;
    }
  }
  return out;
}
