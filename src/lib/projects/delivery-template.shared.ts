// Modelos de entrega por serviço — helpers puros (client-safe) para editar e descrever a definição.
// Formato aceito pelo banco (`project_delivery_template_validate_definition`):
//   { milestones: [{ key, name, offset_days? }], tasks: [{ key, title, milestone_key?, estimated_hours? }],
//     client_acceptance?: boolean }

export const TEMPLATE_KIND_LABEL: Record<string, string> = {
  capacity: "Capacidade / equipe recorrente",
  scope: "Escopo com marcos e aceite",
  hunting: "Hunting (vagas no TechHire)",
  package: "Pacote de consultoria",
  deliverables: "Entregáveis com evidências",
};

export type TemplateMilestone = { key: string; name: string; offset_days?: number };
export type TemplateTask = {
  key: string;
  title: string;
  milestone_key?: string;
  estimated_hours?: number;
};
export type TemplateDefinition = {
  milestones?: TemplateMilestone[];
  tasks?: TemplateTask[];
  client_acceptance?: boolean;
};

/** Chave estável a-z0-9_ (até 40), única dentro do conjunto informado. */
export function templateKey(label: string, used: Set<string>): string {
  const base =
    label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 34) || "item";
  let key = base;
  let n = 2;
  while (used.has(key)) key = `${base}_${n++}`;
  used.add(key);
  return key;
}

/**
 * Texto → definição. Marcos: um por linha, opcional "| dias" (prazo a partir do início).
 * Tarefas: uma por linha, "Marco > Tarefa | horas" liga ao marco de mesmo nome.
 */
export function parseTemplateText(
  milestonesText: string,
  tasksText: string,
  clientAcceptance: boolean,
): TemplateDefinition {
  const used = new Set<string>();
  const milestones: TemplateMilestone[] = [];
  const byName = new Map<string, string>();
  for (const raw of milestonesText.split("\n")) {
    const line = raw.trim();
    if (line.length < 2) continue;
    const [name, days] = line.split("|").map((s) => s.trim());
    const key = templateKey(name!, used);
    const m: TemplateMilestone = { key, name: name! };
    if (days && /^\d{1,4}$/.test(days)) m.offset_days = Number(days);
    milestones.push(m);
    byName.set(name!.toLowerCase(), key);
  }
  const tasks: TemplateTask[] = [];
  for (const raw of tasksText.split("\n")) {
    const line = raw.trim();
    if (line.length < 2) continue;
    const [main, hours] = line.split("|").map((s) => s.trim());
    const parts = main!.split(">").map((s) => s.trim());
    const title = parts.length > 1 ? parts.slice(1).join(" > ") : parts[0]!;
    if (title.length < 2) continue;
    const t: TemplateTask = { key: templateKey(title, used), title };
    if (parts.length > 1) {
      const mk = byName.get(parts[0]!.toLowerCase());
      if (mk) t.milestone_key = mk;
    }
    if (hours && /^\d+([.,]\d+)?$/.test(hours)) t.estimated_hours = Number(hours.replace(",", "."));
    tasks.push(t);
  }
  return { milestones, tasks, client_acceptance: clientAcceptance };
}

/** Definição → texto editável (inverso de `parseTemplateText`). */
export function templateToText(def: TemplateDefinition | null | undefined): {
  milestones: string;
  tasks: string;
  clientAcceptance: boolean;
} {
  const ms = def?.milestones ?? [];
  const nameByKey = new Map(ms.map((m) => [m.key, m.name]));
  return {
    milestones: ms
      .map((m) => (m.offset_days != null ? `${m.name} | ${m.offset_days}` : m.name))
      .join("\n"),
    tasks: (def?.tasks ?? [])
      .map((t) => {
        const head =
          t.milestone_key && nameByKey.get(t.milestone_key)
            ? `${nameByKey.get(t.milestone_key)} > `
            : "";
        return `${head}${t.title}${t.estimated_hours != null ? ` | ${t.estimated_hours}` : ""}`;
      })
      .join("\n"),
    clientAcceptance: !!def?.client_acceptance,
  };
}

export function describeTemplate(
  def: Record<string, unknown> | TemplateDefinition | null | undefined,
): string {
  const d = (def ?? {}) as TemplateDefinition;
  const ms = d.milestones?.length ?? 0;
  const tk = d.tasks?.length ?? 0;
  const parts = [`${ms} marco(s)`, `${tk} tarefa(s)`];
  if (d.client_acceptance) parts.push("liga o aceite do cliente");
  return parts.join(" · ");
}
