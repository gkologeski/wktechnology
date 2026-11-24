import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertDisposableInboxTarget } from "../../tests/fixtures/inbox/load";
import { resolveGmailReply } from "./gmail-reply.server";
import { sendAuthenticatedChat } from "./inbox/chat-send.server";

// CI creates its own real GoTrue/PostgREST copy; the guarded installed-draft path
// remains available explicitly. Neither mode connects to a production URL.
const owned =
  process.env["INBOX_BACKEND_REGRESSIONS"] === "1"
    ? null
    : await import("../../tests/fixtures/inbox/backend-regression");
const apiBase = () => owned?.apiBase() ?? "http://127.0.0.1:8001";
describe("installed Inbox backend regression", () => {
  const workspace = owned?.workspace ?? "fa110000-0000-4000-8000-000000000001";
  const user = (n: number) => `fb110000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  let admin: SupabaseClient;
  let key: string;
  const clients = new Map<number, SupabaseClient>();
  const sql = async (query: string) => {
    if (owned) return owned.scalar(query);
    const result = spawnSync("psql", ["-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", query], {
      encoding: "utf8",
    });
    if (result.status !== 0)
      throw new Error("Disposable SQL check failed; private output withheld.");
    return result.stdout.trim();
  };
  const fetchLocal: typeof fetch = (url, init) => {
    if (owned) return owned.fetchLocal(url, init);
    const headers = new Headers(init?.headers);
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
      headers.delete("Authorization");
    return fetch(url, { ...init, headers });
  };
  beforeAll(async () => {
    if (owned) {
      key = await owned.setup();
    } else {
      assertDisposableInboxTarget(process.env, ["--disposable-draft"]);
      const credential = process.env["SUPABASE_SERVICE_ROLE_KEY"];
      if (!credential) throw new Error("Local service credential missing; not executed.");
      key = credential;
    }
    expect(
      await sql(
        "SELECT bool_and(slug IN('gmail-queue-isolated-a','gmail-queue-isolated-b')) FROM public.workspaces",
      ),
    ).toBe("t");
    admin = createClient(apiBase(), key, {
      auth: { persistSession: false },
      global: { fetch: fetchLocal },
    });
    for (const n of [11, 12, 13, 14, 15, 16, 17]) {
      const password = crypto.randomUUID() + crypto.randomUUID();
      await fetchLocal(`${apiBase()}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: user(n),
          email: `backend-regression-${n}@example.invalid`,
          password,
          email_confirm: true,
        }),
      });
      const updated = await admin.auth.admin.updateUserById(user(n), { password });
      if (updated.error || !updated.data.user?.email)
        throw new Error(
          `Disposable auth fixture ${n} unavailable (${updated.error?.status ?? "missing email"}).`,
        );
      const client = createClient(apiBase(), key, {
        auth: { persistSession: false },
        global: { fetch: fetchLocal },
      });
      const login = await client.auth.signInWithPassword({
        email: updated.data.user.email,
        password,
      });
      if (login.error || !login.data.session) throw new Error("Disposable GoTrue login failed.");
      clients.set(n, client);
    }
  }, 120000);
  afterAll(async () => {
    await owned?.stop();
  }, 30000);
  const subject = (n: number) => {
    const c = clients.get(n);
    if (!c) throw new Error("Missing authenticated fixture client.");
    return c;
  };
  const newSession = async (assignee: number) => {
    const id = crypto.randomUUID();
    if (owned) {
      await owned.seedChatSession(id, user(assignee));
    } else {
      const created = await admin.from("live_chat_sessions").insert({
        id,
        workspace_id: workspace,
        owner_id: workspace,
        visitor_id: id,
        assignee_id: user(assignee),
        status: "open",
      });
      expect(created.error).toBeNull();
    }
    return id;
  };
  it.each([
    [16, 16, true, "own in own conversation"],
    [16, 17, false, "own outside own conversation despite view.workspace"],
    [17, 17, false, "team-only even in own conversation"],
    [17, 16, false, "team-only in a peer conversation"],
    [11, 17, true, "workspace"],
    [12, 17, false, "missing permission"],
    [13, 17, false, "explicit deny"],
    [14, 17, false, "foreign workspace"],
    [15, 17, false, "inactive"],
  ] as const)("real GoTrue/RLS INSERT: %s/%s %s (%s)", async (actor, assignee, allowed, _label) => {
    const session = await newSession(assignee);
    const request = crypto.randomUUID();
    const send = sendAuthenticatedChat(subject(actor), {
      workspace,
      actor: user(actor),
      session,
      request,
      body: "Disposable scope regression",
    });
    if (allowed) await send;
    else await expect(send).rejects.toThrow();
    const persisted = await admin.from("live_chat_messages").select("id").eq("session_id", session);
    expect(persisted.error).toBeNull();
    expect(persisted.data).toHaveLength(allowed ? 1 : 0);
    const receipts = await admin
      .from("inbox_response_receipts")
      .select("id")
      .eq("conversation_id", session);
    expect(receipts.error).toBeNull();
    expect(receipts.data).toHaveLength(allowed ? 1 : 0);
  });
  let conversation: string;
  const gmailAccount = crypto.randomUUID();
  it("resolves a Gmail thread through real user/RLS record view+create", async () => {
    conversation = crypto.randomUUID();
    expect(
      (
        await admin.from("email_accounts").insert({
          id: gmailAccount,
          workspace_id: workspace,
          owner_id: user(11),
          provider: "gmail",
          email: `backend-regression-${gmailAccount}@example.invalid`,
          status: "connected",
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await admin.from("email_threads").insert({
          id: conversation,
          workspace_id: workspace,
          owner_id: user(11),
          assigned_to: user(11),
          account_id: gmailAccount,
          provider_thread_id: `regression-${conversation}`,
          subject: "Disposable Gmail thread",
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await admin.from("email_messages").insert({
          id: crypto.randomUUID(),
          workspace_id: workspace,
          owner_id: user(11),
          thread_id: conversation,
          account_id: gmailAccount,
          provider_message_id: `regression-${conversation}`,
          direction: "inbound",
          body_text: "Disposable mirror; not an attested inbound",
        })
      ).error,
    ).toBeNull();
    expect(
      await resolveGmailReply(subject(11), {
        conversationId: conversation,
        workspace,
        actor: user(11),
      }),
    ).toMatchObject({ conversationId: conversation, accountId: gmailAccount });
  });
  it.each([12, 13, 14, 15])("denies Gmail thread resolution for real profile %s", async (n) => {
    await expect(
      resolveGmailReply(subject(n), { conversationId: conversation, workspace, actor: user(n) }),
    ).rejects.toThrow();
  });
  it("rejects divergent explicit account with real RLS", async () => {
    await expect(
      resolveGmailReply(subject(11), {
        conversationId: conversation,
        workspace,
        actor: user(11),
        accountId: crypto.randomUUID(),
      }),
    ).rejects.toThrow("divergente");
  });
  it("forged resume parent fails 42501 atomically under service transport", async () => {
    const id = crypto.randomUUID();
    const result = await admin.from("workflow_events").insert({
      id,
      workspace_id: workspace,
      owner_id: user(11),
      entity: "inbox_channel_occurrences",
      entity_id: crypto.randomUUID(),
      event_type: "updated",
      notification_event_key: "shared.chat.message_received",
      notification_parent_event_id: crypto.randomUUID(),
      resume_workflow_id: crypto.randomUUID(),
      workflow_version: 1,
      resume_cursor: 1,
    });
    expect(result.error?.code).toBe("42501");
    expect((await admin.from("workflow_events").select("id").eq("id", id)).data).toHaveLength(0);
    expect(
      await sql(
        `SELECT count(*) FROM public.notification_business_event_proofs WHERE event_id='${id}'`,
      ),
    ).toBe("0");
  });
  it("keeps release lock enabled and all workflows inactive", async () => {
    expect(
      await sql("SELECT tgenabled FROM pg_trigger WHERE tgname='inbox_runtime_release_guard'"),
    ).toBe("O");
    expect(
      await sql(
        "SELECT count(*) FROM public.workflows WHERE entity='inbox_channel_occurrences' AND(enabled OR status='published')",
      ),
    ).toBe("0");
  });
});
