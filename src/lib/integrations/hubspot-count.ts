// Lógica pura de "planned count" da importação do HubSpot.
// Sem dependências de I/O — todas as fontes de dados são injetadas via `deps`,
// o que torna a função 100% testável sem mockar fetch / Supabase.

export type CountObjectKey =
  | "companies"
  | "contacts"
  | "deals"
  | "leads"
  | "tickets"
  | "activities";

export type CountDeps = {
  /** Total bruto no HubSpot, sem filtro de vínculo. */
  remoteCount: (key: CountObjectKey) => Promise<number>;
  /** IDs das primeiras N empresas (já respeitando `maxCompanies`). */
  getCompanyIds: () => Promise<string[]>;
  /** União de IDs alvo associados ao conjunto de IDs origem. */
  unionAssocIds: (fromObj: string, fromIds: string[], toObj: string) => Promise<Set<string>>;
  /** Lê propriedades dos contatos (usado para filtrar leads). */
  readContactProps: (
    ids: string[],
    properties: string[],
  ) => Promise<{ id: string; properties: Record<string, string | null | undefined> }[]>;
};

const ACTIVITY_TYPES = ["notes", "calls", "meetings", "tasks", "emails"] as const;

export async function computePlannedCount(
  key: CountObjectKey,
  remote: number,
  maxCompanies: number,
  deps: CountDeps,
): Promise<number> {
  if (key === "companies") return Math.min(remote, maxCompanies);

  const companyIds = await deps.getCompanyIds();
  if (companyIds.length === 0) return 0;

  if (key === "contacts") {
    const set = await deps.unionAssocIds("companies", companyIds, "contacts");
    return set.size;
  }

  if (key === "deals") {
    const set = await deps.unionAssocIds("companies", companyIds, "deals");
    return set.size;
  }

  if (key === "leads") {
    // Conta apenas contatos vinculados às empresas do escopo cujo
    // lifecyclestage === 'lead' (alinhado ao mapeamento que o importer usa).
    const contactSet = await deps.unionAssocIds("companies", companyIds, "contacts");
    if (contactSet.size === 0) return 0;
    const ids = [...contactSet];
    const props = await deps.readContactProps(ids, ["lifecyclestage"]);
    let n = 0;
    for (const p of props) if (p.properties?.lifecyclestage === "lead") n++;
    return n;
  }

  if (key === "tickets") {
    // Tickets vinculados às empresas do escopo (ou diretamente a contatos/negócios).
    const [viaCompanies, contacts, deals] = await Promise.all([
      deps.unionAssocIds("companies", companyIds, "tickets"),
      deps.unionAssocIds("companies", companyIds, "contacts"),
      deps.unionAssocIds("companies", companyIds, "deals"),
    ]);
    const [viaContacts, viaDeals] = await Promise.all([
      deps.unionAssocIds("contacts", [...contacts], "tickets"),
      deps.unionAssocIds("deals", [...deals], "tickets"),
    ]);
    const merged = new Set<string>();
    for (const x of viaCompanies) merged.add(x);
    for (const x of viaContacts) merged.add(x);
    for (const x of viaDeals) merged.add(x);
    return merged.size;
  }

  // activities
  const [contacts, deals] = await Promise.all([
    deps.unionAssocIds("companies", companyIds, "contacts"),
    deps.unionAssocIds("companies", companyIds, "deals"),
  ]);
  let total = 0;
  for (const t of ACTIVITY_TYPES) {
    const [a, b, c] = await Promise.all([
      deps.unionAssocIds("companies", companyIds, t),
      deps.unionAssocIds("contacts", [...contacts], t),
      deps.unionAssocIds("deals", [...deals], t),
    ]);
    const merged = new Set<string>();
    for (const x of a) merged.add(x);
    for (const x of b) merged.add(x);
    for (const x of c) merged.add(x);
    total += merged.size;
  }
  return total;
}

/** `planned` final exposto ao wizard — nunca pode ultrapassar o `remote`. */
export async function computePlannedCapped(
  key: CountObjectKey,
  remote: number,
  maxCompanies: number,
  deps: CountDeps,
): Promise<number> {
  return Math.min(await computePlannedCount(key, remote, maxCompanies, deps), remote);
}
