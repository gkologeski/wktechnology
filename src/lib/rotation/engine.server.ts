// Engine de rotação: escolhe o próximo responsável e atualiza o registro.
// Reusa o estado last_index/last_assigned_* da própria regra.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RotationAssignee, RotationEntity, RotationRule, RotationStrategy } from "./types";

export interface PickResult {
  user_id: string;
  index: number;
}

export function pickNextAssignee(
  strategy: RotationStrategy,
  assignees: RotationAssignee[],
  lastIndex: number,
): PickResult | null {
  const valid = (assignees ?? []).filter((a) => a.user_id);
  if (valid.length === 0) return null;

  if (strategy === "round_robin") {
    const nextIdx = ((lastIndex ?? -1) + 1) % valid.length;
    return { user_id: valid[nextIdx].user_id, index: nextIdx };
  }

  // weighted: random proporcional ao peso (>=1)
  const weights = valid.map((a) => Math.max(1, Math.floor(a.weight ?? 1)));
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < valid.length; i++) {
    r -= weights[i];
    if (r <= 0) return { user_id: valid[i].user_id, index: i };
  }
  return { user_id: valid[valid.length - 1].user_id, index: valid.length - 1 };
}

/**
 * Carrega a regra, escolhe próximo responsável, atualiza o registro alvo
 * (owner_id) e persiste o checkpoint na própria regra.
 */
export async function applyRotation(
  supabase: SupabaseClient,
  ruleId: string,
  entity: RotationEntity,
  entityId: string,
): Promise<{ user_id: string }> {
  const { data: rule, error } = await supabase
    .from("rotation_rules")
    .select("id, entity, enabled, strategy, assignees, last_index")
    .eq("id", ruleId)
    .single();
  if (error || !rule) throw new Error(`Regra de rotação não encontrada (${ruleId})`);
  if (!rule.enabled) throw new Error("Regra de rotação está pausada");
  if (rule.entity !== entity) {
    throw new Error(`Regra é para ${rule.entity}, evento é ${entity}`);
  }

  const pick = pickNextAssignee(
    rule.strategy as RotationStrategy,
    (rule.assignees ?? []) as RotationAssignee[],
    rule.last_index ?? -1,
  );
  if (!pick) throw new Error("Regra não tem responsáveis configurados");

  const assignField = entity === "tickets" ? "assignee_id" : "owner_id";
  const { error: upErr } = await supabase
    .from(entity)
    .update({ [assignField]: pick.user_id })
    .eq("id", entityId);
  if (upErr) throw new Error(`Falha ao atribuir: ${upErr.message}`);

  await supabase
    .from("rotation_rules")
    .update({
      last_index: pick.index,
      last_assigned_user_id: pick.user_id,
      last_assigned_at: new Date().toISOString(),
    })
    .eq("id", ruleId);

  return { user_id: pick.user_id };
}

export type { RotationRule };
