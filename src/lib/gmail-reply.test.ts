import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveGmailReply,
  canonicalGmailReplyHeaders,
  gmailReplyHeadersForAttempt,
} from "./gmail-reply.server";
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
import { buildRawMime, gmailSendRaw } from "./gmail.server";

function client(
  options: { missing?: string; denied?: string; foreignAccount?: boolean; receipt?: unknown } = {},
) {
  const gates: string[] = [];
  const filters: [string, string, unknown][] = [];
  const mock = {
    rpc: async (_name: string, args: { t: string; a: string }) => {
      gates.push(`${args.t}:${args.a}`);
      return { data: args.a !== options.denied, error: null };
    },
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: (key: string, value: unknown) => {
          filters.push([table, key, value]);
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({
          error: null,
          data:
            options.missing === table
              ? null
              : table === "email_threads"
                ? { id: "conversation", account_id: "account", provider_thread_id: "thread" }
                : table === "email_accounts"
                  ? options.foreignAccount
                    ? null
                    : { id: "account" }
                  : table === "inbox_response_receipts"
                    ? (options.receipt ?? null)
                    : { provider_message_id: "original" },
        }),
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  return { mock, gates, filters };
}
const input = { conversationId: "conversation", workspace: "workspace", actor: "actor" };
const reply = {
  conversationId: "conversation",
  accountId: "account",
  providerThreadId: "thread",
  providerMessageId: "original",
};
afterEach(() => vi.unstubAllGlobals());
describe("Gmail conversation authorization and canonical reply", () => {
  it("requires record view and create plus the user's own account in the active workspace", async () => {
    const store = client();
    expect(await resolveGmailReply(store.mock, input)).toEqual(reply);
    expect(store.gates).toEqual([
      "email_threads:view",
      "email_threads:create",
      "email_accounts:view",
    ]);
    expect(store.filters).toContainEqual(["email_accounts", "owner_id", "actor"]);
    expect(store.filters).toContainEqual(["email_accounts", "status", "connected"]);
    for (const table of ["email_threads", "email_accounts", "email_messages"])
      expect(store.filters).toContainEqual([table, "workspace_id", "workspace"]);
  });
  it.each(["view", "create"])("denies a conversation when record %s is denied", async (denied) => {
    await expect(resolveGmailReply(client({ denied }).mock, input)).rejects.toThrow("permissão");
  });
  it("does not fall back to another account when an explicit account differs", async () => {
    await expect(
      resolveGmailReply(client().mock, { ...input, accountId: "other" }),
    ).rejects.toThrow("divergente");
  });
  it("denies a readable conversation if its Gmail account belongs to someone else", async () => {
    await expect(resolveGmailReply(client({ foreignAccount: true }).mock, input)).rejects.toThrow(
      "própria",
    );
  });
  it.each(["email_threads", "email_messages"])(
    "denies absent or RLS-hidden %s instead of making a new thread",
    async (missing) => {
      await expect(resolveGmailReply(client({ missing }).mock, input)).rejects.toThrow();
    },
  );
  it("obtains Message-ID and References only from canonical provider metadata", async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL) =>
      Response.json({
        id: "original",
        threadId: "thread",
        payload: {
          headers: [
            { name: "Message-ID", value: "<original@example.org>" },
            { name: "References", value: "<opening@example.org>" },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(await canonicalGmailReplyHeaders(reply, "test-only-token")).toEqual({
      inReplyTo: "<original@example.org>",
      references: "<opening@example.org> <original@example.org>",
    });
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("/messages/original?");
  });
  it("sends the authorized provider thread and canonical reply headers through the real Gmail adapter", async () => {
    let sends = 0;
    vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).includes("/messages/original?"))
        return Response.json({
          id: "original",
          threadId: "thread",
          payload: {
            headers: [
              { name: "Message-ID", value: "<original@example.org>" },
              { name: "References", value: "<opening@example.org>" },
            ],
          },
        });
      if (!String(url).endsWith("/messages/send"))
        throw new Error("Unexpected test transport URL.");
      const body = JSON.parse(String(init?.body)) as { raw: string; threadId: string };
      expect(body.threadId).toBe("thread");
      const mime = Buffer.from(body.raw, "base64url").toString();
      expect(mime).toContain("In-Reply-To: <original@example.org>");
      expect(mime).toContain("References: <opening@example.org> <original@example.org>");
      sends++;
      return Response.json({ id: "accepted", threadId: "thread" });
    });
    const authorized = await resolveGmailReply(client().mock, input);
    const headers = await canonicalGmailReplyHeaders(authorized, "test-only-token");
    const raw = buildRawMime({
      from: "sender@example.org",
      to: ["client@example.org"],
      subject: "Re: Atendimento",
      bodyText: "Resposta",
      ...headers,
    });
    expect(await gmailSendRaw("test-only-token", raw, authorized.providerThreadId)).toEqual({
      id: "accepted",
      threadId: "thread",
    });
    expect(sends).toBe(1);
  });
  it.each([
    { id: "original", threadId: "foreign-thread" },
    { id: "foreign-message", threadId: "thread" },
    {
      id: "original",
      threadId: "thread",
      payload: { headers: [{ name: "Message-ID", value: "bad\r\nBcc: injected@example.org" }] },
    },
  ])("rejects divergent/malformed provider metadata before sending", async (message) => {
    vi.stubGlobal("fetch", async () => Response.json(message));
    await expect(canonicalGmailReplyHeaders(reply, "test-only-token")).rejects.toThrow();
  });
  it("retains private accepted headers on retry even when the newest message changes", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const store = client({
      receipt: {
        account_id: "account",
        actor_id: "actor",
        transport_payload: {
          thread: { id: "conversation", provider_thread_id: "thread" },
          message: {
            headers: {
              "In-Reply-To": "<original@example.org>",
              References: "<original@example.org>",
            },
          },
        },
      },
    });
    expect(
      await gmailReplyHeadersForAttempt(store.mock, {
        reply: { ...reply, providerMessageId: "newer-message" },
        workspace: "workspace",
        actor: "actor",
        request: "attempt",
        accessToken: "test-only-token",
      }),
    ).toEqual({ inReplyTo: "<original@example.org>", references: "<original@example.org>" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("cannot reuse a private accepted attempt for another conversation", async () => {
    const store = client({
      receipt: {
        account_id: "account",
        actor_id: "actor",
        transport_payload: { thread: { id: "other" } },
      },
    });
    await expect(
      gmailReplyHeadersForAttempt(store.mock, {
        reply,
        workspace: "workspace",
        actor: "actor",
        request: "attempt",
        accessToken: "test-only-token",
      }),
    ).rejects.toThrow("divergente");
  });
});
