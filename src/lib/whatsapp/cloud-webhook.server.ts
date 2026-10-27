import { verifyMetaSignature } from "./cloud-api.server";

const MAX_BYTES = 4 * 1024 * 1024;
async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > MAX_BYTES) {
      await reader.cancel();
      throw new Error("body too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

/** A connection-specific capability: no payload can choose another tenant. */
export async function handleCloudWebhook(
  request: Request,
  connectionId: string,
): Promise<Response> {
  if (!/^[a-f0-9-]{36}$/i.test(connectionId)) return new Response("not found", { status: 404 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { decryptApiKey } = await import("@/lib/ai/provider-resolver.server");
  const admin = supabaseAdmin as any;
  const { data: connection, error } = await admin
    .from("wa_cloud_connections")
    .select("*")
    .eq("id", connectionId)
    .maybeSingle();
  if (error || !connection) return new Response("not found", { status: 404 });
  const secrets = JSON.parse(await decryptApiKey(connection.credentials_ciphertext));
  if (request.method === "GET") {
    const url = new URL(request.url);
    if (
      url.searchParams.get("hub.mode") !== "subscribe" ||
      url.searchParams.get("hub.verify_token") !== secrets.verifyToken
    )
      return new Response("forbidden", { status: 403 });
    const challenge = url.searchParams.get("hub.challenge");
    if (!challenge || challenge.length > 1024)
      return new Response("invalid challenge", { status: 400 });
    const saved = await admin
      .from("wa_cloud_connections")
      .update({ webhook_verified_at: new Date().toISOString() })
      .eq("id", connectionId);
    if (saved.error) return new Response("storage error", { status: 500 });
    return new Response(challenge, { headers: { "Content-Type": "text/plain" } });
  }
  if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
  let bytes: Uint8Array;
  try {
    bytes = await readBody(request);
  } catch {
    return new Response("payload too large", { status: 413 });
  }
  if (
    !(await verifyMetaSignature(
      bytes,
      request.headers.get("x-hub-signature-256"),
      secrets.appSecret,
    ))
  )
    return new Response("invalid signature", { status: 401 });
  let payload: any;
  try {
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return new Response("invalid payload", { status: 400 });
  }
  if (payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry))
    return new Response("invalid object", { status: 400 });
  const numbers = await admin
    .from("wa_cloud_numbers")
    .select("phone_number_id")
    .eq("connection_id", connectionId)
    .eq("workspace_id", connection.workspace_id)
    .eq("available", true);
  if (numbers.error) return new Response("storage error", { status: 500 });
  const allowed = new Set(numbers.data.map((number: any) => number.phone_number_id));
  const changes: any[] = [];
  for (const entry of payload.entry) {
    if (entry.id !== connection.waba_id) return new Response("account mismatch", { status: 403 });
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      if (!allowed.has(change.value?.metadata?.phone_number_id))
        return new Response("unknown number", { status: 403 });
      changes.push({ entry, change });
    }
  }
  const received = await admin
    .from("wa_cloud_connections")
    .update({ webhook_received_at: new Date().toISOString() })
    .eq("id", connectionId);
  if (received.error) return new Response("storage error", { status: 500 });
  const { processEvent } = await import("./webhook-processor.server");
  for (const { entry, change } of changes) {
    for (const kind of ["messages", "statuses"] as const) {
      if (!change.value[kind]?.length) continue;
      const value = {
        ...change.value,
        _verified_workspace_id: connection.workspace_id,
        messages: kind === "messages" ? change.value.messages : [],
        statuses: kind === "statuses" ? change.value.statuses : [],
      };
      const eventPayload = {
        object: payload.object,
        entry: [{ id: entry.id, changes: [{ field: "messages", value }] }],
      };
      const digest = new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(JSON.stringify(eventPayload)),
        ),
      );
      const deliveryId = `cloud:${connectionId}:${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      const event = kind === "messages" ? "whatsapp.message" : "whatsapp.status";
      const stored = await admin
        .from("whatsapp_webhook_events")
        .upsert(
          { delivery_id: deliveryId, event, payload: eventPayload },
          { onConflict: "delivery_id", ignoreDuplicates: true },
        );
      if (stored.error) return new Response("storage error", { status: 500 });
      const row = await admin
        .from("whatsapp_webhook_events")
        .select("id,event,payload,attempts,processed_at")
        .eq("delivery_id", deliveryId)
        .single();
      if (row.error) return new Response("storage error", { status: 500 });
      if (connection.enabled && !row.data.processed_at) await processEvent(admin, row.data);
    }
  }
  return new Response("ok");
}
