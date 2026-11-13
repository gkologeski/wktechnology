import { describe, expect, it } from "vitest";
import { membersWithoutCalendar, normalizeMeetingAssignment } from "./meeting-assignment";

const A = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-000000000002";
const base = {
  meeting_duration_minutes: 30,
  meeting_horizon_days: 7,
  meeting_template_name: null,
  meeting_template_language: null,
};

describe("distribuição das reuniões da ligação", () => {
  it("membro específico exige exatamente um", () => {
    expect(() =>
      normalizeMeetingAssignment({ ...base, meeting_assignment_mode: "member", meeting_member_ids: [] }),
    ).toThrow(/exatamente um/);
  });
  it("rodízio exige ao menos dois", () => {
    expect(() =>
      normalizeMeetingAssignment({ ...base, meeting_assignment_mode: "round_robin", meeting_member_ids: [A] }),
    ).toThrow(/dois/);
  });
  it("sem agendamento descarta membros", () => {
    const r = normalizeMeetingAssignment({ ...base, meeting_assignment_mode: "unassigned", meeting_member_ids: [A] });
    expect(r.meeting_member_ids).toEqual([]);
  });
  it("aponta quem não tem agenda conectada", () => {
    expect(
      membersWithoutCalendar({ meeting_assignment_mode: "round_robin", meeting_member_ids: [A, B] }, new Set([A])),
    ).toEqual([B]);
  });
});
