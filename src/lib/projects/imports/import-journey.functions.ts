import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { allowedImportProviders, authorizeImportJourney } from "./import-journey-access.server";
import { IMPORT_PROVIDERS } from "./import-journey";

const provider = z.enum(IMPORT_PROVIDERS),
  uuid = z.string().uuid();
export const getImportJourneyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ctx, providers } = await allowedImportProviders(context.supabase, context.userId);
    const s = await import("./import-journey-status.server");
    return s.getJourneyStatus(ctx, providers);
  });
export const startImportJourney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ providers: z.array(provider).min(1).max(3) }).parse(d))
  .handler(async ({ data, context }) => {
    const providers = [...new Set(data.providers)];
    const authorized = await Promise.all(
      providers.map((p) => authorizeImportJourney(context.supabase, context.userId, p, true)),
    );
    const s = await import("./import-journey-engine.server");
    return s.startJourney(authorized[0], providers);
  });
export const advanceImportJourney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ provider, runId: uuid, action: z.enum(["advance", "resume"]).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = await authorizeImportJourney(context.supabase, context.userId, data.provider, true);
    const s = await import("./import-journey-engine.server");
    return s.advanceJourney(ctx, data);
  });
export const listImportJourneyRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        provider: provider.optional(),
        status: z.enum(["received", "pending", "ready"]).optional(),
        issuesOnly: z.boolean().optional(),
        assigneeId: uuid.optional(),
        q: z.string().max(200).optional(),
        page: z.number().int().min(0).max(1000000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { ctx, providers } = await allowedImportProviders(context.supabase, context.userId);
    if (data.provider)
      await authorizeImportJourney(context.supabase, context.userId, data.provider, false);
    const s = await import("./import-journey-records.server");
    return s.listJourneyRecords(ctx, providers, data);
  });
export const getImportJourneyRecord = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, versionId: uuid.optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { ctx } = await allowedImportProviders(context.supabase, context.userId);
    const s = await import("./import-journey-records.server");
    return s.getJourneyRecord(ctx, data.id, data.versionId);
  });
export const listImportJourneyEvidence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: uuid, kind: z.enum(["versions", "history"]), cursor: uuid.optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { ctx } = await allowedImportProviders(context.supabase, context.userId);
    const s = await import("./import-journey-evidence.server");
    return s.listJourneyEvidence(ctx, data);
  });
export const listImportJourneyTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid,
        q: z.string().max(100).default(""),
        purpose: z.enum(["link", "review"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { ctx } = await allowedImportProviders(context.supabase, context.userId);
    const s = await import("./import-journey-records.server");
    return s.listJourneyTargets(ctx, data.id, data.q, data.purpose);
  });
export const getImportJourneyFile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, fileId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { ctx } = await allowedImportProviders(context.supabase, context.userId);
    const s = await import("./import-journey-records.server");
    return s.getJourneyFile(ctx, data.id, data.fileId);
  });
export const reviewImportJourneyRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid,
        action: z.enum(["review", "link"]),
        note: z.string().trim().min(8).max(4000),
        versionId: uuid,
        targetId: uuid.optional(),
        assigneeId: uuid.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { ctx } = await allowedImportProviders(context.supabase, context.userId);
    const s = await import("./import-journey-records.server");
    return s.reviewJourneyRecord(ctx, data);
  });
