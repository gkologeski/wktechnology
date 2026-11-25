import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveWorkspaceId: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/access-control/enforce.server", () => ({
  getActiveWorkspaceId: mocks.getActiveWorkspaceId,
  assertAnyPermission: vi.fn(),
}));

import { lookupPersonCnpj } from "./person-cnpj-lookup.server";

const WORKSPACE_ID = "184b9435-0a9b-4334-9e89-8854dc883f5d";
const USER_ID = "1c237fbe-079e-4eb9-a3e6-c08d85e79688";
const PERSON_ID = "bbbbbbbb-2222-4222-8222-222222222222";
const VALID_CNPJ = "19133530000136";

const supabase = { rpc: mocks.rpc, from: mocks.from } as never;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getActiveWorkspaceId.mockResolvedValue(WORKSPACE_ID);
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.fetch.mockResolvedValue(
    Response.json({
      razao_social: "GM KOLOGESKI & CIA LTDA",
      nome_fantasia: "WK TECHNOLOGY",
    }),
  );
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => vi.unstubAllGlobals());

describe("lookupPersonCnpj authorization & fallback", () => {
  it("allows authorized active member and returns PJ suggestion without writing to database", async () => {
    const res = await lookupPersonCnpj(supabase, USER_ID, VALID_CNPJ, PERSON_ID);
    expect(mocks.getActiveWorkspaceId).toHaveBeenCalledWith(supabase, USER_ID);
    expect(mocks.rpc).toHaveBeenCalledWith("hr_record_access", {
      _resource: "people",
      _action: "update",
      _id: PERSON_ID,
    });
    expect(res).toEqual({
      legal_entity_name: "GM KOLOGESKI & CIA LTDA",
      trade_name: "WK TECHNOLOGY",
      source: "brasilapi",
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("denies missing permission before calling public CNPJ API", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect(lookupPersonCnpj(supabase, USER_ID, VALID_CNPJ, PERSON_ID)).rejects.toThrow(
      "Registro indisponível ou sem permissão para esta ação.",
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("denies explicit deny before calling public CNPJ API", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "explicit deny" } });
    await expect(lookupPersonCnpj(supabase, USER_ID, VALID_CNPJ, PERSON_ID)).rejects.toThrow(
      "explicit deny",
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("denies foreign workspace person before calling public CNPJ API", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect(lookupPersonCnpj(supabase, USER_ID, VALID_CNPJ, PERSON_ID)).rejects.toThrow(
      "Registro indisponível ou sem permissão para esta ação.",
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("denies inactive member before calling public CNPJ API", async () => {
    mocks.getActiveWorkspaceId.mockRejectedValue(new Error("inactive member"));
    await expect(lookupPersonCnpj(supabase, USER_ID, VALID_CNPJ, PERSON_ID)).rejects.toThrow(
      "inactive member",
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("falls back to ReceitaWS when BrasilAPI fails", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(null, { status: 503 })).mockResolvedValueOnce(
      Response.json({
        status: "OK",
        nome: "AM IT SERVICOS EM INFORMATICA LTDA",
        fantasia: "AM IT",
      }),
    );
    const res = await lookupPersonCnpj(supabase, USER_ID, VALID_CNPJ, PERSON_ID);
    expect(res).toEqual({
      legal_entity_name: "AM IT SERVICOS EM INFORMATICA LTDA",
      trade_name: "AM IT",
      source: "receitaws",
    });
  });
});
