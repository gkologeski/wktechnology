import { describe, expect, it } from "vitest";
import {
  ACTIVITY_TIME_OPTIONS,
  activityDatePart,
  activityTimePart,
  combineActivityDateTime,
  fromLocalDateTimeValue,
  roundActivityTime,
  toLocalDateTimeValue,
} from "./activity-date-time";

describe("activity date and time", () => {
  it("offers a full day in 15 minute intervals", () => {
    expect(ACTIVITY_TIME_OPTIONS).toHaveLength(96);
    expect(ACTIVITY_TIME_OPTIONS.slice(0, 5)).toEqual([
      "00:00",
      "00:15",
      "00:30",
      "00:45",
      "01:00",
    ]);
    expect(ACTIVITY_TIME_OPTIONS.at(-1)).toBe("23:45");
  });

  it("combines date and time without shifting the local value", () => {
    const local = combineActivityDateTime("2026-09-30", "14:45");
    expect(local).toBe("2026-09-30T14:45");
    expect(activityDatePart(local)).toBe("2026-09-30");
    expect(activityTimePart(local)).toBe("14:45");
    expect(fromLocalDateTimeValue(local, "local")).toBe(local);
  });

  it("rounds a suggested time to a valid interval", () => {
    const date = new Date(2026, 8, 30, 14, 7, 45);
    const rounded = roundActivityTime(date, "next");
    expect(rounded.getHours()).toBe(14);
    expect(rounded.getMinutes()).toBe(15);
    expect(rounded.getSeconds()).toBe(0);
  });

  it("keeps ISO values reversible in the browser timezone", () => {
    const original = new Date(2026, 8, 30, 14, 45, 0, 0);
    const local = toLocalDateTimeValue(original.toISOString());
    expect(new Date(local).toISOString()).toBe(original.toISOString());
  });
});
