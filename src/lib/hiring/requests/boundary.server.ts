import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { orSafeLike } from "@/lib/postgrest-search";
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
    contract: ["contracts", "title"],
    commercial_contract: ["contracts", "title"],
  } as const;
  const [table, label] = map[kind];
  const columns =
    kind === "contact"
      ? "id,first_name,last_name"
      : kind === "company"
        ? "id,name,cnpj"
        : `id,${label}`;
  let q = client.from(table).select(columns).eq("workspace_id", ws).order(label).limit(25);
  if (selected) q = q.eq("id", selected);
  else if (kind === "contact" || kind === "company") {
    for (const token of search.trim().split(/\s+/).filter(Boolean).slice(0, 10)) {
      const like = orSafeLike(token);
      q = q.or(
        kind === "contact"
          ? `first_name.ilike.${like},last_name.ilike.${like}`
          : `name.ilike.${like},cnpj.ilike.${like}`,
      );
    }
  } else q = q.ilike(label, `%${search}%`);
  if (kind === "legal_entity") q = q.eq("active", true);
  if (kind === "person") q = q.eq("archived", false);
  if (["company", "contact", "deal"].includes(kind)) q = q.is("deleted_at", null);
  if (kind === "commercial_contract") q = q.eq("role", "provider");
  if (kind === "contract") q = q.eq("role", "client");
  if (kind === "contact") {
    if (!company) return [];
    q = q.eq("company_id", company);
  }
  const { data, error } = await q;
  if (error) throw new Error("Não foi possível carregar as opções disponíveis.");
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    hint: "cnpj" in row && typeof row.cnpj === "string" ? row.cnpj : null,
    label: String(
      "first_name" in row
        ? [row.first_name, "last_name" in row ? row.last_name : null].filter(Boolean).join(" ")
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
