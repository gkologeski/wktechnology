// Descoberta de alvos via associações do HubSpot. Extraído de hubspot-steps.server.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAssocMany } from "./hubspot-api.server";
import { appendLog, patchItemBefore } from "./hubspot-steps-state.server";
import type { ResumeState, StepName } from "./hubspot-steps-types";

export async function discoverTargetsFromAssociations(args: {
  supabase: SupabaseClient;
  jobId: string;
  itemId: string;
  step: StepName;
  fromObj: string;
  fromIds: string[];
  toObj: string;
  resume: ResumeState;
  deadlineAt: number;
}) {
  const { supabase, jobId, itemId, step, fromObj, fromIds, toObj, resume, deadlineAt } = args;
  const targetIds = [...(resume.target_ids ?? [])];
  const parentMap = { ...(resume.parent_map ?? {}) };
  const seen = new Set(targetIds);
  let assocIndex = resume.assoc_index ?? 0;
  const CHUNK = 500;

  while (assocIndex < fromIds.length) {
    if (Date.now() >= deadlineAt - 1_500) {
      await patchItemBefore(supabase, itemId, {
        assoc_index: assocIndex,
        target_ids: targetIds,
        parent_map: parentMap,
        discovered: targetIds.length,
      });
      return { targetIds, parentMap, partial: true };
    }
    const chunk = fromIds.slice(assocIndex, assocIndex + CHUNK);
    const assoc = await getAssocMany(fromObj, chunk, toObj, 20);
    for (const [fromId, list] of assoc.entries()) {
      for (const id of list) {
        if (!parentMap[id]) parentMap[id] = fromId;
        if (!seen.has(id)) {
          seen.add(id);
          targetIds.push(id);
        }
      }
    }
    assocIndex += chunk.length;
    await patchItemBefore(supabase, itemId, {
      assoc_index: assocIndex,
      target_ids: targetIds,
      parent_map: parentMap,
      discovered: targetIds.length,
      last_heartbeat_at: new Date().toISOString(),
    });
    await supabase
      .from("enrichment_jobs")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", jobId);
    await appendLog(supabase, jobId, {
      level: "info",
      step,
      message: `Associações mapeadas: ${assocIndex}/${fromIds.length} ${fromObj}, ${targetIds.length} ${toObj} únicos`,
    });
  }

  await patchItemBefore(supabase, itemId, {
    assoc_index: assocIndex,
    discovery_complete: true,
    target_ids: targetIds,
    parent_map: parentMap,
    discovered: targetIds.length,
  });
  return { targetIds, parentMap, partial: false };
}

export async function discoverDealContactsMap(args: {
  supabase: SupabaseClient;
  jobId: string;
  itemId: string;
  step: StepName;
  dealIds: string[];
  resume: ResumeState;
  deadlineAt: number;
}) {
  const { supabase, jobId, itemId, step, dealIds, resume, deadlineAt } = args;
  const dealContactsMap = { ...(resume.deal_contacts_map ?? {}) };
  let index = resume.deal_contacts_index ?? 0;
  const CHUNK = 500;
  while (index < dealIds.length) {
    if (Date.now() >= deadlineAt - 1_500) {
      await patchItemBefore(supabase, itemId, {
        deal_contacts_index: index,
        deal_contacts_map: dealContactsMap,
      });
      return { dealContactsMap, partial: true };
    }
    const chunk = dealIds.slice(index, index + CHUNK);
    const assoc = await getAssocMany("deals", chunk, "contacts", 20);
    for (const [dealId, list] of assoc.entries()) dealContactsMap[dealId] = list;
    index += chunk.length;
    await patchItemBefore(supabase, itemId, {
      deal_contacts_index: index,
      deal_contacts_map: dealContactsMap,
      last_heartbeat_at: new Date().toISOString(),
    });
    await supabase
      .from("enrichment_jobs")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", jobId);
    await appendLog(supabase, jobId, {
      level: "info",
      step,
      message: `Associações negócio↔contato mapeadas: ${index}/${dealIds.length}`,
    });
  }
  await patchItemBefore(supabase, itemId, {
    deal_contacts_index: index,
    deal_contacts_complete: true,
    deal_contacts_map: dealContactsMap,
  });
  return { dealContactsMap, partial: false };
}

export async function discoverActivityTargets(args: {
  supabase: SupabaseClient;
  jobId: string;
  itemId: string;
  step: StepName;
  kind: string;
  entities: {
    fromObj: string;
    ids: string[];
    key: "companyId" | "contactId" | "dealId" | "leadId";
  }[];
  resume: ResumeState;
  deadlineAt: number;
}) {
  const { supabase, jobId, itemId, step, kind, entities, resume, deadlineAt } = args;
  const targetIds = [...(resume.target_ids ?? [])];
  const parents = { ...(resume.parents_map ?? {}) } as Record<
    string,
    { contactId?: string; companyId?: string; dealId?: string; leadId?: string }
  >;
  const seen = new Set(targetIds);
  let entityIndex = resume.discovery_entity_index ?? 0;
  let idIndex = resume.discovery_id_index ?? 0;
  const CHUNK = 500;

  while (entityIndex < entities.length) {
    const ent = entities[entityIndex];
    while (idIndex < ent.ids.length) {
      if (Date.now() >= deadlineAt - 1_500) {
        await patchItemBefore(supabase, itemId, {
          discovery_entity_index: entityIndex,
          discovery_id_index: idIndex,
          target_ids: targetIds,
          parents_map: parents,
          discovered: targetIds.length,
        });
        return { targetIds, parents, partial: true };
      }
      const chunk = ent.ids.slice(idIndex, idIndex + CHUNK);
      const assoc = await getAssocMany(ent.fromObj, chunk, kind, 20);
      for (const [, list] of assoc.entries()) {
        for (const eid of list) {
          const cur = parents[eid] ?? {};
          cur[ent.key] ??= undefined;
          cur[ent.key] = cur[ent.key] ?? undefined;
          parents[eid] = { ...cur, [ent.key]: cur[ent.key] ?? undefined };
          if (!seen.has(eid)) {
            seen.add(eid);
            targetIds.push(eid);
          }
        }
      }
      for (const [fid, list] of assoc.entries()) {
        for (const eid of list) parents[eid] = { ...(parents[eid] ?? {}), [ent.key]: fid };
      }
      idIndex += chunk.length;
      await patchItemBefore(supabase, itemId, {
        discovery_entity_index: entityIndex,
        discovery_id_index: idIndex,
        target_ids: targetIds,
        parents_map: parents,
        discovered: targetIds.length,
        last_heartbeat_at: new Date().toISOString(),
      });
      await supabase
        .from("enrichment_jobs")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", jobId);
      await appendLog(supabase, jobId, {
        level: "info",
        step,
        message: `Associações ${ent.fromObj}→${kind}: ${idIndex}/${ent.ids.length}, ${targetIds.length} itens únicos`,
      });
    }
    entityIndex++;
    idIndex = 0;
  }
  await patchItemBefore(supabase, itemId, {
    discovery_entity_index: entityIndex,
    discovery_id_index: idIndex,
    discovery_complete: true,
    target_ids: targetIds,
    parents_map: parents,
    discovered: targetIds.length,
  });
  return { targetIds, parents, partial: false };
}
