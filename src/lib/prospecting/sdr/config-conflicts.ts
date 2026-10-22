// Conflitos entre fontes configuráveis do agente (puro). Só APONTA para o
// operador corrigir no editor — nunca altera persona, controles ou versão.
import { hasTool, type AgentConfig } from "./agent-config";
import type { Persona } from "./persona";
import type { ToolConfig } from "./tools/catalog";

export type ConfigConflict = { severity: "critical" | "notice"; message: string };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function configConflicts(p: {
  persona: Persona;
  config: AgentConfig;
  tools: ToolConfig | null;
  extraInstructions: string | null;
  directBookingReady: boolean;
}): ConfigConflict[] {
  const out: ConfigConflict[] = [];
  const on = new Set(p.tools?.enabled_tools ?? []);
  const g = p.config.guardrails;
  const personaText = norm(
    [p.persona.instructions, p.persona.goal, p.persona.handoff_when, p.persona.collect].join("\n"),
  );
  if (on.has("human.handoff") && !hasTool(p.config, "handoff"))
    out.push({
      severity: "critical",
      message:
        "Ferramenta de transferência ligada, mas a capacidade de transferência do agente está desligada.",
    });
  if (on.has("materials.send") && !g.attach_materials)
    out.push({
      severity: "critical",
      message: "Envio de material ligado nas ferramentas, mas desligado nos controles do agente.",
    });
  if ([...on].some((t) => t.startsWith("calendar.")) && !hasTool(p.config, "schedule"))
    out.push({
      severity: "critical",
      message: "Ferramentas de agenda ligadas, mas a capacidade de agendamento está desligada.",
    });
  if (!g.no_pricing && /\b(nao|nunca) informe valores\b/.test(personaText))
    out.push({
      severity: "notice",
      message: "A persona proíbe informar valores, mas o controle comercial permite.",
    });
  if (g.max_questions > 1 && /\buma pergunta por mensagem\b/.test(personaText))
    out.push({
      severity: "notice",
      message: `A persona pede uma pergunta por mensagem, mas o limite configurado é ${g.max_questions}.`,
    });
  if (!p.directBookingReady && /\b(agenda|agendamento|agendar)\b/.test(personaText))
    out.push({
      severity: "notice",
      message: "A persona prevê agendamento, mas a agenda não está pronta neste agente.",
    });
  if (p.extraInstructions?.trim())
    out.push({
      severity: "notice",
      message:
        "Há orientação complementar no agente; em conflito, prevalece a configuração publicada.",
    });
  return out;
}
