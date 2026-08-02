import { describe, expect, it } from "vitest";
import { conditionsSummary, countConditions, evaluateConditions } from "./conditions";
import type { WorkflowCondition } from "./types";

const leaf = (field: string): WorkflowCondition => ({ field, op: "eq", value: 1 });

describe("workflow conditions (E/OU + grupos)", () => {
  it("lista plana é combinada com E", () => {
    const list = [leaf("a"), leaf("b")];
    expect(evaluateConditions(list, (f) => f.field === "a")).toBe(false);
    expect(evaluateConditions(list, () => true)).toBe(true);
  });

  it("lista vazia passa", () => {
    expect(evaluateConditions([], () => false)).toBe(true);
  });

  it("grupo OU passa quando qualquer condição passa", () => {
    const list: WorkflowCondition[] = [{ logic: "or", conditions: [leaf("a"), leaf("b")] }];
    expect(evaluateConditions(list, (f) => f.field === "b")).toBe(true);
    expect(evaluateConditions(list, () => false)).toBe(false);
  });

  it("grupos aninhados combinam E dentro de OU", () => {
    const list: WorkflowCondition[] = [
      {
        logic: "or",
        conditions: [{ logic: "and", conditions: [leaf("a"), leaf("b")] }, leaf("c")],
      },
    ];
    expect(evaluateConditions(list, (f) => f.field === "c")).toBe(true);
    expect(evaluateConditions(list, (f) => f.field === "a")).toBe(false);
    expect(evaluateConditions(list, (f) => f.field !== "c")).toBe(true);
  });

  it("grupo vazio é neutro", () => {
    const list: WorkflowCondition[] = [{ logic: "and", conditions: [] }];
    expect(evaluateConditions(list, () => false)).toBe(true);
  });

  it("conta folhas e grupos", () => {
    const list: WorkflowCondition[] = [
      leaf("a"),
      { logic: "or", conditions: [leaf("b"), { logic: "and", conditions: [leaf("c")] }] },
    ];
    expect(countConditions(list)).toEqual({ leaves: 3, groups: 2 });
    expect(conditionsSummary(list)).toBe("3 condição(ões) · 2 grupo(s)");
    expect(conditionsSummary([leaf("a")])).toBe("1 condição(ões)");
  });
});
