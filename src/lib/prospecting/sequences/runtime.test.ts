import { describe, expect, it } from "vitest";
import { newDefinition, newStep } from "./draft";
import { decideExecution, nextBusinessInstant, waitUntil, type ExecutionSignals } from "./runtime";
const signals: ExecutionSignals = {
  optedOut: false,
  replied: false,
  previousReplied: false,
  meetingBooked: false,
  callAnswered: false,
  hasPhone: true,
  hasEmail: true,
  hasWhatsApp: true,
};
function scenario() {
  return {
    runId: "run",
    state: "active" as const,
    cursor: 0,
    definition: newDefinition(),
    signals: { ...signals },
    now: new Date("2026-11-02T13:00:00Z"),
    previousAt: new Date("2026-11-01T13:00:00Z"),
  };
}
describe("sequence execution planner", () => {
  it("never runs a paused or uncertain inscription", () => {
    for (const state of ["paused", "uncertain"] as const)
      expect(decideExecution({ ...scenario(), state })).toMatchObject({ kind: "stop", state });
  });
  it("opt-out overrides every branch", () => {
    const s = scenario();
    s.signals.optedOut = true;
    expect(decideExecution(s)).toMatchObject({ kind: "stop", state: "blocked", reason: "opt_out" });
  });
  it("meeting cancels future outreach", () => {
    const s = scenario();
    s.signals.meetingBooked = true;
    expect(decideExecution(s)).toMatchObject({ state: "completed", reason: "meeting_booked" });
  });
  it("reply hands over instead of sending next message", () => {
    const s = scenario();
    s.signals.replied = true;
    expect(decideExecution(s)).toMatchObject({ state: "human" });
    s.definition.settings.agentId = crypto.randomUUID();
    expect(decideExecution(s)).toMatchObject({
      state: "agent",
      agentId: s.definition.settings.agentId,
    });
  });
  it("missing email skips only the email step", () => {
    const s = scenario();
    s.signals.hasEmail = false;
    expect(decideExecution(s)).toMatchObject({
      kind: "advance",
      nextStep: 1,
      reason: "missing_email",
    });
  });
  it("effects have stable per-run per-step keys", () => {
    const s = scenario();
    expect(decideExecution(s)).toEqual(decideExecution(s));
    expect(decideExecution(s)).toMatchObject({
      kind: "effect",
      key: `run:${s.definition.steps[0].id}`,
    });
  });
  it("previous-response waits differ from any-channel waits", () => {
    const s = scenario();
    s.definition.settings.stopOnReply = false;
    const step = {
      ...newStep("wait"),
      type: "wait" as const,
      source: "previous" as const,
      onReply: "human" as const,
      duration: 1,
      unit: "hours" as const,
    };
    s.definition.steps = [step];
    s.signals.replied = true;
    expect(decideExecution(s)).toMatchObject({ kind: "advance" });
    step.source = "any" as "previous";
    expect(decideExecution(s)).toMatchObject({ state: "human" });
  });
  it("condition uses selected signal and branch", () => {
    const s = scenario();
    s.definition.steps = [
      {
        id: crypto.randomUUID(),
        title: "Canal",
        type: "condition",
        criteria: "has_whatsapp",
        yes: "next",
        no: "human",
      },
    ];
    expect(decideExecution(s)).toMatchObject({ kind: "advance" });
    s.signals.hasWhatsApp = false;
    expect(decideExecution(s)).toMatchObject({ state: "human" });
  });
  it("weekend defers to Monday in configured zone", () => {
    expect(
      nextBusinessInstant(
        new Date("2026-11-07T13:00:00Z"),
        scenario().definition.settings,
      ).toISOString(),
    ).toBe("2026-11-09T12:00:00.000Z");
  });
  it("business day wait preserves local clock over weekend", () => {
    const d = scenario().definition;
    const wait = {
      id: crypto.randomUUID(),
      title: "wait",
      type: "wait" as const,
      duration: 1,
      unit: "business_days" as const,
      source: "any" as const,
      onReply: "human" as const,
    };
    expect(waitUntil(new Date("2026-11-06T17:00:00Z"), wait, d.settings).toISOString()).toBe(
      "2026-11-09T17:00:00.000Z",
    );
  });
  it("civil day across daylight saving is not twenty-four hours", () => {
    const d = scenario().definition;
    d.settings.timezone = "America/New_York";
    const wait = {
      id: crypto.randomUUID(),
      title: "wait",
      type: "wait" as const,
      duration: 1,
      unit: "days" as const,
      source: "any" as const,
      onReply: "human" as const,
    };
    expect(waitUntil(new Date("2026-03-07T15:00:00Z"), wait, d.settings).toISOString()).toBe(
      "2026-03-08T14:00:00.000Z",
    );
  });
  it("automatic calls produce a reserved effect rather than a delivered result", () => {
    const s = scenario();
    s.definition.steps = [
      {
        id: crypto.randomUUID(),
        title: "Call",
        type: "call",
        mode: "automatic",
        assigneeId: null,
        scriptId: null,
        notes: "",
        attempts: 1,
      },
    ];
    expect(decideExecution(s)).toMatchObject({
      kind: "effect",
      step: { type: "call", mode: "automatic" },
    });
  });
  it("waiting human activity never dispatches another step", () => {
    expect(decideExecution({ ...scenario(), state: "waiting_task" })).toMatchObject({
      kind: "stop",
      state: "waiting_task",
    });
  });
  it("call without a currently valid phone is skipped", () => {
    const s = scenario();
    s.definition.steps = [newStep("call")];
    s.signals.hasPhone = false;
    expect(decideExecution(s)).toMatchObject({ kind: "advance", reason: "missing_phone" });
  });
  it("unclassified manual call outcome does not pretend the client declined", () => {
    const s = scenario();
    s.definition.steps = [
      {
        id: crypto.randomUUID(),
        title: "Result",
        type: "condition",
        criteria: "call_answered",
        yes: "next",
        no: "end",
      },
    ];
    s.signals.callResultKnown = false;
    expect(decideExecution(s)).toMatchObject({
      kind: "stop",
      state: "blocked",
      reason: "call_outcome_unknown",
    });
  });
  it("a skipped prior channel does not make the recipient wait for a nonexistent reply", () => {
    const s = scenario();
    s.definition.steps = [
      {
        id: crypto.randomUUID(),
        title: "Wait",
        type: "wait",
        duration: 24,
        unit: "hours",
        source: "previous",
        onReply: "human",
      },
    ];
    s.signals.previousContactExists = false;
    expect(decideExecution(s)).toMatchObject({
      kind: "advance",
      reason: "previous_contact_skipped",
      dueAt: s.now.toISOString(),
    });
  });
});

it("wait retains its response policy until elapsed rather than advancing the cursor immediately", () => {
  const s = scenario();
  s.definition.settings.stopOnReply = false;
  s.definition.steps = [
    {
      ...newStep("wait"),
      type: "wait",
      source: "any",
      onReply: "human",
      duration: 24,
      unit: "hours",
    },
    newStep("end"),
  ];
  s.previousAt = s.now;
  expect(decideExecution(s)).toMatchObject({ kind: "advance", nextStep: 0, reason: "wait" });
  s.signals.replied = true;
  expect(decideExecution(s)).toMatchObject({ kind: "stop", state: "human" });
  s.signals.replied = false;
  s.now = new Date(s.now.getTime() + 86400000);
  expect(decideExecution(s)).toMatchObject({
    kind: "advance",
    nextStep: 1,
    reason: "wait_elapsed",
  });
});

it("reply honors the agent resolved from its actual channel over a later configured channel", () => {
  const s = scenario();
  s.definition.settings.agentId = crypto.randomUUID();
  s.signals.replied = true;
  const actual = crypto.randomUUID();
  expect(
    decideExecution({ ...s, signals: { ...s.signals, responseAgentId: actual } }),
  ).toMatchObject({ state: "agent", agentId: actual });
  expect(decideExecution({ ...s, signals: { ...s.signals, responseAgentId: null } })).toMatchObject(
    { state: "human" },
  );
});

it("a newly excluded customer or open deal stops outreach immediately", () => {
  for (const commercialBlock of ["customer", "open_deal"]) {
    const s = scenario();
    expect(decideExecution({ ...s, signals: { ...s.signals, commercialBlock } })).toMatchObject({
      kind: "stop",
      state: "blocked",
      reason: commercialBlock,
    });
  }
});
