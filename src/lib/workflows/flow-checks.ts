// Conferências puras do fluxo antes de publicar (sem rede).
type AnyAction = { type: string; [k: string]: unknown };

function walk(list: unknown, visit: (a: AnyAction) => void) {
  if (!Array.isArray(list)) return;
  for (const raw of list as AnyAction[]) {
    if (!raw || typeof raw !== "object") continue;
    visit(raw);
    walk(raw["then"], visit);
    walk(raw["else"], visit);
    walk(raw["default"], visit);
    for (const c of (raw["cases"] as { actions?: unknown }[] | undefined) ?? [])
      walk(c?.actions, visit);
    for (const b of (raw["branches"] as { actions?: unknown }[] | undefined) ?? [])
      walk(b?.actions, visit);
  }
}

/** Agentes usados em "Ligar agente"; `missing` quando algum bloco não escolheu. */
export function collectSdrAgentIds(actions: unknown): { ids: string[]; missing: boolean } {
  const ids = new Set<string>();
  let missing = false;
  walk(actions, (a) => {
    if (a.type !== "sdr_agent" || a["mode"] !== "on") return;
    const id = typeof a["playbook_id"] === "string" ? (a["playbook_id"] as string) : "";
    if (id) ids.add(id);
    else missing = true;
  });
  return { ids: [...ids], missing };
}
