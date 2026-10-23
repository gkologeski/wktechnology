import type { SupabaseClient } from "@supabase/supabase-js";

export type HrPrivateResource =
  | "people_sensitive"
  | "one_on_ones_private"
  | "allocations_financial";
export type HrPrivateRow = {
  id: string;
  can_view: boolean;
  can_update: boolean;
  fields: Record<string, unknown>;
};
export async function readHrPrivate(
  client: SupabaseClient,
  resource: HrPrivateResource,
  ids: string[],
  parent = false,
): Promise<Map<string, HrPrivateRow>> {
  const rows = new Map<string, HrPrivateRow>();
  const unique = [...new Set(ids)];
  for (let start = 0; start < unique.length; start += 200) {
    const rpc = client.rpc as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: HrPrivateRow[] | null; error: { message: string } | null }>;
    const result = await rpc.call(client, "hr_private_fields", {
      _resource: resource,
      _ids: unique.slice(start, start + 200),
      _parent: parent,
    });
    if (result.error) throw new Error("Não foi possível verificar os dados privados.");
    for (const row of result.data ?? []) rows.set(row.id, row);
  }
  return rows;
}

/** Omitted or hidden blank values must never clear private data on general edits. */
export async function protectHrPrivatePayload(
  client: SupabaseClient,
  resource: HrPrivateResource,
  id: string | undefined | null,
  personId: string | undefined | null,
  payload: Record<string, unknown>,
  columns: string[],
): Promise<void> {
  const supplied = columns.filter(
    (key) => Object.hasOwn(payload, key) && payload[key] !== undefined,
  );
  if (!supplied.length) return;
  if (!id && resource === "people_sensitive") return; // INSERT trigger checks the real new relationship.
  const lookupId = id ?? personId;
  if (!lookupId) throw new Error("Registro privado indisponível.");
  const access = (await readHrPrivate(client, resource, [lookupId], !id)).get(lookupId);
  if (access?.can_update) return;
  const nonblank = supplied.some((key) => payload[key] !== null && payload[key] !== "");
  if (nonblank) throw new Error("Sem permissão para alterar dados privados deste registro.");
  for (const key of supplied) delete payload[key];
}

export async function mergeHrPrivate<T extends { id: string }>(
  client: SupabaseClient,
  resource: HrPrivateResource,
  rows: T[],
): Promise<
  Array<T & Record<string, unknown> & { can_view_private: boolean; can_update_private: boolean }>
> {
  const privateRows = await readHrPrivate(
    client,
    resource,
    rows.map((r) => r.id),
  );
  const empty: Record<string, unknown> =
    resource === "allocations_financial"
      ? { billable_rate: null, cost_rate: null }
      : resource === "one_on_ones_private"
        ? { private_notes: null }
        : {
            cost_hour: null,
            monthly_cost: null,
            personal_doc: {},
            bank: null,
            bank_agency: null,
            bank_account: null,
            pix_key: null,
            address: null,
          };
  return rows.map((r) => ({
    ...r,
    ...empty,
    ...(privateRows.get(r.id)?.fields ?? {}),
    can_view_private: privateRows.get(r.id)?.can_view === true,
    can_update_private: privateRows.get(r.id)?.can_update === true,
  }));
}
