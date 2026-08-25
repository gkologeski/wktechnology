// Sincronização de pipelines/estágios do HubSpot. Extraído de hubspot-steps.server.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import { hsFetch } from "./hubspot-api.server";

// ─────────────────────── HubSpot Pipelines sync ──────────────────────────────

export type HsPipelineStage = {
  id: string;
  label: string;
  displayOrder?: number;
  metadata?: { probability?: string; isClosed?: string | boolean; ticketState?: string };
  stageType?: string;
};
export type HsPipeline = {
  id: string;
  label: string;
  displayOrder?: number;
  stages?: HsPipelineStage[];
};

export const STAGE_COLOR_POOL = [
  "var(--hs-stage-1)",
  "var(--hs-stage-2)",
  "var(--hs-stage-3)",
  "var(--hs-stage-4)",
  "var(--hs-stage-won)",
  "var(--hs-stage-lost)",
];

export function classifyHsStage(s: HsPipelineStage): {
  type: "open" | "won" | "lost";
  legacy: "new" | "won" | "lost";
} {
  const prob = Number(s.metadata?.probability ?? "");
  const closed = String(s.metadata?.isClosed ?? "").toLowerCase() === "true";
  if (closed && prob >= 1) return { type: "won", legacy: "won" };
  if (closed) return { type: "lost", legacy: "lost" };
  return { type: "open", legacy: "new" };
}

export type PipelineSync = {
  pipelineMap: Record<string, string>; // hsPipelineId -> local pipelines.id
  stageMap: Record<string, { hsPipelineId: string; legacy: "new" | "won" | "lost" }>; // hsStageId -> info
};

export async function syncHubspotDealPipelines(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
): Promise<PipelineSync> {
  const r = (await hsFetch("/crm/v3/pipelines/deals")) as { results?: HsPipeline[] };
  const pipelines = r.results ?? [];

  const { data: existing } = await supabase
    .from("pipelines")
    .select("id, name, config, is_default")
    .eq("workspace_id", workspaceId)
    .eq("entity", "deal");

  const existingByHsId = new Map<string, { id: string; name: string }>();
  const existingByName = new Map<string, { id: string; name: string }>();
  for (const p of (existing ?? []) as {
    id: string;
    name: string;
    config: { hs_pipeline_id?: string } | null;
  }[]) {
    const hsId = p.config?.hs_pipeline_id;
    if (hsId) existingByHsId.set(String(hsId), { id: p.id, name: p.name });
    existingByName.set(p.name, { id: p.id, name: p.name });
  }
  const hasAnyDefault = (existing ?? []).some((p) => (p as { is_default?: boolean }).is_default);

  const pipelineMap: Record<string, string> = {};
  const stageMap: Record<string, { hsPipelineId: string; legacy: "new" | "won" | "lost" }> = {};

  for (const hp of pipelines) {
    const sortedStages = [...(hp.stages ?? [])].sort(
      (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
    );
    const stagesPayload = sortedStages.map((s, i) => {
      const c = classifyHsStage(s);
      stageMap[String(s.id)] = { hsPipelineId: hp.id, legacy: c.legacy };
      return {
        value: String(s.id),
        label: s.label,
        color:
          c.type === "won"
            ? "var(--hs-stage-won)"
            : c.type === "lost"
              ? "var(--hs-stage-lost)"
              : STAGE_COLOR_POOL[i % 4],
        probability: Math.round(Number(s.metadata?.probability ?? 0) * 100),
        type: c.type,
      };
    });

    const found = existingByHsId.get(hp.id) ?? existingByName.get(hp.label);
    if (found) {
      await supabase
        .from("pipelines")
        .update({
          name: hp.label,
          stages: stagesPayload as never,
          config: { hs_pipeline_id: hp.id } as never,
        })
        .eq("id", found.id);
      pipelineMap[hp.id] = found.id;
    } else {
      const { data: ins, error } = await supabase
        .from("pipelines")
        .insert({
          owner_id: userId,
          entity: "deal",
          name: hp.label,
          is_default: !hasAnyDefault && Object.keys(pipelineMap).length === 0,
          stages: stagesPayload as never,
          config: { hs_pipeline_id: hp.id } as never,
        })
        .select("id")
        .single();
      if (!error && ins) pipelineMap[hp.id] = (ins as { id: string }).id;
    }
  }

  return { pipelineMap, stageMap };
}

export async function syncHubspotTicketPipelines(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
): Promise<Record<string, string>> {
  const r = (await hsFetch("/crm/v3/pipelines/tickets")) as { results?: HsPipeline[] };
  const pipelines = r.results ?? [];

  const { data: existing } = await supabase
    .from("pipelines")
    .select("id, name, config")
    .eq("workspace_id", workspaceId)
    .eq("entity", "ticket");

  const existingByHsId = new Map<string, { id: string; name: string }>();
  const existingByName = new Map<string, { id: string; name: string }>();
  for (const p of (existing ?? []) as {
    id: string;
    name: string;
    config: { hs_pipeline_id?: string; hubspot_id?: string } | null;
  }[]) {
    const hsId = p.config?.hs_pipeline_id ?? p.config?.hubspot_id;
    if (hsId) existingByHsId.set(String(hsId), { id: p.id, name: p.name });
    existingByName.set(p.name, { id: p.id, name: p.name });
  }

  const pipelineMap: Record<string, string> = {};
  for (const hp of pipelines) {
    const sortedStages = [...(hp.stages ?? [])].sort(
      (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
    );
    const stagesPayload = sortedStages.map((s, i) => {
      const isClosed = String(s.metadata?.ticketState ?? "").toUpperCase() === "CLOSED";
      return {
        value: String(s.id),
        label: s.label,
        color: isClosed ? "var(--hs-stage-won)" : STAGE_COLOR_POOL[i % 4],
        probability: 0,
        type: isClosed ? "won" : "open",
      };
    });

    const found = existingByHsId.get(hp.id) ?? existingByName.get(hp.label);
    if (found) {
      await supabase
        .from("pipelines")
        .update({
          name: hp.label,
          stages: stagesPayload as never,
          config: { hs_pipeline_id: hp.id, hubspot_id: hp.id } as never,
        })
        .eq("id", found.id);
      pipelineMap[hp.id] = found.id;
    } else {
      const { data: ins, error } = await supabase
        .from("pipelines")
        .insert({
          owner_id: userId,
          entity: "ticket",
          name: hp.label,
          is_default: false,
          stages: stagesPayload as never,
          config: { hs_pipeline_id: hp.id, hubspot_id: hp.id } as never,
        })
        .select("id")
        .single();
      if (!error && ins) pipelineMap[hp.id] = (ins as { id: string }).id;
    }
  }
  return pipelineMap;
}
