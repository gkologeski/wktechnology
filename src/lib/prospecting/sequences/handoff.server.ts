import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";
import type { SequencePorts } from "./worker.server";
/** Permission, selected binding, lease and source linkage are revalidated inside SQL. */
export function sequenceHandoff(admin: SupabaseClient): SequencePorts["handoff"] {
  return async (context, decision) => {
    const state = await workRpc<"human" | "agent">(admin, "prospecting_sequence_handoff", {
      p_run: context.run.id,
      p_lease: context.run.lease_token,
      p_mode: decision.state,
      p_agent: decision.agentId || null,
    });
    if (state !== "human" && state !== "agent") throw new Error("handoff_not_confirmed");
    return { state };
  };
}
