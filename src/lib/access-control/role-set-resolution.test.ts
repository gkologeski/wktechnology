import { describe, it, expect } from "vitest";
import { resolveRoleSets, setUsableInWorkspace } from "./role-set-resolution";

const WS = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

const sets = new Map([
  ["global", { id: "global", workspace_id: null, module: "techfinance" }],
  ["globalBundle", { id: "globalBundle", workspace_id: null, module: "__bundle__" }],
  ["local", { id: "local", workspace_id: WS, module: "__bundle__" }],
  ["foreign", { id: "foreign", workspace_id: OTHER, module: "__bundle__" }],
]);

describe("resolução de vínculos cargo→pacote", () => {
  it("usa o pacote local no lugar do conjunto global substituído", () => {
    const out = resolveRoleSets(
      [{ role_id: "r1", set_id: "global" }],
      [{ role_id: "r1", set_id: "global", replacement_set_id: "local" }],
      sets,
      WS,
    );
    expect(out.get("r1")).toEqual(["local"]);
  });

  it("substituto de outro workspace não concede nada", () => {
    const out = resolveRoleSets(
      [{ role_id: "r1", set_id: "global" }],
      [{ role_id: "r1", set_id: "global", replacement_set_id: "foreign" }],
      sets,
      WS,
    );
    expect(out.get("r1")).toBeUndefined();
  });

  it("substituição vale só para o cargo indicado", () => {
    const out = resolveRoleSets(
      [
        { role_id: "r1", set_id: "global" },
        { role_id: "r2", set_id: "global" },
      ],
      [{ role_id: "r1", set_id: "global", replacement_set_id: "local" }],
      sets,
      WS,
    );
    expect(out.get("r1")).toEqual(["local"]);
    expect(out.get("r2")).toEqual(["global"]);
  });

  it("pacote de outro workspace é ignorado", () => {
    const out = resolveRoleSets([{ role_id: "r1", set_id: "foreign" }], [], sets, WS);
    expect(out.get("r1")).toBeUndefined();
  });

  it("pacote global __bundle__ não vale; global comum vale", () => {
    expect(setUsableInWorkspace(sets.get("globalBundle"), WS)).toBe(false);
    expect(setUsableInWorkspace(sets.get("global"), WS)).toBe(true);
    expect(setUsableInWorkspace(sets.get("local"), WS)).toBe(true);
  });
});
