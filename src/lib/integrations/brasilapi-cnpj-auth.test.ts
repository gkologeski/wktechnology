import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveWorkspaceId: vi.fn(),
  assertSalesRecord: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/access-control/enforce.server", () => ({
  getActiveWorkspaceId: mocks.getActiveWorkspaceId,
}));
vi.mock("@/lib/access-control/sales-core.server", () => ({
  assertSalesRecord: mocks.assertSalesRecord,
}));

import { runEnrichCompanyByCNPJ } from "./brasilapi-cnpj.server";

const WORKSPACE_ID = "184b9435-0a9b-4334-9e89-8854dc883f5d";
const USER_ID = "1c237fbe-079e-4eb9-a3e6-c08d85e79688";
const COMPANY_ID = "1dfeec94-41c5-4f06-8c2a-27804d1fe738";

function makeSupabaseMock(companyRow: Record<string, unknown> | null) {
  const updatePayloads: Record<string, unknown>[] = [];
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: companyRow, error: null }),
  };
  const updateChain = {
    update: vi.fn((payload: Record<string, unknown>) => {
      updatePayloads.push(payload);
      return updateChain;
    }),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue({ data: [{ id: COMPANY_ID }], error: null }),
  };
  let callCount = 0;
  const from = vi.fn(() => {
    callCount += 1;
    return callCount === 1 ? selectChain : updateChain;
  });
  return { supabase: { from } as never, from, updatePayloads, selectChain, updateChain };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getActiveWorkspaceId.mockResolvedValue(WORKSPACE_ID);
  mocks.assertSalesRecord.mockResolvedValue(undefined);
  mocks.fetch.mockImplementation(async () =>
    Response.json({
      cnpj: "19133530000136",
      razao_social: "GM KOLOGESKI & CIA LTDA",
      nome_fantasia: "WK TECHNOLOGY",
      municipio: "PORTO ALEGRE",
      uf: "RS",
    }),
  );
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => vi.unstubAllGlobals());

describe("runEnrichCompanyByCNPJ authorization & behavior", () => {
  it("allows authorized active member and writes legal_name/trade_name without touching name", async () => {
    const { supabase, updatePayloads } = makeSupabaseMock({
      id: COMPANY_ID,
      cnpj: "19133530000136",
      name: "WK Exibição",
      legal_name: null,
      trade_name: null,
      industry: null,
      size: null,
      phone: null,
      address: null,
      city: null,
      state: null,
      cep: null,
      domain: null,
    });

    const res = await runEnrichCompanyByCNPJ(supabase, USER_ID, { company_id: COMPANY_ID });
    expect(res).toEqual({
      ok: true,
      needsConfirmation: false,
      applied: 4,
      source: "brasilapi",
      cnpj: "19133530000136",
    });
    expect(mocks.getActiveWorkspaceId).toHaveBeenCalledWith(supabase, USER_ID);
    expect(mocks.assertSalesRecord).toHaveBeenCalledWith(
      supabase,
      "companies",
      COMPANY_ID,
      "update",
    );
    expect(updatePayloads).toHaveLength(1);
    expect(updatePayloads[0]).toMatchObject({
      legal_name: "GM KOLOGESKI & CIA LTDA",
      trade_name: "WK TECHNOLOGY",
      city: "PORTO ALEGRE",
      state: "RS",
    });
    expect("name" in (updatePayloads[0] ?? {})).toBe(false);
  });

  it("returns needsConfirmation when existing legal_name differs and only overwrites after confirmation", async () => {
    const { supabase, updatePayloads } = makeSupabaseMock({
      id: COMPANY_ID,
      cnpj: "19133530000136",
      name: "WK Exibição",
      legal_name: "RAZAO ANTIGA LTDA",
      trade_name: null,
      industry: null,
      size: null,
      phone: null,
      address: null,
      city: null,
      state: null,
      cep: null,
      domain: null,
    });

    const first = await runEnrichCompanyByCNPJ(supabase, USER_ID, { company_id: COMPANY_ID });
    expect(first).toMatchObject({
      ok: true,
      needsConfirmation: true,
      conflicts: [
        {
          field: "legal_name",
          current: "RAZAO ANTIGA LTDA",
          incoming: "GM KOLOGESKI & CIA LTDA",
        },
      ],
    });
    expect(updatePayloads).toHaveLength(0);

    const secondMock = makeSupabaseMock({
      id: COMPANY_ID,
      cnpj: "19133530000136",
      name: "WK Exibição",
      legal_name: "RAZAO ANTIGA LTDA",
      trade_name: null,
      industry: null,
      size: null,
      phone: null,
      address: null,
      city: null,
      state: null,
      cep: null,
      domain: null,
    });
    const second = await runEnrichCompanyByCNPJ(secondMock.supabase, USER_ID, {
      company_id: COMPANY_ID,
      overwrite: true,
    });
    expect(second).toEqual({
      ok: true,
      needsConfirmation: false,
      applied: 4,
      source: "brasilapi",
      cnpj: "19133530000136",
    });
    expect(secondMock.updatePayloads[0]).toMatchObject({
      legal_name: "GM KOLOGESKI & CIA LTDA",
      trade_name: "WK TECHNOLOGY",
    });
    expect("name" in (secondMock.updatePayloads[0] ?? {})).toBe(false);
  });

  it("denies missing permission before querying external CNPJ API", async () => {
    mocks.assertSalesRecord.mockRejectedValue(new Error("missing permission"));
    const { supabase, from } = makeSupabaseMock(null);
    await expect(
      runEnrichCompanyByCNPJ(supabase, USER_ID, { company_id: COMPANY_ID }),
    ).rejects.toThrow("missing permission");
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("denies explicit deny before querying external CNPJ API", async () => {
    mocks.assertSalesRecord.mockRejectedValue(new Error("explicit deny"));
    const { supabase, from } = makeSupabaseMock(null);
    await expect(
      runEnrichCompanyByCNPJ(supabase, USER_ID, { company_id: COMPANY_ID }),
    ).rejects.toThrow("explicit deny");
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("denies foreign workspace company before querying external CNPJ API", async () => {
    mocks.assertSalesRecord.mockRejectedValue(new Error("foreign workspace"));
    const { supabase, from } = makeSupabaseMock(null);
    await expect(
      runEnrichCompanyByCNPJ(supabase, USER_ID, { company_id: COMPANY_ID }),
    ).rejects.toThrow("foreign workspace");
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("denies inactive workspace member before querying external CNPJ API", async () => {
    mocks.getActiveWorkspaceId.mockRejectedValue(new Error("inactive member"));
    const { supabase, from } = makeSupabaseMock(null);
    await expect(
      runEnrichCompanyByCNPJ(supabase, USER_ID, { company_id: COMPANY_ID }),
    ).rejects.toThrow("inactive member");
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });
});
