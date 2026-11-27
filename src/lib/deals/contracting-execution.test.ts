import { expect, it } from "vitest";
import { journeyExecutionState } from "./contracting-execution";

it("shows completed execution independently of a retained receivable", () => {
  expect(
    journeyExecutionState([{ status: "completed", billing_hold: "awaiting_signature" }]),
  ).toEqual({
    complete: true,
    completed: 1,
    total: 1,
    held: 1,
    label: "Execução: 1 de 1 serviço(s) concluído(s)",
  });
});
it("does not infer completion from activation, cancellation, or missing access", () => {
  expect(journeyExecutionState([{ status: "completed" }, { status: "active" }]).complete).toBe(
    false,
  );
  expect(journeyExecutionState([{ status: "cancelled" }]).complete).toBe(false);
  expect(journeyExecutionState([]).complete).toBe(false);
  expect(journeyExecutionState(null).label).toBe("Execução não consultada");
});
