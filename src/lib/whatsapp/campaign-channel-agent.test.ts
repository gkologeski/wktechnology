import { describe, expect, it } from "vitest";
import { campaignAgentMismatch, resolveCampaignChannelAgent } from "./campaign-channel-agent";

const acc = { id: "a", enabled: true, routing_configured: true, archived_at: null };
const bind = { agent_id: "bruna", enabled: true, campaigns: true };

describe("AGENTE-DO-NUMERO", () => {
  it("trava o agente do canal", () => {
    expect(resolveCampaignChannelAgent(acc, bind)).toEqual({ kind: "locked", agentId: "bruna" });
  });
  it("número sem canal configurado fica livre", () => {
    expect(resolveCampaignChannelAgent(null, null).kind).toBe("free");
    expect(resolveCampaignChannelAgent({ ...acc, routing_configured: false }, bind).kind).toBe("free");
  });
  it("canal desativado ou sem campanhas não tem agente", () => {
    expect(resolveCampaignChannelAgent({ ...acc, enabled: false }, bind).kind).toBe("none");
    expect(resolveCampaignChannelAgent(acc, { ...bind, campaigns: false }).kind).toBe("none");
    expect(resolveCampaignChannelAgent(acc, { ...bind, enabled: false }).kind).toBe("none");
  });
  it("recusa agente diferente do número", () => {
    const rule = { kind: "locked", agentId: "bruna" } as const;
    expect(campaignAgentMismatch(rule, "maria")).not.toBeNull();
    expect(campaignAgentMismatch(rule, null)).not.toBeNull();
    expect(campaignAgentMismatch(rule, "bruna")).toBeNull();
  });
  it("sem agente no canal só aceita desligado", () => {
    expect(campaignAgentMismatch({ kind: "none" }, "bruna")).not.toBeNull();
    expect(campaignAgentMismatch({ kind: "none" }, null)).toBeNull();
    expect(campaignAgentMismatch({ kind: "free" }, "x")).toBeNull();
  });
});
