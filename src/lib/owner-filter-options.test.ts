import { describe, expect, it } from "vitest";
import { buildOwnerOptions, selectionState } from "./owner-filter-options";

const hs = (id: string, first: string, status = "active", mapped: string | null = null) => ({
  id,
  first_name: first,
  last_name: null,
  email: `${id}@x.com`,
  status,
  mapped_user_id: mapped,
});

describe("buildOwnerOptions", () => {
  it("mescla usuário e HubSpot com mesmo nome", () => {
    const opts = buildOwnerOptions(
      [{ user_id: "u1", full_name: "Sábrina Maciel" }],
      [hs("1", "sabrina maciel", "archived")],
    );
    expect(opts).toHaveLength(1);
    expect(opts[0].ids).toEqual(["u1", "hs:1"]);
    expect(opts[0].active).toBe(true);
  });
  it("mescla pelo vínculo", () => {
    const opts = buildOwnerOptions([{ user_id: "u1", full_name: "Ana" }], [hs("2", "Outro", "active", "u1")]);
    expect(opts[0].ids).toEqual(["u1", "hs:2"]);
  });
  it("arquivado sem usuário é inativo; membro inativo idem", () => {
    const opts = buildOwnerOptions(
      [{ user_id: "u9", full_name: "Zé", status: "inactive" }],
      [hs("3", "Bia", "archived")],
    );
    expect(opts.every((o) => !o.active)).toBe(true);
  });
  it("estado de seleção", () => {
    expect(selectionState(["a", "b"], ["a"])).toBe("indeterminate");
    expect(selectionState(["a", "b"], ["a", "b"])).toBe(true);
    expect(selectionState(["a"], [])).toBe(false);
  });
});
