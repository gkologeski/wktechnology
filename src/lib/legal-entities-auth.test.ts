import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeFinanceBusiness } from "./access-control/finance-business.server";
const workspace = "184b9435-0a9b-4334-9e89-8854dc883f5d";
function client(data: unknown, error: { message: string } | null = null) {
  return { rpc: vi.fn().mockResolvedValue({ data, error }) } as unknown as SupabaseClient;
}
it("CNPJ allows an authorized active member", async () => {
  await expect(
    authorizeFinanceBusiness(client(workspace), "legal_entities", "update", workspace),
  ).resolves.toBe(workspace);
});
it("CNPJ denies missing permission", async () => {
  await expect(
    authorizeFinanceBusiness(
      client(null, { message: "missing permission" }),
      "legal_entities",
      "update",
    ),
  ).rejects.toThrow("missing permission");
});
it("CNPJ denies explicit deny", async () => {
  await expect(
    authorizeFinanceBusiness(
      client(workspace, { message: "explicit deny" }),
      "legal_entities",
      "delete",
    ),
  ).rejects.toThrow("explicit deny");
});
it("CNPJ denies foreign workspace", async () => {
  await expect(
    authorizeFinanceBusiness(
      client(null, { message: "foreign workspace" }),
      "legal_entities",
      "view",
      workspace,
    ),
  ).rejects.toThrow("foreign workspace");
});
it("CNPJ denies inactive membership", async () => {
  await expect(
    authorizeFinanceBusiness(
      client(null, { message: "inactive member" }),
      "legal_entities",
      "create",
    ),
  ).rejects.toThrow("inactive member");
});
