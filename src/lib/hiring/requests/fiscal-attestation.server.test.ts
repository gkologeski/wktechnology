import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const mock = vi.hoisted(() => ({ download: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { storage: { from: mock.from } },
}));
vi.mock("@/lib/access-control/work-core.server", () => ({ workRpc: mock.rpc }));
import { attestReservedFiscalFile } from "./fiscal-attestation.server";
const bytes = new TextEncoder().encode("%PDF-1.7\nFiscal document fixture\n%%EOF");
const input = {
  workspaceId: "workspace",
  requestId: "request",
  documentId: "document",
  actorId: "uploader",
  path: "workspace/request/document",
  sha256: createHash("sha256").update(bytes).digest("hex"),
  size: bytes.length,
  mime: "application/pdf",
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.from.mockReturnValue({ download: mock.download });
  mock.download.mockResolvedValue({ data: new Blob([bytes]), error: null });
  mock.rpc.mockResolvedValue(undefined);
});
it("attests only the re-read reserved bytes with their actor, MIME, size and SHA-256", async () => {
  await attestReservedFiscalFile(input);
  expect(mock.from).toHaveBeenCalledWith("hiring-fiscal-documents");
  expect(mock.download).toHaveBeenCalledWith(input.path);
  expect(mock.rpc).toHaveBeenCalledWith(expect.anything(), "hiring_fiscal_attest", {
    w: input.workspaceId,
    i: input.requestId,
    p_doc: input.documentId,
    p_actor: input.actorId,
    p_sha256: input.sha256,
    p_size: bytes.length,
    p_mime: input.mime,
  });
});
it("refuses an altered stored payload before invoking the trusted attestation", async () => {
  mock.download.mockResolvedValue({ data: new Blob(["%PDF-replaced content"]), error: null });
  await expect(attestReservedFiscalFile(input)).rejects.toThrow("difere do enviado");
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("refuses a declared MIME or size that differs from the stored bytes", async () => {
  await expect(attestReservedFiscalFile({ ...input, mime: "image/png" })).rejects.toThrow(
    "difere do enviado",
  );
  await expect(attestReservedFiscalFile({ ...input, size: bytes.length + 1 })).rejects.toThrow(
    "difere do enviado",
  );
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("keeps failed storage reads out of the trusted attestation and hides provider details", async () => {
  mock.download.mockResolvedValue({ data: null, error: { message: "private provider detail" } });
  await expect(attestReservedFiscalFile(input)).rejects.toThrow("indisponível para confirmação");
  expect(mock.rpc).not.toHaveBeenCalled();
});
