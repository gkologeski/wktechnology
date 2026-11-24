import { it, expect, vi, beforeEach, describe } from "vitest";
const m = vi.hoisted(() => ({
  allowed: true,
  workspaceId: "w-1" as string | null,
  activeMember: true,
  manageAllowed: true,
  manageDenied: false,
  contactViewAllowed: true,
  rpcError: null as string | null,
  sigCtx: {
    hash: "a".repeat(64),
    reason: null,
    deal_id: null as string | null,
    entity_id: "le-1" as string | null,
    can_manage: true,
    commercial_source: false,
    is_purchase: true,
    entities: [{ id: "le-1", name: "GM Kologeski & Cia Ltda ME", cnpj: "19133530000136" }],
    evidence: [],
  },
}));
vi.mock("@/lib/access-control/enforce.server", () => ({
  getActiveWorkspaceId: async () => {
    if (!m.activeMember || !m.workspaceId) throw new Error("Membro inativo ou sem workspace.");
    return m.workspaceId;
  },
  assertPermission: async (_sb: unknown, _u: string, _w: string, key: string) => {
    if (key === "techcontracts.signature_evidence.manage.workspace") {
      if (m.manageDenied || !m.manageAllowed) throw new Error(`denied:${key}`);
    }
  },
  hasPermission: async (_sb: unknown, _u: string, _w: string, key: string) => {
    if (key.startsWith("techsales.contacts.view.")) return m.contactViewAllowed;
    return true;
  },
  assertAnyPermission: async () => {
    if (!m.allowed) throw new Error("denied");
  },
}));
vi.mock("@/lib/access-control/work-core.server", () => ({
  workRpc: async () => {
    if (m.rpcError) throw new Error(m.rpcError);
    return m.sigCtx;
  },
}));
import { resolveSignerContacts, suggestContractSigners } from "./signer-contacts.server";
const a = "10000000-0000-4000-8000-000000000001",
  b = "10000000-0000-4000-8000-000000000002";
const list = [
  { role: "CONTRATANTE", contactId: a },
  { role: "CONTRATADO", contactId: b },
];
const rows = () => [
  { id: a, first_name: "Cliente", last_name: "Fixture", email: "cliente@example.test" },
  { id: b, first_name: "Emissor", last_name: "Fixture", email: "emissor@example.test" },
];
function client(data: unknown[]) {
  const q: any = {
    select: vi.fn(() => q),
    eq: vi.fn(() => q),
    is: vi.fn(() => q),
    in: vi.fn(async () => ({ data, error: null })),
  };
  return { from: vi.fn(() => q), q } as any;
}
beforeEach(() => {
  m.allowed = true;
  m.workspaceId = "w-1";
  m.activeMember = true;
  m.manageAllowed = true;
  m.manageDenied = false;
  m.contactViewAllowed = true;
  m.rpcError = null;
  m.sigCtx = {
    hash: "a".repeat(64),
    reason: null,
    deal_id: null,
    entity_id: "le-1",
    can_manage: true,
    commercial_source: false,
    is_purchase: true,
    entities: [{ id: "le-1", name: "GM Kologeski & Cia Ltda ME", cnpj: "19133530000136" }],
    evidence: [],
  };
});
it("resolves signer identities only from visible workspace contacts", async () => {
  const c = client(rows());
  const r = await resolveSignerContacts(c, "u", "w", list);
  expect(c.q.eq).toHaveBeenCalledWith("workspace_id", "w");
  expect(c.q.is).toHaveBeenCalledWith("deleted_at", null);
  expect(r[0].name).toBe("Cliente Fixture");
  expect(r[0].email).toBe("cliente@example.test");
});
it("denies contact resolution before querying without contact permission", async () => {
  m.allowed = false;
  const c = client(rows());
  await expect(resolveSignerContacts(c, "u", "w", list)).rejects.toThrow("denied");
  expect(c.from).not.toHaveBeenCalled();
});
it("does not substitute missing or inaccessible contacts", async () => {
  await expect(resolveSignerContacts(client(rows().slice(0, 1)), "u", "w", list)).rejects.toThrow(
    "não está mais disponível",
  );
});
it("rejects invalid stored emails and duplicate signer emails", async () => {
  const invalid = rows();
  invalid[0].email = "not-email";
  await expect(resolveSignerContacts(client(invalid), "u", "w", list)).rejects.toThrow();
  const same = rows();
  same[1].email = same[0].email;
  await expect(resolveSignerContacts(client(same), "u", "w", list)).rejects.toThrow("distintos");
});

type MockTables = Record<string, any[]>;

function mockDb(tables: MockTables) {
  const queriedTables: string[] = [];
  const sb = {
    from: vi.fn((table: string) => {
      queriedTables.push(table);
      let rows = [...(tables[table] ?? [])];
      const q: any = {
        select: vi.fn(() => q),
        eq: vi.fn((col: string, val: unknown) => {
          rows = rows.filter((r) => r[col] === val);
          return q;
        }),
        in: vi.fn((col: string, vals: unknown[]) => {
          rows = rows.filter((r) => vals.includes(r[col]));
          return q;
        }),
        is: vi.fn((col: string, val: unknown) => {
          rows = rows.filter((r) => (r[col] ?? null) === val);
          return q;
        }),
        not: vi.fn((col: string, _op: string, val: unknown) => {
          rows = rows.filter((r) => (r[col] ?? null) !== val);
          return q;
        }),
        order: vi.fn(() => q),
        limit: vi.fn((n: number) => {
          rows = rows.slice(0, n);
          return q;
        }),
        maybeSingle: vi.fn(async () => ({ data: rows[0] ?? null, error: null })),
        then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }),
      };
      return q;
    }),
  } as any;
  return { sb, queriedTables };
}

describe("suggestContractSigners", () => {
  const guilhermeId = "10000000-0000-4000-8000-000000000010";
  const andersonId = "10000000-0000-4000-8000-000000000020";
  const gustavoId = "10000000-0000-4000-8000-000000000030";

  it("suggests contract signers for authorized active member on purchase contract", async () => {
    const { sb } = mockDb({
      contracts: [
        {
          id: "c-buy",
          workspace_id: "w-1",
          role: "client",
          counterparty_kind: "company",
          counterparty_company_id: "co-amit",
          counterparty_contact_id: andersonId,
          contracting_legal_entity_id: "le-1",
          legal_entity_id: "le-1",
          deal_id: null,
        },
        {
          id: "c-past-sale",
          workspace_id: "w-1",
          role: "provider",
          contracting_legal_entity_id: "le-1",
          legal_entity_id: "le-1",
        },
      ],
      companies: [{ id: "co-amit", workspace_id: "w-1", name: "Am It Serviços Em Informática" }],
      contacts: [
        {
          id: andersonId,
          workspace_id: "w-1",
          company_id: "co-amit",
          first_name: "Anderson",
          last_name: "Caldas",
          email: "anderson@amit.test",
          custom_fields: {},
        },
        {
          id: guilhermeId,
          workspace_id: "w-1",
          company_id: "co-wk",
          first_name: "Guilherme",
          last_name: "Kologeski",
          email: "guilherme@wk.test",
          custom_fields: { cpf: "123.456.789-00" },
        },
      ],
      contract_forsign_operations: [
        {
          workspace_id: "w-1",
          contract_id: "c-past-sale",
          created_at: "2026-11-14T20:00:00Z",
          requested_members: [{ role: "CONTRATADO", contact_id: guilhermeId }],
        },
      ],
    });

    const res = await suggestContractSigners(sb, "u-1", "c-buy");
    expect(res.isPurchase).toBe(true);
    expect(res.contratante).toEqual({
      partyName: "GM Kologeski & Cia Ltda ME",
      partyKind: "company",
      contact: { id: guilhermeId, name: "Guilherme Kologeski", email: "guilherme@wk.test" },
      cpf: "123.456.789-00",
    });
    expect(res.contratado).toEqual({
      partyName: "Am It Serviços Em Informática",
      partyKind: "company",
      contact: { id: andersonId, name: "Anderson Caldas", email: "anderson@amit.test" },
      cpf: null,
    });
  });

  it("reverses parties for sale contracts and picks unique signatario_legal with cpf", async () => {
    m.sigCtx.is_purchase = false;
    const { sb } = mockDb({
      contracts: [
        {
          id: "c-sale",
          workspace_id: "w-1",
          role: "provider",
          counterparty_kind: "company",
          counterparty_company_id: "co-nexid",
          counterparty_contact_id: null,
          contracting_legal_entity_id: "le-1",
          legal_entity_id: "le-1",
          deal_id: null,
        },
      ],
      companies: [
        { id: "co-nexid", workspace_id: "w-1", name: "NEXID LTDA", cnpj: "11222333000181" },
        { id: "co-wk", workspace_id: "w-1", name: "WK Technology", cnpj: "19133530000136" },
      ],
      contacts: [
        {
          id: gustavoId,
          workspace_id: "w-1",
          company_id: "co-nexid",
          first_name: "Gustavo",
          last_name: "Silveira",
          email: "gustavo@nexid.test",
          custom_fields: { signatario_legal: true, cpf: "006.597.269-47" },
        },
        {
          id: guilhermeId,
          workspace_id: "w-1",
          company_id: "co-wk",
          first_name: "Guilherme",
          last_name: "Kologeski",
          email: "guilherme@wk.test",
          custom_fields: { signatario_legal: "true" },
        },
      ],
    });

    const res = await suggestContractSigners(sb, "u-1", "c-sale");
    expect(res.isPurchase).toBe(false);
    expect(res.contratante.partyName).toBe("NEXID LTDA");
    expect(res.contratante.contact?.id).toBe(gustavoId);
    expect(res.contratante.cpf).toBe("006.597.269-47");
    expect(res.contratado.partyName).toBe("GM Kologeski & Cia Ltda ME");
    expect(res.contratado.contact?.id).toBe(guilhermeId);
  });

  it("marks person counterparty and leaves ambiguous company contacts blank", async () => {
    const { sb } = mockDb({
      contracts: [
        {
          id: "c-pf",
          workspace_id: "w-1",
          role: "client",
          counterparty_kind: "person",
          counterparty_company_id: null,
          counterparty_contact_id: andersonId,
          contracting_legal_entity_id: "le-1",
          legal_entity_id: "le-1",
          deal_id: null,
        },
      ],
      contacts: [
        {
          id: andersonId,
          workspace_id: "w-1",
          first_name: "Anderson",
          last_name: "Caldas",
          email: "anderson@pf.test",
        },
      ],
    });
    const pf = await suggestContractSigners(sb, "u-1", "c-pf");
    expect(pf.contratado.partyKind).toBe("person");
    expect(pf.contratado.contact?.id).toBe(andersonId);

    const ambig = mockDb({
      contracts: [
        {
          id: "c-ambig",
          workspace_id: "w-1",
          role: "client",
          counterparty_kind: "company",
          counterparty_company_id: "co-multi",
          counterparty_contact_id: null,
          contracting_legal_entity_id: "le-1",
          legal_entity_id: "le-1",
          deal_id: null,
        },
      ],
      companies: [{ id: "co-multi", workspace_id: "w-1", name: "Empresa Multi" }],
      contacts: [
        {
          id: andersonId,
          workspace_id: "w-1",
          company_id: "co-multi",
          first_name: "Pessoa",
          last_name: "Um",
          email: "um@multi.test",
        },
        {
          id: gustavoId,
          workspace_id: "w-1",
          company_id: "co-multi",
          first_name: "Pessoa",
          last_name: "Dois",
          email: "dois@multi.test",
        },
      ],
    });
    const rAmbig = await suggestContractSigners(ambig.sb, "u-1", "c-ambig");
    expect(rAmbig.contratado.partyName).toBe("Empresa Multi");
    expect(rAmbig.contratado.contact).toBeNull();
  });

  it("avoids suggesting the same contact on both sides", async () => {
    const { sb } = mockDb({
      contracts: [
        {
          id: "c-dup",
          workspace_id: "w-1",
          role: "client",
          counterparty_kind: "company",
          counterparty_company_id: "co-amit",
          counterparty_contact_id: guilhermeId,
          contracting_legal_entity_id: "le-1",
          legal_entity_id: "le-1",
          deal_id: null,
        },
      ],
      companies: [
        { id: "co-amit", workspace_id: "w-1", name: "Am It" },
        { id: "co-wk", workspace_id: "w-1", name: "WK", cnpj: "19133530000136" },
      ],
      contacts: [
        {
          id: guilhermeId,
          workspace_id: "w-1",
          company_id: "co-wk",
          first_name: "Guilherme",
          last_name: "Kologeski",
          email: "guilherme@wk.test",
          custom_fields: { signatario_legal: true },
        },
      ],
    });
    const res = await suggestContractSigners(sb, "u-1", "c-dup");
    expect(res.contratado.contact?.id).toBe(guilhermeId);
    expect(res.contratante.contact).toBeNull();
  });

  it("returns only party names without querying contacts when contact view permission is missing", async () => {
    m.contactViewAllowed = false;
    const { sb, queriedTables } = mockDb({
      contracts: [
        {
          id: "c-buy",
          workspace_id: "w-1",
          role: "client",
          counterparty_kind: "company",
          counterparty_company_id: "co-amit",
          counterparty_contact_id: andersonId,
          contracting_legal_entity_id: "le-1",
          legal_entity_id: "le-1",
          deal_id: null,
        },
      ],
      companies: [{ id: "co-amit", workspace_id: "w-1", name: "Am It Serviços Em Informática" }],
      contacts: [
        {
          id: andersonId,
          workspace_id: "w-1",
          first_name: "Anderson",
          last_name: "Caldas",
          email: "anderson@amit.test",
        },
      ],
    });
    const res = await suggestContractSigners(sb, "u-1", "c-buy");
    expect(res.contratante.partyName).toBe("GM Kologeski & Cia Ltda ME");
    expect(res.contratante.contact).toBeNull();
    expect(res.contratado.partyName).toBe("Am It Serviços Em Informática");
    expect(res.contratado.contact).toBeNull();
    expect(queriedTables).not.toContain("contacts");
  });

  it("rejects signer suggestion when signature manage permission is missing", async () => {
    m.manageAllowed = false;
    const { sb } = mockDb({});
    await expect(suggestContractSigners(sb, "u-1", "c-1")).rejects.toThrow("denied");
    expect(sb.from).not.toHaveBeenCalled();
  });

  it("rejects signer suggestion on explicit deny", async () => {
    m.manageDenied = true;
    const { sb } = mockDb({});
    await expect(suggestContractSigners(sb, "u-1", "c-1")).rejects.toThrow("denied");
    expect(sb.from).not.toHaveBeenCalled();
  });

  it("rejects signer suggestion for foreign workspace contract", async () => {
    m.rpcError = "Sem acesso à evidência do contrato.";
    const { sb } = mockDb({});
    await expect(suggestContractSigners(sb, "u-1", "c-other-ws")).rejects.toThrow("Sem acesso");
    expect(sb.from).not.toHaveBeenCalled();
  });

  it("rejects signer suggestion for inactive member", async () => {
    m.activeMember = false;
    const { sb } = mockDb({});
    await expect(suggestContractSigners(sb, "u-1", "c-1")).rejects.toThrow("inativo");
    expect(sb.from).not.toHaveBeenCalled();
  });
});
