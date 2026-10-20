// Server functions do importador Clockify (finas: validação + delegação ao serviço).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { clockifyEntitySchema as entity, clockifyIdSchema as id24 } from "./clockify-schemas";

export const getClockifyImportStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("./clockify-service.server");
    const ctx = await s.requireClockifyAdmin(context.supabase, context.userId, { write: false });
    return s.getClockifyStatus(ctx);
  });

export const saveClockifyImportConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        apiKey: z.string().max(300).optional(),
        region: z.string().max(10),
        subdomain: z.string().max(120).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await import("./clockify-service.server");
    const ctx = await s.requireClockifyAdmin(context.supabase, context.userId, { write: true });
    return s.saveClockifyConnection(ctx, data);
  });

export const removeClockifyImportConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("./clockify-service.server");
    const ctx = await s.requireClockifyAdmin(context.supabase, context.userId, { write: true });
    return s.removeClockifyConnection(ctx);
  });

export const testClockifyImportConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("./clockify-service.server");
    const ctx = await s.requireClockifyAdmin(context.supabase, context.userId, { write: true });
    return s.testClockifyConnection(ctx);
  });

export const selectClockifyImportSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sourceWorkspaceId: id24 }).parse(d))
  .handler(async ({ data, context }) => {
    const s = await import("./clockify-service.server");
    const ctx = await s.requireClockifyAdmin(context.supabase, context.userId, { write: true });
    return s.selectClockifySource(ctx, data.sourceWorkspaceId);
  });

export const startClockifyImportRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        kind: z.enum(["dry_run", "import"]),
        previewRunId: z.string().uuid().optional(),
        options: z
          .object({
            refetch: z.boolean().optional(),
            noProjectPolicy: z.enum(["stage", "fallback"]).optional(),
            erpStatus: z.enum(["locked", "draft"]).optional(),
            targetCurrency: z
              .string()
              .regex(/^[A-Za-z]{3}$/)
              .optional(),
            defaultTimeZone: z.string().max(64).optional(),
          })
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await import("./clockify-service.server");
    const ctx = await s.requireClockifyAdmin(context.supabase, context.userId, { write: true });
    return s.startClockifyRun(ctx, data);
  });

export const advanceClockifyImportRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ runId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const s = await import("./clockify-service.server");
    const ctx = await s.requireClockifyAdmin(context.supabase, context.userId, { write: true });
    await s.advanceClockifyRun(ctx.workspaceId, data.runId);
    return s.getClockifyRun(ctx, data.runId);
  });

export const getClockifyImportRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ runId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const s = await import("./clockify-service.server");
    const ctx = await s.requireClockifyAdmin(context.supabase, context.userId, { write: false });
    return s.getClockifyRun(ctx, data.runId);
  });

export const setClockifyImportRunState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ runId: z.string().uuid(), action: z.enum(["cancel", "pause", "resume"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await import("./clockify-service.server");
    const ctx = await s.requireClockifyAdmin(context.supabase, context.userId, { write: true });
    return s.setClockifyRunState(ctx, data.runId, data.action);
  });

export const confirmClockifyImportPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ runId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const s = await import("./clockify-service.server");
    const ctx = await s.requireClockifyAdmin(context.supabase, context.userId, { write: true });
    return s.confirmClockifyPreview(ctx, data.runId);
  });

export const listClockifyImportMappings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ entity }).parse(d))
  .handler(async ({ data, context }) => {
    const s = await import("./clockify-service.server");
    const ctx = await s.requireClockifyAdmin(context.supabase, context.userId, { write: false });
    return s.listClockifyMappings(ctx, data.entity);
  });

export const setClockifyImportMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        entity,
        externalId: id24,
        decision: z.enum(["confirmed", "ignore", "create", "pending"]),
        targetId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await import("./clockify-service.server");
    const ctx = await s.requireClockifyAdmin(context.supabase, context.userId, { write: true });
    return s.setClockifyMapping(ctx, data);
  });

export const clockifyImportTargetOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ entity, q: z.string().max(80).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    const s = await import("./clockify-service.server");
    const ctx = await s.requireClockifyAdmin(context.supabase, context.userId, { write: false });
    return s.clockifyTargetOptions(ctx, data.entity, data.q);
  });

export const listClockifyImportStaging = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        entity: z.string().regex(/^[a-z_]{3,30}$/),
        status: z
          .string()
          .regex(/^[a-z_]{3,30}$/)
          .nullable()
          .optional(),
        reason: z
          .string()
          .regex(/^[a-z_]{3,40}$/)
          .nullable()
          .optional(),
        page: z.number().int().min(0).max(10_000).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await import("./clockify-service.server");
    const ctx = await s.requireClockifyAdmin(context.supabase, context.userId, { write: false });
    return s.listClockifyStaging(ctx, data);
  });

export const createClockifyImportIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ externalId: id24 }).parse(d))
  .handler(async ({ data, context }) => {
    const s = await import("./clockify-service.server");
    const ctx = await s.requireClockifyAdmin(context.supabase, context.userId, { write: true });
    return s.createClockifyHistoricalIdentity(ctx, data.externalId);
  });
