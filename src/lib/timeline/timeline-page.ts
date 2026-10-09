import type { Activity } from "@/lib/db-types";
import type { TimelineCursor } from "@/lib/timeline/activity-fetch";

export function mergeTimelinePage(current: Activity[], incoming: Activity[]): Activity[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => {
    const ta = new Date(a.hs_createdate ?? a.created_at ?? 0).getTime();
    const tb = new Date(b.hs_createdate ?? b.created_at ?? 0).getTime();
    return tb - ta || b.id.localeCompare(a.id);
  });
}

export function isTimelineCursor(value: unknown): value is TimelineCursor {
  if (!value || typeof value !== "object") return false;
  const cursor = value as Partial<TimelineCursor>;
  return (
    typeof cursor.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      cursor.id,
    ) &&
    typeof cursor.at === "string" &&
    Number.isFinite(Date.parse(cursor.at))
  );
}