import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkResource } from "./work-core.functions";
export async function workRpc<T>(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await (
    client.rpc as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: T; error: { message: string } | null }>
  ).call(client, name, args);
  if (error) throw new Error(error.message);
  return data;
}
export async function assertWorkRecord(
  client: SupabaseClient,
  resource: WorkResource,
  id: string,
  action: "view" | "update" | "delete",
) {
  if ((await workRpc(client, "work_record_access", { r: resource, i: id, a: action })) !== true)
    throw new Error("Registro indisponível ou sem permissão para esta ação.");
}
