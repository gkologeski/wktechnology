import type { SupabaseClient } from "@supabase/supabase-js";

type Query = {
  operation: string;
  select: string;
  filters: Array<{ field: string; op: string; value: unknown }>;
  order: Array<{ column: string; ascending: boolean; nullsFirst?: boolean }>;
  payload?: unknown;
  limit: number;
  offset: number;
};
/** Background source supplies neither actor nor tenant: SQL derives both from the persisted job/integration and retains actual RLS. No raw administrative SDK methods escape this adapter. */
export function hubspotSourceClient<T extends SupabaseClient>(
  admin: T,
  source: {
    table:
      | "integrations"
      | "enrichment_jobs"
      | "sdr_enrollments"
      | "workflow_subscriptions"
      | "report_schedules";
    id: string;
  },
): T {
  const from = (table: string) => {
    const q: Query = {
      operation: "select",
      select: "*",
      filters: [],
      order: [],
      limit: 200,
      offset: 0,
    };
    let single: "one" | "maybe" | null = null;
    let head = false;
    const run = async () => {
      try {
        const { data, error } = await (
          admin.rpc as unknown as (
            name: string,
            args: Record<string, unknown>,
          ) => Promise<{
            data: { data: unknown[]; count: number } | null;
            error: { message: string; code?: string } | null;
          }>
        )("sales_source_query", {
          p_source: source.table,
          p_id: source.id,
          p_table: table,
          p_query: q,
        });
        if (error)
          return {
            data: null,
            error: {
              ...error,
              message:
                error.code === "42501"
                  ? "Sem permissão para este registro ou ação."
                  : error.message,
            },
            count: null,
          };
        const rows = data?.data ?? [];
        if (single && ((single === "one" && rows.length !== 1) || rows.length > 1))
          return {
            data: null,
            error: { code: "PGRST116", message: "Registro indisponível ou resultado ambíguo." },
            count: data?.count ?? 0,
          };
        return {
          data: head ? null : single ? (rows[0] ?? null) : rows,
          error: null,
          count: data?.count ?? 0,
        };
      } catch (e) {
        return {
          data: null,
          error: { message: e instanceof Error ? e.message : "Consulta indisponível." },
          count: null,
        };
      }
    };
    const chain = new Proxy(
      {},
      {
        get(_, name) {
          if (name === "then")
            return (resolve: unknown, reject: unknown) =>
              run().then(resolve as (v: unknown) => unknown, reject as (e: unknown) => unknown);
          return (...args: unknown[]) => {
            if (name === "select") {
              q.select = String(args[0] ?? "*");
              head = !!(args[1] as { head?: boolean } | undefined)?.head;
            } else if (name === "insert" || name === "update") {
              q.operation = String(name);
              q.payload = args[0];
            } else if (name === "delete") q.operation = "delete";
            else if (name === "limit") q.limit = Number(args[0]);
            else if (name === "range") {
              q.offset = Number(args[0]);
              q.limit = Number(args[1]) - q.offset + 1;
            } else if (name === "order") {
              const o = args[1] as { ascending?: boolean; nullsFirst?: boolean } | undefined;
              q.order.push({
                column: String(args[0]),
                ascending: o?.ascending !== false,
                nullsFirst: o?.nullsFirst,
              });
            } else if (name === "single" || name === "maybeSingle")
              single = name === "single" ? "one" : "maybe";
            else if (name === "not" && args[1] === "is" && args[2] === null)
              q.filters.push({ field: String(args[0]), op: "not_is", value: null });
            else if (
              [
                "eq",
                "neq",
                "gt",
                "gte",
                "lt",
                "lte",
                "like",
                "ilike",
                "is",
                "in",
                "contains",
              ].includes(String(name))
            )
              q.filters.push({ field: String(args[0]), op: String(name), value: args[1] });
            else throw new Error("Operação não suportada pela porta autenticada da API.");
            return chain;
          };
        },
      },
    );
    return chain;
  };
  return new Proxy(admin, {
    get(target, key) {
      if (key === "from") return from;
      if (key === "rpc")
        return async (name: string, args: Record<string, unknown>) => {
          if (name !== "sales_record_access" && name !== "sales_area_authorize")
            throw new Error("RPC não permitida no contexto de importação.");
          if (name === "sales_area_authorize" && args.r !== "system.hubspot_sync")
            throw new Error("Área não permitida nesta porta.");
          const { data, error } = await (
            admin.rpc as unknown as (
              name: string,
              args: Record<string, unknown>,
            ) => Promise<{ data: { data: Array<{ allowed: boolean }> } | null; error: unknown }>
          )("sales_source_query", {
            p_source: source.table,
            p_id: source.id,
            p_table: name === "sales_record_access" ? args.t : "hubspot_sync_state",
            p_query: {
              operation: "authorize",
              action: args.a,
              ...(name === "sales_record_access" ? { record_id: args.i } : {}),
            },
          });
          return { data: data?.data?.[0]?.allowed ?? false, error };
        };
      throw new Error("Esta porta aceita somente operações de dados verificadas.");
    },
  }) as T;
}
