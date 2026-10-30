import { describe, expect, it } from "vitest";
import { normalizeAssignment, pickRoundRobin } from "./campaign-assignment";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const C = "00000000-0000-4000-8000-00000000000c";

describe("distribuição das conversas da campanha", () => {
  it("rodízio entre 3 membros segue 1,2,3,1", () => {
    expect([0, 1, 2, 3].map((i) => pickRoundRobin([A, B, C], i))).toEqual([A, B, C, A]);
  });
  it("sem membros ativos fica desatribuída", () => {
    expect(pickRoundRobin([], 5)).toBeNull();
  });
  it("membro específico exige exatamente um membro", () => {
    expect(() =>
      normalizeAssignment({ assignment_mode: "member", assignment_member_ids: [] }),
    ).toThrow();
    expect(
      normalizeAssignment({ assignment_mode: "member", assignment_member_ids: [A] })
        .assignment_member_ids,
    ).toEqual([A]);
  });
  it("dividir exige ao menos dois membros distintos", () => {
    expect(() =>
      normalizeAssignment({ assignment_mode: "round_robin", assignment_member_ids: [A, A] }),
    ).toThrow();
  });
  it("desatribuídas descarta membros", () => {
    expect(
      normalizeAssignment({ assignment_mode: "unassigned", assignment_member_ids: [A] })
        .assignment_member_ids,
    ).toEqual([]);
  });
});
