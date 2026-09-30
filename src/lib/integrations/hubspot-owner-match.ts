// Regras puras de correspondência entre responsáveis do HubSpot e usuários do TechERP.

export function normalizePersonKey(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function hubspotOwnerName(o: {
  first_name: string | null;
  last_name: string | null;
}): string {
  return `${o.first_name ?? ""} ${o.last_name ?? ""}`.trim();
}

/** Robôs/contas técnicas do HubSpot não viram usuários. */
export function isHubspotBotEmail(email: string | null | undefined): boolean {
  return /@(?:[a-z0-9-]+\.)*hubspot\.com$/i.test((email ?? "").trim());
}

export type ProvisionDecision =
  | { kind: "link"; userId: string }
  | { kind: "create"; email: string; fullName: string }
  | { kind: "skip"; reason: string };

export function decideProvision(
  owner: { email: string | null; first_name: string | null; last_name: string | null },
  users: { byEmail: Map<string, string>; byName: Map<string, string> },
): ProvisionDecision {
  const email = (owner.email ?? "").trim().toLowerCase();
  const name = hubspotOwnerName(owner);
  if (email && users.byEmail.has(email)) return { kind: "link", userId: users.byEmail.get(email)! };
  const nameKey = normalizePersonKey(name);
  if (nameKey && users.byName.has(nameKey))
    return { kind: "link", userId: users.byName.get(nameKey)! };
  if (!email) return { kind: "skip", reason: "sem e-mail" };
  if (isHubspotBotEmail(email)) return { kind: "skip", reason: "conta automática do HubSpot" };
  return { kind: "create", email, fullName: name || email };
}
