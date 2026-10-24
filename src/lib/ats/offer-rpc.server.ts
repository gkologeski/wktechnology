import type { SupabaseClient } from "@supabase/supabase-js";

/** Always uses the caller's client; PostgreSQL owns scope, transitions and locks. */
export async function offerRpc<T>(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const rpc = client.rpc as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: T; error: { message: string } | null }>;
  const result = await rpc.call(client, name, args);
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
