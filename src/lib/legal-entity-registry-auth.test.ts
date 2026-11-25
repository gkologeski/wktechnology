import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), fetch: vi.fn(), from: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const b = { middleware: () => b, inputValidator: () => b, handler: (f: unknown) => f };
    return b;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/active-workspace.server", () => ({
  resolveActiveWorkspace: async () => "184b9435-0a9b-4334-9e89-8854dc883f5d",
}));
import {
  lookupCnpjForLegalEntity,
  lookupCepForLegalEntity,
  upsertLegalEntity,
  getLegalEntity,
} from "./legal-entities.functions";
import { readLegalEntityAddress } from "./legal-entity-address";
const workspace = "184b9435-0a9b-4334-9e89-8854dc883f5d";
const id = "aaaaaaaa-1111-4111-8111-111111111111";
const context = {
  userId: "1c237fbe-079e-4eb9-a3e6-c08d85e79688",
  supabase: { rpc: mocks.rpc, from: mocks.from },
};
const invoke = (fn: unknown, data: unknown) =>
  (fn as (input: { data: unknown; context: typeof context }) => Promise<unknown>)({
    data,
    context,
  });
async function invokeLookups() {
  await invoke(lookupCnpjForLegalEntity, { id, cnpj: "19133530000136" });
  await invoke(lookupCepForLegalEntity, { id, cep: "88000-000" });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: workspace, error: null });
  mocks.fetch.mockImplementation(async () =>
    Response.json({ razao_social: "Public company", localidade: "Florianópolis" }),
  );
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());
it("registry allows authorized active member before public lookup", async () => {
  await invokeLookups();
  expect(mocks.rpc).toHaveBeenCalledWith("finance_business_authorize", {
    _resource: "legal_entities",
    _action: "update",
    _id: id,
  });
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  expect(mocks.from).not.toHaveBeenCalled();
});
it("registry denies missing permission before CNPJ and CEP requests", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "missing permission" } });
  await expect(invoke(lookupCnpjForLegalEntity, { id, cnpj: "19133530000136" })).rejects.toThrow(
    "missing permission",
  );
  await expect(invoke(lookupCepForLegalEntity, { id, cep: "88000-000" })).rejects.toThrow(
    "missing permission",
  );
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("registry denies explicit deny before public requests", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "explicit deny" } });
  await expect(invokeLookups()).rejects.toThrow("explicit deny");
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("registry denies foreign workspace record before public requests", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "foreign workspace" } });
  await expect(invokeLookups()).rejects.toThrow("foreign workspace");
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("registry denies inactive member before public requests", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "inactive member" } });
  await expect(invokeLookups()).rejects.toThrow("inactive member");
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("registry uses create authorization for unsaved company", async () => {
  await invoke(lookupCnpjForLegalEntity, { cnpj: "19133530000136" });
  expect(mocks.rpc).toHaveBeenCalledWith("finance_business_authorize", {
    _resource: "legal_entities",
    _action: "create",
    _id: null,
  });
});
it("saves structured address under user RLS with workspace filter and reads it back", async () => {
  const address = readLegalEntityAddress({
    street: "Rua A",
    number: "42",
    city: "Curitiba",
    state: "PR",
    zip_code: "80000-000",
  });
  const q = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() };
  q.update.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  q.select.mockResolvedValueOnce({ data: [{ id }], error: null }).mockReturnValue(q);
  q.maybeSingle.mockResolvedValue({ data: { id, address_json: address }, error: null });
  mocks.from.mockReturnValue(q);
  await expect(
    invoke(upsertLegalEntity, { id, name: "Empresa", address_json: address }),
  ).resolves.toEqual({ id });
  expect(q.update).toHaveBeenCalledWith(expect.objectContaining({ address_json: address }));
  expect(q.eq).toHaveBeenCalledWith("workspace_id", workspace);
  expect(await invoke(getLegalEntity, { id })).toEqual({ id, address_json: address });
  expect(q.select).toHaveBeenLastCalledWith(expect.stringContaining("address_json"));
});
it("does not report a successful save when RLS updates zero records", async () => {
  const q = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  q.update.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  mocks.from.mockReturnValue(q);
  await expect(invoke(upsertLegalEntity, { id, name: "Empresa" })).rejects.toThrow("Sem permissão");
});
