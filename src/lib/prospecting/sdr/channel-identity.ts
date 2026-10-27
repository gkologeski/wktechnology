import { z } from "zod";
import type { Persona } from "./persona";

export const ServiceChannelSchema = z.enum(["whatsapp", "email", "chat"]);
export type ServiceChannel = z.infer<typeof ServiceChannelSchema>;

/** Metadata supplied by the server after resolving the authorized channel account. */
export const ChannelIdentitySchema = z.object({
  workspaceId: z.string().uuid(),
  accountId: z.string().min(1).max(160),
  channel: ServiceChannelSchema,
  accountName: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(60),
  agentName: z.string().trim().min(1).max(120),
  companyName: z.string().trim().min(1).max(160),
});
export type ChannelIdentity = z.infer<typeof ChannelIdentitySchema>;

/** Only these variables are interpolated, in one pass; inserted values are never evaluated. */
export function renderChannelIdentity(text: string, identity: ChannelIdentity): string {
  const values: Record<string, string> = {
    "identidade.nome": identity.displayName,
    "agente.nome": identity.agentName,
    "canal.tipo": identity.channel,
    "canal.nome": identity.accountName,
    "empresa.nome": identity.companyName,
  };
  return text.replace(
    /\{\{\s*([\w.]+)\s*\}\}/g,
    (original, key: string) => values[key] ?? original,
  );
}

/** Published instructions are copied, never changed in storage by runtime identity resolution. */
export function personaForChannel(persona: Persona, identity: ChannelIdentity): Persona {
  const oldName = persona.assistant_name.trim();
  const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Adapt only legacy self-introductions, never names mentioned in business instructions.
  const introduction = oldName
    ? new RegExp(
        `(\\b(?:sou|me chamo|meu nome é)\\s+(?:(?:a|o)\\s+)?)${escaped}(?=[\\s,.;:!?]|$)`,
        "giu",
      )
    : null;
  const render = (text: string) => {
    const legacy = introduction
      ? text.replace(introduction, (_match, prefix: string) => `${prefix}${identity.displayName}`)
      : text;
    return renderChannelIdentity(legacy, identity);
  };
  return {
    ...persona,
    assistant_name: identity.displayName,
    description: render(persona.description),
    goal: render(persona.goal),
    collect: render(persona.collect),
    handoff_when: render(persona.handoff_when),
    instructions: render(persona.instructions),
    good_examples: persona.good_examples.map(render),
    avoid_phrases: persona.avoid_phrases.map(render),
  };
}

export type ChannelBinding = {
  workspaceId: string;
  accountId: string;
  agentId: string;
  enabled: boolean;
  inbound: boolean;
  campaigns: boolean;
};

/** An explicit campaign selection must never silently fall back to another agent/account. */
export function resolveChannelBinding(input: {
  workspaceId: string;
  accountId: string;
  agentId?: string;
  origin: "inbound" | "campaign";
  bindings: readonly ChannelBinding[];
}): ChannelBinding | null {
  const matches = input.bindings.filter(
    (binding) =>
      binding.enabled &&
      binding.workspaceId === input.workspaceId &&
      binding.accountId === input.accountId &&
      (!input.agentId || binding.agentId === input.agentId) &&
      (input.origin === "campaign" ? binding.campaigns : binding.inbound),
  );
  if (matches.length > 1)
    throw new Error("Mais de um agente ativo para esta conta de atendimento.");
  return matches[0] ?? null;
}
