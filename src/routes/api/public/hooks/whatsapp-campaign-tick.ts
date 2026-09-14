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

async function processCampaign(camp: Campaign) {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count: recentCount } = await supabaseAdmin
    .from("whatsapp_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", camp.id)
    .gte("sent_at", since);
  const allowed = Math.max(0, camp.rate_per_minute - (recentCount ?? 0));
  if (allowed === 0) return { processed: 0 };

  const batch = Math.min(allowed, 20);
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

  for (const r of recips) {
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
          status: "sent",
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
        })
        .eq("id", r.id);
      sentInc += 1;
    } catch (e) {
      await supabaseAdmin
        .from("whatsapp_campaign_recipients")
        .update({
          status: "failed",
          error: e instanceof Error ? e.message : "Erro desconhecido",
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
              "id, owner_id, body_template, template_name, template_language, content_variables_template, media_url, media_content_type, rate_per_minute, total, sent, failed, scheduled_at",
            )
            .eq("status", "running")
            .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
            .limit(50);
          if (error) throw new Error(error.message);
          const results: Array<{ id: string; processed: number }> = [];
          for (const c of camps ?? []) {
            const res = await processCampaign(c as unknown as Campaign);
            results.push({ id: c.id, processed: res.processed });
          }
          return { campaigns: results.length, results };
        });
        return Response.json(run);
      },
    },
  },
});
