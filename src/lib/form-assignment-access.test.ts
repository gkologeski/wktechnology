import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeFormAssignment } from "./form-assignment-access";

function client(opts: { active: boolean; keys: string[]; denied?: string[] }) {
  return {
    rpc: async (fn: string, args: Record<string, string>) => {
      if (fn === "is_workspace_member") return { data: opts.active, error: null };
      const k = args._permission_key;
      return { data: opts.keys.includes(k) && !opts.denied?.includes(k), error: null };
    },
  } as unknown as SupabaseClient;
}
const KEY = "techsales.marketing.forms.update.workspace";

describe("authorizeFormAssignment", () => {
  it("allows active member with form edit key", async () => {
    await expect(authorizeFormAssignment(client({ active: true, keys: [KEY] }), "u", "w", "w")).resolves.toBeUndefined();
  });
  it("rejects form assignment without key", async () => {
    await expect(authorizeFormAssignment(client({ active: true, keys: [] }), "u", "w", "w")).rejects.toThrow();
  });
  it("rejects form assignment on explicit deny", async () => {
    await expect(authorizeFormAssignment(client({ active: true, keys: [KEY], denied: [KEY] }), "u", "w", "w")).rejects.toThrow();
  });
  it("rejects form assignment in foreign workspace", async () => {
    await expect(authorizeFormAssignment(client({ active: true, keys: [KEY] }), "u", "w", "other")).rejects.toThrow();
  });
  it("rejects form assignment for inactive member", async () => {
    await expect(authorizeFormAssignment(client({ active: false, keys: [KEY] }), "u", "w", "w")).rejects.toThrow();
  });
});
