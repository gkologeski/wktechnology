import { describe, expect, it } from "vitest";
import { definitionSchema, newDefinition, newStep, saveDraftSchema } from "./draft";
describe("multichannel draft definition", () => {
  it("persists incomplete planning without requiring a live sender", () => {
    const d = newDefinition();
    expect(definitionSchema.parse(d)).toEqual(d);
    expect(d.steps.some((s) => s.type === "whatsapp" && s.accountId === null)).toBe(true);
  });
  it("supports arbitrary ordering and independent step identifiers", () => {
    const d = newDefinition();
    d.steps = [newStep("task"), newStep("condition"), newStep("agent")];
    expect(definitionSchema.parse(d).steps.map((s) => s.type)).toEqual([
      "task",
      "condition",
      "agent",
    ]);
    expect(newDefinition().steps[0].id).not.toBe(newDefinition().steps[0].id);
  });
  it("rejects duplicate identifiers and invalid schedule windows", () => {
    const d = newDefinition();
    d.steps = [d.steps[0], d.steps[0]];
    expect(definitionSchema.safeParse(d).success).toBe(false);
    const schedule = newDefinition();
    schedule.settings.start = "20:00";
    expect(definitionSchema.safeParse(schedule).success).toBe(false);
    schedule.settings.start = "09:00";
    schedule.settings.timezone = "not/a/timezone";
    expect(definitionSchema.safeParse(schedule).success).toBe(false);
  });
  it("rejects hidden fields, unknown configuration and caller supplied ownership", () => {
    const d = newDefinition();
    d.audience.groups = [
      {
        logic: "and",
        filters: [{ entity: "contacts", column: "portal_token", op: "eq", value: "x" }],
      },
    ];
    expect(definitionSchema.safeParse(d).success).toBe(false);
    expect(definitionSchema.safeParse({ ...newDefinition(), token: "secret" }).success).toBe(false);
    expect(
      saveDraftSchema.safeParse({
        id: crypto.randomUUID(),
        workspaceId: crypto.randomUUID(),
        expectedRevision: 0,
        name: "Teste",
        definition: newDefinition(),
        owner_id: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });
  it("bounds definition bytes and steps", () => {
    const d = newDefinition();
    d.steps = Array.from({ length: 7 }, () => ({ ...newStep("email"), body: "a".repeat(10000) }));
    expect(definitionSchema.safeParse(d).success).toBe(false);
    d.steps = Array.from({ length: 51 }, () => newStep("end"));
    expect(definitionSchema.safeParse(d).success).toBe(false);
  });
});
