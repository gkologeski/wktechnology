import { createFileRoute } from "@tanstack/react-router";
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
  PACING_RUN_BUDGET_MS,
  resolveInterval,
  runPacedLoop,
  type PacingInterval,
} from "@/lib/whatsapp/campaign-pacing";

function applyTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

type Campaign = {
  id: string;
  owner_id: string;
  body_template: string | null;
  template_name: string | null;
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
    .select("id, phone, variables, contact_id")
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
    num = await resolveWaNumber(camp.owner_id);
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
    const vars = (r.variables ?? {}) as Record<string, string>;
    const body = applyTemplate(camp.body_template ?? "", vars);

    try {
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
            workspace_id: camp.owner_id,
            contact_id: r.contact_id,
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
        await supabaseAdmin.from("whatsapp_messages").insert({
          conversation_id: conv.id,
          owner_id: camp.owner_id,
          workspace_id: camp.owner_id,
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
      // SDR: liga template → campanha → conversa. Falha aqui não desfaz o envio.
      if (conv) {
        try {
          const { data: sdrCfg } = await supabaseAdmin
            .from("whatsapp_campaigns")
            .select("sdr_enabled, sdr_playbook_id")
            .eq("id", camp.id)
            .maybeSingle();
          if (sdrCfg?.sdr_enabled) {
            const { linkCampaignSend } = await import("@/lib/prospecting/sdr/ingest.server");
            await linkCampaignSend(supabaseAdmin, {
              workspaceId: camp.owner_id,
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
      await supabaseAdmin
        .from("whatsapp_campaign_recipients")
        .update({
          status: "failed",
          error: e instanceof Error ? e.message : "Erro desconhecido",
          quota_reserved_until: null,
        })
        .eq("id", r.id);
      failedInc += 1;
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
      .eq("id", camp.id);
  }

  return { processed: recips.length, sent: sentInc, failed: failedInc };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Disparo espaçado: um destinatário por vez, com intervalo sorteado entre X e Y.
 * `next_send_at` persiste o espaçamento entre execuções; o lease impede duas
 * execuções simultâneas na mesma campanha.
 */
async function processPaced(camp: Campaign, interval: PacingInterval, startedAt: number) {
  const { data: claimed } = await supabaseAdmin.rpc("wa_campaign_claim_dispatch", {
    p_campaign: camp.id,
    p_seconds: Math.ceil(PACING_RUN_BUDGET_MS / 1000) + 30,
  });
  if (!claimed) return { processed: 0, skipped: "locked" };
  let processed = 0;
  try {
    const r = await runPacedLoop({
      interval,
      startedAt,
      nextAt: camp.next_send_at ? new Date(camp.next_send_at).getTime() : 0,
      sleep,
      sendOne: async () => {
        const res = await processCampaign(camp, 1);
        camp.sent += res.sent ?? 0;
        camp.failed += res.failed ?? 0;
        return res;
      },
      persistNextAt: async (ms) => {
        await supabaseAdmin
          .from("whatsapp_campaigns")
          .update({ next_send_at: new Date(ms).toISOString() })
          .eq("id", camp.id);
      },
    });
    processed = r.processed;
  } finally {
    await supabaseAdmin
      .from("whatsapp_campaigns")
      .update({ dispatch_lease_until: null })
      .eq("id", camp.id);
  }
  return { processed };
}

export const Route = createFileRoute("/api/public/hooks/whatsapp-campaign-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        const run = await runCronWithLogging("whatsapp-campaign-tick", async () => {
          const nowIso = new Date().toISOString();
          const { data: camps, error } = await supabaseAdmin
            .from("whatsapp_campaigns")
            .select(
              "id, owner_id, body_template, template_name, template_language, content_variables_template, media_url, media_content_type, rate_per_minute, total, sent, failed, scheduled_at, workspace_id, send_interval_min_s, send_interval_max_s, next_send_at",
            )
            .eq("status", "running")
            .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
            .limit(50);
          if (error) throw new Error(error.message);
          const results: Array<{ id: string; processed: number }> = [];
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
          // Campanhas espaçadas rodam em paralelo, cada uma no seu próprio ritmo.
          const pacedRes = await Promise.all(
            paced.map(({ camp, interval }) => processPaced(camp, interval, startedAt)),
          );
          paced.forEach(({ camp }, i) =>
            results.push({ id: camp.id, processed: pacedRes[i].processed }),
          );
          return { campaigns: results.length, results };
        });
        return Response.json(run);
      },
    },
  },
});
