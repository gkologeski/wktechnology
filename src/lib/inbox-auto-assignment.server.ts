import type { SupabaseClient } from "@supabase/supabase-js";
import { applyRotation } from "@/lib/rotation/engine.server";
import type { RotationEntity } from "@/lib/rotation/types";

export async function autoAssignInboxConversation(
  supabase: SupabaseClient,
  workspaceId: string,
  entity: Extract<
    RotationEntity,
    "whatsapp_conversations" | "email_threads" | "live_chat_sessions"
  >,
  entityId: string,
) {
  const { data: rule } = await supabase
    .from("rotation_rules")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("entity", entity)
    .eq("enabled", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!rule) return null;
  try {
    return await applyRotation(supabase, rule.id, entity, entityId);
  } catch (error) {
    console.error(`[inbox] auto-atribuição de ${entity} falhou`, (error as Error).message);
    return null;
  }
}
