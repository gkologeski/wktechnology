// Etapa "tickets" da importação do HubSpot — extraída de hubspot-steps.server.ts
import {
  type HSRec,
  batchRead,
  getAssocMany,
  hsFetch,
  loadHsProperties,
  mapHsTicketPriority,
  mapTicket,
  rawOf,
} from "./hubspot-api.server";
import {
  appendLog,
  loadMapForStep,
  patchItemBefore,
  searchTotal,
} from "./hubspot-steps-state.server";
import { upsertBatchByHsId } from "./hubspot-steps-upsert.server";
import { syncHubspotTicketPipelines } from "./hubspot-pipelines.server";
import type { StepRunArgs } from "./hubspot-step-run-context";
import type { StepResult } from "./hubspot-steps-types";

export async function runTicketsStep(args: StepRunArgs): Promise<StepResult | void> {
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
  const companyMap = await loadMapForStep(supabase, workspaceId, jobId, "companies", "companies");
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
      st.partial = true;
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
          pipeline_id: p.hs_pipeline ? (ticketPipelineMap[String(p.hs_pipeline)] ?? null) : null,
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
        st.fail++;
        await appendLog(supabase, jobId, {
          level: "warn",
          step,
          message: `Falha ticket ${tasks[j].hsId}: ${r.error}`,
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
