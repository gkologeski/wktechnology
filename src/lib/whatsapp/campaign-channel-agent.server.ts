import {
  resolveCampaignChannelAgent,
  type CampaignChannelAgent,
} from "./campaign-channel-agent";

/**
 * Lê conta+vínculo do número no workspace ativo. Usa o cliente privilegiado
 * apenas depois que o chamador passou por techsales.marketing.campaigns, e só
 * devolve o id do agente (nenhum outro dado do canal).
 */
export async function loadCampaignChannelAgent(
  workspaceId: string,
  phoneNumberId: string | null | undefined,
): Promise<CampaignChannelAgent> {
  if (!phoneNumberId) return { kind: "free" };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const account = await admin
    .from("service_channel_accounts")
    .select("id,enabled,routing_configured,archived_at")
    .eq("workspace_id", workspaceId)
    .eq("channel", "whatsapp")
    .eq("source_key", phoneNumberId)
    .maybeSingle();
  if (account.error) throw new Error("Não foi possível verificar o canal do número.");
  if (!account.data) return { kind: "free" };
  const binding = await admin
    .from("service_channel_bindings")
    .select("agent_id,enabled,campaigns")
    .eq("workspace_id", workspaceId)
    .eq("account_id", account.data.id)
    .maybeSingle();
  if (binding.error) throw new Error("Não foi possível verificar o agente do número.");
  return resolveCampaignChannelAgent(account.data, binding.data ?? null);
}
