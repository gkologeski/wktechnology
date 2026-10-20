// Agregação do painel de campanhas com o cliente do usuário (RLS/RBAC valem).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { mergeSteps, step, summarizeBlocks } from "./campaign-funnel.logic";
import type { CampaignDay, CampaignFunnelData, CampaignRank } from "./campaign-funnel.types";

type Sb = SupabaseClient<Database>;
const CHUNK = 200;
const LIMIT = 20000;

function chunks<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += CHUNK) out.push(arr.slice(i, i + CHUNK));
  return out;
}
function dayKey(iso: string) {
  return new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 10);
}

export async function loadCampaignFunnel(
  sb: Sb,
  workspaceId: string,
  input: { from: string; to: string; ownerId: string | null },
): Promise<CampaignFunnelData> {
  const { from, to, ownerId } = input;
  const span = Date.parse(to) - Date.parse(from);
  const prevFrom = new Date(Date.parse(from) - span).toISOString();

  // Campanhas do workspace (escopo opcional por responsável).
  let waQ = sb.from("whatsapp_campaigns").select("id,name").eq("workspace_id", workspaceId);
  let emQ = sb.from("email_broadcasts").select("id,name").eq("workspace_id", workspaceId);
  if (ownerId) {
    waQ = waQ.eq("owner_id", ownerId);
    emQ = emQ.eq("owner_id", ownerId);
  }
  const [waC, emC] = await Promise.all([waQ.limit(2000), emQ.limit(2000)]);
  if (waC.error) throw new Error(waC.error.message);
  if (emC.error) throw new Error(emC.error.message);
  const waIds = (waC.data ?? []).map((c) => c.id);
  const emIds = (emC.data ?? []).map((c) => c.id);

  type WaR = {
    campaign_id: string;
    status: string;
    error: string | null;
    sent_at: string | null;
    created_at: string;
    wa_message_id: string | null;
  };
  type EmR = {
    broadcast_id: string;
    status: string;
    error: string | null;
    sent_at: string | null;
    created_at: string;
  };
  const waRows: WaR[] = [];
  const emRows: EmR[] = [];
  let previousSent = 0;

  for (const ids of chunks(waIds)) {
    const r = await sb
      .from("whatsapp_campaign_recipients")
      .select("campaign_id,status,error,sent_at,created_at,wa_message_id")
      .in("campaign_id", ids)
      .gte("created_at", prevFrom)
      .lte("created_at", to)
      .limit(LIMIT);
    if (r.error) throw new Error(r.error.message);
    waRows.push(...(r.data as WaR[]));
  }
  for (const ids of chunks(emIds)) {
    const r = await sb
      .from("email_broadcast_recipients")
      .select("broadcast_id,status,error,sent_at,created_at")
      .in("broadcast_id", ids)
      .gte("created_at", prevFrom)
      .lte("created_at", to)
      .limit(LIMIT);
    if (r.error) throw new Error(r.error.message);
    emRows.push(...(r.data as EmR[]));
  }

  const inRange = (iso: string | null) => !!iso && iso >= from && iso <= to;
  const inPrev = (iso: string | null) => !!iso && iso >= prevFrom && iso < from;
  previousSent =
    waRows.filter((r) => r.status === "sent" && inPrev(r.sent_at)).length +
    emRows.filter((r) => r.status === "sent" && inPrev(r.sent_at)).length;

  const waSent = waRows.filter((r) => r.status === "sent" && inRange(r.sent_at));
  const emSent = emRows.filter((r) => r.status === "sent" && inRange(r.sent_at));
  const waNot = waRows.filter(
    (r) => r.status !== "sent" && r.status !== "pending" && inRange(r.created_at),
  );
  const emNot = emRows.filter(
    (r) => r.status !== "sent" && r.status !== "pending" && inRange(r.created_at),
  );

  // Entrega/leitura pelas mensagens do WhatsApp.
  let waDelivered = 0;
  let waRead = 0;
  const msgIds = waSent.map((r) => r.wa_message_id).filter((v): v is string => !!v);
  for (const ids of chunks(msgIds)) {
    const r = await sb
      .from("whatsapp_messages")
      .select("status,delivered_at,read_at")
      .in("wa_message_id", ids);
    if (r.error) throw new Error(r.error.message);
    for (const m of r.data ?? []) {
      const read = m.status === "read" || !!m.read_at;
      if (read || m.status === "delivered" || m.delivered_at) waDelivered++;
      if (read) waRead++;
    }
  }

  // Conversas originadas pelas campanhas no período.
  type Conv = {
    id: string;
    origin_campaign_id: string | null;
    ai_owner: string | null;
    last_inbound_at: string | null;
    created_at: string;
  };
  const convs: Conv[] = [];
  for (const ids of chunks(waIds)) {
    const r = await sb
      .from("whatsapp_conversations")
      .select("id,origin_campaign_id,ai_owner,last_inbound_at,created_at")
      .in("origin_campaign_id", ids)
      .gte("created_at", from)
      .lte("created_at", to)
      .limit(LIMIT);
    if (r.error) throw new Error(r.error.message);
    convs.push(...(r.data as Conv[]));
  }
  const replied = convs.filter((c) => !!c.last_inbound_at);
  const human = convs.filter((c) => c.ai_owner === "human" || c.ai_owner === "paused");

  type Mt = { conversation_id: string | null; deal_id: string | null; status: string };
  const meetings: Mt[] = [];
  for (const ids of chunks(convs.map((c) => c.id))) {
    const r = await sb
      .from("sdr_meetings")
      .select("conversation_id,deal_id,status")
      .in("conversation_id", ids);
    if (r.error) throw new Error(r.error.message);
    meetings.push(
      ...((r.data as Mt[]) ?? []).filter(
        (m) => m.status !== "canceled" && m.status !== "cancelled",
      ),
    );
  }

  // Respostas por dia (mensagens recebidas nas conversas de campanha).
  const replyDays = new Map<string, number>();
  for (const ids of chunks(convs.map((c) => c.id))) {
    const r = await sb
      .from("whatsapp_messages")
      .select("created_at")
      .in("conversation_id", ids)
      .eq("direction", "inbound")
      .gte("created_at", from)
      .lte("created_at", to)
      .limit(LIMIT);
    if (r.error) throw new Error(r.error.message);
    for (const m of r.data ?? [])
      replyDays.set(dayKey(m.created_at), (replyDays.get(dayKey(m.created_at)) ?? 0) + 1);
  }

  const waSteps = [
    step("sent", "Disparado", waSent.length),
    step("delivered", "Entregue", waDelivered),
    step("read", "Lido / aberto", waRead),
    step("replied", "Respondido", replied.length),
    step("human", "Passado a humano", human.length),
    step("meeting", "Reunião agendada", meetings.length),
    step("deal", "Negócio criado", meetings.filter((m) => m.deal_id).length, "partial"),
  ];
  const emSteps = [
    step("sent", "Disparado", emSent.length),
    step("delivered", "Entregue", null),
    step("read", "Lido / aberto", null),
    step("replied", "Respondido", null),
    step("human", "Passado a humano", null),
    step("meeting", "Reunião agendada", null),
    step("deal", "Negócio criado", null),
  ];

  // Série diária.
  const days: CampaignDay[] = [];
  const start = new Date(dayKey(from) + "T12:00:00Z");
  const end = new Date(dayKey(to) + "T12:00:00Z");
  const byDay = new Map<string, CampaignDay>();
  for (let d = start; d <= end && days.length < 120; d = new Date(d.getTime() + 86400_000)) {
    const k = d.toISOString().slice(0, 10);
    const row = {
      day: k,
      label: `${k.slice(8, 10)}/${k.slice(5, 7)}`,
      whatsapp: 0,
      email: 0,
      replies: replyDays.get(k) ?? 0,
    };
    days.push(row);
    byDay.set(k, row);
  }
  for (const r of waSent) {
    const d = byDay.get(dayKey(r.sent_at!));
    if (d) d.whatsapp++;
  }
  for (const r of emSent) {
    const d = byDay.get(dayKey(r.sent_at!));
    if (d) d.email++;
  }

  // Ranking.
  const rank = new Map<string, CampaignRank>();
  for (const c of waC.data ?? [])
    rank.set(c.id, {
      id: c.id,
      name: c.name,
      channel: "whatsapp",
      sent: 0,
      replied: 0,
      meetings: 0,
      failed: 0,
    });
  for (const c of emC.data ?? [])
    rank.set(c.id, {
      id: c.id,
      name: c.name,
      channel: "email",
      sent: 0,
      replied: null,
      meetings: null,
      failed: 0,
    });
  for (const r of waSent) rank.get(r.campaign_id)!.sent++;
  for (const r of emSent) rank.get(r.broadcast_id)!.sent++;
  for (const r of waNot) if (r.status === "failed") rank.get(r.campaign_id)!.failed++;
  for (const r of emNot) if (r.status === "failed") rank.get(r.broadcast_id)!.failed++;
  const convCampaign = new Map(convs.map((c) => [c.id, c.origin_campaign_id]));
  for (const c of replied) {
    const x = c.origin_campaign_id && rank.get(c.origin_campaign_id);
    if (x && x.replied != null) x.replied++;
  }
  for (const m of meetings) {
    const cid = m.conversation_id && convCampaign.get(m.conversation_id);
    const x = cid && rank.get(cid);
    if (x && x.meetings != null) x.meetings++;
  }

  return {
    funnel: { whatsapp: waSteps, email: emSteps, all: mergeSteps(waSteps, emSteps) },
    daily: days,
    ranking: [...rank.values()]
      .filter((r) => r.sent > 0 || r.failed > 0)
      .sort((a, b) => b.sent - a.sent)
      .slice(0, 10),
    blocks: summarizeBlocks([...waNot, ...emNot]),
    aiVsHuman: { ai: convs.length - human.length, human: human.length },
    previousSent,
  };
}
