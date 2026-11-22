import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  gmailRequestFingerprint,
  inboxAttemptId,
  sendGmailWithInboxReceipt,
} from "./inbox-transport.server";

function memoryStore() {
  const receipts: Record<string, unknown>[] = [];
  let projectionFailure = false;
  let threadReadFailure = false;
  let threadId: string | null = null;
  const messages: Record<string, unknown>[] = [];
  const admin = {
    from(table: string) {
      const filters: [string, unknown][] = [];
      let value: Record<string, unknown> | undefined;
      let insertion = false;
      let projectionWrite = false;
      let read = false;
      const result = () => {
        if (table !== "inbox_response_receipts") {
          if (table === "email_messages" && value && !projectionFailure) messages.push(value);
          return {
            data: table === "email_threads" && read && threadId ? { id: threadId } : null,
            error:
              (projectionFailure && projectionWrite) ||
              (table === "email_threads" && read && threadReadFailure)
                ? { message: "projection failure" }
                : null,
          };
        }
        if (insertion && value) {
          if (
            receipts.some(
              (r) => r["origin"] === value?.["origin"] && r["source_id"] === value?.["source_id"],
            )
          )
            return { data: null, error: { message: "duplicate reservation" } };
          value = { id: crypto.randomUUID(), confirmed_at: new Date().toISOString(), ...value };
          receipts.push(value);
          insertion = false;
          return { data: value, error: null };
        }
        return {
          data: receipts.find((r) => filters.every(([k, v]) => r[k] === v)) ?? null,
          error: null,
        };
      };
      const chain = {
        select: () => {
          read = true;
          return chain;
        },
        eq: (k: string, v: unknown) => {
          filters.push([k, v]);
          return chain;
        },
        insert: (row: Record<string, unknown>) => {
          value = row;
          insertion = true;
          return chain;
        },
        upsert: (row: Record<string, unknown>) => {
          value = row;
          projectionWrite = true;
          return chain;
        },
        update: () => {
          projectionWrite = true;
          return chain;
        },
        maybeSingle: async () => result(),
        single: async () => result(),
        then: (resolve: (r: unknown) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  return {
    admin,
    receipts,
    messages,
    failThreadRead: () => {
      threadReadFailure = true;
    },
    restoreThreadRead: () => {
      threadReadFailure = false;
    },
    existingThread: (id: string) => {
      threadId = id;
    },
    failProjection: () => {
      projectionFailure = true;
    },
  };
}
const input = () => ({
  workspace: "workspace",
  account: "account",
  actor: "actor",
  request: inboxAttemptId(["request"]),
  message: inboxAttemptId(["message"]),
  body: "Actual reply",
  messageFields: { body_text: "Actual reply" },
  threadFields: { subject: "Thread" },
});
describe("canonical Gmail transport ownership", () => {
  it("stores private acceptance before projection and retry never resends", async () => {
    const store = memoryStore();
    store.failProjection();
    const send = vi.fn(async () => ({ id: "provider-message", threadId: "provider-thread" }));
    const first = await sendGmailWithInboxReceipt(store.admin, input(), send);
    expect(first.projectionPending).toBe(true);
    expect(store.receipts.map((r) => r["transport_state"])).toEqual(["reserved", "accepted"]);
    const retry = await sendGmailWithInboxReceipt(store.admin, input(), send);
    expect(retry.id).toBe("provider-message");
    expect(send).toHaveBeenCalledTimes(1);
    expect(store.receipts).toHaveLength(2);
  });
  it("unknown delivery and retry cannot acquire a second transport attempt", async () => {
    const store = memoryStore();
    const send = vi.fn(async () => {
      throw new Error("uncertain transport");
    });
    await expect(sendGmailWithInboxReceipt(store.admin, input(), send)).rejects.toThrow(
      "uncertain transport",
    );
    await expect(sendGmailWithInboxReceipt(store.admin, input(), send)).rejects.toThrow(
      "não repita",
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(store.receipts).toHaveLength(1);
  });
  it("conflicting actor, account and body cannot reuse acceptance", async () => {
    const store = memoryStore();
    const send = vi.fn(async () => ({ id: "provider-message", threadId: "provider-thread" }));
    await sendGmailWithInboxReceipt(store.admin, input(), send);
    for (const patch of [{ actor: "foreign" }, { account: "foreign" }, { body: "Changed" }]) {
      await expect(
        sendGmailWithInboxReceipt(store.admin, { ...input(), ...patch }, send),
      ).rejects.toThrow("divergente");
    }
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("concurrent retries reserve one send and one accepted receipt", async () => {
    const store = memoryStore();
    const send = vi.fn(async () => ({ id: "one", threadId: "thread" }));
    const results = await Promise.allSettled([
      sendGmailWithInboxReceipt(store.admin, input(), send),
      sendGmailWithInboxReceipt(store.admin, input(), send),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(store.receipts.filter((r) => r["provider_id"] === "accepted:one")).toHaveLength(1);
    expect(store.receipts.filter((r) => r["provider_id"] === "one")).toHaveLength(1);
  });
  it("persists acceptance before a failing thread read, then reconciles the same immutable receipt", async () => {
    const store = memoryStore();
    store.existingThread("actual-thread");
    store.failThreadRead();
    const send = vi.fn(async () => ({ id: "accepted-message", threadId: "provider-thread" }));
    expect((await sendGmailWithInboxReceipt(store.admin, input(), send)).projectionPending).toBe(
      true,
    );
    const original = store.receipts.find((r) => r["transport_state"] === "accepted");
    const snapshot = JSON.stringify(original);
    expect(original?.["provider_id"]).toBe("accepted:accepted-message");
    store.restoreThreadRead();
    const retry = await sendGmailWithInboxReceipt(store.admin, input(), send);
    expect(retry).toMatchObject({ conversationId: "actual-thread", projectionPending: false });
    expect(JSON.stringify(original)).toBe(snapshot);
    const reconciled = store.receipts.find((r) => r["conversation_id"] === "actual-thread");
    expect(reconciled?.["confirmed_at"]).toBe(original?.["confirmed_at"]);
    expect((reconciled?.["transport_payload"] as Record<string, unknown>)["acceptance_id"]).toBe(
      original?.["id"],
    );
    expect(store.messages.some((m) => m["thread_id"] === "actual-thread")).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("rejects reuse with changed recipients, subject, HTML or attachments even with the same text", async () => {
    const store = memoryStore();
    const send = vi.fn(async () => ({ id: "message", threadId: "thread" }));
    await sendGmailWithInboxReceipt(store.admin, input(), send);
    for (const patch of [
      { to_emails: ["different@example.invalid"] },
      { cc_emails: ["cc@example.invalid"] },
      { bcc_emails: ["bcc@example.invalid"] },
      { subject: "Changed" },
      { body_html: "<p>Changed</p>" },
      { attachments: [{ path: "file", content_sha256: "changed" }] },
    ])
      await expect(
        sendGmailWithInboxReceipt(
          store.admin,
          { ...input(), messageFields: { ...input().messageFields, ...patch } },
          send,
        ),
      ).rejects.toThrow("divergente");
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("uses explicit attempts for identical content independently while retry stays idempotent", async () => {
    const store = memoryStore();
    const send = vi.fn(async () => ({ id: "message", threadId: "thread" }));
    const second = {
      ...input(),
      request: inboxAttemptId(["another-attempt"]),
      message: inboxAttemptId(["another-message"]),
    };
    await sendGmailWithInboxReceipt(store.admin, input(), send);
    await sendGmailWithInboxReceipt(store.admin, input(), send);
    await sendGmailWithInboxReceipt(store.admin, second, send);
    await sendGmailWithInboxReceipt(store.admin, second, send);
    expect(send).toHaveBeenCalledTimes(2);
  });
  it("fingerprints ignore only regenerated projection dates and object ordering", () => {
    expect(gmailRequestFingerprint(input())).toBe(
      gmailRequestFingerprint({
        ...input(),
        messageFields: { sent_at: "later", ...input().messageFields },
        threadFields: { last_message_at: "later", ...input().threadFields },
      }),
    );
    expect(gmailRequestFingerprint(input())).not.toBe(
      gmailRequestFingerprint({ ...input(), body: "changed" }),
    );
  });
  it("rejects divergent reuse even while transport is uncertain", async () => {
    const store = memoryStore();
    const send = vi.fn(async () => {
      throw new Error("uncertain");
    });
    await expect(sendGmailWithInboxReceipt(store.admin, input(), send)).rejects.toThrow(
      "uncertain",
    );
    await expect(
      sendGmailWithInboxReceipt(
        store.admin,
        { ...input(), messageFields: { subject: "changed" } },
        send,
      ),
    ).rejects.toThrow("divergente");
    expect(send).toHaveBeenCalledTimes(1);
  });
});
