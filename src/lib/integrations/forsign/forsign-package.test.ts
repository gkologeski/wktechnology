import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ prepare: vi.fn(), bytes: vi.fn(), chain: vi.fn() }));
vi.mock("@/lib/contracts/signature-package.server", () => ({
  prepareSignaturePackage: m.prepare,
  loadPackageBytes: m.bytes,
}));
vi.mock("@/lib/access-control/enforce.server", () => ({
  getActiveWorkspaceId: async () => "W",
  assertPermission: async () => {},
  hasPermission: async () => true,
}));
vi.mock("@/lib/view-as-guard.server", () => ({ assertNotReadOnlyView: async () => {} }));
vi.mock("@/lib/ai/provider-resolver.server", () => ({
  decryptApiKey: async () => "test-credential",
  encryptApiKey: async () => "",
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: m.chain, rpc: async () => ({ data: "<h1>Contrato</h1>", error: null }) },
}));
import { ForsignClient, sendContract } from "./forsign-service.server";
const input = {
  contractId: "C",
  hash: "a".repeat(64),
  signers: [
    { contactId: "1", name: "Cliente", email: "cliente@example.test", role: "CONTRATANTE" },
    { contactId: "2", name: "Empresa", email: "empresa@example.test", role: "CONTRATADO" },
  ],
};
const caller = {
  rpc: vi.fn().mockResolvedValue({ data: { can_manage: true, hash: "a".repeat(64) }, error: null }),
};
beforeEach(() => {
  vi.clearAllMocks();
  m.prepare.mockResolvedValue({ id: "pack" });
  m.bytes.mockResolvedValue(new Uint8Array([7, 8, 9]));
  m.chain.mockImplementation((table) => {
    const c = {
      select: () => c,
      eq: () => c,
      insert: () => c,
      update: () => c,
      maybeSingle: async () => ({
        data: { key_ciphertext: "configured", enabled: true },
        error: null,
      }),
      single: async () => ({
        data:
          table === "contracts"
            ? { id: "C", title: "Contrato", number: "42" }
            : { id: "operation" },
        error: null,
      }),
    };
    return c;
  });
  vi.spyOn(ForsignClient.prototype, "uploadPdf").mockResolvedValue("11");
  vi.spyOn(ForsignClient.prototype, "createOperation").mockResolvedValue({
    id: 22,
    files: [{ id: 11 }],
    sequential: false,
  } as never);
});
afterEach(() => vi.restoreAllMocks());
it("forsign sends the exact frozen contract-and-annex PDF instead of rebuilding the main body", async () => {
  await sendContract(caller as never, "actor", input);
  expect(m.prepare).toHaveBeenCalledWith(caller, "actor", "C", input.hash);
  expect(ForsignClient.prototype.uploadPdf).toHaveBeenCalledWith(
    new Uint8Array([7, 8, 9]),
    "42.pdf",
  );
  expect(ForsignClient.prototype.createOperation).toHaveBeenCalledWith(
    expect.objectContaining({ files: [{ id: "11", description: "42.pdf" }] }),
  );
  expect(caller.rpc).toHaveBeenCalledTimes(2);
});
it("forsign does not upload or send invitations when any annex cannot be prepared", async () => {
  m.prepare.mockRejectedValue(new Error("Anexo inválido"));
  await expect(sendContract(caller as never, "actor", input)).rejects.toThrow("Anexo inválido");
  expect(ForsignClient.prototype.uploadPdf).not.toHaveBeenCalled();
  expect(ForsignClient.prototype.createOperation).not.toHaveBeenCalled();
});
