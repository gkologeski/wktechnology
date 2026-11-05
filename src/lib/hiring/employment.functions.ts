import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission, getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import type { HiringModelContext, HiringEmploymentContext } from "./employment.types";
const id = z.string().uuid();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
export const loadHiringModels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "system.hiring_access.view.workspace",
    );
    return workRpc<HiringModelContext>(context.supabase, "hiring_model_context", { w });
  });
export const saveHiringModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: id.nullable(),
      revision: z.number().int().min(0),
      roleId: id.nullable(),
      name: z.string().trim().min(3).max(160),
      keys: z.array(z.string()).max(300),
      allocationOnly: z.boolean(),
      active: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "system.hiring_access.manage.workspace",
    );
    return workRpc<string>(context.supabase, "hiring_model_save", {
      w,
      p_id: data.id,
      p_revision: data.revision,
      p_role: data.roleId,
      p_name: data.name,
      p_keys: data.keys,
      p_allocation: data.allocationOnly,
      p_active: data.active,
    });
  });
export const loadEmploymentContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      personId: id.nullable().optional(),
      candidateId: id.nullable().optional(),
      search: z.string().max(100).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techpeople.employment.view.workspace",
    );
    return workRpc<HiringEmploymentContext>(context.supabase, "hiring_employment_context", {
      w,
      p_person: data.personId ?? null,
      p_candidate: data.candidateId ?? null,
      p_search: data.search ?? "",
    });
  });
export const admitEmployment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      applicationId: id,
      personId: id.nullable(),
      modelId: id,
      entityId: id,
      startsAt: date,
      endsAt: date,
      hireDate: date.optional(),
      reason: z.string().max(2000),
      employment: z.enum(["pj", "clt", "contractor", "intern", "other"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techpeople.employment.manage.workspace",
    );
    return workRpc<string>(context.supabase, "hiring_employment_admit", {
      w,
      p_application: data.applicationId,
      p_person: data.personId,
      p_model: data.modelId,
      p_entity: data.entityId,
      p_start: data.startsAt,
      p_end: data.endsAt,
      p_reason: data.reason,
      p_employment: data.employment,
      p_hire_date: data.hireDate ?? null,
    });
  });
export const linkEmploymentContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ engagementId: id, contractId: id.nullable() }))
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techpeople.employment.manage.workspace",
    );
    return workRpc<string>(context.supabase, "hiring_employment_contract", {
      w,
      p_engagement: data.engagementId,
      p_contract: data.contractId,
    });
  });
export const allocateEmployment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      engagementId: id,
      projectId: id,
      startsAt: date,
      endsAt: date,
      percent: z.number().positive().max(100),
      reason: z.string().max(2000),
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techpeople.employment.manage.workspace",
    );
    return workRpc<string>(context.supabase, "hiring_allocate", {
      w,
      p_engagement: data.engagementId,
      p_project: data.projectId,
      p_start: data.startsAt,
      p_end: data.endsAt,
      p_pct: data.percent,
      p_reason: data.reason,
    });
  });
export const endEmployment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ engagementId: id, reason: z.string().trim().min(10).max(2000) }))
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techpeople.employment.manage.workspace",
    );
    await workRpc(context.supabase, "hiring_employment_end", {
      w,
      p_engagement: data.engagementId,
      p_reason: data.reason,
    });
  });
export const prepareEmploymentInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ engagementId: id }))
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techpeople.employment.manage.workspace",
    );
    return workRpc<string>(context.supabase, "hiring_employment_invite", {
      w,
      p_engagement: data.engagementId,
    });
  });
// Capability: signed-in recipient + opaque expiring invite. No ordinary module key is required before joining.
export const acceptEmploymentInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }))
  .handler(async ({ context, data }) =>
    workRpc<string>(context.supabase, "hiring_accept_invite", { p_token: data.token }),
  );
export const loadDemandAccessRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ jobId: id }))
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techhire.hiring_demands.view.workspace",
    );
    return workRpc<{
      role_id: string | null;
      revision: number;
      roles: { id: string; name: string }[];
    }>(context.supabase, "hiring_job_role_context", { w, p_job: data.jobId });
  });
export const saveDemandAccessRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ jobId: id, revision: z.number().int().positive(), roleId: id }))
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techhire.hiring_demands.update.workspace",
    );
    await workRpc(context.supabase, "hiring_job_role_set", {
      w,
      p_job: data.jobId,
      p_revision: data.revision,
      p_role: data.roleId,
    });
  });
export const changeEmploymentModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      engagementId: id,
      revision: z.number().int().positive(),
      modelId: id,
      reason: z.string().trim().min(10).max(2000),
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techpeople.employment.manage.workspace",
    );
    await workRpc(context.supabase, "hiring_employment_model_change", {
      w,
      p_engagement: data.engagementId,
      p_revision: data.revision,
      p_model: data.modelId,
      p_reason: data.reason,
    });
  });
