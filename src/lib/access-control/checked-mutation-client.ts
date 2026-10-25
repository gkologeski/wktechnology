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
                      ? (Reflect.get(q, "select") as (s: string) => object).call(q, "id")
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
