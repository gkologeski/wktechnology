import type { SupabaseClient } from "@supabase/supabase-js";
/** Minimal pipeline lookup; configuration writes still use the table's own permission. */
export function salesPipelineReferences(client: SupabaseClient) {
  return (client.rpc as unknown as (name: string) => ReturnType<typeof client.from>)(
    "sales_pipeline_references",
  );
}
