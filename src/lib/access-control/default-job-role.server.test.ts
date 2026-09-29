import { describe, expect, it, vi } from "vitest";
import { resolveDefaultJobRoleId } from "./default-job-role.server";

function client(result: { data: { id: string } | null; error: { message: string } | null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const byName = vi.fn(() => ({ maybeSingle }));
  const bySystem = vi.fn(() => ({ eq: byName }));
  const select = vi.fn(() => ({ eq: bySystem }));
  return { api: { from: vi.fn(() => ({ select })) }, byName };
}

describe("resolveDefaultJobRoleId", () => {
  it("resolves the manager role by its stable name", async () => {
    const fake = client({ data: { id: "role-id" }, error: null });
    await expect(resolveDefaultJobRoleId(fake.api, "manager")).resolves.toBe("role-id");
    expect(fake.byName).toHaveBeenCalledWith("name", "Gerente Comercial");
  });

  it("uses the member role for unknown legacy values", async () => {
    const fake = client({ data: { id: "member-id" }, error: null });
    await resolveDefaultJobRoleId(fake.api, "legacy");
    expect(fake.byName).toHaveBeenCalledWith("name", "Vendedor");
  });

  it("fails explicitly when the system role is missing", async () => {
    const fake = client({ data: null, error: null });
    await expect(resolveDefaultJobRoleId(fake.api, "admin")).rejects.toThrow(
      "Cargo padrão não configurado: Workspace Admin",
    );
  });
});
