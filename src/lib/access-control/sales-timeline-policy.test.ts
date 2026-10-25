import { describe, it, expect } from "vitest";
import { canCreateTimelineAction } from "./sales-timeline-policy";
describe("timeline permissions", () => {
  it("requires both base read and the specific create action", () => {
    expect(
      canCreateTimelineAction(new Set(["techsales.notes.view.own"]), "log", "note", false),
    ).toBe(false);
    expect(
      canCreateTimelineAction(
        new Set(["techsales.notes.view.own", "techsales.notes.create.own"]),
        "log",
        "note",
        false,
      ),
    ).toBe(true);
  });
  it("does not expand an ordinary activity key into email or WhatsApp send", () => {
    const k = new Set([
      "techsales.activities.view.workspace",
      "techsales.activities.create.workspace",
    ]);
    expect(canCreateTimelineAction(k, "log", "call", false)).toBe(true);
    expect(canCreateTimelineAction(k, "create", "email", false)).toBe(false);
    expect(canCreateTimelineAction(k, "create", "whatsapp", false)).toBe(false);
  });
  it("blocks read-only and unsupported actions", () => {
    const k = new Set(["techsales.meetings.view.workspace", "techsales.meetings.create.workspace"]);
    expect(canCreateTimelineAction(k, "create", "meeting", true)).toBe(false);
    expect(canCreateTimelineAction(k, "create", "unknown", false)).toBe(false);
  });
});
