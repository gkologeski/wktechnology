import { describe, expect, it, vi } from "vitest";
import { authorizeCloudConnection } from "./cloud-connections.server";

function client(member: boolean, permitted: boolean) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "actor" } } }) },
    rpc: vi.fn(async (name: string, args: any) => {
      if (name === "is_workspace_member") return { data: member && args._workspace === "wk" };
      if (name === "user_has_permission") return { data: permitted };
      return { data: true };
    }),
  };
}
describe("cloud connection boundary", () => {
  it("allows active authorized cloud administrator", async () => {
    const db = client(true, true);
    await authorizeCloudConnection(db, "wk", "manage");
    expect(db.rpc).toHaveBeenCalledWith("user_has_permission", {
      _user_id: "actor",
      _workspace_id: "wk",
      _permission_key: "system.whatsapp.manage.workspace",
    });
    expect(db.rpc).toHaveBeenCalledWith("sales_area_authorize", {
      r: "system.whatsapp",
      a: "manage",
      t: null,
      i: null,
    });
  });
  it("rejects cloud missing permission", async () => {
    await expect(authorizeCloudConnection(client(true, false), "wk", "manage")).rejects.toThrow(
      "Sem permissão",
    );
  });
  it("rejects cloud explicit deny even after role grant", async () => {
    const db = client(true, false);
    await expect(authorizeCloudConnection(db, "wk", "view")).rejects.toThrow("Sem permissão");
    expect(db.rpc).not.toHaveBeenCalledWith("sales_area_authorize", expect.anything());
  });
  it("rejects cloud foreign workspace", async () => {
    const db = client(true, true);
    await expect(authorizeCloudConnection(db, "foreign", "manage")).rejects.toThrow("Membro ativo");
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });
  it("rejects cloud inactive member before privilege access", async () => {
    const db = client(false, true);
    await expect(authorizeCloudConnection(db, "wk", "manage")).rejects.toThrow("Membro ativo");
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });
});
