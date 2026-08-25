import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { runCronWithLogging } from "@/lib/cron-observability.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const SANDBOX_FROM = "whatsapp:+14155238886";
const DEFAULT_PUBLIC_BASE = "https://app.wktechnology.com.br";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}
function toWa(phone: string): string {
  const p = normalizePhone(phone);
  return p.startsWith("whatsapp:") ? p : `whatsapp:${p}`;
}
function applyTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

type Campaign = {
  id: string;
  owner_id: string;
  body_template: string | null;
  template_name: string | null;
  content_sid: string | null;
  content_variables_template: Record<string, string>;
  media_url: string | null;
  media_content_type: string | null;
  rate_per_minute: number;
  total: number;
  sent: number;
  failed: number;
};

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

  const { data: integ } = await supabaseAdmin
    .from("integrations")
    .select("config")
    .eq("owner_id", camp.owner_id)
    .eq("provider", "twilio_whatsapp")
    .maybeSingle();
  const cfg = (integ?.config ?? {}) as {
    from_number?: string;
    public_base_url?: string;
  };
  const from = cfg.from_number ? toWa(cfg.from_number) : SANDBOX_FROM;
  const fromBare = from.replace(/^whatsapp:/, "");
  const publicBase = (cfg.public_base_url || DEFAULT_PUBLIC_BASE).replace(/\/$/, "");

  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
  if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
    return { processed: 0, error: "Credenciais Twilio ausentes" };
  }
  const headers = {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": TWILIO_API_KEY,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  let sentInc = 0;
  let failedInc = 0;

  for (const r of recips) {
    const toBare = normalizePhone(r.phone);
    const vars = (r.variables ?? {}) as Record<string, string>;

    const params = new URLSearchParams({
      From: from,
      To: toWa(r.phone),
      StatusCallback: `${publicBase}/api/public/hooks/twilio-whatsapp-status`,
    });
    if (camp.content_sid) {
      params.set("ContentSid", camp.content_sid);
      const renderedVars: Record<string, string> = {};
      for (const [k, v] of Object.entries(camp.content_variables_template ?? {})) {
        renderedVars[k] = applyTemplate(v, vars);
      }
      if (Object.keys(renderedVars).length) {
        params.set("ContentVariables", JSON.stringify(renderedVars));
      }
    } else {
      const body = applyTemplate(camp.body_template ?? "", vars);
      if (body) params.set("Body", body);
      if (camp.media_url) params.set("MediaUrl", camp.media_url);
    }

    try {
      const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
        method: "POST",
        headers,
        body: params,
      });
      const tw = await res.json();
      if (!res.ok) {
        await supabaseAdmin
          .from("whatsapp_campaign_recipients")
          .update({
            status: "failed",
            error: `[${res.status}] ${tw?.message ?? "Falha Twilio"}`,
          })
          .eq("id", r.id);
        failedInc += 1;
        continue;
      }

      const { data: conv } = await supabaseAdmin
        .from("whatsapp_conversations")
        .upsert(
          {
            owner_id: camp.owner_id,
            contact_id: r.contact_id,
            contact_phone: toBare,
            twilio_number: fromBare,
            last_message_at: new Date().toISOString(),
            last_message_preview:
              applyTemplate(camp.body_template ?? "", vars).slice(0, 120) ||
              (camp.media_url ? "[mídia]" : "[template]"),
          },
          { onConflict: "contact_phone,twilio_number" },
        )
        .select("id")
        .single();

      if (conv) {
        await supabaseAdmin.from("whatsapp_messages").insert({
          conversation_id: conv.id,
          owner_id: camp.owner_id,
          direction: "outbound",
          body: applyTemplate(camp.body_template ?? "", vars),
          media_url: camp.media_url,
          media_content_type: camp.media_content_type,
          from_number: fromBare,
          to_number: toBare,
          twilio_sid: tw.sid,
          status: tw.status ?? "queued",
          template_name: camp.template_name,
          is_template: !!camp.template_name,
          sent_by: camp.owner_id,
          sent_at: new Date().toISOString(),
          raw: tw,
        });
      }

      await supabaseAdmin
        .from("whatsapp_campaign_recipients")
        .update({
          status: "sent",
          twilio_sid: tw.sid,
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
              "id, owner_id, body_template, template_name, content_sid, content_variables_template, media_url, media_content_type, rate_per_minute, total, sent, failed, scheduled_at",
            )
            .eq("status", "running")
            .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
            .limit(50);
          if (error) throw new Error(error.message);
          const results: Array<{ id: string; processed: number }> = [];
          let totalProcessed = 0;
          for (const c of camps ?? []) {
            const r = await processCampaign(c as Campaign);
            results.push({ id: c.id, processed: r.processed });
            totalProcessed += r.processed;
          }
          return {
            campaigns: results.length,
            processed: totalProcessed,
          } as unknown as Record<string, unknown>;
        });
        if (run.status === "error")
          return Response.json({ ok: false, error: run.error }, { status: 500 });
        return Response.json({ ok: true, duration_ms: run.duration_ms, ...run.metrics });
      },
    },
  },
});
