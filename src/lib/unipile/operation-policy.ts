import { z } from "zod";
/** Internal conservative ceilings, not official LinkedIn entitlements. */
function createLinkedinPolicySchema() {
  return z
    .object({
      paused: z.boolean(),
      daily_messages: z.number().int().min(0).max(50),
      weekly_messages: z.number().int().min(0).max(250),
      daily_invites: z.number().int().min(0).max(15),
      weekly_invites: z.number().int().min(0).max(100),
      min_interval_seconds: z.number().int().min(60).max(3600),
    })
    .strict();
}
export const linkedinPolicySchema = createLinkedinPolicySchema();
