// Entrega do negócio (TechProjects ciclo 2), lado servidor. Toda gravação passa por funções do
// banco que conferem escopo comercial/projetos, workspace ativo, membership ativo e Ver como;
// leituras auxiliares usam o cliente do usuário (RLS). Nenhuma leitura cria vínculo ou projeto.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { DeliveryOverview, ProjectOrigin } from "./deal-delivery-labels";

type Db = SupabaseClient<Database>;

function rpcError(error: { message: string } | null): never {
  throw new Error(error?.message ?? "Não foi possível concluir a ação de entrega.");
}

export async function loadDealOverview(supabase: Db, dealId: string): Promise<DeliveryOverview> {
  const { data, error } = await supabase.rpc("deal_delivery_overview", { p_deal: dealId });
  if (error) rpcError(error);
  return data as unknown as DeliveryOverview;
}

export async function createFromDeal(
  supabase: Db,
  input: { dealId: string; ownerId: string | null },
) {
  const { data, error } = await supabase.rpc("deal_delivery_create_project", {
    p_deal: input.dealId,
    p_operational_owner: input.ownerId ?? undefined,
  });
  if (error) rpcError(error);
  return data as {
    results: Array<{ group: string; project_id: string; action: "created" | "existing" }>;
  };
}

export async function linkToDeal(
  supabase: Db,
  input: { dealId: string; projectId: string; group: string; note: string | null },
) {
  const { data, error } = await supabase.rpc("deal_delivery_link_project", {
    p_deal: input.dealId,
    p_project: input.projectId,
    p_group: input.group,
    p_note: input.note ?? undefined,
  });
  if (error) rpcError(error);
  return data as { mode: "primary" | "consolidated" };
}

export async function unlinkFromDeal(
  supabase: Db,
  input: { dealId: string; projectId: string; note: string },
) {
  const { data, error } = await supabase.rpc("deal_delivery_unlink_project", {
    p_deal: input.dealId,
    p_project: input.projectId,
    p_note: input.note,
  });
  if (error) rpcError(error);
  return data as { mode: string };
}

export async function saveGroups(
  supabase: Db,
  input: {
    dealId: string;
    items: Array<{ lineItemId: string; groupKey: string | null; groupLabel: string | null }>;
  },
) {
  const { data, error } = await supabase.rpc("deal_delivery_set_groups", {
    p_deal: input.dealId,
    p_items: input.items.map((i) => ({
      line_item_id: i.lineItemId,
      group_key: i.groupKey,
      group_label: i.groupLabel,
    })) as unknown as Json,
  });
  if (error) rpcError(error);
  return data as { items: number };
}

export async function retryDelivery(supabase: Db, dealId: string) {
  const { data, error } = await supabase.rpc("deal_delivery_retry", { p_deal: dealId });
  if (error) rpcError(error);
  return data as { job_status: string; error?: string };
}

export async function setOperationalOwner(
  supabase: Db,
  input: { projectId: string; userId: string | null },
) {
  const { data, error } = await supabase.rpc("deal_delivery_set_operational_owner", {
    p_project: input.projectId,
    p_user: input.userId as string,
  });
  if (error) rpcError(error);
  return data as { assigned_to: string | null };
}

export async function resolveReview(supabase: Db, input: { eventId: string; note: string }) {
  const { data, error } = await supabase.rpc("deal_delivery_resolve_review", {
    p_event: input.eventId,
    p_note: input.note,
  });
  if (error) rpcError(error);
  return data as { resolved: boolean };
}

/** Busca de projetos para vincular: só o que o usuário já pode ler (RLS) no workspace ativo. */
export async function searchLinkableProjects(
  supabase: Db,
  input: { workspaceId: string; dealId: string; q: string },
) {
  let query = supabase
    .from("projects")
    .select("id, name, status, company_id, deal_id, companies(name)")
    .eq("workspace_id", input.workspaceId)
    .order("updated_at", { ascending: false })
    .limit(20);
  const q = input.q.trim();
  if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
  const { data, error } = await query;
  if (error) rpcError(error);
  return (data ?? [])
    .filter((p) => p.deal_id !== input.dealId)
    .map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status as string,
      companyId: p.company_id,
      companyName: (p.companies as { name: string } | null)?.name ?? null,
      hasOtherDeal: !!p.deal_id,
    }));
}

export async function loadProjectOrigin(supabase: Db, projectId: string) {
  const { data, error } = await supabase.rpc("project_delivery_origin", { p_project: projectId });
  if (error) rpcError(error);
  const origin = data as unknown as ProjectOrigin;
  // Contrato e serviço só com nome quando o usuário pode lê-los (RLS); senão, apenas "sem acesso".
  const [contract, service] = await Promise.all([
    origin.contract_id
      ? supabase
          .from("contracts")
          .select("id, number, title")
          .eq("id", origin.contract_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    origin.service_id
      ? supabase.from("services").select("id, name").eq("id", origin.service_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    ...origin,
    contract: contract.data
      ? { id: contract.data.id, label: contract.data.number || contract.data.title || "Contrato" }
      : null,
    contractHidden: !!origin.contract_id && !contract.data,
    service: service.data ? { id: service.data.id, name: service.data.name } : null,
    serviceHidden: !!origin.service_id && !service.data,
  };
}

const PROJECT_LIST = "id, name, status, deal_id, contract_id, origin, assigned_to, created_at";

async function dealNames(supabase: Db, ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const { data } = await supabase.from("deals").select("id, name").in("id", ids);
  return new Map((data ?? []).map((d) => [d.id, d.name]));
}

/** Projetos da empresa (RLS) com o negócio de origem quando legível. Paginado. */
export async function loadCompanyProjects(
  supabase: Db,
  input: { companyId: string; page: number; pageSize: number },
) {
  const from = (input.page - 1) * input.pageSize;
  const { data, error, count } = await supabase
    .from("projects")
    .select(PROJECT_LIST, { count: "exact" })
    .eq("company_id", input.companyId)
    .order("created_at", { ascending: false })
    .range(from, from + input.pageSize - 1);
  if (error) rpcError(error);
  const rows = data ?? [];
  const names = await dealNames(supabase, [
    ...new Set(rows.map((r) => r.deal_id).filter((v): v is string => !!v)),
  ]);
  return {
    total: count ?? rows.length,
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status as string,
      origin: r.origin,
      dealId: r.deal_id && names.has(r.deal_id) ? r.deal_id : null,
      dealName: r.deal_id ? (names.get(r.deal_id) ?? null) : null,
      dealHidden: !!r.deal_id && !names.has(r.deal_id),
    })),
  };
}

/** Projetos ligados ao contrato (RLS). Paginado. */
export async function loadContractProjects(
  supabase: Db,
  input: { contractId: string; page: number; pageSize: number },
) {
  const from = (input.page - 1) * input.pageSize;
  const { data, error, count } = await supabase
    .from("projects")
    .select(PROJECT_LIST, { count: "exact" })
    .eq("contract_id", input.contractId)
    .order("created_at", { ascending: false })
    .range(from, from + input.pageSize - 1);
  if (error) rpcError(error);
  return {
    total: count ?? (data ?? []).length,
    rows: (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status as string,
      origin: r.origin,
    })),
  };
}
