import { expect, it } from "vitest";
import { inspectSequence, inspectSequenceTemplate } from "./preflight";
import { newDefinition, newStep } from "./draft";
const template = (body: string) => ({
  name: "abertura",
  language: "pt_BR",
  status: "APPROVED",
  components: [{ type: "BODY", text: body }],
});
it("preflight reports missing configuration instead of treating a draft as executable", () => {
  const issues = inspectSequence(newDefinition());
  expect(issues.map((i) => i.code)).toEqual(
    expect.arrayContaining([
      "sender_missing",
      "email_content",
      "template_missing",
      "assignee_missing",
      "reply_agent_missing",
    ]),
  );
});
it("preflight accepts a configured email and human follow-up sequence", () => {
  const d = newDefinition(),
    s = newStep("email");
  if (s.type !== "email") throw Error();
  s.accountId = crypto.randomUUID();
  s.subject = "Olá";
  s.body = "Podemos conversar?";
  const task = newStep("call");
  if (task.type !== "call") throw Error();
  task.assigneeId = crypto.randomUUID();
  d.steps = [s, task, newStep("end")];
  expect(inspectSequence(d)).toEqual([]);
});
it("preflight rejects unreachable steps and reply without matching sender", () => {
  const d = newDefinition(),
    s = newStep("email");
  if (s.type !== "email") throw Error();
  s.thread = "reply";
  d.steps = [newStep("end"), s];
  expect(inspectSequence(d).map((i) => i.code)).toEqual(
    expect.arrayContaining(["unreachable", "thread_missing"]),
  );
});
it("template validation checks required positional values and current approval", () => {
  expect(inspectSequenceTemplate("s", template("Olá {{1}}"), {}).map((i) => i.code)).toEqual([
    "template_missing_body",
  ]);
  expect(inspectSequenceTemplate("s", template("Olá {{1}}"), { "1": "Maria" })).toEqual([]);
  expect(
    inspectSequenceTemplate("s", { ...template("Olá"), status: "REJECTED" }, {}).map((i) => i.code),
  ).toEqual(["template_not_approved"]);
});
it("template validation refuses named and oversized variables before allocation", () => {
  for (const text of ["Olá {{nome}}", "Olá {{999999999999}}"]) {
    expect(inspectSequenceTemplate("s", template(text), {})[0].code).toBe(
      "template_shape_unsupported",
    );
  }
});
it("template validation does not silently accept missing media or URL parameters", () => {
  const t = template("Olá");
  t.components.push({ type: "HEADER", format: "IMAGE" } as never);
  expect(inspectSequenceTemplate("s", t, {})[0].code).toBe("template_missing_media");
  const buttons = {
    ...template("Olá"),
    components: [
      { type: "BODY", text: "Olá" },
      { type: "BUTTONS", buttons: [{ type: "URL", url: "https://example.invalid/{{1}}" }] },
    ],
  };
  expect(inspectSequenceTemplate("s", buttons, {})[0].code).toBe("template_button_parameters");
});

it("agent handoff requires a prior communication channel instead of inventing one", () => {
  const d = newDefinition();
  d.settings.agentId = crypto.randomUUID();
  d.steps = [
    { ...newStep("agent"), type: "agent", agentId: d.settings.agentId, objective: "Atender" },
    newStep("end"),
  ];
  expect(inspectSequence(d).some((i) => i.code === "agent_missing_channel")).toBe(true);
});
