// WIZARD-CAMPANHA-WA: modelos listados por número (cada par número+modelo é uma opção).
export type GroupTemplate = { name: string; language: string; approved: boolean; status?: string };
export type SenderCatalog<T extends GroupTemplate> = { senderId: string; items: T[] };

export const pickValue = (senderId: string, name: string) => `${senderId}::${name}`;
export function parsePick(value: string): { senderId: string; name: string } | null {
  const i = value.indexOf("::");
  if (i <= 0) return null;
  return { senderId: value.slice(0, i), name: value.slice(i + 2) };
}

/** Um grupo por número, mantendo modelos de mesmo nome separados por número. */
export function groupTemplatesBySender<T extends GroupTemplate>(catalogs: SenderCatalog<T>[]) {
  const seen = new Set<string>();
  return catalogs
    .filter((c) => c.senderId && !seen.has(c.senderId) && seen.add(c.senderId))
    .map((c) => ({ senderId: c.senderId, items: [...c.items].sort((a, b) => a.name.localeCompare(b.name)) }));
}

/** Acrescenta o número escolhido ao modelo, sem duplicar. */
export function addSenderPick(
  current: Record<string, string[]>,
  name: string,
  senderId: string,
): Record<string, string[]> {
  const list = current[name] ?? [];
  return list.includes(senderId) ? current : { ...current, [name]: [...list, senderId] };
}
