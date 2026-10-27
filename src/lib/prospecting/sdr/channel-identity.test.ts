import { describe, expect, it } from "vitest";
import { parsePersona } from "./persona";
import {
  personaForChannel,
  renderChannelIdentity,
  resolveChannelBinding,
  type ChannelIdentity,
} from "./channel-identity";

const identity: ChannelIdentity = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  accountId: "phone-bruna",
  channel: "whatsapp",
  accountName: "Tucano — Bruna",
  displayName: "Bruna",
  agentName: "Agente Bruna",
  companyName: "WK Technology",
};
const binding = {
  workspaceId: identity.workspaceId,
  accountId: identity.accountId,
  agentId: "bruna",
  enabled: true,
  inbound: true,
  campaigns: true,
};

describe("identidade de atendimento por conta", () => {
  it("resolves Bruna and Lia independently without modifying the published persona", () => {
    const persona = parsePersona({
      assistant_name: "Lia",
      description: "Sou a {{identidade.nome}}, da {{empresa.nome}}.",
      instructions: "Consultar a agenda selecionada.",
    });
    expect(personaForChannel(persona, identity).description).toBe("Sou a Bruna, da WK Technology.");
    expect(
      personaForChannel(persona, { ...identity, accountId: "phone-lia", displayName: "Lia" })
        .assistant_name,
    ).toBe("Lia");
    expect(persona.assistant_name).toBe("Lia");
    expect(personaForChannel(persona, identity).instructions).toBe(persona.instructions);
  });
  it("does not recursively interpret names or unknown template variables", () => {
    expect(
      renderChannelIdentity("{{identidade.nome}} {{secret}}", {
        ...identity,
        displayName: "{{empresa.nome}}",
      }),
    ).toBe("{{empresa.nome}} {{secret}}");
  });
  it("isolates accounts and workspaces and never falls back from an explicit campaign agent", () => {
    const base = {
      workspaceId: identity.workspaceId,
      accountId: identity.accountId,
      origin: "campaign" as const,
      bindings: [binding],
    };
    expect(resolveChannelBinding(base)).toEqual(binding);
    expect(resolveChannelBinding({ ...base, agentId: "lia" })).toBeNull();
    expect(resolveChannelBinding({ ...base, workspaceId: "foreign" })).toBeNull();
    expect(resolveChannelBinding({ ...base, accountId: "phone-lia" })).toBeNull();
    expect(
      resolveChannelBinding({ ...base, bindings: [{ ...binding, enabled: false }] }),
    ).toBeNull();
  });
  it("keeps inbound and campaign activation independent and rejects duplicate responders", () => {
    const base = {
      workspaceId: identity.workspaceId,
      accountId: identity.accountId,
      origin: "inbound" as const,
      bindings: [{ ...binding, campaigns: false }],
    };
    expect(resolveChannelBinding(base)).not.toBeNull();
    expect(resolveChannelBinding({ ...base, origin: "campaign" })).toBeNull();
    expect(() =>
      resolveChannelBinding({ ...base, bindings: [binding, { ...binding, agentId: "lia" }] }),
    ).toThrow("Mais de um agente");
  });
});

describe("legacy introductions", () => {
  it("adapts only self-introductions and preserves unrelated people and instructions", () => {
    const persona = parsePersona({
      assistant_name: "Lia",
      description: "Sou a Lia, especialista da WK. Me chamo Lia.",
      instructions: "Transferir para Lia quando necessário. Nunca inventar preços.",
    });
    const rendered = personaForChannel(persona, identity);
    expect(rendered.description).toBe("Sou a Bruna, especialista da WK. Me chamo Bruna.");
    expect(rendered.instructions).toBe(persona.instructions);
  });
});
