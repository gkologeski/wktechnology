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
  recipients: z.array(RecipientInput).max(5000).optional().default([]),
  audience: z
    .union([
      z.object({ type: z.literal("queue"), queue_id: z.string().uuid() }),
      z.object({
        type: z.literal("filter"),
        base: z.enum(["leads", "contacts", "companies", "deals"]),
        filters: z
          .array(
            z.object({
              entity: z.enum(["leads", "contacts", "companies", "deals"]).optional(),
              column: z.string().max(40),
              op: z.enum([
                "eq",
                "neq",
                "ilike",
                "not_ilike",
                "gte",
                "lte",
                "is_null",
                "is_not_null",
              ]),
              value: z.string().max(200),
            }),
          )
          .max(20)
          .optional(),
        groups_logic: z.enum(["and", "or"]).optional(),
        groups: z
          .array(
            z.object({
              logic: z.enum(["and", "or"]),
              filters: z
                .array(
                  z.object({
                    entity: z.enum(["leads", "contacts", "companies", "deals"]).optional(),
                    column: z.string().max(40),
                    op: z.enum([
                      "eq",
                      "neq",
                      "ilike",
                      "not_ilike",
                      "gte",
                      "lte",
                      "is_null",
                      "is_not_null",
                    ]),
                    value: z.string().max(200),
                  }),
                )
                .max(20),
            }),
          )
          .max(10)
          .optional(),
      }),
    ])
    .optional(),
  variable_map: z
    .record(
      z.string(),
      z.object({ field: z.string().max(60), fallback: z.string().max(200).optional() }),
    )
    .optional(),
  skip_missing: z.boolean().optional(),
  sdr_playbook_id: z.string().uuid().nullable().optional(),
  send_interval_min_s: z.number().int().min(0).max(3600).nullable().optional(),
  send_interval_max_s: z.number().int().min(0).max(3600).nullable().optional(),
  /** Dias sem reenviar a quem recebeu WhatsApp de outra campanha (0 desliga). */
  recent_contact_days: z.number().int().min(0).max(365).optional(),
  /** Telefones liberados manualmente apesar do envio recente. */
  recent_overrides: z.array(z.string().max(40)).max(5000).optional(),
});

const PreviewInput = CreateInput.pick({
  audience: true,
  variable_map: true,
  recent_contact_days: true,
  recent_overrides: true,
});

/** Separa quem recebeu WhatsApp de campanha nos últimos N dias (mesmo canal). */
async function applyRecentGuard<T extends { phone: string }>(
  supabase: unknown,
  workspaceId: string,
  days: number,
  overrides: string[] | undefined,
  items: T[],
) {
  const { recentSince, splitRecent, phoneRecentKey } = await import(
    "@/lib/campaigns/recent-contact"
  );
  const since = recentSince(days);
  if (!since) return { kept: items.map((i) => ({ ...i, overrideRecent: false })), removed: [] };
  const { loadRecentWhatsAppSends } = await import("@/lib/whatsapp/campaign-audience.server");
  const recent = await loadRecentWhatsAppSends(supabase, workspaceId, since);
  return splitRecent(
    items,
    (i) => phoneRecentKey(i.phone),
    recent,
    new Set((overrides ?? []).map(phoneRecentKey)),
  );
}

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
  // A campanha referencia o agente; quem responde é sempre a versão PUBLICADA.
  const { data: pub, error: vErr } = await supabase
    .from("sdr_agent_versions")
    .select("id")
    .eq("playbook_id", playbookId)
    .eq("status", "published")
    .maybeSingle();
  if (vErr) throw new Error(vErr.message);
  if (!pub)
    throw new Error(
      "Este agente ainda não tem versão publicada; publique antes de ligá-lo à campanha.",
    );
  return { sdr_enabled: true, sdr_playbook_id: playbookId };
}

export const createWhatsAppCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { toWhatsAppE164 } = await import("@/lib/phone/whatsapp-e164");
    const seenManual = new Set<string>();
    let recipients = data.recipients.flatMap((r) => {
      // Lista manual: só celular (ou número estrangeiro) em E.164; fixo fica de fora.
      const phone = toWhatsAppE164(r.phone);
      if (!phone || seenManual.has(phone)) return [];
      seenManual.add(phone);
      return [
        {
          phone,
          contactId: r.contactId ?? null,
          variables: (r.variables ?? {}) as Record<string, string>,
        },
      ];
    });
    if (data.audience) {
      const { buildAudience, isAllowedField } = await import("@/lib/whatsapp/campaign-audience");
      const { loadAudienceRows, loadOptedOutPhones } =
        await import("@/lib/whatsapp/campaign-audience.server");
      const { base, rows, truncated } = await loadAudienceRows(
        supabase,
        workspaceId,
        data.audience,
        userId,
      );
      if (truncated) throw new Error("O público passa de 5.000 destinatários. Refine os filtros.");
      const map = data.variable_map ?? {};
      for (const b of Object.values(map))
        if (!isAllowedField(base, b.field)) throw new Error("Campo de variável não permitido.");
      const summary = buildAudience(rows, map, await loadOptedOutPhones(supabase, workspaceId));
      const kept = data.skip_missing
        ? summary.recipients.filter((r) => r.missing.length === 0)
        : summary.recipients;
      if (!data.skip_missing && summary.withMissing > 0)
        throw new Error(
          `${summary.withMissing} destinatário(s) ficariam com variável vazia. Defina um valor se vazio ou escolha pular.`,
        );
      recipients = kept.map((r) => ({
        phone: r.phone,
        contactId: r.contactId,
        variables: { ...r.variables, _source: r.source },
      }));
    }
    const recentDays = data.recent_contact_days ?? 7;
    const guarded = await applyRecentGuard(
      supabase,
      workspaceId,
      recentDays,
      data.recent_overrides,
      recipients,
    );
    if (guarded.kept.length === 0)
      throw new Error(
        guarded.removed.length > 0
          ? "Todos os destinatários receberam mensagem recentemente. Libere manualmente ou reduza o período."
          : "Nenhum destinatário válido no público.",
      );
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
        total: guarded.kept.length,
        recent_contact_days: recentDays,
        ...(await sdrColumns(supabase, data.sdr_playbook_id, data.template_name)),
        ...campaignIntervalColumns(data.send_interval_min_s, data.send_interval_max_s),
        workspace_id: workspaceId,
      })
      .select("id")
      .single();
    if (error) throw error;

    const rows = guarded.kept.map((r) => ({
      campaign_id: camp.id,
      owner_id: userId,
      contact_id: r.contactId,
      phone: r.phone,
      variables: r.variables,
      override_recent: r.overrideRecent,
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
    const { data: rows, error } = await context.supabase
      .from("whatsapp_campaigns")
      .update(patch)
      .eq("id", data.id)
      .select("id");
    if (error) throw error;
    // RLS nega sem erro: sem linha alterada, a pausa não valeu.
    if (!rows || rows.length === 0)
      throw new Error("Sem permissão para alterar o status desta campanha.");
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

export const previewCampaignAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => PreviewInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!data.audience) throw new Error("Escolha um público.");
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { buildAudience, isAllowedField } = await import("@/lib/whatsapp/campaign-audience");
    const { loadAudienceRows, loadOptedOutPhones } =
      await import("@/lib/whatsapp/campaign-audience.server");
    const { base, rows, truncated } = await loadAudienceRows(
      supabase,
      workspaceId,
      data.audience,
      userId,
    );
    const map = Object.fromEntries(
      Object.entries(data.variable_map ?? {}).filter(([, b]) => isAllowedField(base, b.field)),
    );
    const s = buildAudience(rows, map, await loadOptedOutPhones(supabase, workspaceId));
    const guarded = await applyRecentGuard(
      supabase,
      workspaceId,
      data.recent_contact_days ?? 7,
      data.recent_overrides,
      s.recipients,
    );
    return {
      base,
      found: rows.length,
      truncated,
      included: guarded.kept.length,
      recentRemovedCount: guarded.removed.length,
      recentOverriddenCount: guarded.kept.filter((r) => r.overrideRecent).length,
      recentRemoved: guarded.removed.slice(0, 200).map((r) => ({
        label: r.label,
        phone: r.phone,
        at: r.at,
        campaignName: r.campaignName,
      })),
      excluded: s.excluded,
      withMissing: s.withMissing,
      samples: s.recipients.slice(0, 3).map((r) => ({
        label: r.label,
        phone: r.phone,
        variables: r.variables,
        missing: r.missing,
      })),
    };
  });

export const getWhatsAppCampaignForEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: camp, error } = await context.supabase
      .from("whatsapp_campaigns")
      .select("id, body_template, template_name, media_url, sdr_playbook_id")
      .eq("id", data.id)
      .single();
    if (error) throw error;
    return camp;
  });
