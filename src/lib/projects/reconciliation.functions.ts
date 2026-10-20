import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  applyExactLinks,
  decideIssues,
  decideSuggestions,
  exportIssuesCsv,
  listIssues,
  loadBreakdown,
  loadLinks,
  loadOverview,
  refreshIssues,
  requireReconAdmin,
  revertLinks,
} from "./reconciliation.server";
import { ISSUE_ACTIONS, ISSUE_STATUSES, ISSUE_TYPES, RECON_PROVIDERS } from "./reconciliation-labels";

const isoDay = z.string().date();
const uuid = z.string().uuid();
const issueFilters = z.object({
  provider: z.enum(RECON_PROVIDERS).optional(),
  type: z.enum(ISSUE_TYPES).nullable().optional(),
  status: z.union([z.enum(ISSUE_STATUSES), z.literal("pending"), z.literal("all")]).optional(),
  from: isoDay.nullable().optional(),
  to: isoDay.nullable().optional(),
  userId: uuid.nullable().optional(),
  projectId: uuid.nullable().optional(),
});

export const getReconciliationOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: false });
    return loadOverview(context.supabase, ctx);
  });

export const getReconciliationBreakdown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        provider: z.enum(RECON_PROVIDERS),
        from: isoDay,
        to: isoDay,
        group: z.enum(["month", "person", "project"]),
        userId: uuid.nullable().optional(),
        projectId: uuid.nullable().optional(),
        page: z.number().int().min(1).max(10_000),
        pageSize: z.number().int().min(1).max(200),
      })
      .refine((v) => v.from <= v.to, "A data inicial deve ser anterior ou igual à final.")
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: false });
    return loadBreakdown(context.supabase, ctx, data);
  });

export const listReconciliationIssues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    issueFilters
      .extend({ page: z.number().int().min(1).max(10_000), pageSize: z.number().int().min(1).max(200) })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: false });
    return listIssues(context.supabase, ctx, data);
  });

export const exportReconciliationIssues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => issueFilters.parse(input))
  .handler(async ({ context, data }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: false });
    return exportIssuesCsv(context.supabase, ctx, data);
  });

export const refreshReconciliationIssues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: true });
    return refreshIssues(context.supabase, ctx);
  });

export const decideReconciliationIssues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ids: z.array(uuid).min(1).max(5000),
        action: z.enum(ISSUE_ACTIONS),
        note: z.string().max(2000).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: true });
    return decideIssues(context.supabase, ctx, data);
  });

export const getReconciliationLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: false });
    return loadLinks(context.supabase, ctx);
  });

export const applyReconciliationExactLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: true });
    return applyExactLinks(context.supabase, ctx);
  });

export const decideReconciliationSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ids: z.array(uuid).min(1).max(1000),
        action: z.enum(["confirm", "reject"]),
        note: z.string().max(2000).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: true });
    return decideSuggestions(context.supabase, ctx, data);
  });

export const revertReconciliationLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ kind: z.enum(["company", "person"]), subjectIds: z.array(uuid).min(1).max(1000) })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: true });
    return revertLinks(context.supabase, ctx, data);
  });
