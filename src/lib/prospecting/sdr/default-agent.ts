// Agente principal (⭐) do workspace: escolha padrão dos seletores de agente.

type AgentLike = { id: string; enabled?: boolean };

/** Agente pré-selecionado: principal (se existe) → `fallback` → primeiro da lista. */
export function pickDefaultAgent<T extends AgentLike>(
  agents: T[],
  defaultId: string | null | undefined,
  fallback?: (agents: T[]) => T | undefined,
): string | null {
  if (defaultId && agents.some((a) => a.id === defaultId)) return defaultId;
  return (fallback?.(agents) ?? agents[0])?.id ?? null;
}

/** Ordena com o agente principal no topo, preservando a ordem dos demais. */
export function sortDefaultFirst<T extends AgentLike>(agents: T[], defaultId: string | null | undefined): T[] {
  if (!defaultId) return agents;
  const main = agents.filter((a) => a.id === defaultId);
  return [...main, ...agents.filter((a) => a.id !== defaultId)];
}

/** Rótulo do item no seletor, com ⭐ para o principal. */
export function agentOptionLabel(a: AgentLike & { name: string }, defaultId: string | null | undefined) {
  return `${a.id === defaultId ? "⭐ " : ""}${a.name}${a.enabled === false ? " (desativado)" : ""}`;
}

/** Título da reunião a partir do modelo do agente. `{empresa}` vira o nome da empresa. */
export const DEFAULT_MEETING_TITLE = "Reunião {empresa} <> WK Technology";
const LEGACY_MEETING_TITLE = "Reunião com a WK Technology";

export function meetingTitle(
  template: string | null | undefined,
  ctx: { company?: string | null; person?: string | null },
): string {
  const t = !template?.trim() || template.trim() === LEGACY_MEETING_TITLE ? DEFAULT_MEETING_TITLE : template;
  if (!t.includes("{empresa}")) return t;
  const who = ctx.company?.trim() || ctx.person?.trim();
  if (!who) return LEGACY_MEETING_TITLE;
  return t.replaceAll("{empresa}", who).replace(/\s+/g, " ").trim();
}
