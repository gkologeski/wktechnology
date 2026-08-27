// Etapa "contacts" da importação do HubSpot — extraída de hubspot-steps.server.ts
import {
  batchRead,
  mapContact,
  rawOf,
} from "./hubspot-api.server";
import { appendLog, loadImportedHsIdsForStep, loadLocalMapForHsIds, patchItemBefore } from "./hubspot-steps-state.server";
import { upsertBatchByHsId } from "./hubspot-steps-upsert.server";
import { discoverTargetsFromAssociations } from "./hubspot-steps-discovery.server";
import type { StepRunArgs } from "./hubspot-step-run-context";
import type { StepResult } from "./hubspot-steps-types";

export async function runContactsStep(args: StepRunArgs): Promise<StepResult | void> {
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
        st.partial = true;
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
        return { succeeded: st.ok, failed: st.fail, importedHsIds: st.imported, partial: true };
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
      st.partial = true;
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
        st.fail++;
        continue;
      }
      const p = c.properties;
      if (!p.firstname && !p.email) {
        st.fail++;
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
      if (r.status === "failed") st.fail++;
      else {
        st.imported.push(tasks[j].hsId);
        st.ok++;
      }
    }
    await bump(st.ok, st.fail, targetIds.length, true);

    idx += chunkIds.length;
    await persistCursor({ read_index: idx });
    await bump(st.ok, st.fail, targetIds.length);
  }
  if (st.partial) await persistCursor({ read_index: idx });
  else await persistCursor({ read_index: targetIds.length });
}
