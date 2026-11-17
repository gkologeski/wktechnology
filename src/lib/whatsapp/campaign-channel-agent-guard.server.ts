import { campaignAgentMismatch } from "./campaign-channel-agent";
import { loadCampaignChannelAgent } from "./campaign-channel-agent.server";

/** Recusa salvar campanha com agente diferente do canal do número. */
export async function assertCampaignAgentMatchesChannel(
  workspaceId: string,
  phoneNumberId: string | null | undefined,
  playbookId: string | null,
): Promise<void> {
  const rule = await loadCampaignChannelAgent(workspaceId, phoneNumberId);
  const msg = campaignAgentMismatch(rule, playbookId);
  if (msg) throw new Error(msg);
}
