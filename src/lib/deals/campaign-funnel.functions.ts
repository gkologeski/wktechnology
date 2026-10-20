// RPC do painel de campanhas. Arquivo fino: valida e delega ao servidor.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { loadCampaignFunnel } from "./campaign-funnel.server";
import type { CampaignFunnelData } from "./campaign-funnel.types";

const Input = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  assignee: z.union([z.enum(["__all__", "__me__", "__none__"]), z.string().uuid()]).default("__all__"),
});

export const getCampaignFunnel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }): Promise<CampaignFunnelData> => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const ownerId =
      data.assignee === "__me__" ? context.userId : data.assignee.startsWith("__") ? null : data.assignee;
    return loadCampaignFunnel(context.supabase, workspaceId, { from: data.from, to: data.to, ownerId });
  });
