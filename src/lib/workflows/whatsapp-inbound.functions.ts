import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireWorkspaceContext } from "@/lib/access-control/active-workspace.middleware";
import { loadWorkflowWhatsAppSources } from "./whatsapp-inbound.server";

export const listWorkflowWhatsAppSources = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) =>
    z
      .object({})
      .strict()
      .parse(input ?? {}),
  )
  .handler(({ context }) =>
    loadWorkflowWhatsAppSources(context.supabase, context.activeWorkspaceId),
  );
