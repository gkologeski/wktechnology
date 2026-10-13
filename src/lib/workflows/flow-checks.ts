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

/** Páginas de agendamento e materiais usados no fluxo (conferidos ao publicar). */
export function collectResourceIds(actions: unknown): {
  bookingPages: string[];
  materials: string[];
  missing: boolean;
  /** Blocos de agenda sem página: usam a agenda padrão da empresa. */
  bookingDefault: boolean;
} {
  const pages = new Set<string>();
  const mats = new Set<string>();
  let missing = false;
  let bookingDefault = false;
  walk(actions, (a) => {
    if (a.type === "share_booking_link") {
      const id = typeof a["booking_page_id"] === "string" ? (a["booking_page_id"] as string) : "";
      if (id) pages.add(id);
      else bookingDefault = true;
    }
    if (a.type === "share_material") {
      const id = typeof a["material_id"] === "string" ? (a["material_id"] as string) : "";
      if (id) mats.add(id);
      else missing = true;
    }
  });
  return { bookingPages: [...pages], materials: [...mats], missing, bookingDefault };
}

/** Aprovação humana dentro de caminhos em paralelo não é suportada. */
export function hasApprovalInsideParallel(actions: unknown): boolean {
  let found = false;
  walk(actions, (a) => {
    if (a.type !== "parallel") return;
    for (const b of (a["branches"] as { actions?: unknown }[] | undefined) ?? [])
      walk(b?.actions, (x) => {
        if (x.type === "approval_step") found = true;
      });
  });
  return found;
}
