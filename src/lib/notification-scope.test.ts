import { describe, expect, it } from "vitest";
import { scopeNotifications } from "./notification-cursor";

const ME = "11111111-1111-4111-8111-111111111111";
function q() {
  const calls: [string, string][] = [];
  const query = { eq: (c: string, v: string) => (calls.push([c, v]), query) };
  return { query, calls };
}

describe("notificações pessoais", () => {
  it("notifications allow the signed-in owner to read own rows", () => {
    const { query, calls } = q();
    scopeNotifications(query, ME);
    expect(calls).toEqual([["user_id", ME]]);
  });
  it("notifications refuse a caller without session", () => {
    const { query, calls } = q();
    expect(() => scopeNotifications(query, null)).toThrow("Sessão inválida.");
    expect(calls).toEqual([]);
  });
  it("notifications refuse a forged caller identifier", () => {
    const { query, calls } = q();
    expect(() => scopeNotifications(query, "' or 1=1 --")).toThrow();
    expect(calls).toEqual([]);
  });
  it("notifications never widen to the workspace of another member", () => {
    const { query, calls } = q();
    scopeNotifications(query, ME);
    expect(calls.every(([c, v]) => c === "user_id" && v === ME)).toBe(true);
    expect(calls.some(([c]) => c === "workspace_id")).toBe(false);
  });
  it("notifications refuse an inactive member whose session was revoked", () => {
    const { query, calls } = q();
    expect(() => scopeNotifications(query, "")).toThrow("Sessão inválida.");
    expect(calls).toEqual([]);
  });
});
