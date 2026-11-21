import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireWorkspaceContext } from "@/lib/access-control/active-workspace.middleware";
import { assertHrRecordAccess } from "@/lib/access-control/hr-records.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";
import { assertNotificationWorkspace } from "@/lib/notification-center";

const targetInput = z
  .object({
    workspaceId: z.string().uuid(),
    parentId: z.string().uuid(),
    id: z.string().uuid(),
  })
  .strict();

/** Focused reads only: the caller must still read both the actual parent and child. */
export const getNotificationApplicationTarget = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) => targetInput.parse(input))
  .handler(async ({ data, context }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    await assertHrRecordAccess(context.supabase, "jobs", "view", data.parentId);
    await assertHrRecordAccess(context.supabase, "applications", "view", data.id);
    const { data: row, error } = await context.supabase
      .from("ats_applications")
      .select("id, job_id, candidate_id, stage_value, status, applied_at")
      .eq("workspace_id", context.activeWorkspaceId)
      .eq("job_id", data.parentId)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const getNotificationInterviewTarget = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) => targetInput.parse(input))
  .handler(async ({ data, context }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    await assertHrRecordAccess(context.supabase, "jobs", "view", data.parentId);
    await assertAnyPermission(context.supabase, context.userId, context.activeWorkspaceId, [
      "techhire.interviews.view.workspace",
    ]);
    await assertHrRecordAccess(context.supabase, "interviews", "view", data.id);
    const { data: row, error } = await context.supabase
      .from("ats_interviews")
      .select("id, job_id, application_id, candidate_id, kind, status, scheduled_at, duration_min")
      .eq("workspace_id", context.activeWorkspaceId)
      .eq("job_id", data.parentId)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const getNotificationDocumentTarget = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) => targetInput.parse(input))
  .handler(async ({ data, context }) => {
    assertNotificationWorkspace(context, data.workspaceId);
    await assertHrRecordAccess(context.supabase, "people", "view", data.parentId);
    await assertHrRecordAccess(context.supabase, "documents", "view", data.id);
    const { data: row, error } = await context.supabase
      .from("people_documents")
      .select("id, person_id, doc_type, expires_at, status")
      .eq("workspace_id", context.activeWorkspaceId)
      .eq("person_id", data.parentId)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });
