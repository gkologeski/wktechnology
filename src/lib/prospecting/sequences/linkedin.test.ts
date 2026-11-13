import { expect, it } from "vitest";
import { newDefinition, newStep } from "./draft";
import { decideExecution } from "./runtime";
import { cohortCandidates } from "./enrollment";
import { inspectSequence } from "./preflight";
function sample() {
  const definition = newDefinition();
  definition.steps = [
    {
      ...newStep("linkedin"),
      type: "linkedin" as const,
      accountId: crypto.randomUUID(),
      body: "Olá {{first_name}}, podemos conversar?",
      agentId: null,
    },
  ];
  return {
    definition,
    runId: "run",
    previousAt: null,
    state: "active" as const,
    cursor: 0,
    now: new Date("2026-11-09T13:00:00Z"),
    signals: {
      optedOut: false,
      replied: false,
      previousReplied: false,
      meetingBooked: false,
      callAnswered: false,
      hasPhone: false,
      hasEmail: false,
      hasWhatsApp: false,
      hasLinkedin: true,
    },
  };
}
it("plans LinkedIn as an outreach effect and skips a missing profile", () => {
  const s = sample();
  expect(decideExecution(s)).toMatchObject({ kind: "effect" });
  expect(decideExecution({ ...s, signals: { ...s.signals, hasLinkedin: false } })).toMatchObject({
    kind: "advance",
    reason: "missing_linkedin",
  });
});
it("stops LinkedIn followups on reply, meeting and opt-out", () => {
  const s = sample();
  expect(decideExecution({ ...s, signals: { ...s.signals, replied: true } })).toMatchObject({
    state: "human",
  });
  expect(decideExecution({ ...s, signals: { ...s.signals, meetingBooked: true } })).toMatchObject({
    state: "completed",
  });
  expect(decideExecution({ ...s, signals: { ...s.signals, optedOut: true } })).toMatchObject({
    state: "blocked",
  });
});
it("requires LinkedIn content and an account during preflight", () => {
  const s = sample();
  expect(
    inspectSequence(s.definition).filter((x) => x.stepId === s.definition.steps[0].id),
  ).toEqual([]);
  s.definition.steps = [newStep("linkedin")];
  expect(inspectSequence(s.definition).length).toBeGreaterThan(0);
});
it("includes a LinkedIn-only person in the caller-filtered audience", () => {
  const s = sample();
  const rows = [
    {
      sourceType: "contact",
      sourceId: crypto.randomUUID(),
      values: { "contact.linkedin_url": "https://www.linkedin.com/in/andressa-wolf-31491090/" },
      phones: [],
    },
  ];
  const [p] = cohortCandidates(rows as never, s.definition);
  expect(p.channels).toMatchObject({ linkedin: true, email: false, whatsapp: false, call: false });
  expect(p.linkedin_identifier).toBe("andressa-wolf-31491090");
});

it("allows a dedicated LinkedIn response agent in a multichannel sequence", () => {
  const s = sample();
  const agentId = crypto.randomUUID();
  s.definition.steps = [
    {
      ...newStep("linkedin"),
      type: "linkedin",
      accountId: crypto.randomUUID(),
      body: "Olá",
      agentId,
    },
    {
      ...newStep("wait"),
      type: "wait",
      source: "previous",
      duration: 1,
      unit: "hours",
      onReply: "agent",
    },
  ];
  expect(inspectSequence(s.definition).filter((x) => x.code === "reply_agent_missing")).toEqual([]);
  expect(
    decideExecution({ ...s, cursor: 1, signals: { ...s.signals, replied: true } }),
  ).toMatchObject({ state: "agent", agentId });
});
