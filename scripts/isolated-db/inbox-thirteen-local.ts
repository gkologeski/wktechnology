import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  assertDisposableInboxTarget,
  loadDisposableInboxFixtures,
} from "../../tests/fixtures/inbox/load";
import { checkGmailTransport } from "../../tests/fixtures/inbox/gmail-transport-checks";
import { checkThirteenReadBoundaries } from "../../tests/fixtures/inbox/thirteen-read-checks";
assertDisposableInboxTarget(process.env, process.argv);
loadDisposableInboxFixtures();
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!key) throw new Error("Missing local service credential.");
const originalFetch = globalThis.fetch;
const localFetch: typeof fetch = (url, init) => {
  const headers = new Headers(init?.headers);
  if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
    headers.delete("Authorization");
  return originalFetch(url, { ...init, headers });
};
const admin = createClient("http://127.0.0.1:8001", key, {
  auth: { persistSession: false },
  global: { fetch: localFetch },
});
const workspace = "fa110000-0000-4000-8000-000000000001";
const user = (n: number) => `fb110000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tokens = new Map<number, string>();
async function api(path: string, method: string, body?: unknown, token?: string) {
  const response = await localFetch("http://127.0.0.1:8001" + path, {
    method,
    headers: {
      apikey: key ?? "",
      Authorization: `Bearer ${token ?? key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
}
for (const n of [11, 12, 13, 14, 15, 16]) {
  const password = crypto.randomUUID() + crypto.randomUUID();
  const email = `guard-disposable-${n}@example.invalid`;
  const created = await api("/auth/v1/admin/users", "POST", {
    id: user(n),
    email,
    password,
    email_confirm: true,
  });
  if (![200, 201].includes(created.status))
    assert.equal((await api(`/auth/v1/admin/users/${user(n)}`, "PUT", { password })).status, 200);
  const login = await api("/auth/v1/token?grant_type=password", "POST", { email, password });
  assert.equal(login.status, 200);
  assert.ok(
    login.body &&
      typeof login.body === "object" &&
      "access_token" in login.body &&
      typeof login.body.access_token === "string",
  );
  tokens.set(n, login.body.access_token);
  assert.equal(
    (
      await api(`/rest/v1/profiles?id=eq.${user(n)}`, "PATCH", {
        active_workspace_id: n === 14 ? "fa110000-0000-4000-8000-000000000002" : workspace,
      })
    ).status,
    200,
  );
}
for (const name of ["guard", "chat-response", "thirteen-producers"]) {
  const applied = spawnSync(
    "psql",
    [
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "--single-transaction",
      "-f",
      `tests/fixtures/inbox/${name}.sql`,
    ],
    { encoding: "utf8" },
  );
  if (applied.status !== 0) throw new Error("Disposable fixture failed; private output withheld.");
}
const must = <T>(r: { data: T; error: unknown }) => {
  assert.equal(r.error, null);
  return r.data;
};
const emailAccount = crypto.randomUUID();
must(
  await admin.from("email_accounts").insert({
    id: emailAccount,
    workspace_id: workspace,
    owner_id: user(11),
    provider: "gmail",
    email: `thirteen-${emailAccount}@example.invalid`,
    status: "connected",
  }),
);
const gmailChecks = await checkGmailTransport(admin, workspace, emailAccount, user(11));
const gmailCreated = must(
  await admin
    .from("inbox_channel_occurrences")
    .select("conversation_id")
    .eq("account_id", emailAccount)
    .eq("event_key", "shared.email.conversation_created")
    .single(),
);
assert.equal(
  (
    await api(
      `/rest/v1/email_threads?id=eq.${gmailCreated.conversation_id}`,
      "PATCH",
      { assigned_to: user(16) },
      tokens.get(11),
    )
  ).status,
  200,
);
const chat = crypto.randomUUID();
must(
  await admin.from("live_chat_sessions").insert({
    id: chat,
    workspace_id: workspace,
    owner_id: workspace,
    assignee_id: user(11),
    visitor_id: chat,
    status: "open",
  }),
);
must(
  await admin.rpc("widget_inbound_commit", {
    p_session: chat,
    p_visitor: chat,
    p_request: crypto.randomUUID(),
    p_body: "Thirteen real visitor input",
  }),
);
const message = crypto.randomUUID();
assert.equal(
  (
    await api(
      "/rest/v1/live_chat_messages",
      "POST",
      {
        id: message,
        inbox_chat_request: message,
        workspace_id: workspace,
        owner_id: workspace,
        session_id: chat,
        direction: "outbound",
        author_user_id: user(11),
        body: "Real authenticated reply",
      },
      tokens.get(11),
    )
  ).status,
  201,
);
assert.equal(
  (
    await api(
      `/rest/v1/live_chat_sessions?id=eq.${chat}`,
      "PATCH",
      { assignee_id: user(16), status: "closed" },
      tokens.get(11),
    )
  ).status,
  200,
);
const linkedinAccount = crypto.randomUUID(),
  providerChat = `chat_${crypto.randomUUID()}`;
must(
  await admin.from("unipile_accounts").insert({
    id: linkedinAccount,
    workspace_id: workspace,
    owner_id: user(11),
    unipile_account_id: `fixture_${linkedinAccount}`,
    status: "connected",
    daily_window: { tz: "UTC", start_hour: 0, end_hour: 24 },
  }),
);
must(
  await admin.rpc("unipile_signed_inbound_commit", {
    p_account: linkedinAccount,
    p_message: crypto.randomUUID(),
    p_chat: providerChat,
    p_sender: "fixture-visitor",
    p_body: "Actual live-signed input",
    p_envelope_hash: createHash("sha256").update(providerChat).digest("hex"),
    p_occurred: new Date(Date.now() - 1000).toISOString(),
    p_live: true,
    p_self: false,
  }),
);
const linkedin = must(
  await admin
    .from("linkedin_conversations")
    .select("id")
    .eq("account_id", linkedinAccount)
    .eq("provider_chat_id", providerChat)
    .single(),
);
let sends = 0;
const provider = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch() {
    sends++;
    return Response.json({ message_id: "confirmed-thirteen", chat_id: providerChat });
  },
});
process.env["SUPABASE_URL"] = "http://127.0.0.1:8001";
process.env["UNIPILE_API_KEY"] = "isolated-provider-key";
process.env["UNIPILE_API_BASE_URL"] = `http://127.0.0.1:${provider.port}`;
globalThis.fetch = ((url, init) => {
  const parsed = new URL(typeof url === "string" ? url : url instanceof URL ? url.href : url.url);
  assert.ok(
    parsed.hostname === "127.0.0.1" && ["8001", String(provider.port)].includes(parsed.port),
  );
  return localFetch(url, init);
}) as typeof fetch;
try {
  const { sendLinkedinChatReply } = await import("../../src/lib/unipile/client.server");
  const ctx = {
    accountId: linkedinAccount,
    ownerId: user(11),
    unipileAccountId: `fixture_${linkedinAccount}`,
  };
  const input = { chatId: providerChat, text: "Confirmed reply", requestKey: crypto.randomUUID() };
  await sendLinkedinChatReply(ctx, input);
  await sendLinkedinChatReply(ctx, input);
  assert.equal(sends, 1);
  assert.equal(
    (
      await api(
        "/rest/v1/rpc/linkedin_conversation_edit",
        "POST",
        { p_id: linkedin.id, p_status: "closed" },
        tokens.get(11),
      )
    ).status,
    204,
  );
  const occurrences = new Map<string, string>();
  const rows = must(
    await admin
      .from("inbox_channel_occurrences")
      .select("id,event_key")
      .in("conversation_id", [gmailCreated.conversation_id, chat, linkedin.id]),
  );
  for (const row of rows) occurrences.set(row.event_key, row.id);
  const checks = await checkThirteenReadBoundaries(api, occurrences, tokens);
  console.log(
    `${gmailChecks} Gmail checks + ${checks} real checks across thirteen producers and five GoTrue profiles; worker/dispatch certification remains separate; lock intact.`,
  );
} finally {
  globalThis.fetch = originalFetch;
  provider.stop(true);
}
