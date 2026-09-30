// Monta as opções do filtro de Responsável: uma linha por pessoa, unindo o
// usuário do TechERP e os responsáveis do HubSpot correspondentes.
import { hubspotOwnerName, normalizePersonKey } from "./integrations/hubspot-owner-match";

export type OwnerFilterMember = {
  user_id: string;
  full_name: string | null;
  is_me?: boolean;
  status?: "active" | "inactive";
};

export type OwnerFilterHubspot = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string | null;
  mapped_user_id: string | null;
};

export type OwnerOption = {
  key: string;
  label: string;
  ids: string[];
  active: boolean;
  is_me: boolean;
  hasUser: boolean;
  hasHubspot: boolean;
};

export function buildOwnerOptions(
  members: OwnerFilterMember[],
  hubspot: OwnerFilterHubspot[],
): OwnerOption[] {
  const groups = new Map<string, OwnerOption>();
  const byUser = new Map<string, OwnerOption>();

  for (const m of members) {
    const label = m.full_name?.trim() || m.user_id.slice(0, 8);
    const nameKey = normalizePersonKey(m.full_name);
    const key = nameKey ? `n:${nameKey}` : `u:${m.user_id}`;
    const existing = groups.get(key);
    const active = m.status !== "inactive";
    if (existing) {
      existing.ids.push(m.user_id);
      existing.active ||= active;
      existing.is_me ||= !!m.is_me;
      byUser.set(m.user_id, existing);
      continue;
    }
    const opt: OwnerOption = {
      key,
      label,
      ids: [m.user_id],
      active,
      is_me: !!m.is_me,
      hasUser: true,
      hasHubspot: false,
    };
    groups.set(key, opt);
    byUser.set(m.user_id, opt);
  }

  for (const o of hubspot) {
    const id = `hs:${o.id}`;
    const name = hubspotOwnerName(o);
    const target =
      (o.mapped_user_id && byUser.get(o.mapped_user_id)) ||
      groups.get(`n:${normalizePersonKey(name)}`) ||
      (o.email ? groups.get(`e:${o.email.trim().toLowerCase()}`) : undefined);
    if (target) {
      target.ids.push(id);
      target.hasHubspot = true;
      continue;
    }
    // Responsável mapeado para usuário fora da lista não gera linha própria.
    if (o.mapped_user_id) continue;
    const nameKey = normalizePersonKey(name);
    const key = nameKey ? `n:${nameKey}` : o.email ? `e:${o.email.trim().toLowerCase()}` : id;
    groups.set(key, {
      key,
      label: name || o.email || `HubSpot ${o.id}`,
      ids: [id],
      active: (o.status ?? "").toLowerCase() !== "archived",
      is_me: false,
      hasUser: false,
      hasHubspot: true,
    });
  }

  return [...groups.values()].sort((a, b) => {
    if (a.is_me !== b.is_me) return a.is_me ? -1 : 1;
    return a.label.localeCompare(b.label, "pt-BR");
  });
}

export function selectionState(ids: string[], selected: string[]): boolean | "indeterminate" {
  const n = ids.filter((id) => selected.includes(id)).length;
  if (n === 0) return false;
  return n === ids.length ? true : "indeterminate";
}
