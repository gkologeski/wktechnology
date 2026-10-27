import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/gmail.server", () => ({
  buildRawMime: vi.fn(),
  ensureAccessToken: vi.fn(),
  gmailSendRaw: vi.fn(),
}));
import { serviceJobGuard, type ServiceJob } from "./service-transports.server";
const job = { id: "j1", lease_token: "lease-1" } as ServiceJob;
function db(reason: string) {
  return { rpc: vi.fn().mockResolvedValue({ data: reason, error: null }) };
}
describe("service source guard", () => {
  it("allows current authorized leased source", async () => {
    const client = db("ok");
    await expect(serviceJobGuard(client, job)).resolves.toBeUndefined();
    expect(client.rpc).toHaveBeenCalledWith("service_agent_guard", {
      p_job: "j1",
      p_lease: "lease-1",
    });
  });
  it("rejects source missing required permission", async () => {
    await expect(serviceJobGuard(db("permission_revoked"), job)).rejects.toMatchObject({
      message: "permission_revoked",
      serviceGuard: true,
    });
  });
  it("rejects source with explicit deny", async () => {
    await expect(serviceJobGuard(db("explicit_deny"), job)).rejects.toMatchObject({
      message: "explicit_deny",
      serviceGuard: true,
    });
  });
  it("rejects foreign workspace source", async () => {
    await expect(serviceJobGuard(db("context_mismatch"), job)).rejects.toMatchObject({
      message: "context_mismatch",
      serviceGuard: true,
    });
  });
  it("rejects inactive source actor", async () => {
    await expect(serviceJobGuard(db("inactive_member"), job)).rejects.toMatchObject({
      message: "inactive_member",
      serviceGuard: true,
    });
  });
  it("rejects lost lease before any effect", async () => {
    await expect(serviceJobGuard(db("lease_lost"), job)).rejects.toMatchObject({
      message: "lease_lost",
      serviceGuard: true,
    });
  });
});
