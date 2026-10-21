// TechProjects Ciclo 4 — tarifas/custos com vigência e modelo de cobrança (dono da cobrança).
// Regras e autorização no banco (`project_rate_*`, `project_billing_config_*`); aqui só forma da entrada.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import {
  configSave,
  isoDate,
  money,
  rateCreate,
  rateTarget,
  reason,
  shortReason,
  uuid,
} from "@/lib/projects/billing.schemas";
import {
  loadConfigs,
  loadContractBillingContext,
  loadRateOptions,
  loadRates,
  rpc,
} from "@/lib/projects/billing.server";
import type { LegacyRateCandidates, RateImpact } from "@/lib/projects/billing.types";

// ============= tarifas e custos =============

export const listRates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    return loadRates(context.supabase, ws);
  });

export const listRateTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    return loadRateOptions(context.supabase, ws);
  });

export const previewRateImpact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        scope: z.enum(["exception", "allocation", "service", "person", "catalog"]),
        target: rateTarget,
        from: isoDate,
        to: isoDate.nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    return rpc<RateImpact>(context.supabase, "project_rate_impact", {
      p_ws: ws,
      p_scope: data.scope,
      p_target: data.target,
      p_from: data.from,
      p_to: data.to,
    });
  });

export const createRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => rateCreate.parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const id = await rpc<string>(context.supabase, "project_rate_create", {
      p_ws: ws,
      p_kind: data.kind,
      p_scope: data.scope,
      p_target: data.target,
      p_unit: data.unit,
      p_proration: data.proration,
      p_currency: data.currency,
      p_amount: data.amount,
      p_from: data.validFrom,
      p_to: data.validTo,
      p_reason: data.reason,
      p_confirm_retroactive: data.confirmRetroactive,
    });
    return { id };
  });

export const splitRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        rateId: uuid,
        effective: isoDate,
        amount: money,
        reason: shortReason,
        confirmRetroactive: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const id = await rpc<string>(context.supabase, "project_rate_split", {
      p_rate: data.rateId,
      p_effective: data.effective,
      p_amount: data.amount,
      p_reason: data.reason,
      p_confirm_retroactive: data.confirmRetroactive,
    });
    return { id };
  });

export const endRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ rateId: uuid, end: isoDate, reason: shortReason, confirmRetroactive: z.boolean() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await rpc(context.supabase, "project_rate_end", {
      p_rate: data.rateId,
      p_end: data.end,
      p_reason: data.reason,
      p_confirm_retroactive: data.confirmRetroactive,
    });
    return { ok: true };
  });

export const listLegacyRateCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    return rpc<LegacyRateCandidates>(context.supabase, "project_rate_legacy_candidates", {
      p_ws: ws,
    });
  });

// ============= modelo de cobrança =============

export const getContractBillingContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ contractId: uuid }).parse(i))
  .handler(async ({ data, context }) =>
    loadContractBillingContext(context.supabase, data.contractId),
  );

export const listBillingConfigs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ contractId: uuid }).parse(i))
  .handler(async ({ data, context }) => loadConfigs(context.supabase, data.contractId));

export const saveBillingConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => configSave.parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    return rpc<{ id: string; version: number; legacy_entries: number }>(
      context.supabase,
      "project_billing_config_save",
      {
        p_ws: ws,
        p_contract: data.contractId,
        p_service: data.serviceId,
        p_model: data.model,
        p_params: data.params,
        p_valid_from: data.validFrom,
        p_reason: data.reason,
      },
    );
  });

export const endBillingConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ configId: uuid, end: isoDate, reason }).parse(i))
  .handler(async ({ data, context }) => {
    await rpc(context.supabase, "project_billing_config_end", {
      p_id: data.configId,
      p_end: data.end,
      p_reason: data.reason,
    });
    return { ok: true };
  });
