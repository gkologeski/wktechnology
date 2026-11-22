import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  db,
  W,
  B,
  U,
  N,
  C,
  F,
  ROLE,
  reset,
  fixtureHttpBase,
  fixtureJwt,
} from "../../tests/fixtures/notification-deliveries";
import { setupInboxExecutionCopy } from "../../tests/fixtures/inbox/runtime";
import { inboxAttemptId, sendGmailWithInboxReceipt } from "./inbox-transport.server";
import { recoverGmailAcceptances } from "./gmail-recovery.server";
import type { EmailAccountRow } from "./gmail.server";

const backend = vi.hoisted(() => ({ admin: undefined as SupabaseClient | undefined }));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    if (!backend.admin) throw new Error("Disposable backend not initialized");
    return backend.admin;
  },
}));
vi.mock("./gmail.server", () => ({ ensureAccessToken: async () => "disposable-provider-token" }));
import { syncAccount } from "./gmail-sync.server";

describe("installed Gmail recovery", () => {
  const workspace = W;
  const foreign = B;
  const account = "fc110000-0000-4000-8000-000000000001";
  const actor = U;
  let admin: SupabaseClient;
  let accountRow: EmailAccountRow;
  const scope = { p_workspace: workspace, p_account: account };
  const realFetch = globalThis.fetch;
  let providerPosts = 0;
  let providerGets = 0;
  let historyIds: string[] = [];
  let history = 9000;
  const must = <T>(result: { data: T; error: { code?: string; message: string } | null }): T => {
    if (result.error)
      throw new Error(`Disposable operation failed (${result.error.code ?? "unknown"})`);
    return result.data;
  };
  const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> =>
    must(
      await (
        admin.rpc as unknown as (
          n: string,
          a: Record<string, unknown>,
        ) => Promise<{ data: T; error: { message: string } | null }>
      )(name, args),
    );
  const patchAccount = async (values: Record<string, unknown>) => {
    must(
      await admin
        .from("email_accounts")
        .update(values)
        .eq("id", account)
        .eq("workspace_id", workspace),
    );
  };
  beforeAll(async () => {
    await setupInboxExecutionCopy(db);
    await reset();
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
        values(${W},${ROLE},'techsales.email_accounts.view.own','grant'),
          (${W},${ROLE},'techsales.email_accounts.update.own','grant'),
          (${W},${ROLE},'techsales.inbox.email.create.workspace','grant') on conflict do nothing`;
    await db`insert into email_accounts(id,workspace_id,owner_id,provider,status,email,history_id)
        values(${account},${workspace},${actor},'gmail','connected','queue-a@example.invalid','9000')`;
    const base = fixtureHttpBase();
    admin = createClient(base, fixtureJwt("service_role"), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: (input, init) => {
          const url = String(input);
          if (!url.startsWith(base + "/rest/v1/")) throw new Error("Refused non-owned fixture URL");
          return realFetch(base + url.slice((base + "/rest/v1").length), init);
        },
      },
    });
    backend.admin = admin;
    await patchAccount({ status: "connected" });
    const loadedAccount = must(
      await admin
        .from("email_accounts")
        .select(
          "id,owner_id,workspace_id,email,access_token,refresh_token,expires_at,status,history_id",
        )
        .eq("id", account)
        .single(),
    );
    if (!loadedAccount) throw new Error("Disposable account unavailable");
    accountRow = loadedAccount;
    expect(
      await rpc<boolean>("sales_account_job_authorize", {
        p_table: "email_accounts",
        p_id: account,
      }),
    ).toBe(true);
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.startsWith("https://gmail.googleapis.com/")) return realFetch(input, init);
      if (init?.method === "POST") {
        providerPosts++;
        return Response.json({ id: "fixture-only", threadId: "fixture-only" });
      }
      providerGets++;
      if (url.includes("/history?"))
        return Response.json({
          historyId: String(++history),
          history: [{ messagesAdded: historyIds.map((id) => ({ message: { id } })) }],
        });
      if (url.endsWith("/profile")) return Response.json({ historyId: String(++history) });
      return Response.json({}, { status: 404 });
    });
  }, 60000);
  afterAll(() => {
    vi.unstubAllGlobals();
    backend.admin = undefined;
  });

  const brokenProjection = () =>
    new Proxy(admin, {
      get(target, property, receiver) {
        if (property !== "from") return Reflect.get(target, property, receiver);
        return (table: string) => {
          const query = target.from(table);
          if (table !== "email_threads") return query;
          const wrap = (q: object): object =>
            new Proxy(q, {
              get(chain, key) {
                if (key === "maybeSingle")
                  return async () => ({
                    data: null,
                    error: { message: "Injected post-acceptance read failure" },
                  });
                const member = Reflect.get(chain, key);
                return typeof member === "function"
                  ? (...args: unknown[]) => wrap(Reflect.apply(member, chain, args))
                  : member;
              },
            });
          return wrap(query);
        };
      },
    });
  async function pending(
    threadId = `recovery-${crypto.randomUUID()}`,
    badOwner = false,
    badBody = false,
  ) {
    const request = crypto.randomUUID();
    const providerId = `recovery-message-${request}`;
    const messageId = inboxAttemptId([request, "message"]);
    const send = vi.fn(async () => {
      await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        body: "synthetic-only",
      });
      return { id: providerId, threadId };
    });
    const result = await sendGmailWithInboxReceipt(
      brokenProjection(),
      {
        workspace,
        account,
        actor,
        request,
        message: messageId,
        body: "Private accepted recovery body",
        threadFields: { owner_id: badOwner ? foreign : actor, subject: "Disposable recovery" },
        messageFields: {
          owner_id: actor,
          body_text: badBody ? "Divergent projection" : "Private accepted recovery body",
          from_email: "queue-a@example.invalid",
          to_emails: ["visitor@example.invalid"],
        },
      },
      send,
    );
    expect(result.projectionPending).toBe(true);
    const receipt = must(
      await admin
        .from("inbox_response_receipts")
        .select("id,confirmed_at,transport_payload")
        .eq("workspace_id", workspace)
        .eq("source_id", inboxAttemptId(["gmail-accepted", request]))
        .single(),
    );
    expect(receipt).toBeTruthy();
    if (!receipt) throw new Error("Disposable acceptance unavailable");
    return {
      receipt: receipt.id,
      messageId,
      providerId,
      threadId,
      send,
      snapshot: JSON.stringify(receipt),
    };
  }
  async function status(receipt: string) {
    return rpc<{
      state: string;
      attempts: number;
      last_error_code: string | null;
      audit: Array<{ outcome: string; error_code: string | null }>;
    }>("inbox_gmail_recovery_status", { ...scope, p_receipt: receipt });
  }
  async function recoverUntil(receipt: string, expected: string) {
    for (let i = 0; i < 20; i++) {
      await recoverGmailAcceptances(admin, workspace, account);
      const state = await status(receipt);
      if (state.state === expected && state.attempts > 0) return state;
    }
    throw new Error("Bounded test cycles did not reach expected recovery state");
  }
  async function inbound() {
    const threadId = `recovery-inbound-${crypto.randomUUID()}`;
    const conversation = crypto.randomUUID();
    const cursor = must(
      await admin.from("email_accounts").select("history_id").eq("id", account).single(),
    );
    if (!cursor) throw new Error("Disposable cursor unavailable");
    await rpc("gmail_sync_enqueue", {
      ...scope,
      p_expected_history: cursor.history_id,
      p_next_history: String(++history),
      p_provenance: "incremental",
      p_ids: [threadId],
    });
    const token = crypto.randomUUID();
    const items = await rpc<Array<{ id: string; provider_message_id: string }>>(
      "gmail_sync_claim",
      { ...scope, p_token: token },
    );
    const item = items.find((row) => row.provider_message_id === threadId);
    if (!item) throw new Error("Canonical inbound claim unavailable");
    must(
      await admin.from("email_threads").insert({
        id: conversation,
        workspace_id: workspace,
        owner_id: actor,
        assigned_to: actor,
        account_id: account,
        provider_thread_id: threadId,
        inbox_creation_receipt: item.id,
      }),
    );
    must(
      await admin.from("email_messages").insert({
        id: crypto.randomUUID(),
        workspace_id: workspace,
        owner_id: actor,
        account_id: account,
        thread_id: conversation,
        provider_message_id: threadId,
        direction: "inbound",
        body_text: "Canonical inbound",
        received_at: new Date(Date.now() - 1000).toISOString(),
      }),
    );
    expect(
      await rpc("gmail_sync_finish", {
        ...scope,
        p_token: token,
        p_id: item.id,
        p_outcome: "existing",
      }),
    ).toBe(true);
    return { threadId, conversation };
  }
  const messages = async (provider: string) =>
    must(
      await admin
        .from("email_messages")
        .select("id,thread_id")
        .eq("workspace_id", workspace)
        .eq("account_id", account)
        .eq("provider_message_id", provider),
    );

  it("closed composer → new real sync cycle recovers same message and one first-response with zero second POST", async () => {
    const incoming = await inbound();
    const accepted = await pending(incoming.threadId);
    expect(await messages(accepted.providerId)).toHaveLength(0);
    const posts = providerPosts;
    historyIds = [accepted.providerId];
    for (let cycle = 0; cycle < 10; cycle++) {
      await syncAccount(accountRow);
      if ((await status(accepted.receipt)).state === "completed") break;
    }
    expect((await status(accepted.receipt)).state).toBe("completed");
    await syncAccount(accountRow);
    expect(providerPosts).toBe(posts);
    expect(accepted.send).toHaveBeenCalledTimes(1);
    expect(await messages(accepted.providerId)).toEqual([
      { id: accepted.messageId, thread_id: incoming.conversation },
    ]);
    const events = must(
      await admin
        .from("inbox_channel_occurrences")
        .select("id")
        .eq("conversation_id", incoming.conversation)
        .eq("event_key", "shared.email.first_response"),
    );
    expect(events).toHaveLength(1);
    const receipt = must(
      await admin
        .from("inbox_response_receipts")
        .select("id,confirmed_at,transport_payload")
        .eq("id", accepted.receipt)
        .single(),
    );
    expect(JSON.stringify(receipt)).toBe(accepted.snapshot);
    const audit = await status(accepted.receipt);
    expect(audit.audit).toHaveLength(1);
    expect(audit.audit[0]?.outcome).toBe("completed");
    expect(providerGets).toBeGreaterThan(0);
  }, 60000);
  it("failure stays pending with SQLSTATE audit and backoff; subsequent healthy acceptance is not starved", async () => {
    historyIds = [];
    const poisoned = await pending(undefined, true);
    const healthy = await pending();
    const failure = await recoverUntil(poisoned.receipt, "pending");
    expect(failure.last_error_code).toBe("42501");
    expect(failure.audit[0]?.outcome).toBe("retry");
    expect(await messages(poisoned.providerId)).toHaveLength(0);
    expect((await recoverUntil(healthy.receipt, "completed")).state).toBe("completed");
    expect((await status(poisoned.receipt)).attempts).toBe(1);
    expect(JSON.stringify(failure)).not.toContain("Private accepted recovery body");
  }, 60000);
  it.each(["disconnected", "revoked", "inactive", "foreign"] as const)(
    "%s account/tenant cannot project a claimed acceptance",
    async (kind) => {
      const accepted = await pending();
      const token = crypto.randomUUID();
      let items = await rpc<Array<{ receipt_id: string }>>("inbox_gmail_recovery_claim", {
        ...scope,
        p_token: token,
        p_limit: 25,
      });
      for (let i = 0; !items.some((r) => r.receipt_id === accepted.receipt) && i < 10; i++) {
        for (const row of items)
          await rpc("inbox_gmail_recovery_project", {
            ...scope,
            p_token: token,
            p_receipt: row.receipt_id,
          });
        items = await rpc("inbox_gmail_recovery_claim", {
          ...scope,
          p_token: token,
          p_limit: 25,
        });
      }
      expect(items.some((row) => row.receipt_id === accepted.receipt)).toBe(true);
      try {
        if (kind === "disconnected") await patchAccount({ status: "error" });
        if (kind === "revoked") await patchAccount({ owner_id: N });
        if (kind === "inactive")
          must(
            await admin
              .from("workspace_members")
              .update({ status: "inactive" })
              .eq("workspace_id", workspace)
              .eq("user_id", actor),
          );
        expect(
          await rpc("inbox_gmail_recovery_project", {
            ...scope,
            p_workspace: kind === "foreign" ? foreign : workspace,
            p_token: token,
            p_receipt: accepted.receipt,
          }),
        ).toBe(false);
        const claim = await admin.rpc("inbox_gmail_recovery_claim", {
          ...scope,
          p_workspace: kind === "foreign" ? foreign : workspace,
          p_token: crypto.randomUUID(),
          p_limit: 25,
        });
        expect(claim.error?.code).toBe("42501");
        expect(await messages(accepted.providerId)).toHaveLength(0);
      } finally {
        await patchAccount({ status: "connected", owner_id: actor });
        must(
          await admin
            .from("workspace_members")
            .update({ status: "active" })
            .eq("workspace_id", workspace)
            .eq("user_id", actor),
        );
      }
    },
    60000,
  );
  it("reservation/uncertain send never enters recovery and never acquires a second send", async () => {
    const request = crypto.randomUUID();
    const send = vi.fn(async () => {
      throw new Error("uncertain");
    });
    const input = {
      workspace,
      account,
      actor,
      request,
      message: crypto.randomUUID(),
      body: "uncertain",
      threadFields: { owner_id: actor },
      messageFields: { owner_id: actor, body_text: "uncertain" },
    };
    await expect(sendGmailWithInboxReceipt(admin, input, send)).rejects.toThrow("uncertain");
    const reservation = must(
      await admin.from("inbox_response_receipts").select("id").eq("source_id", request).single(),
    );
    if (!reservation) throw new Error("Disposable reservation unavailable");
    expect(
      await rpc("inbox_gmail_recovery_status", { ...scope, p_receipt: reservation.id }),
    ).toBeNull();
    await recoverGmailAcceptances(admin, workspace, account);
    expect(send).toHaveBeenCalledTimes(1);
    await expect(sendGmailWithInboxReceipt(admin, input, send)).rejects.toThrow("não repita");
  });
  it("a projection mismatch rolls back thread/message/child atomically while acceptance stays pending", async () => {
    const accepted = await pending(undefined, false, true);
    const posts = providerPosts;
    const failure = await recoverUntil(accepted.receipt, "pending");
    expect(failure.last_error_code).toBe("42501");
    expect(await messages(accepted.providerId)).toHaveLength(0);
    expect(
      must(
        await admin
          .from("email_threads")
          .select("id")
          .eq("account_id", account)
          .eq("provider_thread_id", accepted.threadId),
      ),
    ).toHaveLength(0);
    expect(
      must(
        await admin
          .from("inbox_response_receipts")
          .select("id")
          .eq("account_id", account)
          .eq("provider_id", accepted.providerId),
      ),
    ).toHaveLength(0);
    expect(providerPosts).toBe(posts);
    expect(accepted.send).toHaveBeenCalledTimes(1);
  });
  it("a history mirror without transport acceptance is never queued or promoted", async () => {
    const conversation = crypto.randomUUID();
    const message = crypto.randomUUID();
    const provider = `mirror-${message}`;
    must(
      await admin.from("email_threads").insert({
        id: conversation,
        workspace_id: workspace,
        owner_id: actor,
        account_id: account,
        provider_thread_id: provider,
      }),
    );
    must(
      await admin.from("email_messages").insert({
        id: message,
        workspace_id: workspace,
        owner_id: actor,
        account_id: account,
        thread_id: conversation,
        provider_message_id: provider,
        direction: "outbound",
        body_text: "Unattested history",
      }),
    );
    expect(await rpc("inbox_gmail_recovery_known", { ...scope, p_provider: provider })).toBe(false);
    await recoverGmailAcceptances(admin, workspace, account);
    expect(
      must(
        await admin
          .from("inbox_channel_occurrences")
          .select("id")
          .eq("conversation_id", conversation)
          .eq("event_key", "shared.email.first_response"),
      ),
    ).toHaveLength(0);
    const [defaults] = await db`SELECT column_default FROM information_schema.columns
        WHERE table_schema='public' AND table_name='inbox_response_receipts' AND column_name='confirmed_at'`;
    expect(defaults?.column_default).toBe("clock_timestamp()");
  });
  it("over 100 later acceptances do not hide the oldest pending attempt; concurrent claims are disjoint and bounded", async () => {
    const oldest = await pending();
    const newer = [];
    for (let i = 0; i < 101; i++) newer.push(await pending());
    const [left, right] = await Promise.all(
      [crypto.randomUUID(), crypto.randomUUID()].map((token) =>
        rpc<Array<{ receipt_id: string }>>("inbox_gmail_recovery_claim", {
          ...scope,
          p_token: token,
          p_limit: 25,
        }).then((items) => ({ token, items })),
      ),
    );
    if (!left || !right) throw new Error("Missing concurrent claim results");
    expect(left.items.length).toBeLessThanOrEqual(25);
    expect(right.items.length).toBeLessThanOrEqual(25);
    expect(left.items.some((l) => right.items.some((r) => r.receipt_id === l.receipt_id))).toBe(
      false,
    );
    expect([...left.items, ...right.items].some((r) => r.receipt_id === oldest.receipt)).toBe(true);
    for (const claim of [left, right])
      for (const row of claim.items) {
        await rpc("inbox_gmail_recovery_project", {
          ...scope,
          p_token: claim.token,
          p_receipt: row.receipt_id,
        });
      }
    expect((await status(oldest.receipt)).state).toBe("completed");
    for (let cycle = 0; cycle < 6; cycle++)
      await recoverGmailAcceptances(admin, workspace, account);
    const last = newer.at(-1);
    if (!last) throw new Error("Missing newest acceptance");
    expect((await status(last.receipt)).state).toBe("completed");
    const replay = await rpc("inbox_gmail_recovery_project", {
      ...scope,
      p_token: left.token,
      p_receipt: oldest.receipt,
    });
    expect(replay).toBe(false);
    expect(await messages(oldest.providerId)).toHaveLength(1);
  }, 120000);
  async function recoveryProfile(kind: "allowed" | "missing" | "deny" | "foreign" | "inactive") {
    const accepted = await pending(),
      token = crypto.randomUUID();
    const items = await rpc<Array<{ receipt_id: string }>>("inbox_gmail_recovery_claim", {
      ...scope,
      p_token: token,
      p_limit: 25,
    });
    expect(items.some((row) => row.receipt_id === accepted.receipt)).toBe(true);
    const grants = await db`select permission_key,effect from job_role_permission_overrides
        where workspace_id=${W} and role_id=${ROLE} and permission_key like 'techsales.inbox.email.view.%'`;
    try {
      if (kind === "missing")
        await db`delete from job_role_permission_overrides where workspace_id=${W} and role_id=${ROLE} and permission_key like 'techsales.inbox.email.view.%'`;
      if (kind === "deny")
        await db`update job_role_permission_overrides set effect='deny' where workspace_id=${W} and role_id=${ROLE} and permission_key='techsales.inbox.email.create.workspace'`;
      if (kind === "inactive")
        await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
      const projected = await rpc("inbox_gmail_recovery_project", {
        ...scope,
        p_workspace: kind === "foreign" ? B : W,
        p_token: token,
        p_receipt: accepted.receipt,
      });
      return { projected, messageCount: (await messages(accepted.providerId))?.length };
    } finally {
      if (kind === "missing")
        for (const grant of grants)
          await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},${String(grant.permission_key)},${String(grant.effect)})`;
      if (kind === "deny")
        await db`update job_role_permission_overrides set effect='grant' where workspace_id=${W} and role_id=${ROLE} and permission_key='techsales.inbox.email.create.workspace'`;
      if (kind === "inactive")
        await db`update workspace_members set status='active' where workspace_id=${W} and user_id=${U}`;
    }
  }
  it("Gmail recovery allows the current authorized active owner", async () => {
    await expect(recoveryProfile("allowed")).resolves.toEqual({ projected: true, messageCount: 1 });
  });
  it("Gmail recovery rejects missing current channel permission", async () => {
    await expect(recoveryProfile("missing")).resolves.toEqual({
      projected: false,
      messageCount: 0,
    });
  });
  it("Gmail recovery preserves explicit deny over sending grant", async () => {
    await expect(recoveryProfile("deny")).resolves.toEqual({ projected: false, messageCount: 0 });
  });
  it("Gmail recovery rejects a foreign workspace", async () => {
    await expect(recoveryProfile("foreign")).resolves.toEqual({
      projected: false,
      messageCount: 0,
    });
  });
  it("Gmail recovery rejects an inactive member", async () => {
    await expect(recoveryProfile("inactive")).resolves.toEqual({
      projected: false,
      messageCount: 0,
    });
  });
  it.each([U, N, C, F])(
    "authenticated profile %s cannot execute recovery RPCs or read private payloads",
    async (user) => {
      for (const [name, args] of [
        ["inbox_gmail_recovery_claim", { ...scope, p_token: crypto.randomUUID(), p_limit: 25 }],
        [
          "inbox_gmail_recovery_project",
          { ...scope, p_token: crypto.randomUUID(), p_receipt: crypto.randomUUID() },
        ],
        ["inbox_gmail_recovery_status", { ...scope, p_receipt: crypto.randomUUID() }],
        ["inbox_gmail_recovery_known", { ...scope, p_provider: "synthetic" }],
      ] as const) {
        const response = await realFetch(fixtureHttpBase() + "/rpc/" + name, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + fixtureJwt("authenticated", user),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(args),
        });
        expect(response.status).toBe(403);
      }
      const [acl] = await db`SELECT bool_and(NOT has_table_privilege('authenticated',c.oid,'SELECT')
        AND NOT has_table_privilege('anon',c.oid,'SELECT')) allowed FROM pg_class c
        WHERE c.relname IN('inbox_gmail_recovery','inbox_gmail_recovery_attempts','inbox_response_receipts')`;
      expect(acl?.allowed).toBe(true);
    },
  );
  it("manual sync for an error account validates discovery before connected recovery without resend", async () => {
    const accepted = await pending();
    const posts = providerPosts;
    await patchAccount({ status: "error" });
    historyIds = [];
    try {
      await syncAccount(accountRow);
      expect((await status(accepted.receipt)).state).toBe("completed");
      expect(await messages(accepted.providerId)).toHaveLength(1);
      expect(providerPosts).toBe(posts);
    } finally {
      await patchAccount({ status: "connected" });
    }
  });
});
