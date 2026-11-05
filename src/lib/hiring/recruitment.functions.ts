import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission, getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import type { RecruitmentContext } from "./signature.types";
const job = z.object({ jobId: z.string().uuid() });
export const getRecruitmentAuthorization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(job)
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      ws,
      "techhire.hiring_demands.view.workspace",
    );
    return workRpc<RecruitmentContext>(context.supabase, "hiring_recruitment_check", {
      p_ws: ws,
      p_job: data.jobId,
    });
  });
export const linkRecruitmentContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    job.extend({ revision: z.number().int().positive(), contractId: z.string().uuid() }),
  )
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      ws,
      "techhire.hiring_demands.update.workspace",
    );
    await workRpc(context.supabase, "hiring_job_contract_link", {
      p_ws: ws,
      p_job: data.jobId,
      p_revision: data.revision,
      p_contract: data.contractId,
    });
  });
