// Política e conciliação do histórico da entrega do negócio (somente administrador ativo).
// As funções do banco repetem a checagem de administrador, workspace ativo e Ver como.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

type Db = SupabaseClient<Database>;

function rpcError(error: { message: string } | null): never {
  throw new Error(error?.message ?? "Não foi possível concluir a ação de entrega.");
}

// ------------------------------------------------------------------ política e histórico (admin)
type AdminCtx = { workspaceId: string };

export async function loadPolicy(supabase: Db, ctx: AdminCtx) {
  const { data, error } = await supabase.rpc("deal_delivery_policy_get", { p_ws: ctx.workspaceId });
  if (error) rpcError(error);
  return data as unknown as PolicyState;
}

export type PolicyState = {
  policy: {
    enabled: boolean;
    activated_at: string | null;
    allow_groups: boolean;
    origins: Record<"user" | "system" | "workflow" | "import", boolean>;
    project_creator_id: string | null;
    default_operational_owner_id: string | null;
    updated_at: string;
    updated_by: string | null;
  } | null;
  worker: { last_run_at: string | null; last_work_at: string | null };
  jobs: Record<string, number>;
  projects: { auto: number; manual: number; history: number; linked: number };
  reviews_open: number;
};

export async function savePolicy(
  supabase: Db,
  ctx: AdminCtx,
  input: {
    enabled: boolean;
    allowGroups: boolean;
    origins: Record<"user" | "system" | "workflow" | "import", boolean>;
    creatorId: string | null;
    defaultOwnerId: string | null;
    resetActivation: boolean;
  },
) {
  const { data, error } = await supabase.rpc("deal_delivery_policy_save", {
    p_ws: ctx.workspaceId,
    p_enabled: input.enabled,
    p_allow_groups: input.allowGroups,
    p_origins: input.origins as unknown as Json,
    p_creator: input.creatorId as string,
    p_default_owner: input.defaultOwnerId as string,
    p_reset_activation: input.resetActivation,
  });
  if (error) rpcError(error);
  return data as unknown as PolicyState;
}

export type HistoryRow = {
  id: string;
  name: string;
  closed_at: string | null;
  n_projects: number;
  company: { id: string; name: string } | null;
  contracts: Array<{
    id: string;
    number: string | null;
    title: string;
    kind: string;
    company_ok: boolean;
  }>;
  services: number;
  projects: Array<{ id: string; name: string; link: string }>;
  nature: string[] | null;
  candidates: Array<{
    project_id: string;
    name: string;
    criterion: string;
    exact: boolean;
    project_has_deal: boolean;
    company_matches: boolean;
    first_entry: string | null;
    logged_seconds: number | null;
    days_from_close: number | null;
    evidence: Record<string, string | null>;
  }>;
};

export type HistoryList = {
  summary: { won: number; with_project: number; missing: number; reviews_open: number };
  total: number;
  page: number;
  page_size: number;
  rows: HistoryRow[];
  recent_links: Array<{
    id: string;
    kind: string;
    created_at: string;
    deal_id: string;
    project_id: string;
    deal_name: string | null;
    project_name: string | null;
    mode: string;
    criterion: string | null;
    note: string | null;
    revertable: boolean;
  }>;
};

export async function listHistory(
  supabase: Db,
  ctx: AdminCtx,
  input: {
    filter: "missing" | "linked" | "all";
    q: string | null;
    from: string | null;
    to: string | null;
    page: number;
    pageSize: number;
  },
) {
  const { data, error } = await supabase.rpc("deal_delivery_history_list", {
    p_ws: ctx.workspaceId,
    p_filter: input.filter,
    p_q: input.q ?? undefined,
    p_from: input.from ?? undefined,
    p_to: input.to ?? undefined,
    p_page: input.page,
    p_size: input.pageSize,
  });
  if (error) rpcError(error);
  return data as unknown as HistoryList;
}

export type PairPreview = {
  deal_id: string;
  project_id: string;
  deal_name: string | null;
  project_name: string | null;
  mode: "primary" | "consolidated";
  blocked: string | null;
  warnings: string[];
  logged_seconds: number;
  snapshot: string | null;
};

export async function previewHistory(
  supabase: Db,
  ctx: AdminCtx,
  pairs: Array<{ dealId: string; projectId: string }>,
) {
  const { data, error } = await supabase.rpc("deal_delivery_history_preview", {
    p_ws: ctx.workspaceId,
    p_pairs: pairs.map((p) => ({ deal_id: p.dealId, project_id: p.projectId })) as unknown as Json,
  });
  if (error) rpcError(error);
  return data as unknown as PairPreview[];
}

export async function applyHistory(
  supabase: Db,
  ctx: AdminCtx,
  input: {
    pairs: Array<{ dealId: string; projectId: string; snapshot: string; criterion: string }>;
    note: string;
  },
) {
  const { data, error } = await supabase.rpc("deal_delivery_history_apply", {
    p_ws: ctx.workspaceId,
    p_pairs: input.pairs.map((p) => ({
      deal_id: p.dealId,
      project_id: p.projectId,
      snapshot: p.snapshot,
      criterion: p.criterion,
    })) as unknown as Json,
    p_note: input.note,
  });
  if (error) rpcError(error);
  return data as { batch_id: string; linked: number };
}

export async function applyExactHistory(supabase: Db, ctx: AdminCtx) {
  const { data, error } = await supabase.rpc("deal_delivery_history_apply_exact", {
    p_ws: ctx.workspaceId,
  });
  if (error) rpcError(error);
  return data as { batch_id: string; linked: number; skipped: number };
}

export async function createMissingHistory(
  supabase: Db,
  ctx: AdminCtx,
  input: { dealIds: string[]; note: string },
) {
  const { data, error } = await supabase.rpc("deal_delivery_history_create", {
    p_ws: ctx.workspaceId,
    p_deals: input.dealIds,
    p_note: input.note,
  });
  if (error) rpcError(error);
  return data as { created: Array<{ results: Array<{ action: string }> }> };
}

export async function revertHistory(
  supabase: Db,
  ctx: AdminCtx,
  input: { eventIds: string[]; note: string },
) {
  const { data, error } = await supabase.rpc("deal_delivery_history_revert", {
    p_ws: ctx.workspaceId,
    p_events: input.eventIds,
    p_note: input.note,
  });
  if (error) rpcError(error);
  return data as { reverted: number; skipped: number };
}
