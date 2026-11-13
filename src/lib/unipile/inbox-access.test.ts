import { expect, it } from "vitest";
import { linkedinInboxAccess } from "./inbox-access";
const ctx = {
  actor: "owner",
  workspace: "wk",
  read_only: false,
  keys: {
    "system.linkedin.view.own": true,
    "system.linkedin.manage.own": true,
    "techsales.inbox.linkedin.view.own": true,
    "techsales.inbox.linkedin.create.own": true,
    "techsales.inbox.linkedin.manage.own": true,
  },
};
it("allows the active private Inbox owner", () =>
  expect(linkedinInboxAccess(ctx, "owner", "create")).toBe("wk"));
it("rejects absent Inbox permission", () =>
  expect(() =>
    linkedinInboxAccess({ ...ctx, keys: { "system.linkedin.view.own": true } }, "owner", "view"),
  ).toThrow());
it("rejects effective deny on sending", () =>
  expect(() =>
    linkedinInboxAccess(
      { ...ctx, keys: { ...ctx.keys, "techsales.inbox.linkedin.create.own": false } },
      "owner",
      "create",
    ),
  ).toThrow());
it("rejects another owner's credentials", () =>
  expect(() => linkedinInboxAccess(ctx, "other", "view")).toThrow());
it("rejects inactive membership", () =>
  expect(() => linkedinInboxAccess({}, "owner", "view")).toThrow());
it("rejects read-only impersonation writes", () =>
  expect(() => linkedinInboxAccess({ ...ctx, read_only: true }, "owner", "manage")).toThrow());
