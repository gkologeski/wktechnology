import { expect, it } from "vitest";
import { createMessageSendAttempt } from "./message-send-attempt";

const scope = ["actor", "workspace"];
const payload = { to: ["synthetic@example.invalid"], subject: "Assunto", body_text: "Conteúdo" };
it("email composition retry preserves the exact attempt and payload", () => {
  const state = createMessageSendAttempt();
  const first = state.prepare(scope, payload);
  expect(state.prepare(scope, { ...payload })).toEqual(first);
  expect(first).toMatchObject(payload);
});
it("a confirmed email permits a deliberately new identical composition", () => {
  const state = createMessageSendAttempt();
  const first = state.prepare(scope, payload);
  state.complete();
  expect(state.prepare(scope, payload).request_id).not.toBe(first.request_id);
});
it("email composition attempts isolate active user and workspace changes", () => {
  const state = createMessageSendAttempt();
  const first = state.prepare(scope, payload);
  const foreignUser = state.prepare(["another", scope[1]], payload);
  expect(foreignUser.request_id).not.toBe(first.request_id);
  expect(state.prepare(["another", "another-workspace"], payload).request_id).not.toBe(
    foreignUser.request_id,
  );
});
it("changed recipients subject body and attachments cannot silently reuse an email attempt", () => {
  const state = createMessageSendAttempt();
  const ids = [state.prepare(scope, payload).request_id];
  for (const patch of [
    { to: ["other@example.invalid"] },
    { subject: "Changed" },
    { body_text: "Changed" },
    { attachments: [{ path: "synthetic/private.pdf" }] },
  ])
    ids.push(state.prepare(scope, { ...payload, ...patch }).request_id);
  expect(new Set(ids).size).toBe(ids.length);
});
