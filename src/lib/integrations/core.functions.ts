import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission, getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import type { ProviderSlug } from "./registry";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const INTEGRATIONS_MANAGE = "system.integrations.manage.workspace";


const TRANSIENT_DB_MESSAGES = [
  "could not query the database for the schema cache",
  "statement timeout",
  "connection",
  "timeout",
  "temporarily unavailable",
];

type QueryResult<T> = { data: T | null; error: { message?: string } | null };

const isTransientDatabaseError = (error: { message?: string } | null | undefined) => {
  const message = error?.message?.toLowerCase() ?? "";
  return TRANSIENT_DB_MESSAGES.some((needle) => message.includes(needle));
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withTransientRetry<T>(
  run: () => PromiseLike<QueryResult<T>>,
  attempts = 3,
): Promise<QueryResult<T>> {
  let last: QueryResult<T> | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      last = await run();
    } catch (error) {
      last = {
        data: null,
        error: {
          message:
            error instanceof Error
              ? error.message
              : "Erro temporário ao consultar o banco de dados.",
        },
      };
    }
    if (!isTransientDatabaseError(last.error)) return last;
    if (attempt < attempts - 1) await wait(250 * (attempt + 1));
  }
  return (
    last ?? { data: null, error: { message: "Erro temporário ao consultar o banco de dados." } }
  );
}

// List integrations of the current user
export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await withTransientRetry(() =>
      supabase
        .from("integrations")
        .select("id, provider, status, config, last_used_at, created_at, updated_at")
        .order("created_at", { ascending: false }),
    );
    if (error) {
      if (isTransientDatabaseError(error))
        return { items: [], error: "Banco temporariamente ocupado. Tente novamente em instantes." };
      throw new Error(error.message);
    }
    return { items: data ?? [] };
  });

export const getIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ provider: z.string().min(1).max(40) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    // oauth_tokens is revoked from the authenticated role at the column level;
    // read it server-side via service role, scoped explicitly by owner_id.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("integrations")
      .select(
        "id, provider, status, config, oauth_tokens, credentials_secret_ref, last_used_at, created_at, updated_at",
      )
      .eq("provider", data.provider)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { integration: row };
  });

export const upsertIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        provider: z.string().min(1).max(40),
        status: z.enum(["connected", "pending", "error", "disconnected"]).optional(),
        config: z.record(z.string(), z.unknown()).optional(),
        credentials_secret_ref: z.string().max(120).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const ws = await getActiveWorkspaceId(supabase, userId);
    await assertPermission(supabase, userId, ws, INTEGRATIONS_MANAGE);
    const { data: row, error } = await supabase

      .from("integrations")
      .upsert(
        {
          owner_id: userId,
          workspace_id: workspaceId,
          provider: data.provider,
          status: data.status ?? "connected",
          config: (data.config ?? {}) as never,
          credentials_secret_ref: data.credentials_secret_ref ?? null,
        },
        { onConflict: "owner_id,provider" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { integration: row };
  });

export const disconnectIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ provider: z.string().min(1).max(40) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const ws = await getActiveWorkspaceId(supabase, userId);
    await assertPermission(supabase, userId, ws, INTEGRATIONS_MANAGE);
    const { error } = await supabase.from("integrations").delete().eq("provider", data.provider);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const listJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ provider: z.string().min(1).max(40).optional() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await withTransientRetry(() => {
      let q = supabase
        .from("enrichment_jobs")
        .select(
          "id, provider, kind, entity, scope, status, total, processed, succeeded, failed, credits_used, error, started_at, finished_at, created_at, updated_at, step_logs",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (data.provider) q = q.eq("provider", data.provider);
      return q;
    });
    if (error) {
      if (isTransientDatabaseError(error))
        return { items: [], error: "Banco temporariamente ocupado. Tente novamente em instantes." };
      throw new Error(error.message);
    }
    return { items: rows ?? [] };
  });

export const getCreditUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ provider: z.string().min(1).max(40) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const since = new Date();
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    const { data: rows, error } = await withTransientRetry(() =>
      supabase
        .from("credit_ledger")
        .select("delta")
        .eq("provider", data.provider)
        .gte("created_at", since.toISOString()),
    );
    if (error) {
      if (isTransientDatabaseError(error))
        return {
          used: 0,
          monthly_limit: null,
          per_run_confirm_above: 10,
          error: "Banco temporariamente ocupado. Tente novamente em instantes.",
        };
      throw new Error(error.message);
    }
    const used = (rows ?? []).reduce((s, r) => s + Number(r.delta || 0), 0);
    const { data: limit } = await withTransientRetry<{
      monthly_limit: number | null;
      per_run_confirm_above: number;
    }>(() =>
      supabase
        .from("credit_limits")
        .select("monthly_limit, per_run_confirm_above")
        .eq("provider", data.provider)
        .maybeSingle(),
    );
    return {
      used,
      monthly_limit: limit?.monthly_limit ?? null,
      per_run_confirm_above: limit?.per_run_confirm_above ?? 10,
    };
  });

export const setCreditLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        provider: z.string().min(1).max(40),
        monthly_limit: z.number().int().min(0).max(1_000_000).nullable(),
        per_run_confirm_above: z.number().int().min(0).max(10_000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const ws = await getActiveWorkspaceId(supabase, userId);
    await assertPermission(supabase, userId, ws, INTEGRATIONS_MANAGE);
    const { error } = await supabase.from("credit_limits").upsert(

      {
        owner_id: userId,
        workspace_id: workspaceId,
        provider: data.provider,
        monthly_limit: data.monthly_limit,
        per_run_confirm_above: data.per_run_confirm_above,
      },
      { onConflict: "owner_id,provider" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type ProviderSlugType = ProviderSlug;

// Marca como "failed" jobs que estão com status "running" mas não recebem
// atualização há mais de N segundos (zumbis após timeout do Worker).
// Considera updated_at e, como fallback, started_at.
const ZOMBIE_IDLE_SECONDS = 300;

export const sweepZombieJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ provider: z.string().min(1).max(40).optional() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const cutoff = new Date(Date.now() - ZOMBIE_IDLE_SECONDS * 1000).toISOString();
    const { data: rows, error } = await withTransientRetry(() => {
      let q = supabase
        .from("enrichment_jobs")
        .select("id, started_at, updated_at")
        .eq("status", "running");
      if (data.provider) q = q.eq("provider", data.provider);
      return q;
    });
    if (error) {
      if (isTransientDatabaseError(error)) return { swept: 0 };
      throw new Error(error.message);
    }
    const zombies = (rows ?? []).filter((r) => {
      const stamp = (r.updated_at ?? r.started_at) as string | null;
      return !stamp || stamp < cutoff;
    });
    if (zombies.length === 0) return { swept: 0 };
    const ids = zombies.map((r) => r.id);
    const { error: jobUpdateError } = await withTransientRetry(() =>
      supabase
        .from("enrichment_jobs")
        .update({
          status: "failed",
          error: `Execução interrompida por timeout do servidor (sem progresso por ${ZOMBIE_IDLE_SECONDS}s).`,
          finished_at: new Date().toISOString(),
        })
        .in("id", ids),
    );
    if (jobUpdateError) {
      if (isTransientDatabaseError(jobUpdateError)) return { swept: 0 };
      throw new Error(jobUpdateError.message);
    }
    // Também finaliza items "running" órfãos para refletir no timeline.
    const { error: itemUpdateError } = await withTransientRetry(() =>
      supabase
        .from("enrichment_job_items")
        .update({
          status: "failed",
          after: {
            error: `Interrompido por timeout (>${ZOMBIE_IDLE_SECONDS}s sem progresso).`,
          } as never,
        })
        .in("job_id", ids)
        .eq("status", "running"),
    );
    if (itemUpdateError) {
      if (isTransientDatabaseError(itemUpdateError)) return { swept: ids.length };
      throw new Error(itemUpdateError.message);
    }
    return { swept: ids.length };
  });

// Cancela manualmente um job em execução, marcando-o como "failed".
export const cancelJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("enrichment_jobs")
      .update({
        status: "failed",
        error: "Cancelado pelo usuário.",
        finished_at: new Date().toISOString(),
      })
      .eq("id", data.jobId)
      .in("status", ["running", "queued"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
