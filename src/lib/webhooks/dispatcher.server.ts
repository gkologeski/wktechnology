// Dispatcher de webhooks de saída + helper para enfileirar eventos.
// Segurança (ciclo 6): destino validado contra SSRF antes de cada envio (https, sem IP privado,
// DNS só público), redirecionamentos NÃO são seguidos, tempo limite por envio, assinatura com
// carimbo de tempo e id de evento estável para o receptor deduplicar. Nenhum cabeçalho de
// autorização do sistema é encaminhado.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertSafeWebhookUrl, dohResolver, UnsafeWebhookUrl, type Resolver } from "./url-guard";
import { legacySignature, signWebhook } from "./signing";

export async function enqueueWebhookEvent(
  workspaceId: string,
  ownerId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  if (!workspaceId) throw new Error("Evento sem workspace de origem.");
  const { data: hooks } = await supabaseAdmin
    .from("outbound_webhooks")
    .select("id, workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("owner_id", ownerId)
    .eq("active", true)
    .contains("events", [eventType]);
  if (!hooks || hooks.length === 0) return;
  if (hooks.some((h) => !h.workspace_id)) throw new Error("Webhook sem workspace de origem.");
  const rows = hooks.map((h) => ({
    workspace_id: workspaceId,
    owner_id: ownerId,
    webhook_id: h.id as string,
    event_type: eventType,
    payload: payload as never,
    status: "pending" as const,
    next_retry_at: new Date().toISOString(),
  }));
  await supabaseAdmin.from("webhook_deliveries").insert(rows);
}

/**
 * Eventos do TechProjects (`project.*`): vão para os webhooks do WORKSPACE que um administrador
 * cadastrou e assinou explicitamente para o evento (não só os do autor). Sem assinante = nada.
 * Falha ao enfileirar nunca interrompe a gravação de origem.
 */
export async function enqueueProjectEvent(
  workspaceId: string,
  eventType: `project.${string}`,
  payload: Record<string, unknown>,
) {
  try {
    if (!workspaceId) return;
    const { data: hooks } = await supabaseAdmin
      .from("outbound_webhooks")
      .select("id, owner_id, workspace_id")
      .eq("workspace_id", workspaceId)
      .eq("active", true)
      .contains("events", [eventType]);
    if (!hooks || hooks.length === 0) return;
    await supabaseAdmin.from("webhook_deliveries").insert(
      hooks.map((h) => ({
        workspace_id: workspaceId,
        owner_id: h.owner_id as string,
        webhook_id: h.id as string,
        event_type: eventType,
        payload: payload as never,
        status: "pending" as const,
        next_retry_at: new Date().toISOString(),
      })),
    );
  } catch (e) {
    console.warn(
      JSON.stringify({ evt: "webhook.enqueue_failed", eventType, error: (e as Error).message }),
    );
  }
}

const MAX_ATTEMPTS = 5;
const SEND_TIMEOUT_MS = 10_000;

type Delivery = {
  id: string;
  workspace_id: string | null;
  webhook_id: string | null;
  event_type: string | null;
  payload: unknown;
  attempt: number | null;
  event_id?: string | null;
};

/** Envia uma entrega já validada. Exportado para teste com receptor isolado. */
export async function sendWebhook(
  hook: { url: string; secret: string },
  d: Pick<Delivery, "event_type" | "payload" | "event_id" | "id">,
  opts: { resolve?: Resolver; fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<{ ok: boolean; status: number; text: string }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const nowS = Math.floor((opts.now?.() ?? Date.now()) / 1000);
  try {
    await assertSafeWebhookUrl(hook.url, opts.resolve ?? dohResolver);
  } catch (e) {
    const reason = e instanceof UnsafeWebhookUrl ? e.reason : "destino inválido";
    return { ok: false, status: 0, text: `blocked_destination: ${reason}` };
  }
  const eventId = d.event_id ?? d.id;
  const body = JSON.stringify({
    id: eventId,
    event: d.event_type,
    data: d.payload,
    timestamp: new Date(nowS * 1000).toISOString(),
  });
  try {
    const res = await fetchImpl(hook.url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "TechERP-Webhooks/1",
        "X-Webhook-Event": String(d.event_type),
        "X-Webhook-Signature": await legacySignature(hook.secret, body),
        "X-TechERP-Event-Id": String(eventId),
        "X-TechERP-Timestamp": String(nowS),
        "X-TechERP-Signature": await signWebhook(hook.secret, nowS, body),
      },
      body,
    });
    const text = (await res.text()).slice(0, 2000);
    if (res.status >= 300 && res.status < 400)
      return { ok: false, status: res.status, text: "redirect_not_followed" };
    return { ok: res.status >= 200 && res.status < 300, status: res.status, text };
  } catch (e) {
    return { ok: false, status: 0, text: (e as Error).message.slice(0, 2000) };
  }
}

export async function runWebhookDispatch() {
  const now = new Date().toISOString();
  const { data: pending } = await supabaseAdmin
    .from("webhook_deliveries")
    .select("id, workspace_id, webhook_id, event_type, payload, attempt, event_id")
    .in("status", ["pending", "failed"])
    .lte("next_retry_at", now)
    .order("created_at", { ascending: true })
    .limit(50);
  if (!pending || pending.length === 0) return { processed: 0 };

  let processed = 0;
  for (const d of pending as Delivery[]) {
    if (!d.workspace_id) throw new Error("Entrega sem workspace de origem.");
    const { data: hook } = await supabaseAdmin
      .from("outbound_webhooks")
      .select("url, secret, active")
      .eq("workspace_id", d.workspace_id)
      .eq("id", d.webhook_id as string)
      .maybeSingle();
    if (!hook || !hook.active) {
      await supabaseAdmin
        .from("webhook_deliveries")
        .update({ status: "dead" })
        .eq("id", d.id as string);
      continue;
    }
    const r = await sendWebhook({ url: hook.url as string, secret: hook.secret as string }, d);
    const attempt = ((d.attempt as number) ?? 0) + 1;
    // Destino bloqueado não melhora com nova tentativa: vai direto para "dead".
    const blocked = r.text.startsWith("blocked_destination");
    const newStatus = r.ok ? "success" : blocked || attempt >= MAX_ATTEMPTS ? "dead" : "failed";
    const backoffMin = Math.min(60, Math.pow(2, attempt));
    await supabaseAdmin
      .from("webhook_deliveries")
      .update({
        attempt,
        status: newStatus,
        response_status: r.status || null,
        response_body: r.text,
        next_retry_at:
          r.ok || newStatus === "dead"
            ? null
            : new Date(Date.now() + backoffMin * 60_000).toISOString(),
        delivered_at: r.ok ? new Date().toISOString() : null,
      })
      .eq("id", d.id as string);
    processed++;
  }
  return { processed };
}
