import { afterEach, describe, expect, it, vi } from "vitest";
import { signState, verifyState } from "./email-oauth.server";

afterEach(() => vi.unstubAllEnvs());

describe("OAuth vinculado ao workspace de origem", () => {
  it("preserva o workspace e usuário dentro do estado assinado", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "isolated-unit-test-signing-key");
    const state = signState({ user_id: "user-A", workspace_id: "workspace-B", mode: "calendar" });
    expect(verifyState(state)).toMatchObject({
      user_id: "user-A",
      workspace_id: "workspace-B",
      mode: "calendar",
    });
  });
  it("recusa a substituição do workspace sem uma nova assinatura", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "isolated-unit-test-signing-key");
    const [body, signature] = signState({ user_id: "user-A", workspace_id: "workspace-A" }).split(
      ".",
    );
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    parsed.workspace_id = "workspace-B";
    const replaced = Buffer.from(JSON.stringify(parsed)).toString("base64url");
    expect(() => verifyState(`${replaced}.${signature}`)).toThrow("signature mismatch");
  });
});
