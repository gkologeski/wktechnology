import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { workRpc } from "@/lib/access-control/work-core.server";
const Source = z.object({ channel: z.enum(["email", "chat"]), source_id: z.string().uuid() });
const sourceTable = (channel: "email" | "chat") =>
  channel === "email" ? "email_threads" : "live_chat_sessions";
export type ServiceInboxState = {
  active: boolean;
  agent_name?: string;
  owner?: "ai" | "human" | "paused";
  can_control?: boolean;
  can_verify?: boolean;
  identity_verified?: boolean;
  context_approved?: boolean;
  status?: string;
  draft?: string | null;
  delivery_uncertain?: boolean;
};
export const getServiceInboxState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Source.parse(i))
  .handler(async ({ data, context }) => {
    await assertSalesRecord(context.supabase, sourceTable(data.channel), data.source_id, "view");
    return workRpc<ServiceInboxState>(context.supabase, "service_agent_inbox_state", {
      p_channel: data.channel,
      p_source: data.source_id,
    });
  });
export const setServiceInboxOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Source.extend({ owner: z.enum(["ai", "human", "paused"]) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSalesRecord(context.supabase, sourceTable(data.channel), data.source_id, "update");
    await workRpc(context.supabase, "service_agent_set_owner", {
      p_channel: data.channel,
      p_source: data.source_id,
      p_owner: data.owner,
    });
  });
export const verifyServiceInboxIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Source.parse(i))
  .handler(async ({ data, context }) => {
    await assertSalesRecord(context.supabase, sourceTable(data.channel), data.source_id, "update");
    await workRpc(context.supabase, "service_agent_verify_identity", {
      p_channel: data.channel,
      p_source: data.source_id,
    });
  });
