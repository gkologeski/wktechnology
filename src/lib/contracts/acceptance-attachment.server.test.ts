import { beforeEach, expect, it, vi, type Mock } from "vitest";
import { createHash } from "node:crypto";
import {
  loadContractAcceptanceAttachment,
  type AcceptanceAttachmentDependencies,
} from "./acceptance-attachment.server";

const token = "a".repeat(64);
const attachmentId = "60000000-0000-4000-8000-000000000001";
const bytes = new TextEncoder().encode("Synthetic attachment, no private data.");
const context = {
  attachmentId,
  kind: "file" as const,
  fileName: "Condições.pdf",
  bucket: "contract-attachments" as const,
  storagePath: "workspace/contract/file.pdf",
  sha256: createHash("sha256").update(bytes).digest("hex"),
  sourceId: null,
  workspaceId: "workspace",
  contentHash: "b".repeat(64),
};
let authorize: Mock<AcceptanceAttachmentDependencies["authorize"]>,
  download: Mock<AcceptanceAttachmentDependencies["download"]>,
  render: Mock<AcceptanceAttachmentDependencies["render"]>;
let deps: AcceptanceAttachmentDependencies;
beforeEach(() => {
  authorize = vi.fn(async () => context);
  download = vi.fn(async () => bytes);
  render = vi.fn(async () => bytes);
  deps = { authorize, download, render };
});
it("acceptance annex permits only the authorized same document with verified bytes", async () => {
  const result = await loadContractAcceptanceAttachment(token, attachmentId, deps);
  expect(result.bytes).toEqual(bytes);
  expect(result.fileName).toBe("Condições.pdf");
  expect(Object.keys(result).sort()).toEqual(["bytes", "contentType", "fileName"]);
  expect(authorize).toHaveBeenCalledTimes(2);
  expect(download).toHaveBeenCalledExactlyOnceWith("contract-attachments", context.storagePath);
  expect(render).not.toHaveBeenCalled();
});
it("acceptance annex rejects a missing capability before privileged IO", async () => {
  await expect(loadContractAcceptanceAttachment("", attachmentId, deps)).rejects.toThrow(
    "indisponível",
  );
  expect(authorize).not.toHaveBeenCalled();
  expect(download).not.toHaveBeenCalled();
});
it("acceptance annex respects a revoked capability without downloading files", async () => {
  authorize.mockResolvedValue(null);
  await expect(loadContractAcceptanceAttachment(token, attachmentId, deps)).rejects.toThrow(
    "indisponível",
  );
  expect(download).not.toHaveBeenCalled();
});
it("acceptance annex rejects a foreign attachment identifier without file access", async () => {
  authorize.mockResolvedValue({ ...context, attachmentId: "60000000-0000-4000-8000-000000000002" });
  await expect(loadContractAcceptanceAttachment(token, attachmentId, deps)).rejects.toThrow(
    "indisponível",
  );
  expect(download).not.toHaveBeenCalled();
});
it("acceptance annex rejects an inactive issuer denied by the canonical SQL boundary", async () => {
  authorize.mockRejectedValue(Error("inactive issuer"));
  await expect(loadContractAcceptanceAttachment(token, attachmentId, deps)).rejects.toThrow(
    "inactive issuer",
  );
  expect(download).not.toHaveBeenCalled();
});
it("acceptance annex rejects altered stored bytes", async () => {
  download.mockResolvedValue(new TextEncoder().encode("Altered bytes"));
  await expect(loadContractAcceptanceAttachment(token, attachmentId, deps)).rejects.toThrow(
    "indisponível",
  );
  expect(authorize).toHaveBeenCalledTimes(1);
});
it("acceptance annex rechecks revocation after privileged file IO", async () => {
  authorize.mockResolvedValueOnce(context).mockResolvedValueOnce(null);
  await expect(loadContractAcceptanceAttachment(token, attachmentId, deps)).rejects.toThrow(
    "indisponível",
  );
  expect(download).toHaveBeenCalledTimes(1);
});
it("acceptance annex rejects a changed content revision after rendering", async () => {
  const source = {
    ...context,
    kind: "proposal" as const,
    sourceId: "proposal",
    bucket: null,
    storagePath: null,
    sha256: null,
  };
  authorize
    .mockResolvedValueOnce(source)
    .mockResolvedValueOnce({ ...source, contentHash: "c".repeat(64) });
  await expect(loadContractAcceptanceAttachment(token, attachmentId, deps)).rejects.toThrow(
    "indisponível",
  );
  expect(render).toHaveBeenCalledExactlyOnceWith("proposal", "proposal", context.workspaceId);
  expect(download).not.toHaveBeenCalled();
});
it("acceptance annex uses the frozen copy instead of the live commercial source", async () => {
  authorize.mockResolvedValue({
    ...context,
    kind: "proposal",
    bucket: "contract-signature-packages",
    sourceId: "proposal",
  });
  expect((await loadContractAcceptanceAttachment(token, attachmentId, deps)).bytes).toEqual(bytes);
  expect(render).not.toHaveBeenCalled();
  expect(download).toHaveBeenCalledWith("contract-signature-packages", context.storagePath);
});
it("acceptance annex renders the single authorized unfrozen commercial document", async () => {
  authorize.mockResolvedValue({
    ...context,
    kind: "quote",
    sourceId: "quote",
    bucket: null,
    storagePath: null,
    sha256: null,
  });
  const result = await loadContractAcceptanceAttachment(token, attachmentId, deps);
  expect(result.contentType).toBe("application/pdf");
  expect(render).toHaveBeenCalledExactlyOnceWith("quote", "quote", context.workspaceId);
  expect(download).not.toHaveBeenCalled();
});
