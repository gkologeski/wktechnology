import { describe, expect, it } from "vitest";
import { FORM_ASSIGNMENT_MODES, pickFormAssignee } from "./form-assignment";
import { normalizeAssignment, pickRoundRobin } from "./whatsapp/campaign-assignment";

describe("distribuição de inscrições de formulário", () => {
  it("não oferece modo desatribuído", () => {
    expect(FORM_ASSIGNMENT_MODES).toEqual(["auto", "member", "round_robin"]);
  });
  it("sem membro ativo, cai no dono do formulário", () => {
    expect(pickFormAssignee(null, "owner")).toBe("owner");
    expect(pickFormAssignee("ana", "owner")).toBe("ana");
  });
  it("rodízio alterna entre os membros", () => {
    expect([0, 1, 2].map((c) => pickRoundRobin(["a", "b"], c))).toEqual(["a", "b", "a"]);
  });
  it("membro específico exige exatamente um", () => {
    expect(() => normalizeAssignment({ assignment_mode: "member", assignment_member_ids: [] })).toThrow();
  });
});
