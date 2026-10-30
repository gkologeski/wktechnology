import { assertSalesWorker } from "@/lib/access-control/sales-worker.server";
import { createFileRoute } from "@tanstack/react-router";
import { toWhatsAppE164 } from "@/lib/phone/whatsapp-e164";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { runCronWithLogging } from "@/lib/cron-observability.server";
import {
  metaSend,
  normalizePhone,
  resolveWaNumber,
  type WaNumber,
} from "@/lib/whatsapp/meta-channel.server";
import {
  pacingEnabled,
  PACING_CHAIN_BUDGET_MS,
  PACING_CHAIN_HORIZON_MS,
  PACING_CHAIN_MAX_HOPS,
  PACING_CHAIN_TIMEOUT_MS,
  PACING_RUN_BUDGET_MS,
  resolveInterval,
  runPacedLoop,
  shouldChainNextRun,
  type PacedStop,
  type PacingInterval,
} from "@/lib/whatsapp/campaign-pacing";
import { z } from "zod";

function applyTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

type Campaign = {
  id: string;
  owner_id: string;
  body_template: string | null;
  template_name: string | null;
  sender_phone_number_id?: string | null;
  template_language: string | null;
  content_variables_template: Record<string, string>;
  media_url: string | null;
  media_content_type: string | null;
  rate_per_minute: number;
  total: number;
  sent: number;
  failed: number;
  workspace_id: string;
  send_interval_min_s: number | null;
  send_interval_max_s: number | null;
  next_send_at: string | null;
  dispatch_lease_until?: string | null;
  recent_contact_days?: number | null;
  exclude_customers?: boolean | null;
  exclude_open_deals?: boolean | null;
};

/** Variáveis posicionais do template, renderizadas com os dados do destinatário. */
function templateVariables(camp: Campaign, vars: Record<string, string>): string[] {
  const map = camp.content_variables_template ?? {};
  const indexes = Object.keys(map)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  return indexes.map((i) => applyTemplate(map[String(i)] ?? "", vars));
}

async function processCampaign(camp: Campaign, batchOverride?: number) {
  if (!camp.workspace_id) throw new Error("Campanha sem empresa de origem.");
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count: recentCount } = await supabaseAdmin
    .from("whatsapp_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", camp.id)
    .gte("sent_at", since);
  const allowed = Math.max(0, camp.rate_per_minute - (recentCount ?? 0));
  if (allowed === 0) return { processed: 0 };

  const batch = Math.min(allowed, batchOverride ?? 20);
  const { data: recips } = await supabaseAdmin
    .from("whatsapp_campaign_recipients")
    .select("id, phone, variables, contact_id, override_recent, override_commercial")
    .eq("campaign_id", camp.id)
    .eq("status", "pending")
    .limit(batch);
  if (!recips || recips.length === 0) {
    const { count: remaining } = await supabaseAdmin
      .from("whatsapp_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", camp.id)
      .eq("status", "pending");
    if ((remaining ?? 0) === 0) {
      await supabaseAdmin
        .from("whatsapp_campaigns")
        .update({ status: "completed", finished_at: new Date().toISOString() })
        .eq("id", camp.id);
    }
    return { processed: 0 };
  }

  // Número oficial da Meta do workspace (obrigatório).
  let num: WaNumber;
  try {
    num = await resolveWaNumber(camp.workspace_id, camp.sender_phone_number_id ?? null);
    if (num.provider === "cloud" && !camp.template_name)
      throw new Error("Campanhas Meta diretas exigem template aprovado.");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Número da Meta indisponível";
    await supabaseAdmin
      .from("whatsapp_campaigns")
      .update({ status: "paused", last_tick_at: new Date().toISOString() })
      .eq("id", camp.id);
    return { processed: 0, error: message };
  }

  let sentInc = 0;
  let failedInc = 0;
  // Destinatários que chegaram a um desfecho (ignorado, enviado ou falha).
  let handled = 0;

  // Política de prospecção: cota de templates (opcional) e horário de campanha.
  const { data: pol } = await supabaseAdmin
    .from("sdr_workspace_settings")
    .select(
      "template_daily_limit, template_respect_hours, timezone, quiet_hours_start, quiet_hours_end",
    )
    .eq("workspace_id", camp.workspace_id)
    .maybeSingle();
  if (pol?.template_respect_hours) {
    const { isQuietHours } = await import("@/lib/prospecting/sdr/policy");
    if (
      isQuietHours(
        new Date(),
        pol.timezone ?? "America/Sao_Paulo",
        pol.quiet_hours_start ?? 0,
        pol.quiet_hours_end ?? 0,
      )
    )
      return { processed: 0, skipped: "campaign_hours" };
  }

  for (const r of recips) {
    // Pausa/cancelamento feitos durante a rodada valem antes de cada envio.
    const { data: live } = await supabaseAdmin
      .from("whatsapp_campaigns")
      .select("status")
      .eq("id", camp.id)
      .maybeSingle();
    if (live?.status !== "running") break;
    // Segunda proteção: telefone fixo/inválido nunca é disparado no WhatsApp.
    if (!toWhatsAppE164(r.phone)) {
      await supabaseAdmin
        .from("whatsapp_campaign_recipients")
        .update({ status: "skipped", error: "Telefone fixo ou inválido (sem WhatsApp)" })
        .eq("id", r.id);
      handled += 1;
      continue;
    }
    // Terceira proteção: mesmo telefone recebeu WhatsApp de OUTRA campanha há pouco.
    const recentDays = camp.recent_contact_days ?? 0;
    if (recentDays > 0 && !r.override_recent) {
      const { brPhoneVariants } = await import("@/lib/whatsapp/phone-variants");
      const since = new Date(Date.now() - recentDays * 86_400_000).toISOString();
      const { count: recentHits } = await supabaseAdmin
        .from("whatsapp_campaign_recipients")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", camp.workspace_id)
        .eq("status", "sent")
        .neq("campaign_id", camp.id)
        .gte("sent_at", since)
        .in("phone", brPhoneVariants(r.phone));
      if ((recentHits ?? 0) > 0) {
        await supabaseAdmin
          .from("whatsapp_campaign_recipients")
          .update({ status: "skipped", error: "Envio recente" })
          .eq("id", r.id);
        handled += 1;
        continue;
      }
    }
    // Quarta proteção: cliente (negócio ganho/contrato ativo) ou negociação aberta.
    if (
      (camp.exclude_customers !== false || camp.exclude_open_deals !== false) &&
      !r.override_commercial
    ) {
      const { loadCommercialFlags } = await import("@/lib/campaigns/commercial-status.server");
      const { commercialBlock, COMMERCIAL_LABEL } =
        await import("@/lib/campaigns/commercial-status");
      const e164 = toWhatsAppE164(r.phone) as string;
      const flags = await loadCommercialFlags(supabaseAdmin, camp.workspace_id, [e164]);
      const reason = commercialBlock(flags.get(e164), {
        excludeCustomers: camp.exclude_customers !== false,
        excludeOpenDeals: camp.exclude_open_deals !== false,
      });
      if (reason) {
        await supabaseAdmin
          .from("whatsapp_campaign_recipients")
          .update({ status: "skipped", error: COMMERCIAL_LABEL[reason] })
          .eq("id", r.id);
        handled += 1;
        continue;
      }
    }
    if (pol?.template_daily_limit != null) {
      const { data: q } = await supabaseAdmin.rpc("wa_reserve_template_quota", {
        p_recipient: r.id,
        p_limit: pol.template_daily_limit,
      });
      const res = (q as { result?: string } | null)?.result;
      if (res === "template_quota") break; // fica pendente para a próxima janela
      if (res !== "ok") continue;
    }
    const toBare = normalizePhone(r.phone);
    const { brPhoneVariants } = await import("@/lib/whatsapp/phone-variants");
    const optedOut = await supabaseAdmin
      .from("sdr_enrollments")
      .select("id")
      .eq("workspace_id", camp.workspace_id)
      .in("contact_phone", brPhoneVariants(toBare))
      .not("opted_out_at", "is", null)
      .limit(1);
    if (optedOut.error) throw new Error("Não foi possível verificar descadastramento.");
    if (optedOut.data?.length) {
      await supabaseAdmin
        .from("whatsapp_campaign_recipients")
        .update({ status: "skipped", error: "Contato descadastrado em outro atendimento" })
        .eq("id", r.id);
      handled += 1;
      continue;
    }
    const vars = (r.variables ?? {}) as Record<string, string>;
    const body = applyTemplate(camp.body_template ?? "", vars);

    try {
      await assertSalesWorker(
        supabaseAdmin,
        "whatsapp_campaigns",
        camp.id,
        r.contact_id ? [{ table: "contacts", id: r.contact_id }] : [],
      );
      const { wamid, raw } = await metaSend(num, {
        to: toBare,
        body: camp.template_name ? "" : body,
        mediaUrl: camp.template_name ? null : camp.media_url,
        mediaContentType: camp.media_content_type,
        template: camp.template_name
          ? {
              name: camp.template_name,
              language: camp.template_language ?? undefined,
              variables: templateVariables(camp, vars),
            }
          : null,
      });

      const { data: conv } = await supabaseAdmin
        .from("whatsapp_conversations")
        .upsert(
          {
            owner_id: camp.owner_id,
            workspace_id: camp.workspace_id,
            ...(r.contact_id ? { contact_id: r.contact_id } : {}),
            contact_phone: toBare,
            twilio_number: num.displayPhoneNumber,
            provider: "meta",
            wa_phone_number_id: num.phoneNumberId,
            last_message_at: new Date().toISOString(),
            last_message_preview:
              body.slice(0, 120) ||
              (camp.media_url ? "[mídia]" : `[template ${camp.template_name ?? ""}]`),
          },
          { onConflict: "contact_phone,twilio_number" },
        )
        .select("id")
        .single();

      if (conv) {
        const { ensureWhatsAppConversationIdentity } =
          await import("@/lib/inbox/identity-resolution.server");
        await ensureWhatsAppConversationIdentity(supabaseAdmin as any, conv.id, {
          contactId: r.contact_id,
          source: (r.variables as Record<string, unknown> | null)?._source,
        }).catch(() => null);
        await supabaseAdmin.from("whatsapp_messages").insert({
          conversation_id: conv.id,
          owner_id: camp.owner_id,
          workspace_id: camp.workspace_id,
          direction: "outbound",
          body,
          media_url: camp.template_name ? null : camp.media_url,
          media_content_type: camp.media_content_type,
          from_number: num.displayPhoneNumber,
          to_number: toBare,
          provider: "meta",
          wa_message_id: wamid,
          status: "accepted",
          template_name: camp.template_name,
          is_template: !!camp.template_name,
          sent_by: camp.owner_id,
          sent_at: new Date().toISOString(),
          raw,
        });
      }

      await supabaseAdmin
        .from("whatsapp_campaign_recipients")
        .update({
          status: "sent",
          wa_message_id: wamid,
          sent_at: new Date().toISOString(),
          quota_reserved_until: null,
        })
        .eq("id", r.id);
      sentInc += 1;
      handled += 1;
      // SDR: liga template → campanha → conversa. Falha aqui não desfaz o envio.
      if (conv) {
        try {
          // Campaign opt-in remains authoritative; an unbound campaign must not fall back to receptive AI.
          const origin = await supabaseAdmin
            .from("whatsapp_conversations")
            .update({
              origin_campaign_id: camp.id,
              origin_template_name: camp.template_name,
              origin_wa_message_id: wamid,
              conversation_origin: "campaign",
            })
            .eq("id", conv.id)
            .eq("workspace_id", camp.workspace_id)
            .is("origin_campaign_id", null);
          if (origin.error) throw new Error("Não foi possível registrar a origem da campanha.");
          const { data: sdrCfg } = await supabaseAdmin
            .from("whatsapp_campaigns")
            .select("sdr_enabled, sdr_playbook_id")
            .eq("id", camp.id)
            .maybeSingle();
          if (sdrCfg?.sdr_enabled) {
            const { linkCampaignSend } = await import("@/lib/prospecting/sdr/ingest.server");
            await linkCampaignSend(supabaseAdmin, {
              workspaceId: camp.workspace_id,
              ownerId: camp.owner_id,
              campaign: {
                id: camp.id,
                sdr_enabled: true,
                sdr_playbook_id: sdrCfg.sdr_playbook_id,
                template_name: camp.template_name,
              },
              conversationId: conv.id,
              phone: toBare,
              wamid,
              contactId: r.contact_id ?? null,
            });
          }
        } catch (e) {
          console.error("[sdr] vínculo da campanha falhou", (e as Error).message);
        }
      }
    } catch (e) {
      if (num.provider === "cloud") {
        // Never retry a rejected/uncertain delivery on another phone number.
        await supabaseAdmin
          .from("whatsapp_campaigns")
          .update({ status: "paused", last_tick_at: new Date().toISOString() })
          .eq("id", camp.id);
      }
      await supabaseAdmin
        .from("whatsapp_campaign_recipients")
        .update({
          status: "failed",
          error: e instanceof Error ? e.message : "Erro desconhecido",
          quota_reserved_until: null,
        })
        .eq("id", r.id);
      failedInc += 1;
      handled += 1;
      if (num.provider === "cloud") break;
    }
  }

  await supabaseAdmin
    .from("whatsapp_campaigns")
    .update({
      sent: camp.sent + sentInc,
      failed: camp.failed + failedInc,
      last_tick_at: new Date().toISOString(),
    })
    .eq("id", camp.id);

  const { count: remaining } = await supabaseAdmin
    .from("whatsapp_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", camp.id)
    .eq("status", "pending");
  if ((remaining ?? 0) === 0) {
    await supabaseAdmin
      .from("whatsapp_campaigns")
      .update({ status: "completed", finished_at: new Date().toISOString() })
      .eq("id", camp.id)
      .eq("status", "running");
  }

  return { processed: handled, sent: sentInc, failed: failedInc };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const CAMPAIGN_COLUMNS =
  "id, owner_id, body_template, template_name, sender_phone_number_id, template_language, content_variables_template, media_url, media_content_type, rate_per_minute, total, sent, failed, scheduled_at, workspace_id, send_interval_min_s, send_interval_max_s, next_send_at, dispatch_lease_until, recent_contact_days, exclude_customers, exclude_open_deals";

type PacedRun = { budgetMs: number; idle: boolean; hop: number };

/**
 * Acorda a próxima rodada da mesma campanha quando ainda há fila e o próximo
 * envio está próximo. A chamada sai pelo banco, com o endereço e as credenciais
 * da tarefa agendada; falha aqui só atrasa até a próxima tarefa agendada.
 */
async function chainNextRun(camp: Campaign, stop: PacedStop, nextAt: number, hop: number) {
  const [{ data: live }, { count: pending }] = await Promise.all([
    supabaseAdmin.from("whatsapp_campaigns").select("status").eq("id", camp.id).maybeSingle(),
    supabaseAdmin
      .from("whatsapp_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", camp.id)
      .eq("status", "pending"),
  ]);
  const chain = shouldChainNextRun({
    stop,
    status: live?.status,
    pending: pending ?? 0,
    nextAt,
    now: Date.now(),
    hop,
  });
  if (!chain) return false;
  const { data, error } = await supabaseAdmin.rpc("wa_campaign_chain_tick", {
    p_campaign: camp.id,
    p_hop: hop + 1,
    p_timeout_ms: PACING_CHAIN_TIMEOUT_MS,
  });
  if (error) {
    console.error("[whatsapp-campaign] encadeamento falhou", camp.id, error.message);
    return false;
  }
  return data != null;
}

/**
 * Disparo espaçado: um destinatário por vez, com intervalo sorteado entre X e Y.
 * `next_send_at` persiste o espaçamento entre execuções; o lease impede duas
 * execuções simultâneas na mesma campanha. Rodada bloqueada pelo lease não
 * encadeia, então existe no máximo uma cadeia viva por campanha.
 */
async function processPaced(
  camp: Campaign,
  interval: PacingInterval,
  startedAt: number,
  run: PacedRun,
) {
  const { data: claimed } = await supabaseAdmin.rpc("wa_campaign_claim_dispatch", {
    p_campaign: camp.id,
    p_seconds: Math.ceil(run.budgetMs / 1000) + 30,
  });
  if (!claimed) return { processed: 0, skipped: "locked", chained: false };
  let processed = 0;
  let stop: PacedStop = "empty";
  let nextAt = camp.next_send_at ? new Date(camp.next_send_at).getTime() : 0;
  try {
    const r = await runPacedLoop({
      interval,
      startedAt,
      budgetMs: run.budgetMs,
      idle: run.idle,
      nextAt,
      sleep,
      sendOne: async () => {
        const res = await processCampaign(camp, 1);
        camp.sent += res.sent ?? 0;
        camp.failed += res.failed ?? 0;
        return { ...res, attempted: (res.sent ?? 0) + (res.failed ?? 0) };
      },
      persistNextAt: async (ms) => {
        await supabaseAdmin
          .from("whatsapp_campaigns")
          .update({ next_send_at: new Date(ms).toISOString() })
          .eq("id", camp.id);
      },
    });
    processed = r.processed;
    stop = r.stop;
    nextAt = r.nextAt;
  } finally {
    await supabaseAdmin
      .from("whatsapp_campaigns")
      .update({ dispatch_lease_until: null })
      .eq("id", camp.id);
  }
  // Só depois de liberar o lease, para a próxima rodada conseguir assumir.
  let chained = false;
  try {
    chained = await chainNextRun(camp, stop, nextAt, run.hop);
  } catch (e) {
    console.error("[whatsapp-campaign] encadeamento falhou", camp.id, (e as Error).message);
  }
  return { processed, chained };
}

/**
 * Rodada agendada de uma campanha espaçada: só abre a cadeia (a chamada
 * agendada tem tempo limite curto). Se a cadeia já estiver ativa (lease), não
 * faz nada; se o banco não conseguir abrir a cadeia, envia aqui mesmo, como
 * antes, dentro do orçamento curto.
 */
async function kickPaced(camp: Campaign, interval: PacingInterval, startedAt: number) {
  const leaseUntil = camp.dispatch_lease_until ? new Date(camp.dispatch_lease_until).getTime() : 0;
  if (leaseUntil > Date.now()) return { processed: 0, skipped: "locked", chained: false };
  const nextAt = camp.next_send_at ? new Date(camp.next_send_at).getTime() : 0;
  if (nextAt - Date.now() > PACING_CHAIN_HORIZON_MS)
    return { processed: 0, skipped: "waiting", chained: false };
  const { data, error } = await supabaseAdmin.rpc("wa_campaign_chain_tick", {
    p_campaign: camp.id,
    p_hop: 1,
    p_timeout_ms: PACING_CHAIN_TIMEOUT_MS,
  });
  if (!error && data != null) return { processed: 0, chained: true };
  if (error) console.error("[whatsapp-campaign] abrir cadeia falhou", camp.id, error.message);
  return processPaced(camp, interval, startedAt, {
    budgetMs: PACING_RUN_BUDGET_MS,
    idle: false,
    hop: 0,
  });
}

const ChainBody = z.object({
  campaignId: z.string().uuid().optional(),
  hop: z.number().int().min(0).max(PACING_CHAIN_MAX_HOPS).optional(),
});

/** Rodada encadeada: só a campanha indicada, só se ainda estiver em execução e espaçada. */
async function runChained(campaignId: string, hop: number) {
  const nowIso = new Date().toISOString();
  const { data: c, error } = await supabaseAdmin
    .from("whatsapp_campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("id", campaignId)
    .eq("status", "running")
    .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) return { campaigns: 0, results: [], hop };
  const camp = c as unknown as Campaign;
  const { data: ws } = await supabaseAdmin
    .from("sdr_workspace_settings")
    .select("workspace_id, template_interval_min_s, template_interval_max_s")
    .eq("workspace_id", camp.workspace_id)
    .maybeSingle();
  const interval = resolveInterval(camp, ws ?? null);
  if (!pacingEnabled(interval)) return { campaigns: 0, results: [], hop };
  const res = await processPaced(camp, interval, Date.now(), {
    budgetMs: PACING_CHAIN_BUDGET_MS,
    idle: true,
    hop,
  });
  return {
    campaigns: 1,
    results: [{ id: camp.id, processed: res.processed, chained: res.chained }],
    hop,
  };
}

export const Route = createFileRoute("/api/public/hooks/whatsapp-campaign-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        const raw = await request.text();
        let parsedJson: unknown = {};
        try {
          parsedJson = raw ? JSON.parse(raw) : {};
        } catch {
          return new Response("Invalid body", { status: 400 });
        }
        const parsed = ChainBody.safeParse(parsedJson ?? {});
        if (!parsed.success) return new Response("Invalid body", { status: 400 });
        const { campaignId, hop } = parsed.data;
        if (campaignId) {
          const chainedRun = await runCronWithLogging("whatsapp-campaign-chain", () =>
            runChained(campaignId, hop ?? 1),
          );
          return Response.json(chainedRun);
        }
        const run = await runCronWithLogging("whatsapp-campaign-tick", async () => {
          const nowIso = new Date().toISOString();
          const { data: camps, error } = await supabaseAdmin
            .from("whatsapp_campaigns")
            .select(CAMPAIGN_COLUMNS)
            .eq("status", "running")
            .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
            .limit(50);
          if (error) throw new Error(error.message);
          const results: Array<{ id: string; processed: number; chained?: boolean }> = [];
          const startedAt = Date.now();
          const wsIds = Array.from(new Set((camps ?? []).map((c) => c.workspace_id)));
          const { data: wsSettings } = wsIds.length
            ? await supabaseAdmin
                .from("sdr_workspace_settings")
                .select("workspace_id, template_interval_min_s, template_interval_max_s")
                .in("workspace_id", wsIds)
            : { data: [] };
          const byWs = new Map((wsSettings ?? []).map((w) => [w.workspace_id, w]));
          const paced: Array<{ camp: Campaign; interval: PacingInterval }> = [];
          for (const c of camps ?? []) {
            const camp = c as unknown as Campaign;
            const interval = resolveInterval(camp, byWs.get(camp.workspace_id) ?? null);
            if (pacingEnabled(interval)) {
              paced.push({ camp, interval });
              continue;
            }
            const res = await processCampaign(camp);
            results.push({ id: c.id, processed: res.processed });
          }
          // Campanhas espaçadas: a rodada agendada abre (ou reabre) a cadeia de
          // cada uma; os envios acontecem nas rodadas encadeadas.
          const pacedRes = await Promise.all(
            paced.map(({ camp, interval }) => kickPaced(camp, interval, startedAt)),
          );
          paced.forEach(({ camp }, i) =>
            results.push({
              id: camp.id,
              processed: pacedRes[i].processed,
              chained: pacedRes[i].chained,
            }),
          );
          return { campaigns: results.length, results };
        });
        return Response.json(run);
      },
    },
  },
});
