import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { z } from "zod";
import { requestKind } from "./types";
import type { ExecutionContext } from "./execution-panel";
export const getExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ kind: requestKind, id: z.string().uuid(), revision: z.number().int().positive() }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<ExecutionContext>(context.supabase, "hiring_execution_context", {
      w,
      i: data.id,
    });
  });
export const startExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: requestKind,
      id: z.string().uuid(),
      revision: z.number().int().positive(),
      startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endsAt: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
      reason: z.string().trim().min(10).max(2000),
      operation: z.string().uuid(),
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    return {
      id: await workRpc<string>(context.supabase, "hiring_execution_start", {
        w,
        i: data.id,
        rev: data.revision,
        p_start: data.startsAt,
        p_end: data.endsAt,
        p_reason: data.reason,
        p_operation: data.operation,
      }),
    };
  });
