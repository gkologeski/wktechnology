import { expect, it } from "vitest";
import { commonAvailabilitySlots as slots, type WeeklyWindow } from "./availability-slots";
const window = (timezone: string, start = 9 * 60, end = 18 * 60, weekday = 2): WeeklyWindow => ({
  interviewer_id: "a",
  weekday,
  start_minute: start,
  end_minute: end,
  timezone,
});
it("uses local IANA time instead of treating São Paulo windows as UTC", () => {
  const s = slots(
    ["a"],
    [window("America/Sao_Paulo")],
    [],
    "2026-10-27T11:00:00Z",
    "2026-10-27T13:00:00Z",
    30,
    30,
  );
  expect(s).toEqual(["2026-10-27T12:00:00.000Z", "2026-10-27T12:30:00.000Z"]);
});
it("intersects panel zones and excludes busy intervals even when starting before the search", () => {
  const w = [
    window("America/Sao_Paulo"),
    { ...window("Europe/London", 12 * 60, 14 * 60), interviewer_id: "b" },
  ];
  const s = slots(
    ["a", "b"],
    w,
    [{ interviewer_id: "b", starts_at: "2026-10-27T11:30:00Z", ends_at: "2026-10-27T12:30:00Z" }],
    "2026-10-27T12:00:00Z",
    "2026-10-27T14:00:00Z",
    30,
    30,
  );
  expect(s).toEqual([
    "2026-10-27T12:30:00.000Z",
    "2026-10-27T13:00:00.000Z",
    "2026-10-27T13:30:00.000Z",
  ]);
});
it("does not invent availability for a panel member without windows", () =>
  expect(
    slots(["a", "b"], [window("UTC")], [], "2026-10-27T09:00:00Z", "2026-10-27T10:00:00Z", 30, 30),
  ).toEqual([]));
it("respects DST in both summer and winter", () => {
  const w = window("America/New_York", 9 * 60, 10 * 60, 1);
  expect(slots(["a"], [w], [], "2026-07-06T12:00:00Z", "2026-07-06T15:00:00Z", 60, 30)).toEqual([
    "2026-07-06T13:00:00.000Z",
  ]);
  expect(slots(["a"], [w], [], "2026-12-07T12:00:00Z", "2026-12-07T16:00:00Z", 60, 30)).toEqual([
    "2026-12-07T14:00:00.000Z",
  ]);
});
it("permits end-of-day 24:00 but never spills beyond its weekly window", () =>
  expect(
    slots(
      ["a"],
      [window("UTC", 23 * 60, 1440)],
      [],
      "2026-10-27T23:00:00Z",
      "2026-10-28T01:00:00Z",
      60,
      30,
    ),
  ).toEqual(["2026-10-27T23:00:00.000Z"]));
it("rejects unbounded scans and invalid time zones", () => {
  expect(() =>
    slots(["a"], [window("UTC")], [], "2026-10-01T00:00:00Z", "2026-12-01T00:00:00Z", 30, 30),
  ).toThrow();
  expect(() =>
    slots(
      ["a"],
      [window("Invalid/Zone")],
      [],
      "2026-10-27T09:00:00Z",
      "2026-10-27T10:00:00Z",
      30,
      30,
    ),
  ).toThrow();
});
