import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import {
  assertDisposableInboxTarget,
  loadDisposableInboxFixtures,
} from "../../tests/fixtures/inbox/load";
assertDisposableInboxTarget(process.env, process.argv);
loadDisposableInboxFixtures("unipile");
const fixture = spawnSync(
  "psql",
  [
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "--single-transaction",
    "-f",
    "tests/fixtures/inbox/unipile-response.sql",
  ],
  { encoding: "utf8" },
);
if (fixture.status !== 0)
  throw new Error("Disposable sender fixture failed; private output withheld.");
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!key) throw new Error("Disposable service credential missing.");
const originalFetch = globalThis.fetch;
const admin = createClient("http://127.0.0.1:8001", key, {
  auth: { persistSession: false },
  global: {
    fetch: (url, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
        headers.delete("Authorization");
      headers.set("apikey", key);
      return originalFetch(url, { ...init, headers });
    },
  },
});
const workspace = "fa110000-0000-4000-8000-000000000001";
const actor = "fb110000-0000-4000-8000-000000000001";
let checks = 0,
  sends = 0;
const equal = (a: unknown, b: unknown) => {
  assert.deepEqual(a, b);
  checks++;
};
const must = <T>(r: { data: T; error: unknown }) => {
  equal(r.error, null);
  return r.data;
};
// A real HTTP transport with synthetic, local-only credentials and receipts.
const provider = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    equal(request.headers.get("X-API-KEY"), "isolated-provider-key");
    const body = (await request.json()) as { text: string };
    equal(body.text, "Confirmed LinkedIn reply");
    sends++;
    const chat = new URL(request.url).pathname.split("/").at(-3);
    return Response.json({ message_id: `confirmed_${crypto.randomUUID()}`, chat_id: chat });
  },
});
process.env["SUPABASE_URL"] = "http://127.0.0.1:8001";
process.env["UNIPILE_API_BASE_URL"] = `http://127.0.0.1:${provider.port}`;
process.env["UNIPILE_API_KEY"] = "isolated-provider-key";
globalThis.fetch = ((url, init) => {
  const parsed = new URL(typeof url === "string" ? url : url instanceof URL ? url.href : url.url);
  assert.ok(
    parsed.hostname === "127.0.0.1" && ["8001", String(provider.port)].includes(parsed.port),
    "Transport tests cannot leave their local fixture",
  );
  if (parsed.port === "8001") {
    const headers = new Headers(init?.headers);
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
      headers.delete("Authorization");
    return originalFetch(url, { ...init, headers });
  }
  return originalFetch(url, init);
}) as typeof fetch;
try {
  const { sendLinkedinChatReply } = await import("../../src/lib/unipile/client.server");
  const { readServiceLinkedinAcceptance } = await import("../../src/lib/inbox-transport.server");
  must(await admin.from("profiles").update({ active_workspace_id: workspace }).eq("id", actor));
  for (const kind of ["human", "sdr", "sequence"] as const) {
    const account = crypto.randomUUID(),
      chat = `chat_${crypto.randomUUID()}`;
    must(
      await admin.from("unipile_accounts").insert({
        id: account,
        workspace_id: workspace,
        owner_id: actor,
        unipile_account_id: `fixture_${account}`,
        status: "connected",
        daily_window: { tz: "UTC", start_hour: 0, end_hour: 24 },
      }),
    );
    const args = {
      p_account: account,
      p_chat: chat,
      p_message: `in_${crypto.randomUUID()}`,
      p_sender: "fixture-visitor",
      p_body: "Real signed incremental input",
      p_envelope_hash: createHash("sha256").update(chat).digest("hex"),
      p_occurred: new Date(Date.now() - 1000).toISOString(),
      p_live: true,
      p_self: false,
    };
    must(await admin.rpc("unipile_signed_inbound_commit", args));
    must(await admin.rpc("unipile_signed_inbound_commit", args));
    const conversation = must(
      await admin
        .from("linkedin_conversations")
        .select("id")
        .eq("account_id", account)
        .eq("provider_chat_id", chat)
        .single(),
    );
    const before = must(
      await admin
        .from("inbox_channel_occurrences")
        .select("event_key")
        .eq("conversation_id", conversation.id),
    );
    equal(before.map((r) => r.event_key).sort(), [
      "shared.linkedin.conversation_created",
      "shared.linkedin.message_received",
    ]);
    const job = crypto.randomUUID();
    const attempt = `${kind}:${job}`;
    const ctx = { accountId: account, ownerId: actor, unipileAccountId: `fixture_${account}` };
    const input = { chatId: chat, text: "Confirmed LinkedIn reply", requestKey: attempt };
    const beforeSends = sends;
    const first = await sendLinkedinChatReply(ctx, input);
    const retry = await sendLinkedinChatReply(ctx, input);
    equal(retry, first);
    equal(sends - beforeSends, 1);
    const after = must(
      await admin
        .from("inbox_channel_occurrences")
        .select("event_key")
        .eq("conversation_id", conversation.id)
        .eq("event_key", "shared.linkedin.first_response"),
    );
    equal(after.length, 1);
    await assert.rejects(sendLinkedinChatReply(ctx, { ...input, text: "Divergent" }), /divergente/);
    checks++;
    await assert.rejects(sendLinkedinChatReply(ctx, { ...input, chatId: "another" }), /divergente/);
    checks++;
    await assert.rejects(
      sendLinkedinChatReply(ctx, {
        ...input,
        attachments: [{ filename: "file", content_type: "text/plain", data: "different" }],
      }),
      /divergente/,
    );
    checks++;
    equal(sends - beforeSends, 1);
    if (kind === "sdr")
      equal(
        await readServiceLinkedinAcceptance(admin, {
          workspace,
          conversation: conversation.id,
          job,
          body: input.text,
        }),
        (first as { message_id: string }).message_id,
      );
    // A new attempt is independent but must still obey the real account cadence.
    await assert.rejects(
      sendLinkedinChatReply(ctx, { ...input, requestKey: `new:${job}` }),
      /interval|rate|Reserva|spacing|outbound/i,
    );
    checks++;
    equal(sends - beforeSends, 1);
  }
  console.log(
    `${checks} real LinkedIn transport checks passed; ${sends} local-only HTTP sends; no release lock removal.`,
  );
} finally {
  globalThis.fetch = originalFetch;
  provider.stop(true);
}
