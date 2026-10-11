// Synthetic notes/conversations only, guarded by marker, local URL and fixed fixture IDs.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../.techerp-isolated.local");
if (readFileSync(resolve(root, ".isolation-marker"), "utf8").trim() !== "techerp-empty-local-v1")
  throw new Error("Invalid marker");
const status = JSON.parse(readFileSync(resolve(root, "status.private.json"), "utf8"));
if (status.API_URL !== "http://127.0.0.1:54321") throw new Error("Non-local endpoint refused");
const { createClient } = await import(
  resolve(root, "node_modules/@supabase/supabase-js/dist/index.mjs")
);
const client = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const id = "72000000-0000-4000-8000-000000000011",
  lead = "50000000-0000-4000-8000-0000000000a1",
  ws = "aaaaaaaa-0000-4000-8000-00000000000a";
const guard = await client
  .from("leads")
  .select("workspace_id,first_name,last_name")
  .eq("id", lead)
  .single();
if (guard.error || guard.data.workspace_id !== ws || guard.data.last_name !== "Fixture")
  throw new Error("Synthetic entity absent");
const op = process.argv[2];
let result;
if (op === "chat-event") {
  result = await client.from("chat_messages").upsert(
    {
      id: "76000000-0000-4000-8000-000000000013",
      conversation_id: "59000000-0000-4000-8000-0000000000a1",
      workspace_owner_id: ws,
      sender_user_id: "10000000-0000-4000-8000-000000000007",
      body: "[ISO] Chat chegou sem recarregar",
    },
    { onConflict: "id" },
  );
} else if (op === "property-event") {
  result = await client.from("property_history").upsert(
    {
      id: "77000000-0000-4000-8000-000000000013",
      workspace_id: ws,
      owner_id: "10000000-0000-4000-8000-000000000002",
      entity: "leads",
      entity_id: lead,
      property: "last_name",
      old_value: "Fixture",
      new_value: "[ISO] Histórico visual ciclo 13",
    },
    { onConflict: "id" },
  );
} else if (op === "email-event") {
  const sequence = Number(process.argv[3] ?? 1);
  if (![1, 2, 3].includes(sequence)) throw new Error("Unsupported email sequence");
  const subject = `[ISO] E-mail evento visual ${sequence}`;
  const thread = "55000000-0000-4000-8000-0000000000a2";
  result = await client.from("email_messages").upsert(
    {
      id: `75000000-0000-4000-8000-00000000001${sequence}`,
      workspace_id: ws,
      owner_id: "10000000-0000-4000-8000-000000000002",
      account_id: "54000000-0000-4000-8000-0000000000a2",
      thread_id: thread,
      provider_message_id: `iso-cycle13-ui-${sequence}`,
      direction: "inbound",
      subject,
      body_text: "[ISO] Mensagem de teste recebida sem recarregar",
    },
    { onConflict: "id" },
  );
  if (result.error) throw result.error;
  const count = await client
    .from("email_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", thread);
  if (count.error) throw count.error;
  result = await client
    .from("email_threads")
    .update({
      subject,
      snippet: "[ISO] Mensagem de teste recebida sem recarregar",
      message_count: count.count,
      last_message_at: new Date().toISOString(),
    })
    .eq("id", thread)
    .eq("workspace_id", ws);
} else if (op === "module-branding") {
  const color = process.argv[3];
  if (!["#a17351", "reset"].includes(color)) throw new Error("Unsupported module test color");
  result = await client
    .from("module_branding")
    .update({
      theme: color === "reset" ? {} : { light: { primary: color }, dark: { primary: color } },
    })
    .eq("workspace_id", ws)
    .eq("module_id", "crm");
} else if (op === "branding") {
  const color = process.argv[3];
  if (!["#5173a1", "#111111"].includes(color)) throw new Error("Unsupported test color");
  result = await client
    .from("workspace_branding")
    .update({ primary_color: color })
    .eq("workspace_id", ws);
} else if (op === "conversation") {
  const conversation = "57000000-0000-4000-8000-0000000000a2";
  const check = await client
    .from("whatsapp_conversations")
    .select("workspace_id,contact_phone")
    .eq("id", conversation)
    .single();
  if (
    check.error ||
    check.data.workspace_id !== ws ||
    check.data.contact_phone !== "+5500000000001"
  )
    throw new Error("Synthetic conversation absent");
  const start = Date.now() - 201000;
  const rows = Array.from({ length: 200 }, (_, i) => ({
    id: `73000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    workspace_id: ws,
    owner_id: "10000000-0000-4000-8000-000000000002",
    conversation_id: conversation,
    direction: "inbound",
    from_number: "+5500000000001",
    to_number: "+5500000000999",
    body: `[ISO] Histórico ${String(i + 1).padStart(3, "0")}`,
    created_at: new Date(start + i * 1000).toISOString(),
  }));
  result = await client.from("whatsapp_messages").upsert(rows, { onConflict: "id" });
  if (result.error) throw result.error;
  result = await client.from("whatsapp_conversations").upsert(
    {
      id: "73100000-0000-4000-8000-000000000001",
      workspace_id: ws,
      owner_id: "10000000-0000-4000-8000-000000000002",
      contact_phone: "+5500000010102",
      twilio_number: "+5500000000999",
      last_message_preview: "[ISO] Segunda conversa",
      last_message_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
} else if (op === "append-message") {
  const sequence = Number(process.argv[3] ?? 201);
  if (![201, 202].includes(sequence)) throw new Error("Unsupported synthetic message");
  result = await client.from("whatsapp_messages").insert({
    id: `73000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    workspace_id: ws,
    owner_id: "10000000-0000-4000-8000-000000000002",
    conversation_id: "57000000-0000-4000-8000-0000000000a2",
    direction: "inbound",
    from_number: "+5500000000001",
    to_number: "+5500000000999",
    body: `[ISO] Nova mensagem ${sequence}`,
  });
} else if (op === "login-b") {
  const file = resolve(root, "app-accounts.private.json");
  const accounts = JSON.parse(readFileSync(file, "utf8"));
  const account = accounts.find((a) => a.email === "admin-b@techerp-test.invalid") ?? {
    id: "10000000-0000-4000-8000-000000000006",
    email: "admin-b@techerp-test.invalid",
    password: randomBytes(24).toString("base64url"),
  };
  if (account.id !== "10000000-0000-4000-8000-000000000006") throw new Error("Invalid B account");
  const existing = await client.auth.admin.getUserById(account.id);
  if (existing.data.user?.email !== account.email) throw new Error("Unexpected B user");
  result = await client.auth.admin.updateUserById(account.id, { password: account.password });
  if (result.error) throw result.error;
  if (!accounts.some((a) => a.id === account.id)) accounts.push(account);
  writeFileSync(file, JSON.stringify(accounts), { mode: 0o600 });
} else if (op === "login" || op === "login-admin") {
  const accounts = JSON.parse(readFileSync(resolve(root, "app-accounts.private.json"), "utf8"));
  const account = accounts.find(
    (a) =>
      a.email ===
      (op === "login-admin" ? "admin-a@techerp-test.invalid" : "own-a@techerp-test.invalid"),
  );
  if (
    account?.id !==
      (op === "login-admin"
        ? "10000000-0000-4000-8000-000000000001"
        : "10000000-0000-4000-8000-000000000002") ||
    account.password.length < 24
  )
    throw new Error("Invalid synthetic account");
  const existing = await client.auth.admin.getUserById(account.id);
  if (existing.data.user?.email !== account.email) throw new Error("Unexpected user");
  result = await client.auth.admin.updateUserById(account.id, { password: account.password });
} else if (op === "insert")
  result = await client.from("activities").insert({
    id,
    workspace_id: ws,
    owner_id: "10000000-0000-4000-8000-000000000002",
    related_lead_id: lead,
    type: "note",
    subject: "[ISO] Ciclo 11 realtime",
    body: "Registro descartável para validar atualização visual.",
  });
else if (op === "update")
  result = await client
    .from("activities")
    .update({ subject: "[ISO] Ciclo 11 atualizado" })
    .eq("id", id)
    .eq("workspace_id", ws)
    .eq("related_lead_id", lead);
else if (op === "delete")
  result = await client
    .from("activities")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ws)
    .eq("related_lead_id", lead);
else throw new Error("Use insert|update|delete|conversation|login");
if (result.error) throw result.error;
const check = await client.from("activities").select("id,subject").eq("id", id);
if (check.error) throw check.error;
writeFileSync(
  resolve(root, `artifacts/ui-fixture-${op}.json`),
  JSON.stringify({ at: new Date().toISOString(), operation: op, rows: check.data }, null, 2),
);
console.log(`Local fixture ${op}: confirmed (${check.data.length} rows).`);
