import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { campaignIntervalColumns } from "@/lib/whatsapp/campaign-pacing";

const RecipientInput = z.object({
  phone: z.string().min(5).max(32),
  contactId: z.string().uuid().nullable().optional(),
  variables: z.record(z.string(), z.string()).optional(),
});

const CreateInput = z.object({
  name: z.string().min(1).max(120),
  body_template: z.string().max(1600).optional().default(""),
  template_name: z.string().max(60).optional(),
  template_language: z.string().max(10).optional(),
  content_variables_template: z.record(z.string(), z.string()).optional(),
  media_url: z.string().url().optional().or(z.literal("")),
  media_content_type: z.string().max(120).optional(),
  rate_per_minute: z.number().int().min(1).max(120).default(10),
  scheduled_at: z.string().datetime().optional(),
  recipients: z.array(RecipientInput).min(1).max(5000),
  sdr_playbook_id: z.string().uuid().nullable().optional(),
  send_interval_min_s: z.number().int().min(0).max(3600).nullable().optional(),
  send_interval_max_s: z.number().int().min(0).max(3600).nullable().optional(),
});

/** Playbook do SDR precisa existir e ser visível ao usuário (RLS). Exige template oficial. */
async function sdrColumns(
  supabase: any,
  playbookId: string | null | undefined,
  templateName: string | null | undefined,
) {
  if (playbookId === undefined) return {};
  if (!playbookId) return { sdr_enabled: false, sdr_playbook_id: null };
  if (!templateName) throw new Error("O SDR só pode ser ligado a campanhas com template aprovado.");
  const { data, error } = await supabase
    .from("sdr_playbooks")
    .select("id")
    .eq("id", playbookId)
    .maybeSingle();
  if (error || !data) throw new Error("Playbook do SDR não encontrado.");
  return { sdr_enabled: true, sdr_playbook_id: playbookId };
}

export const createWhatsAppCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: camp, error } = await supabase
      .from("whatsapp_campaigns")
      .insert({
        owner_id: userId,
        name: data.name,
        body_template: data.body_template || null,
        template_name: data.template_name || null,
        template_language: data.template_language || null,
        content_variables_template: data.content_variables_template ?? {},
        media_url: data.media_url || null,
        media_content_type: data.media_content_type || null,
        rate_per_minute: data.rate_per_minute,
        scheduled_at: data.scheduled_at ?? new Date().toISOString(),
        status: "draft",
        total: data.recipients.length,
        ...(await sdrColumns(supabase, data.sdr_playbook_id, data.template_name)),
        ...campaignIntervalColumns(data.send_interval_min_s, data.send_interval_max_s),
        workspace_id: await resolveActiveWorkspace(context.userId),
      })
      .select("id")
      .single();
    if (error) throw error;

    const rows = data.recipients.map((r) => ({
      campaign_id: camp.id,
      owner_id: userId,
      contact_id: r.contactId ?? null,
      phone: r.phone.trim(),
      variables: r.variables ?? {},
      status: "pending" as const,
    }));
    // Insere em lotes de 500 para evitar payload gigante
    for (let i = 0; i < rows.length; i += 500) {
      const slice = rows.slice(i, i + 500);
      const { error: rErr } = await supabase.from("whatsapp_campaign_recipients").insert(slice);
      if (rErr) throw rErr;
    }
    return { id: camp.id as string };
  });

export const listWhatsAppCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("whatsapp_campaigns")
      .select(
        "id, name, status, total, sent, failed, rate_per_minute, scheduled_at, started_at, finished_at, created_at, workspace_id, send_interval_min_s, send_interval_max_s, next_send_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const wsIds = Array.from(new Set((data ?? []).map((c) => c.workspace_id)));
    const { data: ws } = wsIds.length
      ? await context.supabase
          .from("sdr_workspace_settings")
          .select("workspace_id, template_interval_min_s, template_interval_max_s")
          .in("workspace_id", wsIds)
      : { data: [] };
    const byWs = new Map((ws ?? []).map((w) => [w.workspace_id, w]));
    return (data ?? []).map((c) => {
      const own = c.send_interval_min_s != null && c.send_interval_max_s != null;
      const d = byWs.get(c.workspace_id);
      return {
        ...c,
        interval_source: own ? ("campaign" as const) : ("workspace" as const),
        interval_min_s: own ? c.send_interval_min_s! : (d?.template_interval_min_s ?? 0),
        interval_max_s: own ? c.send_interval_max_s! : (d?.template_interval_max_s ?? 0),
      };
    });
  });

export const getWhatsAppCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: camp, error } = await supabase
      .from("whatsapp_campaigns")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw error;
    const { data: recips } = await supabase
      .from("whatsapp_campaign_recipients")
      .select("id, phone, status, wa_message_id, error, sent_at")
      .eq("campaign_id", data.id)
      .order("created_at", { ascending: true })
      .limit(500);
    return { campaign: camp, recipients: recips ?? [] };
  });

export const setWhatsAppCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["running", "paused", "canceled"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: {
      status: "running" | "paused" | "canceled";
      started_at?: string;
      finished_at?: string;
    } = { status: data.status };
    if (data.status === "running") patch.started_at = new Date().toISOString();
    if (data.status === "canceled") patch.finished_at = new Date().toISOString();
    const { error } = await context.supabase
      .from("whatsapp_campaigns")
      .update(patch)
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

const UpdateInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  body_template: z.string().max(1600).nullable().optional(),
  template_name: z.string().max(60).nullable().optional(),
  template_language: z.string().max(10).nullable().optional(),
  content_variables_template: z.record(z.string(), z.string()).optional(),
  media_url: z.string().url().nullable().optional().or(z.literal("")),
  media_content_type: z.string().max(120).nullable().optional(),
  rate_per_minute: z.number().int().min(1).max(120).optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
  sdr_playbook_id: z.string().uuid().nullable().optional(),
  send_interval_min_s: z.number().int().min(0).max(3600).nullable().optional(),
  send_interval_max_s: z.number().int().min(0).max(3600).nullable().optional(),
});

export const updateWhatsAppCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: existing, error: getErr } = await supabase
      .from("whatsapp_campaigns")
      .select("id, status")
      .eq("id", data.id)
      .single();
    if (getErr) throw getErr;
    if (existing.status !== "draft" && existing.status !== "paused") {
      throw new Error("Apenas campanhas em rascunho ou pausadas podem ser editadas");
    }
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.body_template !== undefined) patch.body_template = data.body_template || null;
    if (data.template_name !== undefined) patch.template_name = data.template_name || null;
    if (data.template_language !== undefined)
      patch.template_language = data.template_language || null;
    if (data.content_variables_template !== undefined)
      patch.content_variables_template = data.content_variables_template;
    if (data.media_url !== undefined) patch.media_url = data.media_url || null;
    if (data.media_content_type !== undefined)
      patch.media_content_type = data.media_content_type || null;
    if (data.rate_per_minute !== undefined) patch.rate_per_minute = data.rate_per_minute;
    if (data.scheduled_at !== undefined) patch.scheduled_at = data.scheduled_at;
    Object.assign(patch, await sdrColumns(supabase, data.sdr_playbook_id, data.template_name));
    Object.assign(
      patch,
      campaignIntervalColumns(data.send_interval_min_s, data.send_interval_max_s),
    );
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase
      .from("whatsapp_campaigns")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const duplicateWhatsAppCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { duplicateCampaignRow } = await import("@/lib/whatsapp/campaign-actions");
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: src, error } = await supabase
      .from("whatsapp_campaigns")
      .select("*")
      .eq("id", data.id)
      .eq("workspace_id", workspaceId)
      .single();
    if (error || !src) throw new Error("Campanha não encontrada.");
    const recips: { phone: string; contact_id: string | null; variables: unknown }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: page, error: pErr } = await supabase
        .from("whatsapp_campaign_recipients")
        .select("phone, contact_id, variables")
        .eq("campaign_id", data.id)
        .order("created_at", { ascending: true })
        .range(from, from + 999);
      if (pErr) throw pErr;
      recips.push(...(page ?? []));
      if (!page || page.length < 1000) break;
    }
    const { data: camp, error: cErr } = await supabase
      .from("whatsapp_campaigns")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        ...duplicateCampaignRow(src, recips.length),
        owner_id: userId,
        workspace_id: workspaceId,
      } as any)
      .select("id")
      .single();
    if (cErr) throw cErr;
    for (let i = 0; i < recips.length; i += 500) {
      const slice = recips.slice(i, i + 500).map((r) => ({
        campaign_id: camp.id,
        owner_id: userId,
        contact_id: r.contact_id,
        phone: r.phone,
        variables: r.variables ?? {},
        status: "pending" as const,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: rErr } = await supabase
        .from("whatsapp_campaign_recipients")
        .insert(slice as any);
      if (rErr) {
        await supabase.from("whatsapp_campaigns").delete().eq("id", camp.id);
        throw rErr;
      }
    }
    return { id: camp.id as string };
  });

export const deleteWhatsAppCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { canDeleteCampaign } = await import("@/lib/whatsapp/campaign-actions");
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: camp, error } = await supabase
      .from("whatsapp_campaigns")
      .select("id, status")
      .eq("id", data.id)
      .eq("workspace_id", workspaceId)
      .single();
    if (error || !camp) throw new Error("Campanha não encontrada.");
    if (!canDeleteCampaign(camp.status)) throw new Error("Pause a campanha antes de excluir.");
    const { error: rErr } = await supabase
      .from("whatsapp_campaign_recipients")
      .delete()
      .eq("campaign_id", data.id);
    if (rErr) throw rErr;
    const { data: del, error: dErr } = await supabase
      .from("whatsapp_campaigns")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (dErr) throw dErr;
    if (!del || del.length === 0)
      throw new Error("Você não tem permissão para excluir esta campanha.");
    return { ok: true };
  });
