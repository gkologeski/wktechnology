import { z } from "zod";

// Recipient selection is intent, never proof of access. The SQL dispatcher resolves current data.
const automatic = z
  .object({
    kind: z.enum([
      "workflow_owner",
      "source_responsible",
      "source_creator",
      "area_manager",
      "pending_approvers",
      "project_members",
      "followers",
    ]),
  })
  .strict();
const named = z
  .object({ kind: z.enum(["user", "team", "job_role"]), id: z.string().uuid() })
  .strict();
export const notificationRecipientRuleSchema = z.union([automatic, named]);
export const notificationRecipientRulesSchema = z
  .array(notificationRecipientRuleSchema)
  .min(1)
  .max(10);
export type NotificationRecipientRule = z.infer<typeof notificationRecipientRuleSchema>;

export function effectiveNotificationRecipients(action: {
  user_id?: string;
  recipients?: NotificationRecipientRule[];
}): NotificationRecipientRule[] {
  if (action.recipients !== undefined)
    return notificationRecipientRulesSchema.parse(action.recipients);
  // Empty legacy selection meant the executor, not the source record owner or a manager.
  const legacy = action.user_id?.trim();
  return legacy
    ? [{ kind: "user", id: z.string().uuid().parse(legacy) }]
    : [{ kind: "workflow_owner" }];
}
