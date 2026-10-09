import { describe, expect, it } from "vitest";
import type { Activity } from "@/lib/db-types";
import { isTimelineCursor, mergeTimelinePage } from "@/lib/timeline/timeline-page";

const activity = (id: string, at: string, subject = id) =>
  ({ id, created_at: at, hs_createdate: at, subject }) as Activity;

describe("timeline page merge", () => {
  it("deduplicates overlapping pages and keeps the newest representation", () => {
    const first = activity("00000000-0000-4000-8000-000000000001", "2026-01-02T10:00:00Z");
    const overlap = activity(
      "00000000-0000-4000-8000-000000000001",
      "2026-01-02T10:00:00Z",
      "updated",
    );
    const older = activity("00000000-0000-4000-8000-000000000002", "2026-01-01T10:00:00Z");
    const merged = mergeTimelinePage([first], [older, overlap]);
    expect(merged.map((row) => row.id)).toEqual([first.id, older.id]);
    expect(merged[0]?.subject).toBe("updated");
  });

  it("uses the id as stable tie-breaker", () => {
    const at = "2026-01-02T10:00:00Z";
    const low = activity("00000000-0000-4000-8000-000000000001", at);
    const high = activity("00000000-0000-4000-8000-000000000002", at);
    expect(mergeTimelinePage([low], [high]).map((row) => row.id)).toEqual([high.id, low.id]);
  });
});

describe("timeline cursor validation", () => {
  it("accepts only complete UUID/date cursors", () => {
    expect(
      isTimelineCursor({
        id: "00000000-0000-4000-8000-000000000001",
        at: "2026-01-02T10:00:00Z",
      }),
    ).toBe(true);
    expect(isTimelineCursor({ id: "forged", at: "2026-01-02T10:00:00Z" })).toBe(false);
    expect(isTimelineCursor({ id: "00000000-0000-4000-8000-000000000001", at: "nope" })).toBe(
      false,
    );
  });
});
