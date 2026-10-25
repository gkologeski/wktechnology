import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";
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
    return await workRpc<{ user_id: string }>(supabase, "sales_inbox_rotate", {
      p_rule: rule.id,
      p_table: entity,
      p_record: entityId,
    });
  } catch (error) {
    console.error(`[inbox] auto-atribuição de ${entity} falhou`, (error as Error).message);
    return null;
  }
}
