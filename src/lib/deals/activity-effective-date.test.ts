import { describe, expect, it } from "vitest";
import { activityEffectiveDate } from "./activity-effective-date";

describe("activityEffectiveDate", () => {
  it("uses the task due date before its creation date", () => {
    expect(
      activityEffectiveDate({
        type: "task",
        due_date: "2026-09-24T19:57:00.000Z",
        activity_date: "2026-09-26T02:08:39.000Z",
        created_at: "2026-09-18T19:57:28.000Z",
      }),
    ).toBe("2026-09-24T19:57:00.000Z");
  });

  it("falls back safely when a task has no due date", () => {
    expect(
      activityEffectiveDate({
        type: "task",
        due_date: null,
        activity_date: "2026-09-25T15:00:00.000Z",
        created_at: "2026-09-20T15:00:00.000Z",
      }),
    ).toBe("2026-09-25T15:00:00.000Z");
  });

  it("uses the occurrence date for other activities", () => {
    expect(
      activityEffectiveDate({
        type: "meeting",
        due_date: null,
        activity_date: "2026-09-25T15:00:00.000Z",
        created_at: "2026-09-18T15:00:00.000Z",
      }),
    ).toBe("2026-09-25T15:00:00.000Z");
  });

  it("falls back to creation when no effective date exists", () => {
    expect(
      activityEffectiveDate({
        type: "note",
        due_date: null,
        activity_date: null,
        created_at: "2026-09-18T15:00:00.000Z",
      }),
    ).toBe("2026-09-18T15:00:00.000Z");
  });
});