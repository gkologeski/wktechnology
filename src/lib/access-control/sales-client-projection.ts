import {
  SHARED_FIELD_COLUMNS,
  SHARED_FIELD_RESOURCES,
  SHARED_FIELD_DEPENDENCIES,
} from "./shared-field-catalog";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SALES_PRIVATE_COLUMNS, SALES_PUBLIC_COLUMNS } from "./sales-private-columns";
type Table = keyof typeof SALES_PUBLIC_COLUMNS;
function splitSelection(selection: string): string[] {
  const fields: string[] = [];
  let depth = 0,
    start = 0;
  for (let i = 0; i < selection.length; i++) {
    if (selection[i] === "(") depth++;
    if (selection[i] === ")") depth--;
    if (selection[i] === "," && depth === 0) {
      fields.push(selection.slice(start, i).trim());
      start = i + 1;
    }
  }
  fields.push(selection.slice(start).trim());
  return fields;
}
/** Safe projection convenience only. Database column ACLs remain authoritative. */
export function salesPublicSelection(table: string, selection: string): string {
  if (!selection.trim()) return selection;
  const known = Object.hasOwn(SALES_PUBLIC_COLUMNS, table);
  const projected = splitSelection(selection).flatMap((field) => {
    const open = field.indexOf("(");
    if (open >= 0 && field.endsWith(")")) {
      const head = field.slice(0, open);
      const related = head.replace(/^[^:]+:(?!:)/, "").split("!")[0];
      return [`${head}(${salesPublicSelection(related, field.slice(open + 1, -1))})`];
    }
    if (!known) return [field];
    if (field === "*") return SALES_PUBLIC_COLUMNS[table as Table].split(",");
    const column = field.replace(/^[^:]+:(?!:)/, "").split(/::|->/)[0];
    return (SALES_PRIVATE_COLUMNS[table as Table] as readonly string[]).includes(column)
      ? []
      : [field];
  });
  return projected.join(",") || "id";
}
type FieldTable = keyof typeof SHARED_FIELD_COLUMNS;
const isFieldTable = (table: string): table is FieldTable =>
  Object.hasOwn(SHARED_FIELD_COLUMNS, table);
/** Keep response relation aliases stable while using caller-RLS field views. */
export function sharedFieldSelection(selection: string): string {
  return splitSelection(selection)
    .map((field) => {
      const open = field.indexOf("(");
      if (open < 0 || !field.endsWith(")")) return field;
      const head = field.slice(0, open),
        raw = head.replace(/^[^:]+:(?!:)/, ""),
        table = raw.split("!")[0];
      const related = isFieldTable(table)
        ? `${head.includes(":") ? head.slice(0, head.indexOf(":")) : table}:shared_fields_${table}${raw.slice(table.length)}`
        : head;
      return `${related}(${sharedFieldSelection(field.slice(open + 1, -1))})`;
    })
    .join(",");
}
function writeProjection(table: FieldTable, selection: string): string {
  const columns = SHARED_FIELD_COLUMNS[table] as readonly string[];
  return [
    ...new Set([
      "id",
      ...splitSelection(salesPublicSelection(table, selection)).filter(
        (field) =>
          field !== "*" && !columns.includes(field.replace(/^[^:]+:(?!:)/, "").split(/::|->/)[0]),
      ),
    ]),
  ].join(",");
}
/** User clients only. Read views own no bypass role; raw column ACLs and triggers
 * protect direct REST too. Privileged server clients remain explicitly separate. */
export function protectSalesClient<T extends SupabaseClient>(client: T): T {
  const from = (table: string) => {
    type Op = { method: PropertyKey; args: unknown[] };
    const wrap = (ops: Op[]): object =>
      new Proxy(
        {},
        {
          get(_target, key) {
            if (key === "then")
              return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
                const execute = async () => {
                  const mutation = ops.find((o) =>
                    ["insert", "upsert", "update", "delete"].includes(String(o.method)),
                  );
                  const field = isFieldTable(table),
                    effective = ops.map((o) => ({ ...o, args: [...o.args] }));
                  if (field && mutation && mutation.method !== "delete") {
                    const result = await client.rpc("shared_field_context" as never, {} as never);
                    if (result.error)
                      throw new Error("Não foi possível verificar as regras dos campos.");
                    const modes =
                      (result.data as { rules?: Record<string, Record<string, string>> })?.rules?.[
                        SHARED_FIELD_RESOURCES[table]
                      ] ?? {};
                    const patch = (value: unknown): unknown =>
                      Array.isArray(value)
                        ? value.map(patch)
                        : value && typeof value === "object"
                          ? Object.fromEntries(
                              Object.entries(value).filter(([column]) => {
                                const deps = (
                                  SHARED_FIELD_DEPENDENCIES[table] as Record<
                                    string,
                                    readonly string[] | null
                                  >
                                )[column];
                                return (
                                  !modes[column] &&
                                  (deps === undefined ||
                                    (deps === null
                                      ? !Object.keys(modes).length
                                      : !deps.some((d) => !!modes[d])))
                                );
                              }),
                            )
                          : value;
                    const at = effective.find((o) => o.method === mutation.method)!;
                    at.args[0] = patch(at.args[0]);
                  }
                  const source = field && !mutation ? `shared_fields_${table}` : table;
                  let query: object = client.from(source);
                  for (const op of effective) {
                    if (op.method === "select") {
                      const requested = String(op.args[0] ?? "*");
                      const projected =
                        field && mutation
                          ? writeProjection(table, requested)
                          : salesPublicSelection(table, requested);
                      op.args[0] = sharedFieldSelection(projected);
                    }
                    query = Reflect.apply(Reflect.get(query, op.method), query, op.args);
                  }
                  const result = (await query) as { data: unknown; error: unknown };
                  // Returning values on a write never bypasses masking. Re-read through the
                  // same RLS view; deletes return only non-sensitive requested columns.
                  if (
                    field &&
                    mutation &&
                    mutation.method !== "delete" &&
                    !result.error &&
                    result.data &&
                    ops.some((o) => o.method === "select")
                  ) {
                    const original = Array.isArray(result.data) ? result.data : [result.data];
                    const ids = original
                      .map((r) => (r as { id?: string }).id)
                      .filter((id): id is string => !!id);
                    if (ids.length) {
                      const projection = String(
                        ops.find((o) => o.method === "select")?.args[0] ?? "*",
                      );
                      const rows = await client
                        .from(`shared_fields_${table}`)
                        .select(
                          "id," + sharedFieldSelection(salesPublicSelection(table, projection)),
                        )
                        .in("id", ids);
                      if (rows.error)
                        throw new Error(
                          "Alteração salva; não foi possível recarregar os campos autorizados.",
                        );
                      const includeId = splitSelection(projection).some(
                        (f) => f === "*" || f === "id",
                      );
                      const publicRows = (rows.data as unknown as Array<{ id: string }>).map(
                        (row) => ({
                          id: row.id,
                          row: includeId
                            ? row
                            : Object.fromEntries(
                                Object.entries(row).filter(([key]) => key !== "id"),
                              ),
                        }),
                      );
                      const byId = new Map(publicRows.map((r) => [r.id, r.row]));
                      result.data = Array.isArray(result.data)
                        ? ids.map((id) => byId.get(id)).filter(Boolean)
                        : (byId.get(ids[0]) ?? null);
                    }
                  }
                  return result;
                };
                return execute().then(resolve, reject);
              };
            return (...args: unknown[]) => {
              ops.push({ method: key, args });
              return wrap(ops);
            };
          },
        },
      );
    return wrap([]);
  };
  return new Proxy(client, {
    get(target, key) {
      if (key === "from") return from;
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as T;
}
