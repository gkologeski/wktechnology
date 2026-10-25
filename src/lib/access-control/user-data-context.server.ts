import { createServerOnlyFn } from "@tanstack/react-start";
import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SHARED_FIELD_COLUMNS } from "./shared-field-catalog";

// A verified request may not regain unmasked business data by importing the
// service client later. Cron/public-capability/actor-bound SQL ports retain their
// separate explicit proofs, outside this authenticated request context.
let userData: AsyncLocalStorage<SupabaseClient> | undefined;
const getUserData = createServerOnlyFn(
  () => (userData ??= new AsyncLocalStorage<SupabaseClient>()),
);
export function withUserDataClient<T>(client: SupabaseClient, run: () => T): T {
  return getUserData().run(client, run);
}
export function protectAdminBusinessData<T extends SupabaseClient>(client: T): T {
  return new Proxy(client, {
    get(target, key) {
      if (key === "from")
        return (table: string) => {
          const actor = getUserData().getStore();
          return actor && Object.hasOwn(SHARED_FIELD_COLUMNS, table)
            ? actor.from(table)
            : target.from(table);
        };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as T;
}
