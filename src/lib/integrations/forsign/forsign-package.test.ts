import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { extractText } from "unpdf";
import { contractHtmlToPdf } from "./forsign-pdf";
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
let insertedOp: Record<string, unknown> | null = null;
beforeEach(async () => {
  vi.clearAllMocks();
  insertedOp = null;
  m.prepare.mockResolvedValue({ id: "pack" });
  const frozenPdf = await contractHtmlToPdf(
    "<h1>Contrato</h1><p>Anexo congelado</p>",
    "Contrato e anexos",
  );
  m.bytes.mockResolvedValue(frozenPdf);
  m.chain.mockImplementation((table) => {
    const c = {
      select: () => c,
      eq: () => c,
      insert: (row: Record<string, unknown>) => {
        if (table === "contract_forsign_operations") insertedOp = row;
        return c;
      },
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
it("forsign uses the frozen contract-and-annex PDF, stamps signature/rubric tags on every page, and sends tags in payload", async () => {
  await sendContract(caller as never, "actor", input);
  expect(m.prepare).toHaveBeenCalledWith(caller, "actor", "C", input.hash);
  expect(m.bytes).toHaveBeenCalledTimes(1);
  const uploadCall = vi.mocked(ForsignClient.prototype.uploadPdf).mock.calls[0];
  expect(uploadCall?.[1]).toBe("42.pdf");
  const uploadedBytes = uploadCall?.[0] as Uint8Array;
  const extracted = await extractText(new Uint8Array(uploadedBytes), { mergePages: false });
  const pages = Array.isArray(extracted.text) ? extracted.text : [String(extracted.text)];
  expect(pages.join("\n")).toContain("Anexo congelado");
  expect(pages.join("\n")).toContain("#TE-ASSINA-1");
  expect(pages.join("\n")).toContain("#TE-ASSINA-2");
  for (const page of pages) {
    expect(page).toContain("#TE-RUBRICA-1");
    expect(page).toContain("#TE-RUBRICA-2");
  }
  expect(ForsignClient.prototype.createOperation).toHaveBeenCalledWith(
    expect.objectContaining({
      files: [{ id: "11", description: "42.pdf" }],
      members: expect.arrayContaining([
        expect.objectContaining({
          email: "cliente@example.test",
          hasSignatureTag: true,
          signPositionTag: "#TE-ASSINA-1",
          hasRubricTag: true,
          rubricTag: "#TE-RUBRICA-1",
          signatures: [{ documentId: "11", printSignature: true, positions: [] }],
        }),
      ]),
    }),
  );
  expect(insertedOp?.requested_members).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        email: "cliente@example.test",
        placement: "signature_page",
        signature_tag: "#TE-ASSINA-1",
        rubric_tag: "#TE-RUBRICA-1",
      }),
    ]),
  );
  const expectedCheck = [
    ["hiring_contract_signature_context", { p_ws: "W", p_contract: "C" }],
    ["hiring_formalization_signature_gate", { w: "W", k: "C", h: input.hash }],
  ];
  expect(caller.rpc.mock.calls).toEqual([...expectedCheck, ...expectedCheck, ...expectedCheck]);
  const checks = caller.rpc.mock.invocationCallOrder;
  const preparedAt = m.prepare.mock.invocationCallOrder[0];
  const uploadedAt = vi.mocked(ForsignClient.prototype.uploadPdf).mock.invocationCallOrder[0];
  const invitedAt = vi.mocked(ForsignClient.prototype.createOperation).mock.invocationCallOrder[0];
  expect(checks[1]).toBeLessThan(preparedAt);
  expect(checks[2]).toBeGreaterThan(preparedAt);
  expect(checks[3]).toBeLessThan(uploadedAt);
  expect(checks[4]).toBeGreaterThan(uploadedAt);
  expect(checks[5]).toBeLessThan(invitedAt);
});
it("forsign does not upload or send invitations when any annex cannot be prepared", async () => {
  m.prepare.mockRejectedValue(new Error("Anexo inválido"));
  await expect(sendContract(caller as never, "actor", input)).rejects.toThrow("Anexo inválido");
  expect(ForsignClient.prototype.uploadPdf).not.toHaveBeenCalled();
  expect(ForsignClient.prototype.createOperation).not.toHaveBeenCalled();
});
