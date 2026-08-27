// Etapa "leads" da importação do HubSpot — extraída de hubspot-steps.server.ts
import {
  type HSRec,
  batchRead,
  hsFetch,
  loadHsProperties,
  mapLead,
  rawOf,
} from "./hubspot-api.server";
import { appendLog, patchItemBefore, searchTotal } from "./hubspot-steps-state.server";
import { upsertBatchByHsId } from "./hubspot-steps-upsert.server";
import type { StepRunArgs } from "./hubspot-step-run-context";
import type { StepResult } from "./hubspot-steps-types";

export async function runLeadsStep(args: StepRunArgs): Promise<StepResult | void> {
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
        st.partial = true;
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
        if (r.status === "failed") st.fail++;
        else {
          st.imported.push(tasks[j].hsId);
          st.ok++;
        }
      }
      idx += chunkIds.length;
      await persistCursor({ read_index: idx });
      await bump(st.ok, st.fail, targetIds.length);
    }
    if (st.partial) await persistCursor({ read_index: idx });
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
        st.partial = true;
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
          st.fail++;
          await appendLog(supabase, jobId, {
            level: "warn",
            step,
            message: `Falha lead ${tasks[j].hsId}: ${r.error}`,
          });
        } else {
          st.imported.push(tasks[j].hsId);
          st.ok++;
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
