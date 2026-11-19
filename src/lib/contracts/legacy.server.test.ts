import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const rpc = vi.fn();
vi.mock("@/lib/access-control/work-core.server", () => ({
  workRpc: (_db: unknown, name: string, args: unknown) => {
    calls.push(name);
    return rpc(name, args);
  },
}));
const attest = vi.fn();
vi.mock("./legacy-evidence.server", () => ({
  sha256Hex: async () => "a".repeat(64),
  storeAndAttestLegacyEvidence: (...a: unknown[]) => {
    calls.push("service_store_attest");
    return attest(...a);
  },
}));
const signed = vi.fn();
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({
        createSignedUrl: (p: string, s: number) => {
          calls.push("service_signed_url");
          return signed(p, s);
        },
      }),
    },
  },
}));
const { loadLegacyState, openLegacyEvidence, uploadLegacyEvidence } =
  await import("./legacy.server");
const db = {} as never;
const pdf = btoa("%PDF-1.7 legado");
beforeEach(() => {
  calls.length = 0;
  rpc.mockReset();
  attest.mockReset();
  signed.mockReset();
});

describe("legacy server boundary", () => {
  it("permission denial is reported as denied, other failures throw", async () => {
    rpc.mockRejectedValueOnce(new Error("Sem permissão para esta ação no contrato."));
    expect(await loadLegacyState(db, "w", "c")).toEqual({ access: "denied" });
    rpc.mockRejectedValueOnce(new Error("statement timeout"));
    await expect(loadLegacyState(db, "w", "c")).rejects.toThrow(/timeout/);
  });
  it("rejects DOCX before any reservation or privileged call", async () => {
    await expect(
      uploadLegacyEvidence(db, "u", "w", {
        contractId: "c",
        expectedRevision: 1,
        fileName: "x.pdf",
        base64: btoa("PK\u0003\u0004zz"),
        operationId: "o",
      }),
    ).rejects.toThrow(/PDF/);
    expect(calls).toEqual([]);
  });
  it("privileged store/attest only runs after an authorized user reservation", async () => {
    rpc.mockRejectedValueOnce(new Error("Sem permissão para esta ação no contrato."));
    await expect(
      uploadLegacyEvidence(db, "u", "w", {
        contractId: "c",
        expectedRevision: 1,
        fileName: "x.pdf",
        base64: pdf,
        operationId: "o",
      }),
    ).rejects.toThrow(/Sem permissão/);
    expect(calls).toEqual(["contract_legacy_evidence_reserve"]);
  });
  it("uses only the reservation path and skips re-attesting on replay", async () => {
    rpc.mockImplementation(async (name: string) =>
      name === "contract_legacy_evidence_reserve"
        ? { evidence_id: "e", path: "legacy-contracts/w/c/e.pdf", replayed: false }
        : { evidence: [{ id: "e", status: "pending_upload" }] },
    );
    await uploadLegacyEvidence(db, "u", "w", {
      contractId: "c",
      expectedRevision: 1,
      fileName: "x.pdf",
      base64: pdf,
      operationId: "o",
    });
    expect(attest.mock.calls[0][0]).toMatchObject({
      path: "legacy-contracts/w/c/e.pdf",
      actorId: "u",
      evidenceId: "e",
    });
    rpc.mockImplementation(async (name: string) =>
      name === "contract_legacy_evidence_reserve"
        ? { evidence_id: "e", path: "legacy-contracts/w/c/e.pdf", replayed: true }
        : { evidence: [{ id: "e", status: "attested" }] },
    );
    calls.length = 0;
    await uploadLegacyEvidence(db, "u", "w", {
      contractId: "c",
      expectedRevision: 1,
      fileName: "x.pdf",
      base64: pdf,
      operationId: "o",
    });
    expect(calls).not.toContain("service_store_attest");
  });
  it("short download URL only after the user RPC authorizes", async () => {
    rpc.mockRejectedValueOnce(new Error("Sem permissão para esta ação no contrato."));
    await expect(openLegacyEvidence(db, "w", "c", "e")).rejects.toThrow();
    expect(calls).toEqual(["contract_legacy_evidence_open"]);
    rpc.mockResolvedValueOnce({
      path: "legacy-contracts/w/c/e.pdf",
      sha256: "a",
      file_name: "x.pdf",
    });
    signed.mockResolvedValueOnce({ data: { signedUrl: "https://x" }, error: null });
    await openLegacyEvidence(db, "w", "c", "e");
    expect(signed).toHaveBeenCalledWith("legacy-contracts/w/c/e.pdf", 60);
  });
});
