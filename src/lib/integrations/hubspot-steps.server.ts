// Per-step execution helpers for HubSpot import.
// Each step runs in its own HTTP request (via /api/public/hubspot-run-step)
// so the Cloudflare Worker timeout (~30s) is respected.
// State is rebuilt from DB each call (no in-memory cache between steps).
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type HSRec,
  batchRead,
  discoverTotal,
  getAssoc,
  getAssocMany,
  hsFetch,
  hsPost,
  loadHsProperties,
  mapActivity,
  mapCompany,
  mapContact,
  mapDeal,
  mapLead,
  mapTicket,
  mapHsTicketPriority,
  parseHsDate,
  parseHsNum,
  rawOf,
} from "./hubspot-api.server";
import { syncHubspotDealPipelines, syncHubspotTicketPipelines } from "./hubspot-pipelines.server";
// ─────────────────────────── Step framework ──────────────────────────────────

import {
  appendLog,
  loadImportedHsIdsForStep,
  loadLocalMapForHsIds,
  loadMapForStep,
  loadResume,
  makeProgressBumper,
  patchItemBefore,
  searchTotal,
} from "./hubspot-steps-state.server";
import { upsertBatchByHsId, upsertByHsId } from "./hubspot-steps-upsert.server";
import {
  discoverActivityTargets,
  discoverDealContactsMap,
  discoverTargetsFromAssociations,
} from "./hubspot-steps-discovery.server";
import type {
  ItemRow,
  ResumeState,
  Scope,
  StepCtx,
  StepName,
  StepResult,
} from "./hubspot-steps-types";

export type { Scope, StepCtx, StepName, StepResult } from "./hubspot-steps-types";

export const STEP_DEPS: Record<StepName, StepName[]> = {
  compare: [],
  companies: ["compare"],
  contacts: ["compare"],
  deals: ["compare"],
  leads: ["compare"],
  tickets: ["compare"],
  "activities-notes": ["compare"],
  "activities-calls": ["compare"],
  "activities-meetings": ["compare"],
  "activities-tasks": ["compare"],
  "activities-emails": ["compare"],
};

const STEP_ORDER: StepName[] = [
  "compare",
  "companies",
  "contacts",
  "deals",
  "leads",
  "tickets",
  "activities-notes",
  "activities-calls",
  "activities-meetings",
  "activities-tasks",
  "activities-emails",
];

export function planSteps(scope: Scope): StepName[] {
  const wanted = new Set<StepName>();
  wanted.add("compare");
  if (scope.companies) wanted.add("companies");
  if (scope.contacts) wanted.add("contacts");
  if (scope.deals) wanted.add("deals");
  if (scope.leads) wanted.add("leads");
  if (scope.tickets) wanted.add("tickets");
  if (scope.activities) {
    wanted.add("activities-notes");
    wanted.add("activities-calls");
    wanted.add("activities-meetings");
    wanted.add("activities-tasks");
    wanted.add("activities-emails");
  }
  return STEP_ORDER.filter((s) => wanted.has(s));
}

const DEFAULT_BUDGET_MS = 22_000;

export async function runStep(ctx: StepCtx): Promise<StepResult> {
  const { supabase, userId, workspaceId, jobId, step, itemId, scope } = ctx;
  const deadlineAt = ctx.deadlineAt ?? Date.now() + DEFAULT_BUDGET_MS;
  const isExpired = () => Date.now() >= deadlineAt;

  const resume = await loadResume(supabase, itemId);
  const isResume = Boolean(resume.cursor || resume.read_index || resume.imported_hs_ids?.length);

  // Initialize / preserve before
  const baseBefore: Record<string, unknown> = {
    ...resume,
    step,
    order: STEP_ORDER.indexOf(step),
    depends_on: STEP_DEPS[step],
    started_at: resume.started_at ?? new Date().toISOString(),
    cursor: resume.cursor,
    read_index: resume.read_index ?? 0,
    running_succeeded: resume.running_succeeded ?? 0,
    running_failed: resume.running_failed ?? 0,
    discovered: resume.discovered,
    imported_hs_ids: resume.imported_hs_ids ?? [],
    last_heartbeat_at: new Date().toISOString(),
    paused: false,
  };
  await supabase
    .from("enrichment_job_items")
    .update({ status: "running", before: baseBefore as never })
    .eq("id", itemId);
  await appendLog(supabase, jobId, {
    level: "info",
    step,
    message: isResume
      ? `Retomando etapa ${step} (cursor=${resume.cursor ?? "—"}, idx=${resume.read_index ?? 0})`
      : `Iniciando etapa ${step}`,
  });
  const bump = makeProgressBumper(supabase, itemId, jobId);

  let ok = (resume.running_succeeded as number) ?? 0;
  let fail = (resume.running_failed as number) ?? 0;
  const imported: string[] = [...(resume.imported_hs_ids ?? [])];
  let partial = false;

  // Persist progress + cursor (used on each pause / page boundary)
  const persistCursor = async (extra: Record<string, unknown>) => {
    await patchItemBefore(supabase, itemId, {
      running_succeeded: ok,
      running_failed: fail,
      imported_hs_ids: imported,
      ...extra,
    });
  };

  try {
    if (step === "compare") {
      // Count remote (HubSpot) vs local for each planned object and log the diff.
      // Steps where local >= remote are marked to be skipped (no fetch).
      const objects: {
        key: "companies" | "contacts" | "deals" | "leads" | "tickets" | "activities";
        remote: () => Promise<number>;
        localTable: "companies" | "contacts" | "deals" | "leads" | "tickets" | "activities";
      }[] = [];
      if (scope.companies !== false)
        objects.push({
          key: "companies",
          remote: () => searchTotal("companies"),
          localTable: "companies",
        });
      if (scope.contacts)
        objects.push({
          key: "contacts",
          remote: () => searchTotal("contacts"),
          localTable: "contacts",
        });
      if (scope.deals)
        objects.push({ key: "deals", remote: () => searchTotal("deals"), localTable: "deals" });
      if (scope.leads)
        objects.push({ key: "leads", remote: () => searchTotal("leads"), localTable: "leads" });
      if (scope.tickets)
        objects.push({
          key: "tickets",
          remote: () => searchTotal("tickets"),
          localTable: "tickets",
        });
      if (scope.activities) {
        objects.push({
          key: "activities",
          remote: async () => {
            const parts = await Promise.all([
              searchTotal("notes"),
              searchTotal("calls"),
              searchTotal("meetings"),
              searchTotal("tasks"),
              searchTotal("emails"),
            ]);
            return parts.reduce((a: number, b: number) => a + b, 0);
          },
          localTable: "activities",
        });
      }

      const skipSteps: string[] = [];
      const summary: Record<string, { local: number; remote: number; diff: number }> = {};

      for (const o of objects) {
        const [remote, localRes] = await Promise.all([
          o.remote().catch(() => 0),
          supabase
            .from(o.localTable)
            .select("*", { count: "exact", head: true })
            .eq("workspace_id", workspaceId),
        ]);
        const local = localRes.count ?? 0;
        const diff = Math.max(0, remote - local);
        summary[o.key] = { local, remote, diff };
        await appendLog(supabase, jobId, {
          level: "info",
          step: "compare",
          message: `${o.key}: local=${local} · HubSpot=${remote} · diferença=${diff}`,
          count: diff,
        });
        if (diff === 0 && remote > 0) {
          // already in sync — skip the corresponding step(s)
          if (o.key === "activities") {
            skipSteps.push(
              "activities-notes",
              "activities-calls",
              "activities-meetings",
              "activities-tasks",
              "activities-emails",
            );
          } else {
            skipSteps.push(o.key);
          }
          await appendLog(supabase, jobId, {
            level: "info",
            step: "compare",
            message: `${o.key}: já está sincronizado, etapa será pulada`,
          });
        }
      }

      // Persist comparison + skip list on the job scope so other steps can read it
      const { data: jobRow } = await supabase
        .from("enrichment_jobs")
        .select("scope")
        .eq("id", jobId)
        .single();
      const prevScope = (jobRow?.scope as Record<string, unknown> | null) ?? {};
      await supabase
        .from("enrichment_jobs")
        .update({
          scope: { ...prevScope, compare_summary: summary, skip_steps: skipSteps } as never,
        })
        .eq("id", jobId);

      // Mark downstream items as 'done' with 0 imports when in skip list
      if (skipSteps.length > 0) {
        const { data: allItems } = await supabase
          .from("enrichment_job_items")
          .select("id, before")
          .eq("job_id", jobId);
        for (const it of allItems ?? []) {
          const stepName = (it.before as { step?: string } | null)?.step;
          if (stepName && skipSteps.includes(stepName)) {
            await supabase
              .from("enrichment_job_items")
              .update({
                status: "done",
                after: { succeeded: 0, failed: 0, imported_hs_ids: [], skipped: true } as never,
              })
              .eq("id", it.id);
          }
        }
      }

      ok = 1;
      await supabase
        .from("enrichment_job_items")
        .update({
          status: "done",
          after: {
            succeeded: 1,
            failed: 0,
            imported_hs_ids: [],
            compare_summary: summary,
            skip_steps: skipSteps,
          } as never,
        })
        .eq("id", itemId);
      return { succeeded: 1, failed: 0, importedHsIds: [] };
    } else if (step === "companies") {
      const allProps = await loadHsProperties("companies");
      const propsParam = allProps.length
        ? allProps.join(",")
        : "name,domain,industry,numberofemployees,phone,city,state,zip,address,website";

      // Delta mode: target_ids pre-injetados (reconciliação). Pula pagination/search e faz batchRead direto.
      if (Array.isArray(resume.target_ids) && resume.discovery_complete) {
        const targetIds = resume.target_ids;
        const propsList = allProps.length
          ? allProps
          : [
              "name",
              "domain",
              "industry",
              "numberofemployees",
              "phone",
              "city",
              "state",
              "zip",
              "address",
              "website",
            ];
        let idx = (resume.read_index as number) ?? 0;
        const CHUNK = 100;
        while (idx < targetIds.length) {
          if (isExpired()) {
            partial = true;
            break;
          }
          const chunkIds = targetIds.slice(idx, idx + CHUNK);
          const recs = await batchRead("companies", chunkIds, propsList);
          for (const c of recs) {
            const p = c.properties;
            if (!p.name) {
              fail++;
              continue;
            }
            const mapped = mapCompany(p);
            const payload = {
              owner_id: userId,
              name: p.name,
              domain: p.domain ?? null,
              industry: p.industry ?? null,
              size: p.numberofemployees ?? null,
              phone: p.phone ?? null,
              city: p.city ?? null,
              state: p.state ?? null,
              cep: p.zip ?? null,
              address: p.address ?? null,
              website: p.website ?? null,
              ...mapped,
              external_ids: { hubspot: c.id } as never,
              hs_raw: rawOf(c),
              deleted_at: null,
            };
            const r = await upsertByHsId(supabase, "companies", userId, c.id, payload);
            if (r.status === "failed") fail++;
            else {
              imported.push(c.id);
              ok++;
            }
          }
          idx += chunkIds.length;
          await persistCursor({ read_index: idx });
          await bump(ok, fail, targetIds.length);
        }
        if (partial) await persistCursor({ read_index: idx });
      } else {
        const alreadyProcessed = ok + fail;
        let after: string | undefined =
          resume.cursor ?? (alreadyProcessed > 0 ? String(alreadyProcessed) : undefined);
        let page = Math.floor(alreadyProcessed / 100) + 1;
        // Descobre o total real no HubSpot apenas na primeira execução do step
        if (resume.discovered === undefined) {
          const total = await discoverTotal("companies");
          if (total !== null) {
            const effective = Math.min(total, scope.maxCompanies);
            await patchItemBefore(supabase, itemId, { discovered: effective });
            await appendLog(supabase, jobId, {
              level: "info",
              step,
              message: `Total no HubSpot: ${total} · alvo desta execução: ${effective}`,
            });
          }
        }
        while (ok + fail < scope.maxCompanies) {
          if (isExpired()) {
            partial = true;
            await persistCursor({
              cursor: after ?? (ok + fail > 0 ? String(ok + fail) : undefined),
            });
            break;
          }
          const remaining = scope.maxCompanies - (ok + fail);
          const limit = Math.min(100, remaining);
          const params: Record<string, string> = { limit: String(limit), properties: propsParam };
          if (after) params.after = after;
          const res = (await hsFetch("/crm/v3/objects/companies", params)) as {
            results: (HSRec & { createdAt?: string; updatedAt?: string })[];
            paging?: { next?: { after: string } };
          };
          if (!res.results.length) break;
          await appendLog(supabase, jobId, {
            level: "info",
            step,
            message: `Página ${page}: ${res.results.length} empresas`,
            count: res.results.length,
          });
          type Task = { hsId: string; name: string; payload: Record<string, unknown> };
          const tasks: Task[] = [];
          for (const c of res.results) {
            const p = c.properties;
            if (!p.name) continue;
            const mapped = mapCompany(p);
            tasks.push({
              hsId: c.id,
              name: p.name as string,
              payload: {
                owner_id: userId,
                name: p.name,
                domain: p.domain ?? null,
                industry: p.industry ?? null,
                size: p.numberofemployees ?? null,
                phone: p.phone ?? null,
                city: p.city ?? null,
                state: p.state ?? null,
                cep: p.zip ?? null,
                address: p.address ?? null,
                website: p.website ?? null,
                ...mapped,
                external_ids: { hubspot: c.id } as never,
                hs_raw: rawOf(c),
              },
            });
          }

          // Conta como falha os registros sem nome
          fail += res.results.length - tasks.length;

          const CONCURRENCY = 12;
          for (let i = 0; i < tasks.length; i += CONCURRENCY) {
            const batch = tasks.slice(i, i + CONCURRENCY);
            const results = await Promise.all(
              batch.map((t) => upsertByHsId(supabase, "companies", userId, t.hsId, t.payload)),
            );
            for (let j = 0; j < results.length; j++) {
              const r = results[j];
              if (r.status === "failed") {
                fail++;
                await appendLog(supabase, jobId, {
                  level: "warn",
                  step,
                  message: `Falha empresa ${batch[j].name}: ${r.error}`,
                });
              } else {
                imported.push(batch[j].hsId);
                ok++;
              }
            }
            await bump(ok, fail);
          }
          after = res.paging?.next?.after;
          await persistCursor({ cursor: after ?? null, last_processed: ok + fail });
          await bump(ok, fail);
          page++;
          if (!after) break;
        }
        await patchItemBefore(supabase, itemId, { discovered: ok + fail });
      }
    } else if (step === "contacts") {
      // Fase 1 (cacheada em before.target_ids/parent_map): mapear contatos↔empresas.
      // Fase 2: batchRead em chunks pequenos com checkpoint a cada chunk.
      let targetIds = resume.target_ids as string[] | undefined;
      let parentMap = resume.parent_map as Record<string, string> | undefined;
      if (!targetIds || !parentMap || !resume.discovery_complete) {
        const hsCompanyIds = await loadImportedHsIdsForStep(
          supabase,
          userId,
          jobId,
          "companies",
          "companies",
        );
        if ((resume.assoc_index ?? 0) === 0) {
          await appendLog(supabase, jobId, {
            level: "info",
            step,
            message: `Mapeando contatos para ${hsCompanyIds.length} empresas`,
          });
          if (hsCompanyIds.length === 0) {
            targetIds = [];
            parentMap = {};
            await patchItemBefore(supabase, itemId, {
              assoc_index: 0,
              discovery_complete: true,
              target_ids: [],
              parent_map: {},
              discovered: 0,
            });
          }
        }
        if (targetIds === undefined || parentMap === undefined) {
          const discovery = await discoverTargetsFromAssociations({
            supabase,
            jobId,
            itemId,
            step,
            fromObj: "companies",
            fromIds: hsCompanyIds,
            toObj: "contacts",
            resume,
            deadlineAt,
          });
          targetIds = discovery.targetIds;
          parentMap = discovery.parentMap;
          await bump(0, 0, targetIds.length, true);
          if (discovery.partial) {
            partial = true;
            await persistCursor({ discovered: targetIds.length });
            await patchItemBefore(supabase, itemId, {
              paused: true,
              last_heartbeat_at: new Date().toISOString(),
            });
            await appendLog(supabase, jobId, {
              level: "info",
              step,
              message: `Mapeamento de contatos pausado para próximo tick (${targetIds.length} contatos encontrados)`,
            });
            return { succeeded: ok, failed: fail, importedHsIds: imported, partial: true };
          }
        }
        await appendLog(supabase, jobId, {
          level: "info",
          step,
          message: `Plano: ${targetIds.length} contatos a importar`,
        });
      }
      const propsList = [
        "firstname",
        "lastname",
        "email",
        "phone",
        "jobtitle",
        "mobilephone",
        "country",
        "address",
        "zip",
        "city",
        "state",
        "website",
        "company",
        "lifecyclestage",
        "hs_lead_status",
        "hubspot_owner_id",
        "hs_object_id",
        "createdate",
        "hs_createdate",
        "lastmodifieddate",
        "hs_lastmodifieddate",
        "linkedin_url",
        "linkedinbio",
        "twitterhandle",
      ];
      let idx = (resume.read_index as number) ?? 0;
      const CHUNK = 100;
      while (idx < targetIds.length) {
        if (isExpired()) {
          partial = true;
          break;
        }
        const chunkIds = targetIds.slice(idx, idx + CHUNK);
        const recs = await batchRead("contacts", chunkIds, propsList);
        const byId = new Map(recs.map((r) => [r.id, r]));
        const parentCompanyHsIds = Array.from(
          new Set(
            chunkIds.map((hsId) => parentMap?.[hsId]).filter((id): id is string => Boolean(id)),
          ),
        );
        const companyMap = parentCompanyHsIds.length
          ? await loadLocalMapForHsIds(supabase, workspaceId, "companies", parentCompanyHsIds)
          : new Map<string, string>();
        const tasks: { hsId: string; payload: Record<string, unknown> }[] = [];
        for (const hsId of chunkIds) {
          const c = byId.get(hsId);
          if (!c) {
            fail++;
            continue;
          }
          const p = c.properties;
          if (!p.firstname && !p.email) {
            fail++;
            continue;
          }
          const localCompanyId = companyMap.get(parentMap[hsId] ?? "") ?? null;
          const mapped = mapContact(p);
          tasks.push({
            hsId: c.id,
            payload: {
              owner_id: userId,
              first_name: (p.firstname ?? p.email ?? "Sem nome") as string,
              last_name: p.lastname ?? null,
              email: p.email ?? null,
              phone: p.phone ?? null,
              job_title: p.jobtitle ?? null,
              company_id: localCompanyId,
              ...mapped,
              external_ids: { hubspot: c.id, hs_lifecyclestage: p.lifecyclestage ?? null } as never,
              hs_raw: rawOf(c),
            },
          });
        }
        const results = await upsertBatchByHsId(supabase, "contacts", userId, tasks);
        for (let j = 0; j < results.length; j++) {
          const r = results[j];
          if (r.status === "failed") fail++;
          else {
            imported.push(tasks[j].hsId);
            ok++;
          }
        }
        await bump(ok, fail, targetIds.length, true);

        idx += chunkIds.length;
        await persistCursor({ read_index: idx });
        await bump(ok, fail, targetIds.length);
      }
      if (partial) await persistCursor({ read_index: idx });
      else await persistCursor({ read_index: targetIds.length });
    } else if (step === "deals") {
      // Sincroniza pipelines do HubSpot (cria os inexistentes) e importa TODOS
      // os negócios (de todos os pipelines), paginando direto em /objects/deals
      // — sem depender de associações vindas de companies.
      const contactMap = await loadMapForStep(supabase, workspaceId, jobId, "contacts", "contacts");

      let pipelineMap = resume.pipeline_map as Record<string, string> | undefined;
      let stageMap = resume.stage_map as
        | Record<string, { hsPipelineId: string; legacy: "new" | "won" | "lost" }>
        | undefined;
      if (!pipelineMap || !stageMap) {
        const synced = await syncHubspotDealPipelines(supabase, userId, workspaceId);
        pipelineMap = synced.pipelineMap;
        stageMap = synced.stageMap;
        await patchItemBefore(supabase, itemId, { pipeline_map: pipelineMap, stage_map: stageMap });
        await appendLog(supabase, jobId, {
          level: "info",
          step,
          message: `Pipelines sincronizados: ${Object.keys(pipelineMap).length}`,
        });
      }

      const dealProps = await loadHsProperties("deals");
      const dealPropsList = dealProps.length
        ? dealProps
        : ["dealname", "amount", "dealstage", "closedate", "pipeline"];

      // Delta mode: target_ids pre-injetados (reconciliação). Pula pagination e faz batchRead direto.
      if (Array.isArray(resume.target_ids) && resume.discovery_complete) {
        const targetIds = resume.target_ids;
        let idx = (resume.read_index as number) ?? 0;
        const CHUNK = 100;
        while (idx < targetIds.length) {
          if (isExpired()) {
            partial = true;
            break;
          }
          const chunkIds = targetIds.slice(idx, idx + CHUNK);
          const recs = await batchRead("deals", chunkIds, dealPropsList);
          const [dealCompanies, dealContacts] = await Promise.all([
            getAssocMany("deals", chunkIds, "companies", 20),
            getAssocMany("deals", chunkIds, "contacts", 20),
          ]);
          const parentCompanyHsIds = Array.from(
            new Set(Array.from(dealCompanies.values()).flatMap((arr) => arr.slice(0, 1))),
          );
          const companyMap = parentCompanyHsIds.length
            ? await loadLocalMapForHsIds(supabase, workspaceId, "companies", parentCompanyHsIds)
            : new Map<string, string>();

          const tasks: {
            hsId: string;
            payload: Record<string, unknown>;
            contactHsIds: string[];
          }[] = [];
          for (const d of recs) {
            const p = d.properties;
            const hsCompanyId = (dealCompanies.get(d.id) ?? [])[0];
            const localCompanyId = hsCompanyId ? (companyMap.get(hsCompanyId) ?? null) : null;
            const stageInfo = p.dealstage ? stageMap[p.dealstage] : undefined;
            const hsPipelineId = p.pipeline ?? stageInfo?.hsPipelineId ?? null;
            const localPipelineId = hsPipelineId ? (pipelineMap[hsPipelineId] ?? null) : null;
            const legacyStage: "new" | "won" | "lost" = stageInfo?.legacy ?? "new";
            const mapped = mapDeal(p);
            tasks.push({
              hsId: d.id,
              contactHsIds: dealContacts.get(d.id) ?? [],
              payload: {
                owner_id: userId,
                name: p.dealname ?? "Sem nome",
                value: p.amount ? Number(p.amount) : 0,
                currency: "BRL",
                stage: legacyStage,
                stage_id: p.dealstage ?? null,
                pipeline_id: localPipelineId,
                company_id: localCompanyId,
                expected_close_date: p.closedate ? p.closedate.slice(0, 10) : null,
                ...mapped,
                external_ids: {
                  hubspot: d.id,
                  hs_stage: p.dealstage,
                  hs_pipeline: hsPipelineId,
                } as never,
                hs_raw: rawOf(d),
                deleted_at: null,
              },
            });
          }

          const results = await upsertBatchByHsId(supabase, "deals", userId, tasks);
          for (let j = 0; j < results.length; j++) {
            const r = results[j];
            const t = tasks[j];
            if (r.status === "failed") {
              fail++;
              continue;
            }
            imported.push(t.hsId);
            ok++;
            if (r.status === "inserted" && r.localId) {
              const inserts = t.contactHsIds
                .map((cid) => contactMap.get(cid))
                .filter((lc): lc is string => !!lc)
                .map((lc) => ({ deal_id: r.localId as string, contact_id: lc }));
              if (inserts.length) {
                await supabase.from("deal_contacts").insert(inserts);
              }
            }
          }

          idx += chunkIds.length;
          await persistCursor({ read_index: idx });
          await bump(ok, fail, targetIds.length);
        }
        if (partial) await persistCursor({ read_index: idx });
      } else {
        if (resume.discovered === undefined) {
          const total = await searchTotal("deals");
          await patchItemBefore(supabase, itemId, { discovered: total });
          await appendLog(supabase, jobId, {
            level: "info",
            step,
            message: `Total no HubSpot: ${total} negócios`,
          });
        }

        const propsParam = dealPropsList.join(",");

        let after: string | undefined = (resume.cursor as string | undefined) ?? undefined;
        let page = (resume.page as number | undefined) ?? 1;

        type DealsPage = {
          results: HSRec[];
          paging?: { next?: { after: string } };
        };
        const fetchPage = async (cursor?: string): Promise<DealsPage> => {
          const params: Record<string, string> = { limit: "100", properties: propsParam };
          if (cursor) params.after = cursor;
          return (await hsFetch("/crm/v3/objects/deals", params)) as DealsPage;
        };

        let nextPromise: Promise<DealsPage> | null = fetchPage(after);

        while (nextPromise) {
          if (isExpired()) {
            partial = true;
            await persistCursor({ cursor: after ?? null, page });
            break;
          }
          const res: DealsPage = await nextPromise;
          if (!res.results?.length) break;

          const nextAfter: string | undefined = res.paging?.next?.after;
          nextPromise = nextAfter ? fetchPage(nextAfter) : null;

          const pageIds = res.results.map((r) => r.id);
          const [dealCompanies, dealContacts] = await Promise.all([
            getAssocMany("deals", pageIds, "companies", 20),
            getAssocMany("deals", pageIds, "contacts", 20),
          ]);
          const parentCompanyHsIds = Array.from(
            new Set(Array.from(dealCompanies.values()).flatMap((arr) => arr.slice(0, 1))),
          );
          const companyMap = parentCompanyHsIds.length
            ? await loadLocalMapForHsIds(supabase, workspaceId, "companies", parentCompanyHsIds)
            : new Map<string, string>();

          await appendLog(supabase, jobId, {
            level: "info",
            step,
            message: `Página ${page}: ${res.results.length} negócios`,
            count: res.results.length,
          });

          const tasks: {
            hsId: string;
            payload: Record<string, unknown>;
            contactHsIds: string[];
          }[] = [];
          for (const d of res.results) {
            const p = d.properties;
            const hsCompanyId = (dealCompanies.get(d.id) ?? [])[0];
            const localCompanyId = hsCompanyId ? (companyMap.get(hsCompanyId) ?? null) : null;
            const stageInfo = p.dealstage ? stageMap[p.dealstage] : undefined;
            const hsPipelineId = p.pipeline ?? stageInfo?.hsPipelineId ?? null;
            const localPipelineId = hsPipelineId ? (pipelineMap[hsPipelineId] ?? null) : null;
            const legacyStage: "new" | "won" | "lost" = stageInfo?.legacy ?? "new";
            const mapped = mapDeal(p);
            tasks.push({
              hsId: d.id,
              contactHsIds: dealContacts.get(d.id) ?? [],
              payload: {
                owner_id: userId,
                name: p.dealname ?? "Sem nome",
                value: p.amount ? Number(p.amount) : 0,
                currency: "BRL",
                stage: legacyStage,
                stage_id: p.dealstage ?? null,
                pipeline_id: localPipelineId,
                company_id: localCompanyId,
                expected_close_date: p.closedate ? p.closedate.slice(0, 10) : null,
                ...mapped,
                external_ids: {
                  hubspot: d.id,
                  hs_stage: p.dealstage,
                  hs_pipeline: hsPipelineId,
                } as never,
                hs_raw: rawOf(d),
              },
            });
          }

          const results = await upsertBatchByHsId(supabase, "deals", userId, tasks);
          for (let j = 0; j < results.length; j++) {
            const r = results[j];
            const t = tasks[j];
            if (r.status === "failed") {
              fail++;
              continue;
            }
            imported.push(t.hsId);
            ok++;
            if (r.status === "inserted" && r.localId) {
              const inserts = t.contactHsIds
                .map((cid) => contactMap.get(cid))
                .filter((lc): lc is string => !!lc)
                .map((lc) => ({ deal_id: r.localId as string, contact_id: lc }));
              if (inserts.length) {
                await supabase.from("deal_contacts").insert(inserts);
              }
            }
          }

          after = nextAfter;
          page++;
          await persistCursor({ cursor: after ?? null, page });
          await bump(ok, fail);
          if (!nextAfter) break;
        }
      }
    } else if (step === "leads") {
      // Importa o objeto NATIVO de Leads do HubSpot (/crm/v3/objects/leads),
      // paginando com cursor — não depende da importação de contatos.
      const leadProps = await loadHsProperties("leads");
      const fallbackProps = [
        "hs_lead_name",
        "hs_lead_name_calculated",
        "hs_associated_contact_firstname",
        "hs_associated_contact_lastname",
        "hs_associated_contact_email",
        "hs_associated_company_name",
        "hs_lead_source",
        "hs_analytics_source",
        "hs_analytics_source_data_1",
        "hs_pipeline_stage",
        "hubspot_owner_id",
        "hs_object_id",
        "createdate",
        "lastmodifieddate",
      ];
      const propsList = leadProps.length ? leadProps : fallbackProps;
      const propsParam = propsList.join(",");

      // Delta mode: target_ids pre-injetados (reconciliação). Pula pagination e faz batchRead direto.
      if (Array.isArray(resume.target_ids) && resume.discovery_complete) {
        const targetIds = resume.target_ids;
        let idx = (resume.read_index as number) ?? 0;
        const CHUNK = 100;
        while (idx < targetIds.length) {
          if (isExpired()) {
            partial = true;
            break;
          }
          const chunkIds = targetIds.slice(idx, idx + CHUNK);
          const recs = await batchRead("leads", chunkIds, propsList);
          const tasks: { hsId: string; payload: Record<string, unknown> }[] = [];
          for (const c of recs) {
            const p = c.properties;
            const mapped = mapLead(p);
            let first = (p.hs_associated_contact_firstname ?? "") as string;
            let last = (p.hs_associated_contact_lastname ?? null) as string | null;
            if (!first) {
              const full = ((p.hs_lead_name_calculated ?? p.hs_lead_name ?? "") as string).trim();
              if (full) {
                const parts = full.split(/\s+/);
                first = parts[0];
                last = parts.slice(1).join(" ") || last;
              }
            }
            if (!first) first = (p.hs_associated_contact_email ?? "Sem nome") as string;
            tasks.push({
              hsId: c.id,
              payload: {
                owner_id: userId,
                first_name: first,
                last_name: last,
                email: p.hs_associated_contact_email ?? null,
                phone: null,
                company_name: p.hs_associated_company_name ?? null,
                source: p.hs_lead_source ?? p.hs_analytics_source ?? "hubspot",
                status: "new",
                ...mapped,
                external_ids: { hubspot: c.id } as never,
                hs_raw: rawOf(c),
                deleted_at: null,
              },
            });
          }
          const results = await upsertBatchByHsId(supabase, "leads", userId, tasks);
          for (let j = 0; j < results.length; j++) {
            const r = results[j];
            if (r.status === "failed") fail++;
            else {
              imported.push(tasks[j].hsId);
              ok++;
            }
          }
          idx += chunkIds.length;
          await persistCursor({ read_index: idx });
          await bump(ok, fail, targetIds.length);
        }
        if (partial) await persistCursor({ read_index: idx });
      } else {
        if (resume.discovered === undefined) {
          const total = await searchTotal("leads");
          await patchItemBefore(supabase, itemId, { discovered: total });
          await appendLog(supabase, jobId, {
            level: "info",
            step,
            message: `Total no HubSpot: ${total} leads`,
          });
        }

        let after: string | undefined = (resume.cursor as string | undefined) ?? undefined;
        let page = (resume.page as number | undefined) ?? 1;

        type LeadsPage = {
          results: (HSRec & { createdAt?: string; updatedAt?: string })[];
          paging?: { next?: { after: string } };
        };
        const fetchPage = async (cursor?: string): Promise<LeadsPage> => {
          const params: Record<string, string> = { limit: "100", properties: propsParam };
          if (cursor) params.after = cursor;
          return (await hsFetch("/crm/v3/objects/leads", params)) as LeadsPage;
        };

        // Prefetch first page; subsequent pages are prefetched in parallel
        // with the upsert of the current page (network ⇄ DB pipelining).
        let nextPromise: Promise<LeadsPage> | null = fetchPage(after);

        while (nextPromise) {
          if (isExpired()) {
            partial = true;
            await persistCursor({ cursor: after ?? null, page });
            break;
          }
          const res: LeadsPage = await nextPromise;
          if (!res.results?.length) break;

          const nextAfter: string | undefined = res.paging?.next?.after;
          // Start the next page download immediately (overlap with DB work).
          nextPromise = nextAfter ? fetchPage(nextAfter) : null;

          await appendLog(supabase, jobId, {
            level: "info",
            step,
            message: `Página ${page}: ${res.results.length} leads`,
            count: res.results.length,
          });

          const tasks: { hsId: string; payload: Record<string, unknown> }[] = [];
          for (const c of res.results) {
            const p = c.properties;
            const mapped = mapLead(p);
            let first = (p.hs_associated_contact_firstname ?? "") as string;
            let last = (p.hs_associated_contact_lastname ?? null) as string | null;
            if (!first) {
              const full = ((p.hs_lead_name_calculated ?? p.hs_lead_name ?? "") as string).trim();
              if (full) {
                const parts = full.split(/\s+/);
                first = parts[0];
                last = parts.slice(1).join(" ") || last;
              }
            }
            if (!first) first = (p.hs_associated_contact_email ?? "Sem nome") as string;
            tasks.push({
              hsId: c.id,
              payload: {
                owner_id: userId,
                first_name: first,
                last_name: last,
                email: p.hs_associated_contact_email ?? null,
                phone: null,
                company_name: p.hs_associated_company_name ?? null,
                source: p.hs_lead_source ?? p.hs_analytics_source ?? "hubspot",
                status: "new",
                ...mapped,
                external_ids: { hubspot: c.id } as never,
                hs_raw: rawOf(c),
              },
            });
          }

          // 1 SELECT + 1 batch INSERT (+ small UPDATE batch) per page
          // instead of ~100 round-trips.
          const results = await upsertBatchByHsId(supabase, "leads", userId, tasks);
          for (let j = 0; j < results.length; j++) {
            const r = results[j];
            if (r.status === "failed") {
              fail++;
              await appendLog(supabase, jobId, {
                level: "warn",
                step,
                message: `Falha lead ${tasks[j].hsId}: ${r.error}`,
              });
            } else {
              imported.push(tasks[j].hsId);
              ok++;
            }
          }

          after = nextAfter;
          page++;
          await persistCursor({ cursor: after ?? null, page });
          await bump(ok, fail);
          if (!nextAfter) break;
        }
      }
    } else if (step === "tickets") {
      // Espelha pipelines de tickets do HubSpot ANTES da importação,
      // para vincular cada ticket ao seu pipeline local.
      let ticketPipelineMap: Record<string, string> = {};
      try {
        ticketPipelineMap = await syncHubspotTicketPipelines(supabase, userId, workspaceId);
        await appendLog(supabase, jobId, {
          level: "info",
          step,
          message: `Pipelines de tickets sincronizados: ${Object.keys(ticketPipelineMap).length}`,
          count: Object.keys(ticketPipelineMap).length,
        });
      } catch (e) {
        await appendLog(supabase, jobId, {
          level: "warn",
          step,
          message: `Falha ao sincronizar pipelines de tickets: ${e instanceof Error ? e.message : String(e)}`,
        });
      }

      // Fetch ticket pipeline stages once to derive status (open/closed) per stage id.
      const stageState = new Map<string, "open" | "closed">();
      try {
        const pr = (await hsFetch("/crm/v3/pipelines/tickets")) as {
          results?: { stages?: { id: string; metadata?: { ticketState?: string } }[] }[];
        };
        for (const p of pr.results ?? []) {
          for (const s of p.stages ?? []) {
            const st = String(s.metadata?.ticketState ?? "").toUpperCase();
            stageState.set(String(s.id), st === "CLOSED" ? "closed" : "open");
          }
        }
      } catch {
        // stage map is best-effort; default to 'new'
      }

      const ticketProps = await loadHsProperties("tickets");
      const fallbackProps = [
        "subject",
        "content",
        "hs_pipeline",
        "hs_pipeline_stage",
        "hs_ticket_priority",
        "hs_ticket_category",
        "source_type",
        "hubspot_owner_id",
        "hs_object_id",
        "createdate",
        "hs_lastmodifieddate",
        "closed_date",
      ];
      const propsList = ticketProps.length ? ticketProps : fallbackProps;
      const propsParam = propsList.join(",");

      // Load local maps so we can fill FK columns from associations.
      const companyMap = await loadMapForStep(
        supabase,
        workspaceId,
        jobId,
        "companies",
        "companies",
      );
      const contactMap = await loadMapForStep(supabase, workspaceId, jobId, "contacts", "contacts");
      const dealMap = await loadMapForStep(supabase, workspaceId, jobId, "deals", "deals");

      if (resume.discovered === undefined) {
        const total = await searchTotal("tickets");
        await patchItemBefore(supabase, itemId, { discovered: total });
        await appendLog(supabase, jobId, {
          level: "info",
          step,
          message: `Total no HubSpot: ${total} tickets`,
        });
      }

      let after: string | undefined = (resume.cursor as string | undefined) ?? undefined;
      let page = (resume.page as number | undefined) ?? 1;

      type TicketsPage = {
        results: (HSRec & { createdAt?: string; updatedAt?: string })[];
        paging?: { next?: { after: string } };
      };
      const fetchPage = async (cursor?: string): Promise<TicketsPage> => {
        const params: Record<string, string> = { limit: "100", properties: propsParam };
        if (cursor) params.after = cursor;
        return (await hsFetch("/crm/v3/objects/tickets", params)) as TicketsPage;
      };

      let nextPromise: Promise<TicketsPage> | null = fetchPage(after);
      while (nextPromise) {
        if (isExpired()) {
          partial = true;
          await persistCursor({ cursor: after ?? null, page });
          break;
        }
        const res: TicketsPage = await nextPromise;
        if (!res.results?.length) break;
        const nextAfter: string | undefined = res.paging?.next?.after;
        nextPromise = nextAfter ? fetchPage(nextAfter) : null;

        const pageIds = res.results.map((r) => r.id);
        const [tContacts, tCompanies, tDeals] = await Promise.all([
          getAssocMany("tickets", pageIds, "contacts", 20),
          getAssocMany("tickets", pageIds, "companies", 20),
          getAssocMany("tickets", pageIds, "deals", 20),
        ]);

        await appendLog(supabase, jobId, {
          level: "info",
          step,
          message: `Página ${page}: ${res.results.length} tickets`,
          count: res.results.length,
        });

        const tasks: { hsId: string; payload: Record<string, unknown> }[] = [];
        for (const t of res.results) {
          const p = t.properties;
          const stageId = p.hs_pipeline_stage ?? null;
          const status = stageId ? (stageState.get(String(stageId)) ?? "new") : "new";
          const priority = mapHsTicketPriority(p.hs_ticket_priority);
          const contactHs = (tContacts.get(t.id) ?? [])[0];
          const companyHs = (tCompanies.get(t.id) ?? [])[0];
          const dealHs = (tDeals.get(t.id) ?? [])[0];
          const mapped = mapTicket(p);
          tasks.push({
            hsId: t.id,
            payload: {
              owner_id: userId,
              subject: p.subject ?? "Sem assunto",
              description: p.content ?? null,
              status,
              priority,
              source: p.source_type ?? "hubspot",
              contact_id: contactHs ? (contactMap.get(contactHs) ?? null) : null,
              company_id: companyHs ? (companyMap.get(companyHs) ?? null) : null,
              deal_id: dealHs ? (dealMap.get(dealHs) ?? null) : null,
              pipeline_id: p.hs_pipeline
                ? (ticketPipelineMap[String(p.hs_pipeline)] ?? null)
                : null,
              custom_fields: {
                hs_pipeline: p.hs_pipeline ?? null,
                hs_pipeline_stage: stageId,
                hs_ticket_category: p.hs_ticket_category ?? null,
              } as never,
              ...mapped,
              external_ids: {
                hubspot: t.id,
                hs_pipeline: p.hs_pipeline ?? null,
                hs_pipeline_stage: stageId,
              } as never,
              hs_raw: rawOf(t),
              deleted_at: null,
            },
          });
        }

        const results = await upsertBatchByHsId(supabase, "tickets", userId, tasks);
        for (let j = 0; j < results.length; j++) {
          const r = results[j];
          if (r.status === "failed") {
            fail++;
            await appendLog(supabase, jobId, {
              level: "warn",
              step,
              message: `Falha ticket ${tasks[j].hsId}: ${r.error}`,
            });
          } else {
            imported.push(tasks[j].hsId);
            ok++;
          }
        }

        after = nextAfter;
        page++;
        await persistCursor({ cursor: after ?? null, page });
        await bump(ok, fail);
        if (!nextAfter) break;
      }
    } else if (step.startsWith("activities-")) {
      const kind = step.replace("activities-", "") as
        | "notes"
        | "calls"
        | "meetings"
        | "tasks"
        | "emails";
      const TYPE_MAP: Record<
        typeof kind,
        { type: "note" | "call" | "meeting" | "task" | "email"; props: string[] }
      > = {
        notes: { type: "note", props: ["hs_note_body", "hs_timestamp"] },
        calls: {
          type: "call",
          props: ["hs_call_title", "hs_call_body", "hs_timestamp", "hs_call_disposition"],
        },
        meetings: {
          type: "meeting",
          props: ["hs_meeting_title", "hs_meeting_body", "hs_timestamp"],
        },
        tasks: {
          type: "task",
          props: ["hs_task_subject", "hs_task_body", "hs_timestamp", "hs_task_status"],
        },
        emails: { type: "email", props: ["hs_email_subject", "hs_email_text", "hs_timestamp"] },
      };
      const t = TYPE_MAP[kind];

      const companyMap = await loadMapForStep(
        supabase,
        workspaceId,
        jobId,
        "companies",
        "companies",
      );
      const contactMap = await loadMapForStep(supabase, workspaceId, jobId, "contacts", "contacts");
      const dealMap = await loadMapForStep(supabase, workspaceId, jobId, "deals", "deals");
      const leadMap = await loadMapForStep(supabase, workspaceId, jobId, "leads", "leads");

      let targetIds = resume.target_ids as string[] | undefined;
      type Parents = { contactId?: string; companyId?: string; dealId?: string; leadId?: string };
      let parents = resume.parents_map as Record<string, Parents> | undefined;
      if (!targetIds || !parents || !resume.discovery_complete) {
        const entities: {
          fromObj: string;
          ids: string[];
          key: "companyId" | "contactId" | "dealId" | "leadId";
        }[] = [
          { fromObj: "companies", ids: [...companyMap.keys()], key: "companyId" },
          { fromObj: "contacts", ids: [...contactMap.keys()], key: "contactId" },
          { fromObj: "deals", ids: [...dealMap.keys()], key: "dealId" },
          { fromObj: "leads", ids: [...leadMap.keys()], key: "leadId" },
        ];
        const discovery = await discoverActivityTargets({
          supabase,
          jobId,
          itemId,
          step,
          kind,
          entities,
          resume,
          deadlineAt,
        });
        targetIds = discovery.targetIds;
        parents = discovery.parents;
        await bump(0, 0, targetIds.length, true);
        if (discovery.partial) {
          await patchItemBefore(supabase, itemId, {
            paused: true,
            last_heartbeat_at: new Date().toISOString(),
          });
          await appendLog(supabase, jobId, {
            level: "info",
            step,
            message: `Mapeamento de ${kind} pausado para próximo tick (${targetIds.length} encontrados)`,
          });
          return { succeeded: ok, failed: fail, importedHsIds: imported, partial: true };
        }
        await appendLog(supabase, jobId, {
          level: "info",
          step,
          message: `Plano: ${targetIds.length} ${kind}`,
        });
      }
      if (targetIds.length === 0) {
        await appendLog(supabase, jobId, { level: "info", step, message: `Sem ${kind}` });
      } else {
        const allActProps = await loadHsProperties(kind);
        const actPropsList = allActProps.length ? allActProps : t.props;
        let idx = (resume.read_index as number) ?? 0;
        const CHUNK = 100;
        while (idx < targetIds.length) {
          if (isExpired()) {
            partial = true;
            break;
          }
          const chunkIds = targetIds.slice(idx, idx + CHUNK);
          const recs = await batchRead(kind, chunkIds, actPropsList);
          for (const a of recs) {
            const p = a.properties;
            const subject =
              p.hs_note_body?.replace(/<[^>]+>/g, "").slice(0, 100) ??
              p.hs_call_title ??
              p.hs_meeting_title ??
              p.hs_task_subject ??
              p.hs_email_subject ??
              t.type;
            const body =
              p.hs_note_body ??
              p.hs_call_body ??
              p.hs_meeting_body ??
              p.hs_task_body ??
              p.hs_email_text ??
              null;
            const due = p.hs_timestamp ?? null;
            const pr = parents[a.id] ?? {};
            const mapped = mapActivity(kind, p);
            const hsCreated =
              parseHsDate(p.hs_createdate ?? p.createdate) ??
              parseHsDate(p.hs_timestamp) ??
              a.createdAt ??
              null;
            const hsUpdated =
              parseHsDate(p.hs_lastmodifieddate ?? p.lastmodifieddate) ?? a.updatedAt ?? null;
            const payload = {
              owner_id: userId,
              type: t.type,
              subject,
              body,
              due_date: due,
              completed: t.type !== "task",
              related_contact_id: pr.contactId ? (contactMap.get(pr.contactId) ?? null) : null,
              related_company_id: pr.companyId ? (companyMap.get(pr.companyId) ?? null) : null,
              related_deal_id: pr.dealId ? (dealMap.get(pr.dealId) ?? null) : null,
              related_lead_id: pr.leadId ? (leadMap.get(pr.leadId) ?? null) : null,
              ...mapped,
              external_ids: { hubspot: a.id, hs_kind: kind } as never,
              hs_raw: rawOf(a),
              ...(hsCreated ? { created_at: hsCreated } : {}),
              ...(hsUpdated ? { updated_at: hsUpdated } : {}),
            };
            const r = await upsertByHsId(supabase, "activities", userId, a.id, payload);
            if (r.status === "failed") fail++;
            else {
              imported.push(a.id);
              ok++;
            }
          }
          idx += chunkIds.length;
          await persistCursor({ read_index: idx });
          await bump(ok, fail, targetIds.length);
        }
        if (partial) await persistCursor({ read_index: idx });
        else await persistCursor({ read_index: targetIds.length });
      }
    }

    if (partial) {
      // Mantém status='running' para evitar flicker na UI; o próximo tick
      // reclama itens com (status='pending') OU (status='running' AND before.paused=true).
      await patchItemBefore(supabase, itemId, {
        paused: true,
        last_heartbeat_at: new Date().toISOString(),
      });
      await appendLog(supabase, jobId, {
        level: "info",
        step,
        message: `Etapa ${step} pausada para próximo tick (${ok} ok / ${fail} falhas)`,
      });
      return { succeeded: ok, failed: fail, importedHsIds: imported, partial: true };
    }

    await supabase
      .from("enrichment_job_items")
      .update({
        status: "done",
        after: {
          succeeded: ok,
          failed: fail,
          finished_at: new Date().toISOString(),
          imported_hs_ids: imported,
        } as never,
      })
      .eq("id", itemId);
    await appendLog(supabase, jobId, {
      level: "info",
      step,
      message: `Etapa ${step} concluída: ${ok} ok / ${fail} falhas`,
    });
    return { succeeded: ok, failed: fail, importedHsIds: imported };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("enrichment_job_items")
      .update({
        status: "failed",
        error: msg,
        after: { succeeded: ok, failed: fail, imported_hs_ids: imported } as never,
      })
      .eq("id", itemId);
    await appendLog(supabase, jobId, { level: "error", step, message: msg });
    throw e;
  }
}

// Pick the next pending item in the job whose dependencies are all 'done'.
export async function pickNextItem(
  supabase: SupabaseClient,
  jobId: string,
): Promise<{ itemId: string; step: StepName } | null> {
  const { data: rows } = await supabase
    .from("enrichment_job_items")
    .select("id, status, before")
    .eq("job_id", jobId);
  const items = (rows ?? []) as ItemRow[];
  const doneSteps = new Set(
    items.filter((it) => it.status === "done").map((it) => it.before?.step ?? ""),
  );
  const pending = items
    .filter((it) => it.status === "pending")
    .sort((a, b) => (a.before?.order ?? 0) - (b.before?.order ?? 0));
  for (const it of pending) {
    const deps = it.before?.depends_on ?? [];
    if (deps.every((d) => doneSteps.has(d))) {
      return { itemId: it.id, step: (it.before?.step ?? "") as StepName };
    }
  }
  return null;
}

export async function finalizeJob(supabase: SupabaseClient, jobId: string) {
  const { data: rows } = await supabase
    .from("enrichment_job_items")
    .select("status, after")
    .eq("job_id", jobId);
  const items = (rows ?? []) as ItemRow[];
  const total = items.length;
  const doneCount = items.filter((it) => it.status === "done").length;
  const failedCount = items.filter((it) => it.status === "failed").length;
  let succeeded = 0;
  let failed = 0;
  for (const it of items) {
    succeeded += (it.after?.succeeded as number | undefined) ?? 0;
    failed += (it.after?.failed as number | undefined) ?? 0;
  }
  const allDone = doneCount + failedCount === total;
  if (!allDone) {
    await supabase
      .from("enrichment_jobs")
      .update({ processed: doneCount + failedCount, succeeded, failed })
      .eq("id", jobId);
    return false;
  }
  await supabase
    .from("enrichment_jobs")
    .update({
      status: failedCount > 0 && doneCount === 0 ? "failed" : "done",
      processed: total,
      succeeded,
      failed,
      finished_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  return true;
}
