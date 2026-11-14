import { beforeEach, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/access-control/work-core.server", () => ({ workRpc: rpc }));
import { dispatchContractSignature } from "./signature-delivery.server";
const input = { contractId: "c", hash: "hash", documentId: "d", requestId: "r" };
beforeEach(() => vi.resetAllMocks());
function setup(status = "pending", provider = "ok") {
  rpc.mockResolvedValue({ workspace_id: "w", deliveries: [{ id: "a", signer_id: "s", status }] });
  const filters: unknown[] = [];
  const saves: unknown[] = [];
  const admin = {
    from: (table: string) => {
      const row: any = {
        select: () => row,
        eq: (...a: any[]) => {
          filters.push([table, ...a]);
          return row;
        },
        in: (...a: any[]) => {
          filters.push([table, ...a]);
          return row;
        },
        single: () => row,
        update: (v: any) => {
          saves.push(v);
          return row;
        },
        then: (resolve: any) =>
          resolve({
            error: null,
            data:
              table === "workspaces"
                ? { name: "Workspace" }
                : table === "esign_documents"
                  ? { title: "Termos", status: "sent" }
                  : table === "esign_signers"
                    ? [
                        {
                          id: "s",
                          name: "Cliente",
                          email: "cliente@example.test",
                          public_token: "personal-token",
                          status: "pending",
                        },
                      ]
                    : [{ id: "a", signer_id: "s", status }],
          }),
      };
      return row;
    },
  };
  const send = vi.fn(async () => {
    if (provider === "error") throw Error("provider");
    return { sent: provider !== "suppressed" };
  });
  return { deps: { admin: vi.fn(async () => admin as any), send }, filters, saves };
}
it("authorizes before any privileged read or external effect", async () => {
  const s = setup();
  rpc.mockRejectedValue(Error("denied"));
  await expect(dispatchContractSignature({} as any, input, s.deps)).rejects.toThrow("denied");
  expect(s.deps.admin).not.toHaveBeenCalled();
  expect(s.deps.send).not.toHaveBeenCalled();
});
it("limits service reads to the claimed workspace/document and uses stable email idempotency", async () => {
  const s = setup();
  expect(await dispatchContractSignature({} as any, input, s.deps)).toEqual({
    accepted: 1,
    suppressed: 0,
    failed: 0,
  });
  expect(s.filters).toContainEqual(["esign_signers", "workspace_id", "w"]);
  expect(s.filters).toContainEqual(["esign_signers", "document_id", "d"]);
  expect(s.deps.send).toHaveBeenCalledWith(
    "cliente@example.test",
    expect.objectContaining({ signUrl: expect.stringContaining("/sign/personal-token") }),
    "contract-signature:a",
  );
});
it("does not send a second email for an accepted attempt", async () => {
  const s = setup("accepted");
  expect((await dispatchContractSignature({} as any, input, s.deps)).accepted).toBe(1);
  expect(s.deps.send).not.toHaveBeenCalled();
});
it("records suppression separately from successful acceptance", async () => {
  const s = setup("pending", "suppressed");
  expect(await dispatchContractSignature({} as any, input, s.deps)).toEqual({
    accepted: 0,
    suppressed: 1,
    failed: 0,
  });
  expect(s.saves).toContainEqual(expect.objectContaining({ status: "suppressed" }));
});
it("records provider failure without claiming successful delivery", async () => {
  const s = setup("pending", "error");
  expect(await dispatchContractSignature({} as any, input, s.deps)).toEqual({
    accepted: 0,
    suppressed: 0,
    failed: 1,
  });
  expect(s.saves).toContainEqual(expect.objectContaining({ status: "failed" }));
});
