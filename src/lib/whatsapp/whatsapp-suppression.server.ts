import type { SupabaseClient } from "@supabase/supabase-js";
import { toWhatsAppE164 } from "@/lib/phone/whatsapp-e164";
import { activeSuppressions, suppressionKey, type SuppressionReason } from "./whatsapp-suppression";

/**
 * Bloqueios vigentes (131026/131049) só dos telefones informados, no workspace
 * informado. O chamador decide o cliente: o worker usa o de serviço já
 * restrito à execução; telas usam o cliente do usuário (RLS por membership).
 */
export async function loadPhoneSuppressions(
  db: SupabaseClient,
  workspaceId: string,
  phones: Array<string | null | undefined>,
): Promise<Map<string, SuppressionReason>> {
  const keys = [
    ...new Set(
      phones
        .map((p) => toWhatsAppE164(p))
        .filter((p): p is string => !!p)
        .map(suppressionKey),
    ),
  ];
  if (!keys.length) return new Map();
  const { data, error } = await db
    .from("whatsapp_number_suppressions")
    .select("phone_key, reason, expires_at, released_at")
    .eq("workspace_id", workspaceId)
    .in("phone_key", keys)
    .is("released_at", null);
  if (error) throw new Error("Não foi possível verificar bloqueios de WhatsApp.");
  return activeSuppressions((data ?? []) as never);
}
