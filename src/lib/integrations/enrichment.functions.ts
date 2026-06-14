// Server functions de enriquecimento (refinado) — cascade multi-provider,
// modo fill_empty/overwrite, dry-run e histórico de jobs.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ProviderEnum = z.enum(["apollo", "lusha"]);

export const ENRICH_PROVIDERS = ["apollo", "lusha"] as const;
export type EnrichProvider = (typeof ENRICH_PROVIDERS)[number];

export const enrichBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        entity: z.enum(["lead", "contact"]),
        ids: z.array(z.string().uuid()).min(1).max(500),
        providers: z.array(ProviderEnum).min(1).max(2),
        mode: z.enum(["fill_empty", "overwrite"]).default("fill_empty"),
        dryRun: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { runEnrichmentBatch } = await import("@/lib/integrations/enrichment-engine.server");
    return await runEnrichmentBatch({
      supabase: context.supabase,
      ownerId: context.userId,
      providers: data.providers,
      entity: data.entity,
      ids: data.ids,
      mode: data.mode,
      dryRun: data.dryRun,
    });
  });

export const listEnrichmentJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("enrichment_jobs")
      .select(
        "id, provider, entity, status, total, processed, succeeded, failed, credits_used, scope, started_at, finished_at, created_at, error",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return { jobs: data ?? [] };
  });

export const listJobItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: items, error } = await context.supabase
      .from("enrichment_job_items")
      .select("id, entity_id, status, before, after, error, created_at")
      .eq("job_id", data.jobId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return { items: items ?? [] };
  });
