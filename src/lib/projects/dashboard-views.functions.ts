import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  actOnDashAlert,
  exportDashDrill,
  loadDashDrill,
  loadDashFilterOptions,
  loadDashRiskRules,
  loadDashScope,
  loadDashSummary,
  refreshDashAlerts,
  saveDashRiskRules,
} from "./dashboard-views.server";
import { DASH_DATASETS, DASH_VIEWS } from "./dashboard-views.shared";
import { isIanaTimeZone, validateIsoRange } from "./reconciliation-labels";

const uuid = z.string().uuid();
const filtersSchema = z
  .object({
    from: z.string().date(),
    to: z.string().date(),
    tz: z.string().min(1).max(64),
    compare: z.boolean().optional(),
    project: uuid.optional(),
    company: uuid.optional(),
    service: uuid.optional(),
    leader: uuid.optional(),
    person: uuid.optional(),
    origin: z.string().max(20).optional(),
    status: z.string().max(20).optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
  })
  .superRefine((v, ctx) => {
    const msg = validateIsoRange(v.from, v.to);
    if (msg) ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
    if (!isIanaTimeZone(v.tz))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fuso horário inválido." });
  });
const view = z.enum(DASH_VIEWS);
const dataset = z.enum(DASH_DATASETS);
const metric = z.string().regex(/^[a-z_]{1,48}$/);

export const getDashScope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadDashScope(context.supabase));

export const getDashSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ view, filters: filtersSchema }).parse(input))
  .handler(async ({ context, data }) => loadDashSummary(context.supabase, data.view, data.filters));

export const getDashDrill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        view,
        dataset,
        metric,
        filters: filtersSchema,
        limit: z.number().int().min(1).max(200),
        offset: z.number().int().min(0).max(1_000_000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) =>
    loadDashDrill(
      context.supabase,
      data.view,
      data.dataset,
      data.metric,
      data.filters,
      data.limit,
      data.offset,
    ),
  );

export const exportDashList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ view, dataset, metric, filters: filtersSchema }).parse(input),
  )
  .handler(async ({ context, data }) =>
    exportDashDrill(context.supabase, data.view, data.dataset, data.metric, data.filters),
  );

export const searchDashFilterOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z.enum(["project", "company", "service", "leader", "person"]),
        q: z.string().max(80),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => loadDashFilterOptions(context.supabase, data.kind, data.q));

export const reevaluateDashAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ tz: z.string().min(1).max(64) })
      .refine((v) => isIanaTimeZone(v.tz), "Fuso horário inválido.")
      .parse(input),
  )
  .handler(async ({ context, data }) => refreshDashAlerts(context.supabase, data.tz));

export const actOnAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        alertId: uuid,
        action: z.enum(["ack", "snooze", "resolve", "reopen"]),
        note: z.string().trim().min(5).max(1000),
        until: z.string().date().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) =>
    actOnDashAlert(context.supabase, data.alertId, data.action, data.note, data.until),
  );

export const getRiskRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: uuid.nullable() }).parse(input))
  .handler(async ({ context, data }) => loadDashRiskRules(context.supabase, data.projectId));

export const saveRiskRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        projectId: uuid.nullable(),
        rules: z.record(
          z.string(),
          z.record(z.string(), z.union([z.boolean(), z.number(), z.string()])),
        ),
        note: z.string().trim().min(5).max(500),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) =>
    saveDashRiskRules(context.supabase, data.projectId, data.rules, data.note),
  );
