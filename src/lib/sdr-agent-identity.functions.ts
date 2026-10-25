import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireSdr } from "@/lib/prospecting/sdr/access.server";

// Perfil da Lia: leitura para quem vê o agente; criar e transferir histórico
// exigem gestão do agente e papel admin/owner no workspace.

async function requireAdmin(supabase: unknown, userId: string) {
  const ws = await requireSdr(supabase as never, userId, "manage");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("workspace_members")
    .select("role, status")
    .eq("workspace_id", ws)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || data.status !== "active" || !["owner", "admin"].includes(data.role as string))
    throw new Error("Apenas administradores do workspace podem fazer isso.");
  return { ws, admin: supabaseAdmin };
}

export const getSdrAgentProfile = createServerFn({ method: "GET" })
  .middleware([requireSalesPermission("techsales.marketing.sdr_agent", "view")])
  .handler(async ({ context }) => {
    const ws = await requireSdr(context.supabase, context.userId, "view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getSdrAgentIdentity } = await import("@/lib/prospecting/sdr/agent-identity.server");
    return { identity: await getSdrAgentIdentity(supabaseAdmin, ws) };
  });

export const createSdrAgentProfile = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.sdr_agent", "create")])
  .handler(async ({ context }) => {
    const { ws, admin } = await requireAdmin(context.supabase, context.userId);
    const { provisionSdrAgentIdentity } =
      await import("@/lib/prospecting/sdr/agent-identity.server");
    return provisionSdrAgentIdentity(admin, { workspaceId: ws, sourceUserId: context.userId });
  });

export const sdrAgentHistory = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.sdr_agent", "manage")])
  .inputValidator((d: unknown) => z.object({ apply: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { ws, admin } = await requireAdmin(context.supabase, context.userId);
    const { reassignSdrHistory } = await import("@/lib/prospecting/sdr/agent-identity.server");
    return reassignSdrHistory(admin, ws, data.apply);
  });

export const undoSdrAgentHistory = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.marketing.sdr_agent", "manage")])
  .inputValidator((d: unknown) => z.object({ runId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { ws, admin } = await requireAdmin(context.supabase, context.userId);
    const { undoSdrHistory } = await import("@/lib/prospecting/sdr/agent-identity.server");
    return undoSdrHistory(admin, ws, data.runId);
  });
