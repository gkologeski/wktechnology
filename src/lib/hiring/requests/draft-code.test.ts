import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { codeDigest, requestDraftCode } from "./draft-code.server";
describe("canonical draft code adapter", () => {
  it("delivers only to canonical recipient and returns no code or digest", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    let delivered = "";
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return {
          data:
            name === "hiring_draft_code_reserve"
              ? { recipient: "counterparty@example.test" }
              : null,
          error: null,
        };
      },
    } as unknown as SupabaseClient;
    const result = await requestDraftCode(
      client,
      "token",
      "synthetic-test-key",
      async (to, code) => {
        expect(to).toBe("counterparty@example.test");
        expect(code).toMatch(/^\d{8}$/);
        delivered = code;
        return { sent: true };
      },
    );
    expect(result).toEqual({ sent: true });
    expect(JSON.stringify(result)).not.toContain(delivered);
    expect(calls[0].args.digest).toBe(
      codeDigest("synthetic-test-key", "token", String(calls[0].args.challenge), delivered),
    );
    expect(calls[1].args.ok).toBe(true);
  });
  it.each(["suppressed", "failed"])("%s never validates the challenge", async (mode) => {
    let ok: unknown;
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        if (name === "hiring_draft_code_delivery") ok = args.ok;
        return { data: { recipient: "counterparty@example.test" }, error: null };
      },
    } as unknown as SupabaseClient;
    expect(
      await requestDraftCode(client, "token", "synthetic-test-key", async () => {
        if (mode === "failed") throw new Error("provider");
        return { sent: false };
      }),
    ).toEqual({ sent: false });
    expect(ok).toBe(false);
  });
  it("HMAC binds secret token challenge and code independently", () => {
    const expected = codeDigest("key", "token", "challenge", "12345678");
    expect(codeDigest("other", "token", "challenge", "12345678")).not.toBe(expected);
    expect(codeDigest("key", "other", "challenge", "12345678")).not.toBe(expected);
    expect(codeDigest("key", "token", "other", "12345678")).not.toBe(expected);
    expect(codeDigest("key", "token", "challenge", "87654321")).not.toBe(expected);
  });
});
