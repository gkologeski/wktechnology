// Etapa "deals" da importação do HubSpot — extraída de hubspot-steps.server.ts
import {
  type HSRec,
  batchRead,
  getAssocMany,
  hsFetch,
  loadHsProperties,
  mapDeal,
  rawOf,
} from "./hubspot-api.server";
import {
  appendLog,
  loadLocalMapForHsIds,
  loadMapForStep,
  patchItemBefore,
  searchTotal,
} from "./hubspot-steps-state.server";
import { upsertBatchByHsId } from "./hubspot-steps-upsert.server";
import { syncHubspotDealPipelines } from "./hubspot-pipelines.server";
import type { StepRunArgs } from "./hubspot-step-run-context";
import type { StepResult } from "./hubspot-steps-types";

export async function runDealsStep(args: StepRunArgs): Promise<StepResult | void> {
  const {
    supabase,
    userId,
    workspaceId,
    jobId,
    itemId,
    step,
    scope,
    resume,
    st,
    deadlineAt,
    isExpired,
    bump,
    persistCursor,
  } = args;
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
        st.partial = true;
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
          st.fail++;
          continue;
        }
        st.imported.push(t.hsId);
        st.ok++;
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
      await bump(st.ok, st.fail, targetIds.length);
    }
    if (st.partial) await persistCursor({ read_index: idx });
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
        st.partial = true;
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
          st.fail++;
          continue;
        }
        st.imported.push(t.hsId);
        st.ok++;
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
      await bump(st.ok, st.fail);
      if (!nextAfter) break;
    }
  }
}
