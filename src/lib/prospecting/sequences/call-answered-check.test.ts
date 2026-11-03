import { describe, expect, it } from "vitest";
import { newDefinition, type SequenceDefinition } from "./draft";
import { decideExecution, type ExecutionSignals } from "./runtime";

// Regra: após a Ligação 1, se o cliente atendeu, a sequência para (vai para pessoa)
// e não faz a 2ª ligação; se não atendeu ou falhou, segue para a 2ª ligação.
function run(callAnswered: boolean, callResultKnown: boolean) {
  const base = newDefinition();
  const definition: SequenceDefinition = {
    ...base,
    steps: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        type: "condition",
        title: "Ligação 1 foi atendida?",
        criteria: "call_answered",
        yes: "human",
        no: "next",
      },
      ...base.steps,
    ],
  } as SequenceDefinition;
  const signals: ExecutionSignals = {
    optedOut: false,
    replied: false,
    previousReplied: false,
    meetingBooked: false,
    callAnswered,
    callResultKnown,
    hasPhone: true,
    hasEmail: true,
    hasWhatsApp: true,
  };
  return decideExecution({
    runId: "run",
    state: "active",
    cursor: 0,
    definition,
    signals,
    now: new Date("2026-11-02T13:00:00Z"),
    previousAt: new Date("2026-11-01T13:00:00Z"),
  });
}

describe("verificação após a 1ª ligação", () => {
  it("ligação atendida encerra e encaminha para pessoa, sem 2ª ligação", () => {
    expect(run(true, true)).toMatchObject({ kind: "stop", state: "human" });
  });
  it("ligação não atendida segue para o próximo passo (2ª ligação)", () => {
    expect(run(false, true)).toMatchObject({ kind: "advance", nextStep: 1 });
  });
  it("ligação com falha (resultado conhecido, não atendida) também segue", () => {
    // O banco passa a marcar 'failed' como resultado conhecido.
    expect(run(false, true)).not.toMatchObject({ state: "blocked" });
  });
});
