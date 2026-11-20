import { expect, it } from "vitest";
import { parseNotificationCenterLookup, parseNotificationCenterPage } from "./notification-center";
const row = {
  id: "aaaaaaaa-1111-4111-8111-111111111111",
  type: "workflow",
  eventKey: "contracts.draft.accepted",
  moduleKey: "contracts",
  title: "Atualização disponível",
  body: null,
  entity: "deals",
  entity_id: "bbbbbbbb-1111-4111-8111-111111111111",
  link: "/deals/bbbbbbbb-1111-4111-8111-111111111111",
  created_at: "2026-11-20T12:00:00Z",
  read_at: null,
  snoozed_until: null,
};
it("preserves canonical provenance from both list and focused lookup without inferring the module from the source table", () => {
  const page = parseNotificationCenterPage({
    items: [row],
    unread: 1,
    nextCursor: null,
    cutoff: row.created_at,
  });
  const lookup = parseNotificationCenterLookup({ items: [row], checkedAt: row.created_at });
  for (const result of [page, lookup]) {
    expect(result.items[0].type).toBe("workflow");
    expect(result.items[0].eventKey).toBe("contracts.draft.accepted");
    expect(result.items[0].event).toEqual({
      eventKey: "contracts.draft.accepted",
      category: "approval",
      moduleKey: "contracts",
    });
    expect(result.items[0].entity).toBe("deals");
  }
});
it.each([null, "future.unknown", "mention", "projects.project.started"])(
  "preserves explicit unavailable provenance %s without fabricating legacy metadata",
  (eventKey) => {
    const parsed = parseNotificationCenterLookup({
      items: [{ ...row, type: "mention", eventKey }],
      checkedAt: row.created_at,
    });
    expect(parsed.items[0].eventKey).toBe(eventKey);
    expect(parsed.items[0].event).toBeNull();
  },
);
it("preserves legacy records when the RPC omits canonical provenance", () => {
  const { eventKey: _key, ...legacy } = row;
  const parsed = parseNotificationCenterLookup({ items: [legacy], checkedAt: row.created_at });
  expect(parsed.items[0].event).toEqual({
    eventKey: "legacy.workflow",
    category: "workflow",
    moduleKey: null,
  });
});
