/**
 * Tables whose primary key has no `id` column. When a caller omits `.select()`
 * on an `update`/`delete`, the checked writer must still project a real column
 * so PostgreSQL does not fail with `column <table>.id does not exist`.
 */
const RETURNING_COLUMN_BY_TABLE: Record<string, string> = {
  chat_conversation_members: "conversation_id",
  deal_contacts: "deal_id",
  ml_scoring_models: "owner_id",
  project_delivery_template_services: "workspace_id",
  project_time_favorites: "project_id",
  proposal_template_services: "template_id",
  sdr_material_offers: "material_id",
  sdr_workspace_settings: "workspace_id",
  segment_members: "segment_id",
  user_group_members: "group_id",
  voice_agent_settings: "workspace_id",
  workspace_branding: "owner_id",
  workspace_members: "user_id",
};

export function returningColumnForTable(table: string): string {
  return RETURNING_COLUMN_BY_TABLE[table] ?? "id";
}

/** Association controls must never report success for a write rejected by RLS. */
export function checkedMutationClient<T extends object>(
  client: T,
  options?: { server?: boolean },
): T {
  return new Proxy(client, {
    get(target, key, receiver) {
      if (key !== "from") return Reflect.get(target, key, receiver);
      return (...args: unknown[]) => {
        const from = Reflect.get(target, "from") as (...args: unknown[]) => object;
        const table = typeof args[0] === "string" ? args[0] : "";
        const returningColumn = returningColumnForTable(table);
        let writing = false,
          selected = false,
          singleId = false;
        const wrap = (query: object): object =>
          new Proxy(query, {
            get(q, method) {
              if (method === "then")
                return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
                  const effective =
                    writing && !selected
                      ? (Reflect.get(q, "select") as (s: string) => object).call(q, returningColumn)
                      : q;
                  return Promise.resolve(effective)
                    .then((value: unknown) => {
                      const result = value as { data: unknown; error: unknown };
                      if (options?.server && result.error)
                        throw Object.assign(
                          new Error((result.error as { message: string }).message),
                          result.error,
                        );
                      if (
                        writing &&
                        (!options?.server || singleId) &&
                        !result.error &&
                        (result.data == null || (Array.isArray(result.data) && !result.data.length))
                      ) {
                        const denied = {
                          ...result,
                          error: {
                            code: "42501",
                            message:
                              "Registro indisponível ou sem permissão para alterar esta associação.",
                            details: "",
                            hint: "",
                          },
                        };
                        if (options?.server)
                          throw Object.assign(new Error(denied.error.message), denied.error);
                        return denied;
                      }
                      return result;
                    })
                    .then(resolve, reject);
                };
              const original = Reflect.get(q, method);
              if (typeof original !== "function") return original;
              return (...values: unknown[]) => {
                if (method === "update" || method === "delete") writing = true;
                if (method === "select") selected = true;
                if (method === "eq" && values[0] === "id" && values[1] != null) singleId = true;
                return wrap(original.apply(q, values));
              };
            },
          });
        return wrap(from.apply(target, args));
      };
    },
  });
}
