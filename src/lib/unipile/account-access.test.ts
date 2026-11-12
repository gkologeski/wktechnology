import { describe, expect, it } from "vitest";
import { linkedinAccountAccess } from "./account-access";
const actor = "owner";
const context = {
  actor,
  workspace: "workspace",
  read_only: false,
  keys: {
    "system.linkedin.view.own": true,
    "system.linkedin.manage.own": true,
  },
};
describe("personal LinkedIn account boundary", () => {
  it("allows an authorized active owner", () => {
    expect(linkedinAccountAccess(context, actor, "manage")).toBe("workspace");
  });
  it("rejects missing permission", () => {
    expect(() => linkedinAccountAccess({ ...context, keys: {} }, actor, "view")).toThrow();
  });
  it("rejects effective explicit deny", () => {
    expect(() =>
      linkedinAccountAccess(
        { ...context, keys: { ...context.keys, "system.linkedin.manage.own": false } },
        actor,
        "manage",
      ),
    ).toThrow();
  });
  it("rejects a foreign actor", () => {
    expect(() => linkedinAccountAccess(context, "another-user", "view")).toThrow();
  });
  it("rejects inactive membership without active context", () => {
    expect(() => linkedinAccountAccess({}, actor, "view")).toThrow();
  });
  it("rejects read-only impersonation writes", () => {
    expect(() => linkedinAccountAccess({ ...context, read_only: true }, actor, "manage")).toThrow();
  });
});
