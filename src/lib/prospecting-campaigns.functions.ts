import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSalesArea, assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { startVapiCall } from "@/lib/prospecting-vapi-call.server";
import {
  AudienceRulesSchema,
  resolveAudienceServer,
  type AudienceRule,
} from "@/lib/prospecting-audience.functions";
import { isRetriableEndedReason } from "@/lib/prospecting-ended-reason";


// Carrega o cliente admin sob demanda (mantém o bundle do cliente limpo).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sbAdmin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

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
  audience_mode: "static" | "dynamic";
  // Stored as JSON in Postgres; cast to AudienceRule[] in the UI before reading.
  audience_rules: JsonValue;
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
  vapi_call_id: string | null;
  vapi_request: JsonValue | null;
  vapi_response: JsonValue | null;
  created_at: string;
};

type JsonValue = string | number | boolean | null | { [k: string]: JsonValue } | JsonValue[];

const ACTIVE_ATTEMPT_STATUSES = ["queued", "ringing", "in_progress"];

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
    return (data ?? []) as unknown as Campaign[];
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

    const payload = {
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
      .object({ id: z.string().uuid(), status: z.enum(["draft", "running", "paused", "done"]) })
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
        .select("lead_ids, max_attempts, audience_mode, audience_rules")
        .eq("id", data.id)
        .eq("workspace_id", ws)
        .single();
      let leadIds = (c?.lead_ids ?? []) as string[];
      const maxAttempts = (c?.max_attempts as number | undefined) ?? 1;
      const audienceMode = (c?.audience_mode as string | undefined) ?? "static";
      if (audienceMode === "dynamic") {
        const rules = (c?.audience_rules ?? []) as AudienceRule[];
        const resolved = await resolveAudienceServer(ws, rules, context.supabase);
        leadIds = resolved.lead_ids;
      }
      if (leadIds.length) {
        const { data: visibleLeads, error: leadError } = await sb
          .from("leads")
          .select("id")
          .in("id", leadIds)
          .eq("workspace_id", ws);
        if (leadError) throw new Error(leadError.message);
        const visibleIds = new Set((visibleLeads ?? []).map((x) => x.id));
        if (leadIds.some((id) => !visibleIds.has(id)))
          throw new Error(
            "Há leads sem acesso atual no público da campanha. Revise a seleção antes de iniciar.",
          );
        const { data: existing } = await sb
          .from("prospecting_call_attempts")
          .select("lead_id, status, attempt_number, ended_reason")
          .eq("campaign_id", data.id);
        const byLead = new Map<string, { blocking: boolean; lastAttempt: number }>();
        for (const x of (existing ?? []) as Array<{
          lead_id: string;
          status: string;
          attempt_number: number;
          ended_reason: string | null;
        }>) {
          const prev = byLead.get(x.lead_id) ?? { blocking: false, lastAttempt: 0 };
          const isActive = ["queued", "ringing", "in_progress"].includes(x.status);
          const isTalked = x.status === "completed" && !isRetriableEndedReason(x.ended_reason);
          byLead.set(x.lead_id, {
            blocking: prev.blocking || isActive || isTalked,
            lastAttempt: Math.max(prev.lastAttempt, x.attempt_number ?? 0),
          });
        }
        const rows = leadIds
          .filter((lid) => {
            const prev = byLead.get(lid);
            return !prev || (!prev.blocking && prev.lastAttempt < maxAttempts);
          })
          .map((lid) => ({
            workspace_id: ws,
            owner_id: context.userId,
            campaign_id: data.id,
            lead_id: lid,
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
    return { ok: true };
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
      .eq("campaign_id", data.campaign_id)
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
      .select("lead_ids, max_attempts, audience_mode, audience_rules")
      .eq("id", data.campaign_id)
      .eq("workspace_id", ws)
      .single();
    if (!c) return [];
    let leadIds = (c.lead_ids ?? []) as string[];
    const maxAttempts = (c.max_attempts as number | undefined) ?? 1;
    const audienceMode = (c.audience_mode as string | undefined) ?? "static";
    if (audienceMode === "dynamic") {
      const rules = (c.audience_rules ?? []) as AudienceRule[];
      const resolved = await resolveAudienceServer(ws, rules, context.supabase);
      leadIds = resolved.lead_ids;
    }
    if (!leadIds.length) return [];

    const { data: leads } = await sb
      .from("leads")
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
      .select("lead_id, status, attempt_number, created_at, ended_reason")
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
      lead_id: string;
      status: string;
      attempt_number: number;
      created_at: string;
      ended_reason: string | null;
    }>) {
      const a = agg.get(x.lead_id) ?? {
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
      agg.set(x.lead_id, a);
    }

    return leadIds.map<LeadAudit>((lid) => {
      const a = agg.get(lid);
      const info = leadMap.get(lid);
      const reasons: string[] = [];
      if (!info) reasons.push("Lead não encontrado no workspace");
      if (info && !info.phone) reasons.push("Lead sem telefone");
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
    z.object({ lead_id: z.string().uuid(), script_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    return startVapiCall({
      workspaceId: ws,
      leadId: data.lead_id,
      scriptId: data.script_id,
      caller: context.supabase,
      actorId: context.userId,
    });
  });
