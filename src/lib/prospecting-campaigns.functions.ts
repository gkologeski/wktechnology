import { assertSalesArea, assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  MeetingAssignmentInput,
  normalizeMeetingAssignment,
} from "@/lib/prospecting/calls/meeting-assignment";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { startVapiCall } from "@/lib/prospecting-vapi-call.server";
import {
  AudienceRulesSchema,
  resolveAudienceServer,
  type AudienceRule,
} from "@/lib/prospecting-audience.functions";
import { isRetriableEndedReason } from "@/lib/prospecting-ended-reason";
import { normalizeRecentContact } from "@/lib/prospecting/calls/recent-contact";
import type { CallCampaignStats } from "@/lib/prospecting/calls/status-label";
import type { CallAudienceConfig } from "@/lib/prospecting/calls/call-audience";

// Carrega o cliente admin sob demanda (mantém o bundle do cliente limpo).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sbAdmin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type Campaign = {
  id: string;
  name: string;
  status: "draft" | "running" | "paused" | "done" | "canceled";
  assignment_mode: "weighted" | "segment";
  max_attempts: number;
  retry_interval_minutes: number;
  stats?: CallCampaignStats | null;
  source_type: "segment" | "saved_view" | "manual";
  source_ref: string | null;
  lead_ids: string[];
  dialing_window: { start: string; end: string; timezone: string; days: number[] };
  audience_mode: "static" | "dynamic";
  // Stored as JSON in Postgres; cast to AudienceRule[] in the UI before reading.
  audience_rules: JsonValue;
  created_at: string;
  updated_at: string;
  followup_enabled?: boolean;
  followup_sender_phone_number_id?: string | null;
  followup_template_name?: string | null;
  followup_template_language?: string;
  followup_answered_text?: string | null;
  recent_contact_days?: number;
  recent_contact_scope?: "calls" | "calls_whatsapp";
  audience_config?: JsonValue | null;
  meeting_assignment_mode?: "auto" | "member" | "round_robin" | "unassigned";
  meeting_member_ids?: string[];
  meeting_duration_minutes?: number;
  meeting_horizon_days?: number;
  meeting_template_name?: string | null;
  meeting_template_language?: string | null;
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
  vapi_call_id: string | null;
  vapi_request: JsonValue | null;
  vapi_response: JsonValue | null;
  followup_status?: string | null;
  followup_error?: string | null;
  created_at: string;
};

type JsonValue = string | number | boolean | null | { [k: string]: JsonValue } | JsonValue[];

const ACTIVE_ATTEMPT_STATUSES = ["queued", "ringing", "in_progress"];

const CallAudienceConfigSchema = z.object({
  state: z.object({
    mode: z.enum(["queue", "filter", "manual"]),
    queueId: z.string().max(64).default(""),
    base: z.enum(["leads", "contacts"]).default("leads"),
    groups: z.array(z.unknown()).max(10).default([]),
    groupsLogic: z.enum(["and", "or"]).default("or"),
    recentOverrides: z.array(z.string().max(32)).max(5000).default([]),
    excludeCustomers: z.boolean().default(true),
    excludeOpenDeals: z.boolean().default(true),
    commercialOverrides: z.array(z.string().max(32)).max(5000).default([]),
  }),
  manualRaw: z.string().max(200_000).default(""),
});

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
    .default({
      start: "09:00",
      end: "18:00",
      timezone: "America/Sao_Paulo",
      days: [1, 2, 3, 4, 5],
    }),
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
  audience_mode: z.enum(["static", "dynamic"]).default("static"),
  audience_rules: AudienceRulesSchema.default([]),
  recent_contact_days: z.number().int().min(0).max(365).default(7),
  recent_contact_scope: z.enum(["calls", "calls_whatsapp"]).default("calls"),
  audience_config: CallAudienceConfigSchema.nullable().optional(),
  meeting: MeetingAssignmentInput.optional(),
});

export const listCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.campaigns", "view")])
  .handler(async ({ context }): Promise<Campaign[]> => {
    const sb = context.supabase;
    const ws = await resolveActiveWorkspace(context.userId);
    const { data, error } = await sb
      .from("prospecting_campaigns")
      .select("*")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const list = (data ?? []) as unknown as Campaign[];
    if (!list.length) return list;
    // Contagens por campanha (cliente do usuário, RLS).
    const { data: att, error: attErr } = await sb
      .from("prospecting_call_attempts")
      .select("campaign_id, status, created_at, scheduled_at")
      .eq("workspace_id", ws)
      .in(
        "campaign_id",
        list.map((c) => c.id),
      )
      .limit(50000);
    if (attErr) throw new Error(attErr.message);
    const { summarizeCallAttempts } = await import("@/lib/prospecting/calls/status-label");
    const stats = summarizeCallAttempts(
      (att ?? []) as Array<{
        campaign_id: string;
        status: string;
        created_at: string;
        scheduled_at?: string | null;
      }>,
    );
    return list.map((c) => ({ ...c, stats: stats.get(c.id) ?? null }));
  });

export const duplicateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.campaigns", "create")])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const ws = await resolveActiveWorkspace(context.userId);
    await assertSalesRecord(sb, "prospecting_campaigns", data.id, "view");
    const { data: c, error } = await sb
      .from("prospecting_campaigns")
      .select("*")
      .eq("id", data.id)
      .eq("workspace_id", ws)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) throw new Error("Campanha não encontrada");
    const src = c as Record<string, unknown>;
    const copy: Record<string, unknown> = {};
    for (const k of [
      "name",
      "assignment_mode",
      "max_attempts",
      "retry_interval_minutes",
      "source_type",
      "source_ref",
      "lead_ids",
      "dialing_window",
      "audience_mode",
      "audience_rules",
      "recent_contact_days",
      "recent_contact_scope",
      "audience_config",
      "followup_enabled",
      "followup_sender_phone_number_id",
      "followup_template_name",
      "followup_template_language",
      "followup_answered_text",
      "meeting_assignment_mode",
      "meeting_member_ids",
      "meeting_duration_minutes",
      "meeting_horizon_days",
      "meeting_template_name",
      "meeting_template_language",
    ])
      if (k in src) copy[k] = src[k];
    copy.name = `${String(src.name ?? "Campanha")} (cópia)`;
    const { data: row, error: insErr } = await sb
      .from("prospecting_campaigns")
      .insert({ ...copy, workspace_id: ws, owner_id: context.userId, status: "draft" } as never)
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    const id = (row as { id: string }).id;
    const { data: variants } = await sb
      .from("prospecting_campaign_variants")
      .select("script_id, weight, segment_id, position")
      .eq("campaign_id", data.id);
    if (variants?.length) {
      const { error: vErr } = await sb
        .from("prospecting_campaign_variants")
        .insert(
          variants.map((v) => ({
            ...v,
            workspace_id: ws,
            owner_id: context.userId,
            campaign_id: id,
          })),
        );
      if (vErr) throw new Error(vErr.message);
    }
    return { id };
  });

export const getCampaign = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.campaigns", "view")])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ campaign: Campaign; variants: Variant[] }> => {
    const sb = context.supabase;
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
    const campaign = c as unknown as Campaign;
    return { campaign, variants: (variants ?? []) as Variant[] };
  });

export const upsertCampaign = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.campaigns", ["create", "update"])])
  .inputValidator((i) => CampaignInput.parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const ws = await resolveActiveWorkspace(context.userId);

    // Em modo estático, resolve as regras AGORA (snapshot) e usa esses ids.
    // Em modo dinâmico, lead_ids é recalculado a cada "Iniciar".
    let resolvedLeadIds: string[] = data.lead_ids;
    if (data.audience_mode === "static" && data.audience_rules.length > 0) {
      const resolved = await resolveAudienceServer(
        ws,
        data.audience_rules as AudienceRule[],
        context.supabase,
      );
      // União com lead_ids manuais já passados (caso o usuário também tenha colado UUIDs).
      const set = new Set<string>([...resolvedLeadIds, ...resolved.lead_ids]);
      resolvedLeadIds = Array.from(set);
    } else if (data.audience_mode === "dynamic") {
      resolvedLeadIds = [];
    }
    if (data.audience_config) {
      const { resolveCallAudience } = await import("@/lib/prospecting/calls/call-audience.server");
      const r = await resolveCallAudience(
        sb,
        ws,
        context.userId,
        data.id ?? null,
        data.audience_config,
        normalizeRecentContact(data),
      );
      resolvedLeadIds = r.leadIds;
    }

    let meeting: Record<string, unknown> = {};
    if (data.meeting) {
      const m = normalizeMeetingAssignment(data.meeting);
      if (m.meeting_member_ids.length) {
        // Só membros ativos do workspace ativo (RLS do usuário).
        const { data: mem, error: memErr } = await sb
          .from("workspace_members")
          .select("user_id")
          .eq("workspace_id", ws)
          .eq("status", "active")
          .in("user_id", m.meeting_member_ids);
        if (memErr) throw new Error("Não foi possível conferir os membros escolhidos.");
        if ((mem ?? []).length !== m.meeting_member_ids.length)
          throw new Error("Um dos membros escolhidos não está ativo neste workspace.");
      }
      meeting = m;
    }

    const payload = {
      ...meeting,
      workspace_id: ws,
      owner_id: context.userId,
      name: data.name,
      assignment_mode: data.assignment_mode,
      max_attempts: data.max_attempts,
      retry_interval_minutes: data.retry_interval_minutes,
      source_type: data.source_type,
      source_ref: data.source_ref ?? null,
      lead_ids: resolvedLeadIds,
      dialing_window: data.dialing_window,
      audience_mode: data.audience_mode,
      audience_rules: data.audience_rules,
      recent_contact_days: data.recent_contact_days,
      recent_contact_scope: data.recent_contact_scope,
      ...(data.audience_config
        ? {
            audience_config: data.audience_config as never,
            audience_mode: "static",
            audience_rules: [],
          }
        : {}),
    };

    let id: string;
    if (data.id) {
      id = data.id;
      await assertSalesRecord(context.supabase, "prospecting_campaigns", id, "update");
      const { owner_id: _owner, workspace_id: _ws, ...updatable } = payload;
      const { error } = await sb
        .from("prospecting_campaigns")
        .update(updatable)
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
        owner_id: context.userId,
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
  .middleware([requireSalesPermission("techsales.marketing.campaigns", "delete")])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    if (data.id)
      await assertSalesRecord(context.supabase, "prospecting_campaigns", data.id, "delete");

    const sb = context.supabase;
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: cur } = await sb
      .from("prospecting_campaigns")
      .select("status")
      .eq("id", data.id)
      .eq("workspace_id", ws)
      .maybeSingle();
    const { canDeleteCallCampaign } = await import("@/lib/prospecting/calls/status-label");
    if (cur && !canDeleteCallCampaign(String(cur.status)))
      throw new Error("Pause a campanha antes de excluir.");
    const { error } = await sb
      .from("prospecting_campaigns")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", ws);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.campaigns", "manage")])
  .inputValidator((i) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["draft", "running", "paused", "done", "canceled"]) })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const ws = await resolveActiveWorkspace(context.userId);
    await assertSalesRecord(context.supabase, "prospecting_campaigns", data.id, "manage");
    await assertSalesRecord(context.supabase, "prospecting_campaigns", data.id, "update");
    const callQueue = await sbAdmin();
    if (data.status === "running") {
      await assertSalesArea(context.supabase, "techsales.prospecting_voice", "create");
      const staleStartedBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      await callQueue
        .from("prospecting_call_attempts")
        .update({
          status: "failed",
          ended_at: new Date().toISOString(),
          ended_reason: "stale active call: no final status received",
        })
        .eq("campaign_id", data.id)
        .eq("workspace_id", ws)
        .in("status", ["ringing", "in_progress"])
        .lt("started_at", staleStartedBefore);

      const { data: c } = await sb
        .from("prospecting_campaigns")
        .select(
          "lead_ids, max_attempts, audience_mode, audience_rules, recent_contact_days, recent_contact_scope, audience_config",
        )
        .eq("id", data.id)
        .eq("workspace_id", ws)
        .single();
      let leadIds = (c?.lead_ids ?? []) as string[];
      let entity: "lead" | "contact" = "lead";
      const maxAttempts = (c?.max_attempts as number | undefined) ?? 1;
      const audienceMode = (c?.audience_mode as string | undefined) ?? "static";
      if (audienceMode === "dynamic") {
        const rules = (c?.audience_rules ?? []) as AudienceRule[];
        const resolved = await resolveAudienceServer(ws, rules, context.supabase);
        leadIds = resolved.lead_ids;
      }
      const callCfg = (c as { audience_config?: unknown } | null)?.audience_config as
        | CallAudienceConfig
        | null
        | undefined;
      if (callCfg) {
        const { resolveCallAudience } =
          await import("@/lib/prospecting/calls/call-audience.server");
        const r = await resolveCallAudience(
          sb,
          ws,
          context.userId,
          data.id,
          callCfg,
          normalizeRecentContact(c ?? {}),
        );
        entity = r.entity;
        leadIds = r.ids;
      }
      const table = entity === "contact" ? "contacts" : "leads";
      const col = entity === "contact" ? "contact_id" : "lead_id";
      const noun = entity === "contact" ? "contatos" : "leads";
      if (leadIds.length) {
        const { data: visibleRows, error: leadError } = await sb
          .from(table)
          .select("id, phone")
          .in("id", leadIds)
          .eq("workspace_id", ws);
        if (leadError) throw new Error(leadError.message);
        const visible = (visibleRows ?? []) as Array<{ id: string; phone: string | null }>;
        const visibleIds = new Set(visible.map((x) => x.id));
        if (leadIds.some((id) => !visibleIds.has(id)))
          throw new Error(
            `Há ${noun} sem acesso atual no público da campanha. Revise a seleção antes de iniciar.`,
          );
        const { data: existing } = await sb
          .from("prospecting_call_attempts")
          .select("lead_id, contact_id, status, attempt_number, ended_reason")
          .eq("campaign_id", data.id);
        const byLead = new Map<string, { blocking: boolean; lastAttempt: number }>();
        for (const x of (existing ?? []) as Array<{
          lead_id: string | null;
          contact_id: string | null;
          status: string;
          attempt_number: number;
          ended_reason: string | null;
        }>) {
          const key = x[col];
          if (!key) continue;
          const prev = byLead.get(key) ?? { blocking: false, lastAttempt: 0 };
          const isActive = ["queued", "ringing", "in_progress"].includes(x.status);
          const isTalked = x.status === "completed" && !isRetriableEndedReason(x.ended_reason);
          byLead.set(key, {
            blocking: prev.blocking || isActive || isTalked,
            lastAttempt: Math.max(prev.lastAttempt, x.attempt_number ?? 0),
          });
        }
        // Público novo já descontou contatos recentes na resolução (com liberações manuais).
        const recent = callCfg
          ? new Map<string, string>()
          : await (
              await import("@/lib/prospecting/calls/recent-contact.server")
            ).findRecentlyContacted(sb, ws, data.id, visible, normalizeRecentContact(c ?? {}));
        const rows = leadIds
          .filter((lid) => {
            if (recent.has(lid)) return false;
            const prev = byLead.get(lid);
            return !prev || (!prev.blocking && prev.lastAttempt < maxAttempts);
          })
          .map((lid) => ({
            workspace_id: ws,
            owner_id: context.userId,
            campaign_id: data.id,
            [col]: lid,
            status: "queued" as const,
            attempt_number: (byLead.get(lid)?.lastAttempt ?? 0) + 1,
            scheduled_at: new Date().toISOString(),
          }));
        if (rows.length) {
          await assertSalesRecord(context.supabase, "prospecting_campaigns", data.id, "manage");
          await assertSalesArea(context.supabase, "techsales.prospecting_voice", "create");
          const { error: queueError } = await callQueue
            .from("prospecting_call_attempts")
            .insert(rows);
          if (queueError) throw new Error(queueError.message);
        }
      }
    }
    const { error } = await sb
      .from("prospecting_campaigns")
      .update({
        status: data.status,
        ...(data.status === "running" ? { execution_user_id: context.userId } : {}),
      } as never)
      .eq("id", data.id)
      .eq("workspace_id", ws);
    if (error) throw new Error(error.message);
    if (data.status === "done" || data.status === "canceled") {
      // Encerrar: tentativas ainda na fila deixam de ser discadas.
      const { error: cErr } = await callQueue
        .from("prospecting_call_attempts")
        .update({
          status: "canceled",
          ended_at: new Date().toISOString(),
          ended_reason: "campaign canceled",
        })
        .eq("campaign_id", data.id)
        .eq("workspace_id", ws)
        .eq("status", "queued");
      if (cErr) throw new Error(cErr.message);
    }
    return { ok: true };
  });

export const previewCallAudience = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.campaigns", "view")])
  .inputValidator((i) =>
    z
      .object({
        campaign_id: z.string().uuid().nullable(),
        audience_config: CallAudienceConfigSchema,
        recent_contact_days: z.number().int().min(0).max(365).default(7),
        recent_contact_scope: z.enum(["calls", "calls_whatsapp"]).default("calls"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { resolveCallAudience } = await import("@/lib/prospecting/calls/call-audience.server");
    const r = await resolveCallAudience(
      context.supabase,
      ws,
      context.userId,
      data.campaign_id,
      data.audience_config,
      normalizeRecentContact(data),
    );
    return r.preview;
  });

export const listCampaignAttempts = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.campaigns", "view")])
  .inputValidator((i) => z.object({ campaign_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<Attempt[]> => {
    const sb = context.supabase;
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: rows, error } = await sb
      .from("prospecting_call_attempts")
      .select("*")
      .eq("workspace_id", ws)
      .or(`campaign_id.eq.${data.campaign_id},followup_campaign_id.eq.${data.campaign_id}`)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (rows ?? []) as Attempt[];
  });

export type LeadAudit = {
  lead_id: string;
  lead_name: string;
  phone: string | null;
  attempts: number;
  last_status: string | null;
  queueable: boolean;
  reasons: string[];
};

export const auditCampaignQueueability = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.campaigns", "view")])
  .inputValidator((i) => z.object({ campaign_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<LeadAudit[]> => {
    const sb = context.supabase;
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: c } = await sb
      .from("prospecting_campaigns")
      .select(
        "lead_ids, max_attempts, audience_mode, audience_rules, recent_contact_days, recent_contact_scope, audience_config",
      )
      .eq("id", data.campaign_id)
      .eq("workspace_id", ws)
      .single();
    if (!c) return [];
    let leadIds = (c.lead_ids ?? []) as string[];
    let entity: "lead" | "contact" = "lead";
    const maxAttempts = (c.max_attempts as number | undefined) ?? 1;
    const audienceMode = (c.audience_mode as string | undefined) ?? "static";
    if (audienceMode === "dynamic") {
      const rules = (c.audience_rules ?? []) as AudienceRule[];
      const resolved = await resolveAudienceServer(ws, rules, context.supabase);
      leadIds = resolved.lead_ids;
    }
    const callCfg = (c as { audience_config?: unknown }).audience_config as
      | CallAudienceConfig
      | null
      | undefined;
    if (callCfg) {
      const { resolveCallAudience } = await import("@/lib/prospecting/calls/call-audience.server");
      const r = await resolveCallAudience(
        sb,
        ws,
        context.userId,
        data.campaign_id,
        callCfg,
        normalizeRecentContact(c),
      );
      entity = r.entity;
      leadIds = r.ids;
    }
    const col = entity === "contact" ? "contact_id" : "lead_id";
    const noun = entity === "contact" ? "Contato" : "Lead";
    if (!leadIds.length) return [];

    const { data: leads } = await sb
      .from(entity === "contact" ? "contacts" : "leads")
      .select("id, first_name, last_name, company_name, phone")
      .eq("workspace_id", ws)
      .in("id", leadIds);
    const leadMap = new Map<string, { name: string; phone: string | null }>();
    for (const l of (leads ?? []) as Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      company_name: string | null;
      phone: string | null;
    }>) {
      const name =
        [l.first_name, l.last_name].filter(Boolean).join(" ").trim() ||
        l.company_name ||
        l.id.slice(0, 8);
      leadMap.set(l.id, { name, phone: l.phone });
    }

    const { data: existing } = await sb
      .from("prospecting_call_attempts")
      .select("lead_id, contact_id, status, attempt_number, created_at, ended_reason")
      .eq("campaign_id", data.campaign_id)
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false });

    type Agg = {
      count: number;
      lastStatus: string | null;
      hasBlocking: string | null;
      lastAttempt: number;
    };
    const agg = new Map<string, Agg>();
    for (const x of (existing ?? []) as Array<{
      lead_id: string | null;
      contact_id: string | null;
      status: string;
      attempt_number: number;
      created_at: string;
      ended_reason: string | null;
    }>) {
      const key = x[col];
      if (!key) continue;
      const a = agg.get(key) ?? {
        count: 0,
        lastStatus: null,
        hasBlocking: null,
        lastAttempt: 0,
      };
      a.count += 1;
      if (!a.lastStatus) a.lastStatus = x.status;
      const isActive = ["queued", "ringing", "in_progress"].includes(x.status);
      const isTalked = x.status === "completed" && !isRetriableEndedReason(x.ended_reason);
      if (!a.hasBlocking && (isActive || isTalked)) {
        a.hasBlocking = isTalked ? "conversed" : x.status;
      }
      a.lastAttempt = Math.max(a.lastAttempt, x.attempt_number ?? 0);
      agg.set(key, a);
    }

    const { findRecentlyContacted } = await import("@/lib/prospecting/calls/recent-contact.server");
    const recent = await findRecentlyContacted(
      sb,
      ws,
      data.campaign_id,
      [...leadMap.entries()].map(([id, v]) => ({ id, phone: v.phone })),
      callCfg ? { days: 0, scope: "calls" } : normalizeRecentContact(c),
      entity,
    );

    return leadIds.map<LeadAudit>((lid) => {
      const a = agg.get(lid);
      const info = leadMap.get(lid);
      const reasons: string[] = [];
      if (!info) reasons.push(`${noun} não encontrado no workspace`);
      const recentWhy = recent.get(lid);
      if (recentWhy) reasons.push(recentWhy);
      if (info && !info.phone) reasons.push(`${noun} sem telefone`);
      if (a?.hasBlocking) {
        reasons.push(
          a.hasBlocking === "conversed"
            ? "Já houve conversa real concluída (não re-enfileira)"
            : `Já está em andamento (status: ${a.hasBlocking})`,
        );
      }
      if (a && a.lastAttempt >= maxAttempts) {
        reasons.push(`Atingiu max_attempts (${a.lastAttempt}/${maxAttempts})`);
      }
      return {
        lead_id: lid,
        lead_name: info?.name ?? lid.slice(0, 8),
        phone: info?.phone ?? null,
        attempts: a?.count ?? 0,
        last_status: a?.lastStatus ?? null,
        queueable: reasons.length === 0,
        reasons,
      };
    });
  });

export const dialLeadNow = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.prospecting_voice", "create")])
  .inputValidator((i) =>
    z
      .object({
        lead_id: z.string().uuid(),
        script_id: z.string().uuid(),
        followup_campaign_id: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    if (data.followup_campaign_id)
      await assertSalesRecord(
        context.supabase,
        "prospecting_campaigns",
        data.followup_campaign_id,
        "view",
      );
    return startVapiCall({
      followupCampaignId: data.followup_campaign_id ?? null,
      workspaceId: ws,
      leadId: data.lead_id,
      scriptId: data.script_id,
      caller: context.supabase,
      actorId: context.userId,
    });
  });

export type CallFollowupConfig = {
  followup_enabled: boolean;
  followup_sender_phone_number_id: string | null;
  followup_template_name: string | null;
  followup_template_language: string;
  followup_answered_text: string | null;
};

export const saveCampaignCallFollowup = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.campaigns", "update")])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        followup_enabled: z.boolean(),
        followup_sender_phone_number_id: z.string().max(64).nullable(),
        followup_template_name: z.string().max(512).nullable(),
        followup_template_language: z.string().min(2).max(16).default("pt_BR"),
        followup_answered_text: z.string().max(1000).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSalesRecord(context.supabase, "prospecting_campaigns", data.id, "update");
    if (data.followup_enabled)
      await assertSalesArea(context.supabase, "techsales.marketing.campaigns", "create");
    if (data.followup_enabled && !data.followup_template_name)
      throw new Error("Escolha o modelo aprovado usado quando o cliente não atender.");
    const ws = await resolveActiveWorkspace(context.userId);
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("prospecting_campaigns")
      .update(patch)
      .eq("id", id)
      .eq("workspace_id", ws);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCallFollowupSenders = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.campaigns", "view")])
  .handler(async ({ context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data, error } = await context.supabase
      .from("wa_cloud_numbers")
      .select("phone_number_id, display_phone_number, verified_name")
      .eq("workspace_id", ws);
    if (error) return [] as Array<{ id: string; label: string }>;
    return (data ?? []).map((n) => ({
      id: String(n.phone_number_id),
      label: `${n.verified_name ?? "Meta"} · ${n.display_phone_number ?? ""}`,
    }));
  });

export const listCallFollowupTemplates = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.campaigns", "view")])
  .inputValidator((i) => z.object({ senderId: z.string().max(64).nullable() }).parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { loadApprovedTemplates } = await import("@/lib/whatsapp/templates.server");
    try {
      const items = await loadApprovedTemplates(context.supabase, ws, {
        phoneNumberId: data.senderId,
      });
      return {
        items: items.map((t) => ({ name: t.name, language: t.language ?? "pt_BR" })),
        error: null as string | null,
      };
    } catch (e) {
      console.error("listCallFollowupTemplates", e instanceof Error ? e.message : e);
      return { items: [], error: "Não foi possível carregar os modelos deste remetente." };
    }
  });

/** Ids dos membros ativos com agenda Google conectada (quem pode receber reuniões da ligação). */
export const listMeetingHosts = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.campaigns", "view")])
  .handler(async ({ context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data, error } = await context.supabase.rpc("call_meeting_hosts_with_calendar", {
      _workspace: ws,
    });
    if (error) throw new Error("Não foi possível carregar quem tem agenda conectada.");
    return { userIds: ((data ?? []) as unknown as string[]).map(String) };
  });
