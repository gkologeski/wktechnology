import { describe, expect, it } from "vitest";
import { loadDashSummary } from "./dashboard-views.server";
const filters = { from: "2026-10-01", to: "2026-10-27", tz: "America/Sao_Paulo" };
const allowed = { scope: { view: "me" }, total_seconds: 3600 };
function client(message?: string) {
  const sb = {
    rpc: async function (this: unknown, name: string) {
      expect(this).toBe(sb);
      expect(name).toBe("project_dash_summary");
      return message
        ? { data: null, error: { code: "42501", message } }
        : { data: allowed, error: null };
    },
  };
  return sb as unknown as Parameters<typeof loadDashSummary>[0];
}
describe("finite RPC adapter preserves database authorization", () => {
  it("preserves authenticated client and allowed database result", async () => {
    await expect(loadDashSummary(client(), "me", filters)).resolves.toEqual(allowed);
  });
  it("propagates missing permission without returning data", async () => {
    await expect(loadDashSummary(client("Sem permissão"), "me", filters)).rejects.toThrow(
      "Sem permissão",
    );
  });
  it("propagates explicit deny without a fallback query", async () => {
    await expect(
      loadDashSummary(client("Acesso negado explicitamente"), "me", filters),
    ).rejects.toThrow("negado explicitamente");
  });
  it("propagates foreign workspace refusal", async () => {
    await expect(loadDashSummary(client("Workspace indisponível"), "me", filters)).rejects.toThrow(
      "Workspace indisponível",
    );
  });
  it("propagates inactive membership refusal", async () => {
    await expect(loadDashSummary(client("Membro inativo"), "me", filters)).rejects.toThrow(
      "Membro inativo",
    );
  });
});
