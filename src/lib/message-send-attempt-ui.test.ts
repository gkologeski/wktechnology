import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
const state = vi.hoisted(() => ({
  user: { id: "actor" } as { id: string } | null,
  workspace: "workspace" as string | null,
  keys: new Set<string>(),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: state.workspace,
    canAny: (keys: readonly string[]) => keys.some((key) => state.keys.has(key)),
  }),
}));
import { useEmailSendAttempt, useChatSendAttempt } from "../hooks/use-message-send-attempt";
function renderAttempt(channel: "email" | "chat") {
  let value: ReturnType<typeof useEmailSendAttempt> | undefined;
  renderToString(
    createElement(function Probe() {
      const email = useEmailSendAttempt();
      const chat = useChatSendAttempt();
      value = channel === "email" ? email : chat;
      return null;
    }),
  );
  if (!value) throw new Error("Missing composition probe");
  return value;
}
afterEach(() => {
  state.user = { id: "actor" };
  state.workspace = "workspace";
  state.keys.clear();
});
it("email composer reuses a pending attempt and permits a new accepted composition", () => {
  state.keys.add("techsales.inbox.email.create.own");
  const attempt = renderAttempt("email");
  expect(attempt.canSend).toBe(true);
  const first = attempt.prepare({ to: ["synthetic@example.invalid"], body: "Synthetic" });
  expect(attempt.prepare({ to: ["synthetic@example.invalid"], body: "Synthetic" })).toEqual(first);
  attempt.complete();
  expect(
    attempt.prepare({ to: ["synthetic@example.invalid"], body: "Synthetic" }).request_id,
  ).not.toBe(first.request_id);
});
it("composer without current sending permission cannot prepare a transport attempt", () => {
  const attempt = renderAttempt("email");
  expect(attempt.canSend).toBe(false);
  expect(() => attempt.prepare({ body: "Synthetic" })).toThrow("permissão");
});
it("composer requires current user and active workspace even with a cached create key", () => {
  state.keys.add("techsales.inbox.email.create.workspace");
  state.workspace = null;
  expect(renderAttempt("email").canSend).toBe(false);
  state.workspace = "workspace";
  state.user = null;
  expect(renderAttempt("email").canSend).toBe(false);
});
it("chat composer preserves existing own or workspace send gates and rejects team-only create", () => {
  state.keys.add("techsales.inbox.chat.create.team");
  expect(renderAttempt("chat").canSend).toBe(false);
  state.keys.add("techsales.inbox.chat.create.own");
  expect(renderAttempt("chat").canSend).toBe(true);
});
it("an email create grant never authorizes chat composition", () => {
  state.keys.add("techsales.inbox.email.create.workspace");
  const chat = renderAttempt("chat");
  expect(chat.canSend).toBe(false);
  expect(() => chat.prepare({ body: "Synthetic" })).toThrow("permissão");
});
