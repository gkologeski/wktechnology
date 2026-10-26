import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start", () => {
  const builder = () => ({
    middleware: () => builder(),
    inputValidator: () => builder(),
    handler: (fn: unknown) => fn,
  });
  return { createServerFn: builder };
});
vi.mock("./admin-setting.middleware", () => ({ requireAdminSetting: () => ({}) }));
vi.mock("./active-workspace.middleware", () => ({ requireWorkspaceContext: () => ({}) }));
import {
  listPermissionCatalog,
  getRbacDiagnostics,
  computeWarnings,
} from "./rbac-diagnostics.functions";

type Handler = (input: {
  context: { supabase: unknown; userId: string };
  data: Record<string, unknown>;
}) => Promise<any>;
const catalog = listPermissionCatalog as unknown as Handler;
const diagnostics = getRbacDiagnostics as unknown as Handler;
const keys = Array.from({ length: 2756 }, (_, i) => `system.resource${i}.view.workspace`);
function client(fail = false) {
  const ranges: number[][] = [],
    batches: string[][] = [];
  const rpc = vi.fn(async (name: string) => ({
    data:
      name === "work_access_context"
        ? { workspace: "workspace-a" }
        : name === "effective_permissions_array"
          ? keys
          : true,
    error: fail && name === "effective_permissions_array" ? { message: "denied" } : null,
  }));
  const from = (table: string) => {
    let columns = "",
      selected: string[] | undefined;
    const q = {
      select: (s: string) => {
        columns = s;
        return q;
      },
      eq: () => q,
      or: () => q,
      order: () => q,
      in: (_: string, ids: string[]) => {
        selected = ids;
        batches.push(ids);
        return q;
      },
      range: async (a: number, b: number) => {
        ranges.push([a, b]);
        return {
          data: keys.slice(a, b + 1).map((key) => ({ key })),
          error: fail && a > 0 ? { message: "page failed" } : null,
        };
      },
      single: async () => ({
        data: table === "workspaces" ? { name: "WK", created_by: "me" } : { role: "owner" },
        error: null,
      }),
      maybeSingle: async () => ({ data: {}, error: null }),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({
          data:
            table === "permissions" && columns.includes("label_pt")
              ? (selected ?? []).map((key) => ({ key, label_pt: key }))
              : [],
          error: null,
        }).then(resolve),
    };
    return q;
  };
  return { supabase: { rpc, from }, ranges, batches, rpc };
}
describe("complete permission metadata", () => {
  it("reads all 2756 catalog entries in ordered pages", async () => {
    const c = client();
    const rows = await catalog({ context: { supabase: c.supabase, userId: "me" }, data: {} });
    expect(rows).toHaveLength(2756);
    expect(c.ranges).toHaveLength(6);
    expect(rows.at(-1).key).toBe(keys.at(-1));
  });
  it("rejects a failed later page rather than returning an incomplete catalog", async () => {
    const c = client(true);
    await expect(
      catalog({ context: { supabase: c.supabase, userId: "me" }, data: {} }),
    ).rejects.toThrow("page failed");
  });
  it("reads full aggregate permissions and labels beyond PostgREST row limit", async () => {
    const c = client();
    const result = await diagnostics({ context: { supabase: c.supabase, userId: "me" }, data: {} });
    expect(result.permissions).toHaveLength(2756);
    expect(Object.keys(result.permission_labels)).toHaveLength(2756);
    expect(c.rpc).toHaveBeenCalledWith("effective_permissions_array", {
      _user_id: "me",
      _workspace_id: "workspace-a",
    });
    expect(c.batches.every((b) => b.length <= 100)).toBe(true);
  });
  it("does not disguise permission RPC errors as an empty successful diagnosis", async () => {
    const c = client(true);
    await expect(
      diagnostics({ context: { supabase: c.supabase, userId: "me" }, data: {} }),
    ).rejects.toThrow("denied");
  });
});

describe("scope warning precision", () => {
  it("does not classify own or team management as workspace-wide access", () => {
    expect(
      computeWarnings(["system.api_keys.manage.own", "system.workflows.manage.team"], []),
    ).toEqual([]);
  });
  it("flags broad mutations without treating manage as a wildcard", () => {
    const warnings = computeWarnings(
      [
        "system.roles.manage.workspace",
        "techsales.leads.view.workspace",
        "techsales.leads.delete.own",
      ],
      [],
    );
    expect(warnings[0].keys).toEqual(["system.roles.manage.workspace"]);
    expect(warnings[0].detail).toContain("negativas explícitas");
  });
  it("does not advise that extra roles override explicit denials", () => {
    const warnings = computeWarnings(
      [],
      [
        { id: "1", name: "A", is_primary: true },
        { id: "2", name: "B", is_primary: false },
      ],
    );
    expect(warnings[0].detail).toContain("Negativas explícitas");
    expect(warnings[0].detail).not.toContain("prevalece");
  });
});
