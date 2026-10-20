// Server functions do importador Jibble (finas: validação + delegação ao serviço).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const mapEntity = z.enum(["person", "client", "project"]);

export const getJibbleImportStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("./jibble-service.server");
    const ctx = await s.requireJibbleAdmin(context.supabase, context.userId, { write: false });
    return s.getJibbleStatus(ctx);
  });

export const saveJibbleImportConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ clientId: z.string().min(8).max(300), clientSecret: z.string().min(8).max(500) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await import("./jibble-service.server");
    const ctx = await s.requireJibbleAdmin(context.supabase, context.userId, { write: true });
    return s.saveJibbleConnection(ctx, data);
  });

export const removeJibbleImportConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("./jibble-service.server");
    const ctx = await s.requireJibbleAdmin(context.supabase, context.userId, { write: true });
    return s.removeJibbleConnection(ctx);
  });

export const testJibbleImportConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("./jibble-service.server");
    const ctx = await s.requireJibbleAdmin(context.supabase, context.userId, { write: true });
    return s.testJibbleConnection(ctx);
  });

export const confirmJibbleImportSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orgId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const s = await import("./jibble-service.server");
    const ctx = await s.requireJibbleAdmin(context.supabase, context.userId, { write: true });
    return s.confirmJibbleSource(ctx, data.orgId);
  });

export const startJibbleImportRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        kind: z.enum(["dry_run", "import", "rollback"]),
        previewRunId: uuid.optional(),
        targetRunId: uuid.optional(),
        options: z
          .object({
            fromDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .nullable()
              .optional(),
            erpStatus: z.enum(["locked", "draft"]).optional(),
            billable: z.boolean().optional(),
            refetch: z.boolean().optional(),
          })
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await import("./jibble-service.server");
    const ctx = await s.requireJibbleAdmin(context.supabase, context.userId, { write: true });
    return s.startJibbleRun(ctx, data);
  });

export const advanceJibbleImportRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ runId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const s = await import("./jibble-service.server");
    const ctx = await s.requireJibbleAdmin(context.supabase, context.userId, { write: true });
    return s.advanceJibbleRun(ctx.workspaceId, data.runId);
  });

export const setJibbleImportRunState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ runId: uuid, action: z.enum(["cancel", "pause", "resume"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await import("./jibble-service.server");
    const ctx = await s.requireJibbleAdmin(context.supabase, context.userId, { write: true });
    return s.setJibbleRunState(ctx, data.runId, data.action);
  });

export const confirmJibbleImportPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ runId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const s = await import("./jibble-service.server");
    const ctx = await s.requireJibbleAdmin(context.supabase, context.userId, { write: true });
    return s.confirmJibblePreview(ctx, data.runId);
  });

export const listJibbleImportMappings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ entity: mapEntity }).parse(d))
  .handler(async ({ data, context }) => {
    const s = await import("./jibble-service.server");
    const ctx = await s.requireJibbleAdmin(context.supabase, context.userId, { write: false });
    return s.listJibbleMappings(ctx, data.entity);
  });

export const setJibbleImportMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        entity: mapEntity,
        externalId: uuid,
        decision: z.enum(["confirmed", "ignore", "create", "pending"]),
        targetId: uuid.nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await import("./jibble-service.server");
    const ctx = await s.requireJibbleAdmin(context.supabase, context.userId, { write: true });
    return s.setJibbleMapping(ctx, data);
  });

export const jibbleImportTargetOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ entity: mapEntity, q: z.string().max(80).default("") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await import("./jibble-service.server");
    const ctx = await s.requireJibbleAdmin(context.supabase, context.userId, { write: false });
    return s.jibbleTargetOptions(ctx, data.entity, data.q);
  });

export const listJibbleImportStaging = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        entity: z.string().regex(/^[a-z_]{3,40}$/),
        status: z.string().max(30).nullable().optional(),
        reason: z.string().max(60).nullable().optional(),
        page: z.number().int().min(0).max(10_000).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await import("./jibble-service.server");
    const ctx = await s.requireJibbleAdmin(context.supabase, context.userId, { write: false });
    return s.listJibbleStaging(ctx, data);
  });

export const listJibbleImportDuplicates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        decision: z.enum(["pending", "same_event", "distinct"]).nullable().optional(),
        page: z.number().int().min(0).max(10_000).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await import("./jibble-service.server");
    const ctx = await s.requireJibbleAdmin(context.supabase, context.userId, { write: false });
    return s.listJibbleDuplicates(ctx, { decision: data.decision ?? null, page: data.page });
  });

export const decideJibbleImportDuplicate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: uuid, decision: z.enum(["same_event", "distinct", "pending"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await import("./jibble-service.server");
    const ctx = await s.requireJibbleAdmin(context.supabase, context.userId, { write: true });
    return s.decideJibbleDuplicate(ctx, data.id, data.decision);
  });
