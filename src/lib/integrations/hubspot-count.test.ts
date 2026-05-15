import { describe, expect, it } from "vitest";
import { computePlannedCapped, type CountDeps } from "./hubspot-count";

/**
 * Helpers para montar `deps` de forma declarativa nos testes.
 * `assoc` é uma matriz: { [`${fromObj}->${toObj}`]: Map<fromId, toIds[]> }
 */
function makeDeps(opts: {
  companyIds: string[];
  remote?: Partial<Record<string, number>>;
  assoc?: Record<string, Record<string, string[]>>;
  contactProps?: Record<string, Record<string, string>>;
}): CountDeps & { calls: { unionAssoc: number; getCompanyIds: number; readContactProps: number } } {
  const calls = { unionAssoc: 0, getCompanyIds: 0, readContactProps: 0 };
  return {
    calls,
    remoteCount: async (k) => opts.remote?.[k] ?? 0,
    getCompanyIds: async () => {
      calls.getCompanyIds++;
      return opts.companyIds;
    },
    unionAssocIds: async (fromObj, fromIds, toObj) => {
      calls.unionAssoc++;
      const table = opts.assoc?.[`${fromObj}->${toObj}`] ?? {};
      const out = new Set<string>();
      for (const id of fromIds) for (const x of table[id] ?? []) out.add(x);
      return out;
    },
    readContactProps: async (ids) => {
      calls.readContactProps++;
      return ids.map((id) => ({ id, properties: opts.contactProps?.[id] ?? {} }));
    },
  } as CountDeps & typeof calls extends never ? never : ReturnType<typeof makeDeps>;
}

describe("computePlannedCapped — empresas", () => {
  it("respeita o limite maxCompanies quando remote é maior", async () => {
    const deps = makeDeps({ companyIds: [] });
    const planned = await computePlannedCapped("companies", 1000, 50, deps);
    expect(planned).toBe(50);
  });

  it("usa o remote quando maxCompanies é maior", async () => {
    const deps = makeDeps({ companyIds: [] });
    const planned = await computePlannedCapped("companies", 12, 200, deps);
    expect(planned).toBe(12);
  });
});

describe("computePlannedCapped — zero empresas no escopo", () => {
  it("retorna 0 para contatos mesmo se HubSpot tem milhares", async () => {
    const deps = makeDeps({ companyIds: [], remote: { contacts: 5000 } });
    const planned = await computePlannedCapped("contacts", 5000, 200, deps);
    expect(planned).toBe(0);
    // Não deve nem tentar pedir associações se não há empresa-fonte.
    expect(deps.calls.unionAssoc).toBe(0);
  });

  it("retorna 0 para deals, leads e activities", async () => {
    const deps = makeDeps({ companyIds: [] });
    for (const k of ["deals", "leads", "activities"] as const) {
      expect(await computePlannedCapped(k, 999, 200, deps)).toBe(0);
    }
  });
});

describe("computePlannedCapped — empresas sem contatos vinculados", () => {
  it("contatos = 0 quando nenhuma empresa do escopo tem contatos", async () => {
    const deps = makeDeps({
      companyIds: ["c1", "c2", "c3"],
      remote: { contacts: 1234 },
      assoc: { "companies->contacts": { c1: [], c2: [], c3: [] } },
    });
    const planned = await computePlannedCapped("contacts", 1234, 200, deps);
    expect(planned).toBe(0);
  });

  it("leads = 0 quando empresas do escopo não têm contatos (não chama readContactProps)", async () => {
    const deps = makeDeps({
      companyIds: ["c1"],
      remote: { leads: 500 },
      assoc: { "companies->contacts": { c1: [] } },
    });
    const planned = await computePlannedCapped("leads", 500, 200, deps);
    expect(planned).toBe(0);
    expect(deps.calls.readContactProps).toBe(0);
  });

  it("conta apenas contatos efetivamente vinculados, deduplicados entre empresas", async () => {
    const deps = makeDeps({
      companyIds: ["c1", "c2"],
      remote: { contacts: 100 },
      assoc: {
        "companies->contacts": {
          c1: ["p1", "p2"],
          c2: ["p2", "p3"], // p2 duplicado — deve contar 1×
        },
      },
    });
    const planned = await computePlannedCapped("contacts", 100, 200, deps);
    expect(planned).toBe(3);
  });
});

describe("computePlannedCapped — leads sem lifecyclestage=lead", () => {
  it("contatos existem mas nenhum é lead → planned = 0", async () => {
    const deps = makeDeps({
      companyIds: ["c1"],
      remote: { leads: 10 },
      assoc: { "companies->contacts": { c1: ["p1", "p2", "p3"] } },
      contactProps: {
        p1: { lifecyclestage: "customer" },
        p2: { lifecyclestage: "subscriber" },
        p3: { lifecyclestage: "opportunity" },
      },
    });
    const planned = await computePlannedCapped("leads", 10, 200, deps);
    expect(planned).toBe(0);
  });

  it("conta só os contatos com lifecyclestage='lead'", async () => {
    const deps = makeDeps({
      companyIds: ["c1"],
      remote: { leads: 10 },
      assoc: { "companies->contacts": { c1: ["p1", "p2", "p3", "p4"] } },
      contactProps: {
        p1: { lifecyclestage: "lead" },
        p2: { lifecyclestage: "customer" },
        p3: { lifecyclestage: "lead" },
        p4: {}, // sem propriedade — não conta
      },
    });
    const planned = await computePlannedCapped("leads", 10, 200, deps);
    expect(planned).toBe(2);
  });

  it("cap por remote: nunca retorna mais que o total no HubSpot", async () => {
    const deps = makeDeps({
      companyIds: ["c1"],
      remote: { leads: 1 },
      assoc: { "companies->contacts": { c1: ["p1", "p2"] } },
      contactProps: {
        p1: { lifecyclestage: "lead" },
        p2: { lifecyclestage: "lead" },
      },
    });
    // computado seria 2, mas remote=1 deve limitar.
    const planned = await computePlannedCapped("leads", 1, 200, deps);
    expect(planned).toBe(1);
  });
});

describe("computePlannedCapped — atividades", () => {
  it("deduplica atividades vinculadas a múltiplas entidades do escopo", async () => {
    const deps = makeDeps({
      companyIds: ["c1"],
      remote: { activities: 100 },
      assoc: {
        "companies->contacts": { c1: ["p1"] },
        "companies->deals": { c1: ["d1"] },
        // mesma nota n1 aparece via company, contato e deal — deve contar 1×.
        "companies->notes": { c1: ["n1"] },
        "contacts->notes": { p1: ["n1", "n2"] },
        "deals->notes": { d1: ["n1"] },
      },
    });
    const planned = await computePlannedCapped("activities", 100, 200, deps);
    expect(planned).toBe(2); // n1 + n2
  });
});
