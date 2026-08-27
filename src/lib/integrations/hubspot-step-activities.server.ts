// Etapa "activities" da importação do HubSpot — extraída de hubspot-steps.server.ts
import {
  type HSRec,
  batchRead,
  getAssocMany,
  hsFetch,
  loadHsProperties,
  mapActivity,
  parseHsDate,
  rawOf,
} from "./hubspot-api.server";
import { appendLog, loadMapForStep, patchItemBefore } from "./hubspot-steps-state.server";
import { upsertByHsId } from "./hubspot-steps-upsert.server";
import { discoverActivityTargets } from "./hubspot-steps-discovery.server";
import type { StepRunArgs } from "./hubspot-step-run-context";
import type { StepResult } from "./hubspot-steps-types";

export async function runActivitiesStep(args: StepRunArgs): Promise<StepResult | void> {
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
      return { succeeded: st.ok, failed: st.fail, importedHsIds: st.imported, partial: true };
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
        st.partial = true;
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
        if (r.status === "failed") st.fail++;
        else {
          st.imported.push(a.id);
          st.ok++;
        }
      }
      idx += chunkIds.length;
      await persistCursor({ read_index: idx });
      await bump(st.ok, st.fail, targetIds.length);
    }
    if (st.partial) await persistCursor({ read_index: idx });
    else await persistCursor({ read_index: targetIds.length });
  }
}
