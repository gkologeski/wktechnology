import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireWorkspaceContext } from "@/lib/access-control/active-workspace.middleware";
import { INBOX_CHANNELS } from "./inbox-channel-events";
import { loadWorkflowInboxSources } from "./inbox-channels.server";

export const listWorkflowInboxSources = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) =>
    z
      .object({ channel: z.enum(INBOX_CHANNELS) })
      .strict()
      .parse(input),
  )
  .handler(({ data, context }) =>
    loadWorkflowInboxSources(context.supabase, context.activeWorkspaceId, data.channel),
  );
