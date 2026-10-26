import { describe, it, expect } from "vitest";
import { canConfigurationAction } from "./configuration-actions";
const resource = "system.communication.subscription_types";
const keys = new Set([`${resource}.view.workspace`, `${resource}.update.workspace`]);
describe("configuration UI actions", () => {
  it("configuration allows authorized active workspace", () => {
    expect(canConfigurationAction(keys, "workspace-a", true, resource, "update")).toBe(true);
    expect(canConfigurationAction(keys, "workspace-a", true, resource, "delete")).toBe(false);
  });
  it("configuration denies missing permission", () => {
    expect(canConfigurationAction(new Set(), "workspace-a", true, resource, "view")).toBe(false);
    expect(
      canConfigurationAction(
        new Set([`${resource}.update.workspace`]),
        "workspace-a",
        true,
        resource,
        "update",
      ),
    ).toBe(false);
  });
  it("configuration denies explicit deny removed from effective keys", () => {
    const effective = new Set(keys);
    effective.delete(`${resource}.update.workspace`);
    expect(canConfigurationAction(effective, "workspace-a", true, resource, "update")).toBe(false);
  });
  it("configuration denies foreign workspace without active context", () => {
    expect(canConfigurationAction(keys, null, true, resource, "update")).toBe(false);
  });
  it("configuration denies inactive membership while context unavailable", () => {
    expect(canConfigurationAction(keys, null, false, resource, "view")).toBe(false);
  });
  it("macro ownership alone never grants view", () => {
    const r = "system.automation.macros";
    expect(canConfigurationAction(new Set(), "w", true, r, "view", "u", "u")).toBe(false);
    expect(canConfigurationAction(new Set([`${r}.view.own`]), "w", true, r, "view", "u", "u")).toBe(
      true,
    );
    expect(
      canConfigurationAction(new Set([`${r}.view.own`]), "w", true, r, "view", "u", "other"),
    ).toBe(false);
  });
});
