import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const VAPI_BASE = "https://api.vapi.ai";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any;

export type Campaign = {
  id: string;
  name: string;
  status: "draft" | "running" | "paused" | "done";
  assignment_mode: "weighted" | "segment";
  max_attempts: number;
  retry_interval_minutes: number;
  source_type: "segment" | "saved_view" | "manual";
  source_ref: string | null;
  lead_ids: string[];
  dialing_window: { start: string; end: string; timezone: string; days: number[] };
  created_at: string;
  updated_at: string;
};

export type Variant = {
  id: string;
  campaign_id: string;
  script_id: string;
  weight: number;
  segment_id: string | null;
  position: number;
};

export type Attempt = {
  id: string;
  variant_id: string | null;
  script_id: string | null;
  lead_id: string | null;
  status: string;
  duration_seconds: number | null;
  cost_usd: number | null;
  recording_url: string | null;
  summary: string | null;
  success_evaluation: string | null;
  ended_reason: string | null;
  created_at: string;
};

const CampaignInput = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(120),
  assignment_mode: z.enum(["weighted", "segment"]).default("weighted"),
  max_attempts: z.number().int().min(1).max(20).default(3),
  retry_interval_minutes: z.number().int().min(5).max(10080).default(240),
  source_type: z.enum(["segment", "saved_view", "manual"]).default("manual"),
  source_ref: z.string().uuid().nullable().optional(),
  lead_ids: z.array(z.string().uuid()).max(10000).default([]),
  dialing_window: z
    .object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
      timezone: z.string().min(1).max(64),
      days: z.array(z.number().int().min(0).max(6)),
    })
    .default({ start: "09:00", end: "18:00", timezone: "America/Sao_Paulo", days: [1, 2, 3, 4, 5] }),
  variants: z
    .array(
      z.object({
        script_id: z.string().uuid(),
        weight: z.number().int().min(0).max(100).default(50),
        segment_id: z.string().uuid().nullable().optional(),
      }),
    )
    .max(20)
    .default([]),
});

export const listCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Campaign[]> => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data, error } = await sb
      .from("prospecting_campaigns")
      .select("*")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Campaign[];
  });

export const getCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ campaign: Campaign; variants: Variant[] }> => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: c, error } = await sb
      .from("prospecting_campaigns")
      .select("*")
      .eq("id", data.id)
      .eq("workspace_id", ws)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) throw new Error("Campanha não encontrada");
    const { data: variants } = await sb
      .from("prospecting_campaign_variants")
      .select("*")
      .eq("campaign_id", data.id)
      .order("position", { ascending: true });
    return { campaign: c as Campaign, variants: (variants ?? []) as Variant[] };
  });

export const upsertCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CampaignInput.parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const payload = {
      workspace_id: ws,
      owner_id: ws,
      name: data.name,
      assignment_mode: data.assignment_mode,
      max_attempts: data.max_attempts,
      retry_interval_minutes: data.retry_interval_minutes,
      source_type: data.source_type,
      source_ref: data.source_ref ?? null,
      lead_ids: data.lead_ids,
      dialing_window: data.dialing_window,
    };

    let id: string;
    if (data.id) {
      id = data.id;
      const { error } = await sb
        .from("prospecting_campaigns")
        .update(payload)
        .eq("id", id)
        .eq("workspace_id", ws);
      if (error) throw new Error(error.message);
      await sb.from("prospecting_campaign_variants").delete().eq("campaign_id", id);
    } else {
      const { data: row, error } = await sb
        .from("prospecting_campaigns")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = row.id as string;
    }

    if (data.variants.length > 0) {
      const rows = data.variants.map((v, i) => ({
        workspace_id: ws,
        owner_id: ws,
        campaign_id: id,
        script_id: v.script_id,
        weight: v.weight,
        segment_id: v.segment_id ?? null,
        position: i,
      }));
      const { error } = await sb.from("prospecting_campaign_variants").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { id };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { error } = await sb
      .from("prospecting_campaigns")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", ws);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), status: z.enum(["draft", "running", "paused", "done"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    if (data.status === "running") {
      const { data: c } = await sb
        .from("prospecting_campaigns")
        .select("lead_ids")
        .eq("id", data.id)
        .eq("workspace_id", ws)
        .single();
      const leadIds = (c?.lead_ids ?? []) as string[];
      if (leadIds.length) {
        const { data: existing } = await sb
          .from("prospecting_call_attempts")
          .select("lead_id")
          .eq("campaign_id", data.id);
        const done = new Set(((existing ?? []) as Array<{ lead_id: string }>).map((x) => x.lead_id));
        const rows = leadIds
          .filter((lid) => !done.has(lid))
          .map((lid) => ({
            workspace_id: ws,
            owner_id: ws,
            campaign_id: data.id,
            lead_id: lid,
            status: "queued",
            attempt_number: 1,
            scheduled_at: new Date().toISOString(),
          }));
        if (rows.length) await sb.from("prospecting_call_attempts").insert(rows);
      }
    }
    const { error } = await sb
      .from("prospecting_campaigns")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("workspace_id", ws);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCampaignAttempts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ campaign_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<Attempt[]> => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: rows, error } = await sb
      .from("prospecting_call_attempts")
      .select("*")
      .eq("workspace_id", ws)
      .eq("campaign_id", data.campaign_id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (rows ?? []) as Attempt[];
  });

function renderTemplate(tpl: string, ctx: { lead: { name: string; company: string } }): string {
  return tpl.replaceAll("{{lead.name}}", ctx.lead.name).replaceAll("{{lead.company}}", ctx.lead.company);
}

export const dialLeadNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ lead_id: z.string().uuid(), script_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    return startVapiCall({ workspaceId: ws, leadId: data.lead_id, scriptId: data.script_id });
  });

export async function startVapiCall(opts: {
  workspaceId: string;
  leadId: string;
  scriptId: string;
  campaignId?: string | null;
  variantId?: string | null;
  attemptNumber?: number;
}): Promise<{ ok: boolean; call_id?: string; error?: string }> {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) return { ok: false, error: "VAPI_API_KEY ausente" };

  const { data: lead } = await sb
    .from("leads")
    .select("id, first_name, last_name, company_name, phone")
    .eq("id", opts.leadId)
    .single();
  if (!lead?.phone) return { ok: false, error: "Lead sem telefone" };

  const { data: script } = await sb
    .from("prospecting_scripts")
    .select("*")
    .eq("id", opts.scriptId)
    .single();
  if (!script) return { ok: false, error: "Script não encontrado" };

  const { data: cfg } = await sb
    .from("voice_agent_settings")
    .select("*")
    .eq("workspace_id", opts.workspaceId)
    .maybeSingle();
  const phoneNumberId = cfg?.vapi_phone_number_id as string | undefined;
  if (!phoneNumberId) return { ok: false, error: "Vapi phone number não configurado" };

  const leadName = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim();
  const ctx = { lead: { name: leadName, company: lead.company_name ?? "" } };
  const renderedFirst = renderTemplate(script.first_message ?? "", ctx);
  const renderedPrompt = renderTemplate(script.system_prompt ?? "", ctx);
  const voiceId = (script.voice_id as string | null) ?? (cfg?.default_voice_id as string | undefined);

  const assistant: Record<string, unknown> = {
    name: "Prospecting Agent",
    model: {
      provider: "openai",
      model: (cfg?.llm_model as string) ?? "gpt-4o-mini",
      messages: [{ role: "system", content: renderedPrompt }],
    },
    firstMessage: renderedFirst,
    maxDurationSeconds: (cfg?.max_duration_seconds as number) ?? 600,
  };
  if (voiceId) assistant.voice = { provider: "11labs", voiceId };

  // Tell Vapi where to send events for this call (per-assistant server config).
  const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;
  const baseUrl =
    process.env.LOVABLE_APP_URL ??
    "https://project--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app";
  if (webhookSecret) {
    assistant.server = {
      url: `${baseUrl}/api/public/hooks/vapi`,
      secret: webhookSecret,
    };
  }

  const res = await fetch(`${VAPI_BASE}/call`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      phoneNumberId,
      assistant,
      customer: { number: lead.phone },
      metadata: {
        leadId: opts.leadId,
        scriptId: opts.scriptId,
        campaignId: opts.campaignId ?? null,
        variantId: opts.variantId ?? null,
        workspaceId: opts.workspaceId,
      },
    }),
  });
  if (!res.ok) return { ok: false, error: `Vapi ${res.status}: ${await res.text()}` };
  const json = (await res.json()) as { id?: string };

  await sb.from("prospecting_call_attempts").insert({
    workspace_id: opts.workspaceId,
    owner_id: opts.workspaceId,
    campaign_id: opts.campaignId ?? null,
    variant_id: opts.variantId ?? null,
    script_id: opts.scriptId,
    lead_id: opts.leadId,
    vapi_call_id: json.id ?? null,
    status: "ringing",
    attempt_number: opts.attemptNumber ?? 1,
    started_at: new Date().toISOString(),
  });

  return { ok: true, call_id: json.id };
}
