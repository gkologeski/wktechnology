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
/** User clients only. Privileged server clients remain separate and explicitly guarded. */
export function protectSalesClient<T extends SupabaseClient>(client: T): T {
  const wrap = (target: object, table: string): object =>
    new Proxy(target, {
      get(obj, key) {
        const value = Reflect.get(obj, key);
        if (key === "select")
          return (selection = "*", ...options: unknown[]) =>
            wrap(
              Reflect.apply(value, obj, [salesPublicSelection(table, selection), ...options]),
              table,
            );
        if (typeof value !== "function") return value;
        if (key === "then") return value.bind(obj);
        return (...args: unknown[]) => {
          const next = Reflect.apply(value, obj, args);
          return next && typeof next === "object" ? wrap(next, table) : next;
        };
      },
    });
  return new Proxy(client, {
    get(target, key) {
      if (key === "from") return (table: string) => wrap(target.from(table), table);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as T;
}
