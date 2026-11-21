import { createServerFn } from "@tanstack/react-start";
import { requireWorkspaceContext } from "@/lib/access-control/active-workspace.middleware";
import { assertNotificationWorkspace } from "@/lib/notification-center";
import {
  notificationReadinessInputSchema,
  notificationReadinessWorkflowsInputSchema,
} from "./readiness-types";
import { loadNotificationReadiness, loadNotificationReadinessWorkflows } from "./readiness.server";

export const listNotificationReadinessWorkflows = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) => notificationReadinessWorkflowsInputSchema.parse(input))
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    return loadNotificationReadinessWorkflows(context.supabase, data.workspaceId);
  });

export const getNotificationReadiness = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) => notificationReadinessInputSchema.parse(input))
  .handler(async ({ context, data }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    return loadNotificationReadiness(context.supabase, data.workspaceId, data.workflowId);
  });
