import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import type { RequestKind, PickerKind, PickerOption } from "./types";
export async function assertPreparation(
  client: SupabaseClient,
  userId: string,
  kind: RequestKind,
  action: string,
) {
  const ws = await getActiveWorkspaceId(client, userId);
  if ((await workRpc(client, "hiring_preparation_access", { w: ws, k: kind, a: action })) !== true)
    throw new Error("Sem permissão para esta solicitação.");
  return ws;
}
export async function preparationPicker(
  client: SupabaseClient,
  ws: string,
  kind: PickerKind,
  search: string,
  selected: string | null,
  company: string | null,
): Promise<PickerOption[]> {
  const map = {
    area: ["user_groups", "name"],
    legal_entity: ["legal_entities", "name"],
    person: ["people", "full_name"],
    company: ["companies", "name"],
    contact: ["contacts", "first_name"],
    deal: ["deals", "name"],
    project: ["projects", "name"],
    commercial_contract: ["contracts", "title"],
  } as const;
  const [table, label] = map[kind];
  let q = client.from(table).select(`id,${label}`).eq("workspace_id", ws).order(label).limit(25);
  if (selected) q = q.eq("id", selected);
  else q = q.ilike(label, `%${search}%`);
  if (kind === "legal_entity") q = q.eq("active", true);
  if (kind === "person") q = q.eq("archived", false);
  if (["company", "contact", "deal"].includes(kind)) q = q.is("deleted_at", null);
  if (kind === "commercial_contract") q = q.eq("role", "provider");
  if (kind === "contact") {
    if (!company) return [];
    q = q.eq("company_id", company);
  }
  const { data, error } = await q;
  if (error) throw new Error("Não foi possível carregar as opções disponíveis.");
  return (data ?? []).map((row) => ({
    id: String(row.id),
    label: String(
      "first_name" in row
        ? row.first_name
        : "full_name" in row
          ? row.full_name
          : "name" in row
            ? row.name
            : "title" in row
              ? row.title
              : "Sem nome",
    ),
  }));
}
