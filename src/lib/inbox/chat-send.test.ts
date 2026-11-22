import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendAuthenticatedChat } from "./chat-send.server";

const input = {
  workspace: "workspace-a",
  actor: "real-actor",
  session: "own-session",
  request: "one-request",
  body: "Actual reply",
};
function client(error: { code: string; message: string } | null, existing: unknown = null) {
  const insert = vi.fn(async () => ({ error }));
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: existing, error: null }),
  };
  const from = vi.fn(() => ({ ...chain, insert }));
  return { user: { from } as unknown as SupabaseClient, insert, from };
}
describe("authenticated chat transport", () => {
  it("allows accepted real-user INSERT and binds author and immutable request", async () => {
    const c = client(null);
    await sendAuthenticatedChat(c.user, input);
    expect(c.insert).toHaveBeenCalledWith({
      id: "one-request",
      inbox_chat_request: "one-request",
      workspace_id: "workspace-a",
      owner_id: "workspace-a",
      session_id: "own-session",
      direction: "outbound",
      author_user_id: "real-actor",
      body: "Actual reply",
    });
  });
  for (const [name, message] of [
    ["missing permission", "RLS missing create"],
    ["explicit deny", "RLS deny overrides grant"],
    ["foreign workspace", "RLS foreign tenant"],
    ["inactive member", "RLS inactive membership"],
  ] as const) {
    it(`refuses ${name} from the real INSERT without any fallback`, async () => {
      const c = client({ code: "42501", message });
      await expect(sendAuthenticatedChat(c.user, input)).rejects.toThrow(message);
      expect(c.insert).toHaveBeenCalledTimes(1);
      expect(c.from).toHaveBeenCalledTimes(1);
    });
  }
  it("reconciles duplicate accepted request without upsert or new send", async () => {
    const c = client(
      { code: "23505", message: "duplicate" },
      {
        id: input.request,
        inbox_chat_request: input.request,
        session_id: input.session,
        author_user_id: input.actor,
        body: input.body,
        direction: "outbound",
      },
    );
    await sendAuthenticatedChat(c.user, input);
    expect(c.insert).toHaveBeenCalledTimes(1);
    expect(c.from).toHaveBeenCalledTimes(2);
  });
  it("refuses duplicate mirror or divergent actor/body/session", async () => {
    for (const patch of [
      { inbox_chat_request: null },
      { author_user_id: "other" },
      { body: "changed" },
      { session_id: "other" },
    ]) {
      const c = client(
        { code: "23505", message: "duplicate" },
        {
          inbox_chat_request: input.request,
          session_id: input.session,
          author_user_id: input.actor,
          body: input.body,
          direction: "outbound",
          ...patch,
        },
      );
      await expect(sendAuthenticatedChat(c.user, input)).rejects.toThrow("divergente");
    }
  });
});
