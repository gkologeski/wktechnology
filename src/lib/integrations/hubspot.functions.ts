import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computePlannedCapped, type CountDeps } from "./hubspot-count";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import {
  type HSRec,
  type LogEntry,
  ObjectKey,
  type PipelineMaps,
  STEP_DEPS,
  ScopeSchema,
  type StepName,
  allAssocIds,
  batchRead,
  fetchCompanyIdsCount,
  firstAssocId,
  getAssoc,
  hsFetch,
  listAll,
  mapDealStageEnum,
  mapLeadStatusEnum,
  originalCreatedAt,
  planSteps,
  searchTotal,
  sleep,
  syncDealPipelines,
  syncLeadPipeline,
  unionAssocIds,
} from "./hubspot.server";

import { countryFromRecordField, sourcePhone } from "@/lib/phone/phone-boundary";
export const countHubspotObjects = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.hubspot_sync", "view")])
  .inputValidator((input: unknown) =>
    z
      .object({
        objects: z.array(ObjectKey).min(1),
        mode: z.enum(["linked", "full"]).default("linked"),
        maxCompanies: z.number().min(1).max(2000).default(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    async function localCount(key: ObjectKey): Promise<number> {
      const table = key === "activities" ? "activities" : key;
      const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
      return count ?? 0;
    }

    async function remoteCount(key: ObjectKey): Promise<number> {
      if (key === "companies") return searchTotal("companies");
      if (key === "contacts") return searchTotal("contacts");
      if (key === "deals") return searchTotal("deals");
      if (key === "leads") return searchTotal("leads");
      if (key === "tickets") return searchTotal("tickets");
      const parts = await Promise.all([
        searchTotal("notes"),
        searchTotal("calls"),
        searchTotal("meetings"),
        searchTotal("tasks"),
        searchTotal("emails"),
      ]);
      return parts.reduce((a, b) => a + b, 0);
    }

    const out: Record<string, { planned: number; remote: number; local: number }> = {};

    // Modo "full": planned = remote para todos os objetos (sem cap, sem filtro de vínculo).
    if (data.mode === "full") {
      for (const k of data.objects) {
        const [remote, local] = await Promise.all([remoteCount(k), localCount(k)]);
        out[k] = { planned: remote, remote, local };
      }
      return out as Record<ObjectKey, { planned: number; remote: number; local: number }>;
    }

    // Modo "linked": filhos respeitam vínculo com as empresas dentro de maxCompanies.
    let companyIdsPromise: Promise<string[]> | null = null;
    const getCompanyIds = () => {
      if (!companyIdsPromise) companyIdsPromise = fetchCompanyIdsCount(data.maxCompanies);
      return companyIdsPromise;
    };

    const deps: CountDeps = {
      remoteCount,
      getCompanyIds,
      unionAssocIds,
      readContactProps: (ids, props) => batchRead("contacts", ids, props),
    };

    for (const k of data.objects) {
      const [remote, local] = await Promise.all([remoteCount(k), localCount(k)]);
      const planned = await computePlannedCapped(k, remote, data.maxCompanies, deps);
      out[k] = { planned, remote, local };
    }
    return out as Record<ObjectKey, { planned: number; remote: number; local: number }>;
  });

// Mantido para compat
export const previewHubspotCounts = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.hubspot_sync", "view")])
  .handler(async () => {
    const [companies, contacts, deals] = await Promise.all([
      searchTotal("companies"),
      searchTotal("contacts"),
      searchTotal("deals"),
    ]);
    return { companies, contacts, deals };
  });

// ─── Enqueue-only: cria job + items e retorna. A execução roda em ticks
// (UI/cron chamam tickHubspotImportJob), evitando o timeout de ~30s do Worker.
export const startHubspotImport = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.hubspot_sync", "manage")])
  .inputValidator((input: unknown) => ScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { planStepsFromScope, ensureJobItems } = await import("./hubspot-tick.server");
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const scope = data;
    // Em modo "full" usamos um teto alto pra companies; demais steps são best-effort.
    const effectiveScope = {
      ...scope,
      maxCompanies: scope.mode === "full" ? 100000 : scope.maxCompanies,
    };
    const steps = planStepsFromScope(effectiveScope as never);

    const { data: job, error: jobErr } = await supabase
      .from("enrichment_jobs")
      .insert({
        owner_id: userId,
        workspace_id: workspaceId,
        provider: "hubspot",
        kind: "import",
        entity: "lead",
        status: "queued",
        total: steps.length,
        scope: effectiveScope as never,
        step_logs: [
          {
            ts: new Date().toISOString(),
            level: "info",
            step: "queued",
            message: `Job criado com ${steps.length} etapas. Aguardando execução…`,
          },
        ],
      })
      .select("id")
      .single();
    if (jobErr || !job) throw new Error(`Erro ao criar job: ${jobErr?.message}`);
    const jobId = job.id;

    await ensureJobItems(supabase, jobId, steps as never);
    return { jobId, steps };
  });

// Limpa tabelas locais (apenas registros do usuário) antes de importar.
export const clearHubspotLocalTables = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.hubspot_sync", "manage")])
  .inputValidator((input: unknown) =>
    z
      .object({
        companies: z.boolean().optional(),
        contacts: z.boolean().optional(),
        deals: z.boolean().optional(),
        leads: z.boolean().optional(),
        tickets: z.boolean().optional(),
        activities: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const tables: ("companies" | "contacts" | "deals" | "leads" | "tickets" | "activities")[] = [];
    if (data.companies) tables.push("companies");
    if (data.contacts) tables.push("contacts");
    if (data.deals) tables.push("deals");
    if (data.leads) tables.push("leads");
    if (data.tickets) tables.push("tickets");
    if (data.activities) tables.push("activities");

    const result: Record<string, number> = {};
    for (const t of tables) {
      const { count, error } = await supabase
        .from(t)
        .delete({ count: "exact" })
        .eq("workspace_id", workspaceId);
      if (error) throw new Error(`Falha ao limpar ${t}: ${error.message}`);
      result[t] = count ?? 0;
    }
    return { cleared: result };
  });

// Executa UM step do job HubSpot. Chamado pela UI (polling) e pelo cron.
export const tickHubspotImportJob = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.hubspot_sync", "manage")])
  .inputValidator((input: unknown) =>
    z.object({ jobId: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { tickOnce } = await import("./hubspot-tick.server");
    const { supabase, userId } = context;
    const result = await tickOnce(supabase, data.jobId, userId);
    return result;
  });

export const resumeHubspotImport = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.hubspot_sync", "manage")])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: job, error: jobErr } = await supabase
      .from("enrichment_jobs")
      .select("id, status")
      .eq("id", data.jobId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (jobErr) throw new Error(jobErr.message);
    if (!job) throw new Error("Importação não encontrada");

    const { data: items, error: itemsErr } = await supabase
      .from("enrichment_job_items")
      .select("id, status, before, after")
      .eq("job_id", data.jobId);
    if (itemsErr) throw new Error(itemsErr.message);

    const stepByItem = new Map<string, string>();
    const depsByStep = new Map<string, string[]>();
    for (const item of items ?? []) {
      const before = ((item.before as Record<string, unknown> | null) ?? {}) as Record<
        string,
        unknown
      >;
      const step = typeof before.step === "string" ? before.step : undefined;
      if (!step) continue;
      stepByItem.set(item.id, step);
      depsByStep.set(step, Array.isArray(before.depends_on) ? (before.depends_on as string[]) : []);
    }
    const resumeSteps = new Set(
      (items ?? [])
        .filter((item) => {
          if (item.status === "failed" || item.status === "running") return true;
          const before = ((item.before as Record<string, unknown> | null) ?? {}) as Record<
            string,
            unknown
          >;
          const after = ((item.after as Record<string, unknown> | null) ?? {}) as Record<
            string,
            unknown
          >;
          const deps = Array.isArray(before.depends_on) ? (before.depends_on as string[]) : [];
          const zeroResult =
            item.status === "done" &&
            Number(after.succeeded ?? 0) === 0 &&
            Number(after.failed ?? 0) === 0 &&
            (!Array.isArray(after.imported_hs_ids) || after.imported_hs_ids.length === 0);
          return zeroResult && deps.length > 0;
        })
        .map((item) => stepByItem.get(item.id))
        .filter(Boolean) as string[],
    );
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const [step, deps] of depsByStep.entries()) {
        if (!resumeSteps.has(step) && deps.some((dep) => resumeSteps.has(dep))) {
          resumeSteps.add(step);
          expanded = true;
        }
      }
    }

    let resumedItems = 0;
    for (const item of items ?? []) {
      const step = stepByItem.get(item.id);
      if (!step || !resumeSteps.has(step)) continue;
      const before = ((item.before as Record<string, unknown> | null) ?? {}) as Record<
        string,
        unknown
      >;
      const after = ((item.after as Record<string, unknown> | null) ?? {}) as Record<
        string,
        unknown
      >;
      const keepProgress = item.status === "failed" || item.status === "running";
      const mergedBefore = {
        ...before,
        cursor: keepProgress ? before.cursor : undefined,
        read_index: keepProgress ? before.read_index : 0,
        running_succeeded: keepProgress ? (before.running_succeeded ?? after.succeeded ?? 0) : 0,
        running_failed: keepProgress ? (before.running_failed ?? after.failed ?? 0) : 0,
        imported_hs_ids: keepProgress
          ? (before.imported_hs_ids ?? after.imported_hs_ids ?? [])
          : [],
      };
      const { error } = await supabase
        .from("enrichment_job_items")
        .update({ status: "pending", before: mergedBefore as never, after: null, error: null })
        .eq("id", item.id);
      if (error) throw new Error(error.message);
      resumedItems++;
    }

    if (resumedItems === 0) throw new Error("Não há etapas para continuar nesta importação");
    const doneCount = (items ?? []).filter((it) => it.status === "done").length;
    await supabase
      .from("enrichment_jobs")
      .update({
        status: "queued",
        processed: doneCount,
        error: null,
        finished_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.jobId);
    return { ok: true, resumedItems };
  });

export const cancelHubspotImport = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.hubspot_sync", "manage")])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: job, error: jobErr } = await supabase
      .from("enrichment_jobs")
      .select("id, status, step_logs")
      .eq("id", data.jobId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (jobErr) throw new Error(jobErr.message);
    if (!job) throw new Error("Importação não encontrada");
    if (job.status === "done" || job.status === "failed") {
      return { ok: true, alreadyFinished: true };
    }
    const logs = Array.isArray(job.step_logs)
      ? (job.step_logs as Array<Record<string, unknown>>)
      : [];
    const next = [
      ...logs,
      {
        ts: new Date().toISOString(),
        level: "warn",
        step: "cancel",
        message: "Importação cancelada pelo usuário",
      },
    ].slice(-300);
    await supabase
      .from("enrichment_jobs")
      .update({
        status: "failed",
        error: "Cancelado pelo usuário",
        finished_at: new Date().toISOString(),
        step_logs: next as never,
      })
      .eq("id", data.jobId);
    // Marca itens pendentes/em execução como failed para o tick parar de tentar
    await supabase
      .from("enrichment_job_items")
      .update({ status: "failed", error: "Cancelado pelo usuário" } as never)
      .eq("job_id", data.jobId)
      .in("status", ["pending", "running"]);
    return { ok: true };
  });

// Stub do antigo handler — mantido apenas para satisfazer referências; o
// código abaixo está inativo agora que a execução é tick-based.

// ─────────────────────────── Legacy compat ────────────────────────────────────
export const previewHubspotLeads = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.hubspot_sync", "view")])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().min(1).max(100).default(10) }).parse(input),
  )
  .handler(async ({ data }) => {
    const params: Record<string, string> = {
      limit: String(data.limit),
      properties: "firstname,lastname,email,phone,company,hs_analytics_source",
    };
    const r = (await hsFetch("/crm/v3/objects/contacts", params)) as {
      results: { id: string; properties: Record<string, string | null | undefined> }[];
    };
    return {
      contacts: r.results.map((c) => ({
        id: c.id,
        first_name: c.properties.firstname ?? "",
        last_name: c.properties.lastname ?? "",
        email: c.properties.email ?? "",
        phone: c.properties.phone ?? "",
        company_name: c.properties.company ?? "",
        source: c.properties.hs_analytics_source ?? "hubspot",
      })),
    };
  });
