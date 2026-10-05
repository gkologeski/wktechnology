import { describe, expect, it } from "vitest";
import {
  ALL_CATEGORIES,
  DEFAULT_TIMELINE_FILTERS,
  UNASSIGNED,
  activityCategory,
  applyTimelineFilters,
  type FilterableEntry,
  propertyCategory,
} from "./timeline-filters";

const hist = (property: string, by: string | null = "u1") => ({
  history: {
    id: property,
    changed_at: "2026-10-05T10:00:00Z",
    changed_by: by,
    hasMovement: true,
    changes: [
      {
        id: property,
        entity: "deals",
        entity_id: "d",
        property,
        old_value: null,
        new_value: "x",
        changed_at: "2026-10-05T10:00:00Z",
        changed_by: by,
      },
    ],
  },
});

const entries: FilterableEntry[] = [
  { activity: { type: "email", subject: "Proposta comercial", assigned_to: "u1" } },
  { activity: { type: "note", body: "<p>Ligação útil</p>", owner_id: "u2" } },
  { activity: { type: "sms", subject: "Oi", owner_id: null } },
  hist("stage_substatus_id"),
  hist("amount", "u2"),
];

describe("timeline filters", () => {
  it("categoriza tipos e propriedades", () => {
    expect(activityCategory("linkedin_message")).toBe("message");
    expect(activityCategory(undefined)).toBe("note");
    expect(propertyCategory("stage_substatus_id")).toBe("substatus");
    expect(propertyCategory("assigned_to")).toBe("owner");
    expect(propertyCategory("stage")).toBe("stage");
    expect(propertyCategory("amount")).toBe("fields");
  });

  it("padrão mostra tudo", () => {
    expect(applyTimelineFilters(entries, DEFAULT_TIMELINE_FILTERS)).toHaveLength(5);
  });

  it("aba filtra por tipo", () => {
    const r = applyTimelineFilters(entries, { ...DEFAULT_TIMELINE_FILTERS, tab: "email" });
    expect(r).toHaveLength(1);
  });

  it("substatus fica no grupo Atualizações", () => {
    const r = applyTimelineFilters(entries, {
      ...DEFAULT_TIMELINE_FILTERS,
      categories: ["substatus"],
    });
    expect(r).toHaveLength(1);
    expect(r[0].history?.changes[0].property).toBe("stage_substatus_id");
  });

  it("busca sem acento em texto HTML", () => {
    const r = applyTimelineFilters(entries, { ...DEFAULT_TIMELINE_FILTERS, search: "ligacao" });
    expect(r).toHaveLength(1);
  });

  it("responsável e sem responsável combinados com tipos", () => {
    const r = applyTimelineFilters(entries, {
      ...DEFAULT_TIMELINE_FILTERS,
      categories: ALL_CATEGORIES.filter((c) => c !== "fields"),
      assignees: ["u1", UNASSIGNED],
    });
    expect(r.map((e) => e.activity?.type ?? e.history?.id)).toEqual([
      "email",
      "sms",
      "stage_substatus_id",
    ]);
  });
});
