// Ponte entre a configuração do agente e o turno da IA: decide as ferramentas
// expostas (versão publicada + prontidão) e adapta nomes para a API de funções.
import type { AgentToolSpec } from "../agent.server";
import {
  exposedTools,
  fnName,
  fromFnName,
  type ReadinessFacts,
  type ToolConfig,
  type ToolDef,
} from "./catalog";
import { executeTool, type ToolCtx } from "./dispatcher";

export function toolSpecs(defs: ToolDef[]): AgentToolSpec[] {
  return defs.map((d) => ({ name: fnName(d.id), description: d.description, parameters: d.parameters }));
}

export function selectTools(cfg: ToolConfig | null, facts: ReadinessFacts) {
  const defs = exposedTools(cfg, facts);
  const ids = new Set(defs.map((d) => d.id));
  return {
    defs,
    ids,
    specs: toolSpecs(defs),
    directBooking: ids.has("calendar.availability") && ids.has("calendar.book"),
  };
}

export function makeExecutor(ctx: ToolCtx) {
  return (name: string, args: unknown, callId: string) =>
    executeTool(ctx, fromFnName(name), args, callId);
}

export function newEventId(): string {
  // Google aceita base32hex (0-9, a-v); hexadecimal é subconjunto válido.
  return `lia${crypto.randomUUID().replace(/-/g, "")}`;
}
