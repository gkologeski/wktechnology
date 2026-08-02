// Engine de envio de campanhas de email (broadcast).
// - resolveRecipients: materializa destinatários a partir de segment (lead|contact) ou lista manual,
//   aplicando supressão por email_unsubscribes.
// - tickEmailBroadcasts: processa broadcasts agendados respeitando rate_per_minute por owner.
// Usado por server fns (autenticadas) e pelo endpoint público /api/public/hooks/email-broadcast-tick.
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildRawMime,
  ensureAccessToken,
  gmailSendRaw,
  type EmailAccountRow,
} from "@/lib/gmail.server";

type Json = Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

async function getGmailAccount(
  ownerId: string,
  accountId: string | null,
): Promise<EmailAccountRow | null> {
  let q = admin
    .from("email_accounts")
    .select("id, owner_id, email, access_token, refresh_token, expires_at, status, history_id")
    .eq("owner_id", ownerId)
    .eq("provider", "gmail")
    .eq("status", "connected");
  if (accountId) q = q.eq("id", accountId);
  const { data } = await q.order("created_at", { ascending: false }).limit(1);
  return (data?.[0] as EmailAccountRow | undefined) ?? null;
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

function buildUnsubscribeLink(token: string, baseUrl: string) {
  return `${baseUrl}/api/public/email/unsubscribe/${token}`;
}

function appendUnsubFooter(
  html: string | null | undefined,
  text: string | null | undefined,
  unsubUrl: string,
) {
  const safeHtml = (html ?? "").trim();
  const safeText = (text ?? "").trim();
  const footerHtml = `<hr style="margin-top:32px;border:none;border-top:1px solid #eaeaea"/><p style="color:#888;font-size:12px;margin-top:12px">Não quer mais receber estes emails? <a href="${unsubUrl}">Cancelar inscrição</a>.</p>`;
  const footerText = `\n\n---\nPara cancelar inscrição: ${unsubUrl}`;
  return {
    html: safeHtml ? `${safeHtml}${footerHtml}` : `<p></p>${footerHtml}`,
    text: `${safeText}${footerText}`,
  };
}

export async function resolveBroadcastRecipients(
  broadcastId: string,
): Promise<{ added: number; skipped: number }> {
  const { data: b, error: bErr } = await admin
    .from("email_broadcasts")
    .select("id, owner_id, segment_id")
    .eq("id", broadcastId)
    .single();
  if (bErr || !b) throw new Error(bErr?.message ?? "Broadcast não encontrado");

  // limpar existentes pendentes
  await admin.from("email_broadcast_recipients").delete().eq("broadcast_id", broadcastId);

  const list: Array<{
    email: string;
    name: string | null;
    contact_id: string | null;
    lead_id: string | null;
    variables: Json;
  }> = [];

  if (b.segment_id) {
    const { data: seg } = await admin
      .from("segments")
      .select("id, entity")
      .eq("id", b.segment_id)
      .single();
    if (!seg) throw new Error("Segmento não encontrado");
    if (
      seg.entity !== "lead" &&
      seg.entity !== "contact" &&
      seg.entity !== "leads" &&
      seg.entity !== "contacts"
    ) {
      throw new Error("Segmento deve ser de leads ou contatos");
    }
    const { data: members } = await admin
      .from("segment_members")
      .select("entity_id")
      .eq("segment_id", b.segment_id)
      .limit(50000);
    const ids = (members ?? []).map((m: { entity_id: string }) => m.entity_id);
    if (ids.length > 0) {
      const isLead = seg.entity === "lead" || seg.entity === "leads";
      const table = isLead ? "leads" : "contacts";
      const { data: rows } = await admin
        .from(table)
        .select("id, first_name, last_name, email, company_name")
        .in("id", ids)
        .eq("owner_id", b.owner_id);
      for (const r of (rows ?? []) as Array<Record<string, unknown>>) {
        const email = (r.email as string | null) ?? null;
        if (!email) continue;
        const first = (r.first_name as string) ?? "";
        const last = (r.last_name as string) ?? "";
        const name = `${first} ${last}`.trim() || null;
        list.push({
          email,
          name,
          contact_id: isLead ? null : (r.id as string),
          lead_id: isLead ? (r.id as string) : null,
          variables: {
            first_name: first,
            last_name: last,
            full_name: name ?? "",
            email,
            company_name: (r.company_name as string) ?? "",
          },
        });
      }
    }
  }

  // supressão por unsubscribes
  const { data: unsubs } = await admin
    .from("email_unsubscribes")
    .select("email")
    .eq("owner_id", b.owner_id);
  const blocked = new Set((unsubs ?? []).map((u: { email: string }) => u.email.toLowerCase()));

  // dedupe por email
  const seen = new Set<string>();
  const rows = [] as Array<{
    broadcast_id: string;
    owner_id: string;
    email: string;
    name: string | null;
    contact_id: string | null;
    lead_id: string | null;
    variables: Json;
    status: "pending" | "unsubscribed";
  }>;
  let skipped = 0;
  for (const r of list) {
    const k = r.email.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    const status: "pending" | "unsubscribed" = blocked.has(k) ? "unsubscribed" : "pending";
    if (status === "unsubscribed") skipped++;
    rows.push({
      broadcast_id: broadcastId,
      owner_id: b.owner_id,
      email: r.email,
      name: r.name,
      contact_id: r.contact_id,
      lead_id: r.lead_id,
      variables: r.variables,
      status,
    });
  }

  for (let i = 0; i < rows.length; i += 500) {
    const slice = rows.slice(i, i + 500);
    const { error } = await admin.from("email_broadcast_recipients").insert(slice);
    if (error) throw error;
  }
  await admin.from("email_broadcasts").update({ total: rows.length }).eq("id", broadcastId);

  return { added: rows.filter((r) => r.status === "pending").length, skipped };
}

async function ensureUnsubToken(ownerId: string, email: string): Promise<string> {
  const { data: existing } = await admin
    .from("email_unsubscribes")
    .select("token")
    .eq("owner_id", ownerId)
    .eq("email", email)
    .maybeSingle();
  if (existing?.token) return existing.token as string;
  // Não criamos linha ainda — geramos token "virtual": tabela só recebe ao clicar.
  // Para link estável, criamos uma linha auxiliar com flag opt-out null? Mantemos simples:
  // gerar token aqui e gravar quando usuário clicar (fluxo via /api/public/email/unsubscribe usa email+owner via tabela auxiliar).
  // Para simplicidade: token = hex(owner|email) determinístico — mas seria reversível.
  // Solução: tabela `email_unsubscribe_tokens` separada? Já temos a tabela unsubscribes com token único.
  // Gravamos linha com reason=null marcando "pending_token" para reservar token sem opt-out:
  // Para evitar opt-out automático, usamos flag — porém a tabela atual não tem.
  // Pragmático: criar linha com reason='__token__'; tratá-la como ativa apenas se reason != '__token__'.
  const token = randomUUID().replace(/-/g, "");
  const { error } = await admin
    .from("email_unsubscribes")
    .insert({ owner_id: ownerId, email, token, reason: "__token__" });
  if (error) {
    // race: outra inserção criou — buscar de novo
    const { data: re } = await admin
      .from("email_unsubscribes")
      .select("token")
      .eq("owner_id", ownerId)
      .eq("email", email)
      .maybeSingle();
    if (re?.token) return re.token as string;
    throw error;
  }
  return token;
}

export async function tickEmailBroadcasts(
  limit = 5,
): Promise<{ processed: number; sent: number; failed: number }> {
  const nowIso = new Date().toISOString();
  const { data: due, error } = await admin
    .from("email_broadcasts")
    .select("id")
    .in("status", ["scheduled", "running"])
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  let processed = 0,
    sent = 0,
    failed = 0;
  for (const b of (due ?? []) as { id: string }[]) {
    const r = await processBroadcast(b.id).catch((e) => {
      console.error("[email-broadcast-tick]", b.id, e);
      return { sent: 0, failed: 0 };
    });
    processed++;
    sent += r.sent;
    failed += r.failed;
  }
  return { processed, sent, failed };
}

async function processBroadcast(broadcastId: string): Promise<{ sent: number; failed: number }> {
  const { data: b, error: bErr } = await admin
    .from("email_broadcasts")
    .select("*")
    .eq("id", broadcastId)
    .single();
  if (bErr || !b) throw new Error(bErr?.message ?? "broadcast não encontrado");

  if (b.status === "scheduled") {
    await admin
      .from("email_broadcasts")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", b.id);
  }

  const account = await getGmailAccount(b.owner_id, b.email_account_id);
  if (!account) {
    await admin
      .from("email_broadcasts")
      .update({
        status: "failed",
        last_error: "Nenhuma conta Gmail conectada",
        finished_at: new Date().toISOString(),
      })
      .eq("id", b.id);
    return { sent: 0, failed: 0 };
  }

  const batchSize = Math.max(1, Math.min(60, Number(b.rate_per_minute ?? 30)));
  const { data: recips } = await admin
    .from("email_broadcast_recipients")
    .select("id, email, name, variables")
    .eq("broadcast_id", b.id)
    .eq("status", "pending")
    .limit(batchSize);

  const list = (recips ?? []) as Array<{
    id: string;
    email: string;
    name: string | null;
    variables: Record<string, string>;
  }>;
  if (list.length === 0) {
    // verifica se ainda há pendentes
    const { count } = await admin
      .from("email_broadcast_recipients")
      .select("id", { count: "exact", head: true })
      .eq("broadcast_id", b.id)
      .eq("status", "pending");
    if (!count) {
      await admin
        .from("email_broadcasts")
        .update({ status: "completed", finished_at: new Date().toISOString() })
        .eq("id", b.id);
    }
    return { sent: 0, failed: 0 };
  }

  const baseUrl =
    process.env.PUBLIC_APP_URL ||
    "https://project--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app";

  let accessToken: string;
  try {
    accessToken = await ensureAccessToken(account);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin
      .from("email_broadcasts")
      .update({ status: "failed", last_error: msg, finished_at: new Date().toISOString() })
      .eq("id", b.id);
    return { sent: 0, failed: 0 };
  }

  let sent = 0,
    failed = 0;
  for (const r of list) {
    try {
      const base = (r.variables ?? {}) as Record<string, string>;
      // `company` é alias de `company_name` para templates antigos.
      const vars = {
        ...base,
        name: r.name ?? "",
        company: base["company"] ?? base["company_name"] ?? "",
      };
      const subject = renderTemplate(b.subject ?? "", vars);
      const htmlRaw = renderTemplate(b.body_html ?? "", vars);
      const textRaw = renderTemplate(b.body_text ?? "", vars);
      const token = await ensureUnsubToken(b.owner_id, r.email);
      const unsubUrl = buildUnsubscribeLink(token, baseUrl);
      const merged = appendUnsubFooter(htmlRaw, textRaw, unsubUrl);
      const raw = buildRawMime({
        from: account.email,
        to: [r.email],
        subject,
        bodyHtml: merged.html,
        bodyText: merged.text,
      });
      // header List-Unsubscribe via injeção manual no RAW (prefix antes do final headers)
      const rawWithUnsub = raw.replace(
        "MIME-Version: 1.0\r\n",
        `MIME-Version: 1.0\r\nList-Unsubscribe: <${unsubUrl}>\r\nList-Unsubscribe-Post: List-Unsubscribe=One-Click\r\n`,
      );
      await gmailSendRaw(accessToken, rawWithUnsub);
      await admin
        .from("email_broadcast_recipients")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", r.id);
      sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin
        .from("email_broadcast_recipients")
        .update({ status: "failed", error: msg.slice(0, 500) })
        .eq("id", r.id);
      failed++;
    }
  }

  // atualizar contadores
  const { count: sentCount } = await admin
    .from("email_broadcast_recipients")
    .select("id", { count: "exact", head: true })
    .eq("broadcast_id", b.id)
    .eq("status", "sent");
  const { count: failCount } = await admin
    .from("email_broadcast_recipients")
    .select("id", { count: "exact", head: true })
    .eq("broadcast_id", b.id)
    .eq("status", "failed");
  const { count: pendingCount } = await admin
    .from("email_broadcast_recipients")
    .select("id", { count: "exact", head: true })
    .eq("broadcast_id", b.id)
    .eq("status", "pending");

  const patch: Record<string, unknown> = { sent: sentCount ?? 0, failed: failCount ?? 0 };
  if ((pendingCount ?? 0) === 0) {
    patch.status = "completed";
    patch.finished_at = new Date().toISOString();
  }
  await admin.from("email_broadcasts").update(patch).eq("id", b.id);

  return { sent, failed };
}

export async function recordUnsubscribe(
  token: string,
  reason?: string,
): Promise<{ email: string } | null> {
  const { data: row } = await admin
    .from("email_unsubscribes")
    .select("id, owner_id, email")
    .eq("token", token)
    .maybeSingle();
  if (!row) return null;
  await admin
    .from("email_unsubscribes")
    .update({ reason: reason ?? "user_requested" })
    .eq("id", row.id);
  // marca recipients pendentes desse email como unsubscribed
  await admin
    .from("email_broadcast_recipients")
    .update({ status: "unsubscribed" })
    .eq("owner_id", row.owner_id)
    .ilike("email", row.email)
    .eq("status", "pending");
  return { email: row.email as string };
}
