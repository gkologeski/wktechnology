import { requireWorkPermission } from "@/lib/access-control/work-permission.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { requireReconAdmin } from "./reconciliation.server";
import { groupKey, note, origins, pageInput, pair, uuid } from "./deal-delivery.schemas";
import {
  createFromDeal,
  linkToDeal,
  loadCompanyProjects,
  loadContractProjects,
  loadDealOverview,
  loadProjectOrigin,
  resolveReview,
  retryDelivery,
  saveGroups,
  searchLinkableProjects,
  setOperationalOwner,
  unlinkFromDeal,
} from "./deal-delivery.server";
import {
  applyExactHistory,
  applyHistory,
  createMissingHistory,
  listHistory,
  loadPolicy,
  previewHistory,
  revertHistory,
  savePolicy,
} from "./deal-delivery-history.server";

export const getDealDeliveryOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ dealId: uuid }).parse(input))
  .handler(async ({ data, context }) => loadDealOverview(context.supabase, data.dealId));

export const createDeliveryProjectFromDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ dealId: uuid, ownerId: uuid.nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => createFromDeal(context.supabase, data));

export const linkDeliveryProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ dealId: uuid, projectId: uuid, group: groupKey, note: note.nullable() })
      .parse(input),
  )
  .handler(async ({ data, context }) => linkToDeal(context.supabase, data));

export const unlinkDeliveryProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ dealId: uuid, projectId: uuid, note: note.min(5, "Informe o motivo.") })
      .parse(input),
  )
  .handler(async ({ data, context }) => unlinkFromDeal(context.supabase, data));

export const saveDeliveryGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        dealId: uuid,
        items: z
          .array(
            z.object({
              lineItemId: uuid,
              groupKey: z.union([groupKey, z.null()]),
              groupLabel: z.string().trim().max(120).nullable(),
            }),
          )
          .max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => saveGroups(context.supabase, data));

export const retryDealDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ dealId: uuid }).parse(input))
  .handler(async ({ data, context }) => retryDelivery(context.supabase, data.dealId));

export const setProjectOperationalOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: uuid, userId: uuid.nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => setOperationalOwner(context.supabase, data));

export const resolveDeliveryReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ eventId: uuid, note: note.min(5, "Descreva a decisão.") }).parse(input),
  )
  .handler(async ({ data, context }) => resolveReview(context.supabase, data));

export const searchProjectsForDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ dealId: uuid, q: z.string().max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    return searchLinkableProjects(context.supabase, {
      workspaceId,
      dealId: data.dealId,
      q: data.q,
    });
  });

export const getProjectDeliveryOrigin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: uuid }).parse(input))
  .handler(async ({ data, context }) => loadProjectOrigin(context.supabase, data.projectId));

export const getCompanyDeliveryProjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ companyId: uuid, ...pageInput }).parse(input))
  .handler(async ({ data, context }) => loadCompanyProjects(context.supabase, data));

export const getContractDeliveryProjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ contractId: uuid, ...pageInput }).parse(input))
  .handler(async ({ data, context }) => loadContractProjects(context.supabase, data));

// ------------------------------------------------------------------ administrador do workspace
export const getDeliveryPolicy = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.delivery", "view")])
  .handler(async ({ context }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: false });
    return loadPolicy(context.supabase, ctx);
  });

export const saveDeliveryPolicy = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.delivery", "manage")])
  .inputValidator((input: unknown) =>
    z
      .object({
        enabled: z.boolean(),
        allowGroups: z.boolean(),
        origins,
        creatorId: uuid.nullable(),
        defaultOwnerId: uuid.nullable(),
        resetActivation: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: true });
    return savePolicy(context.supabase, ctx, data);
  });

export const getDeliveryHistory = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.delivery", "view")])
  .inputValidator((input: unknown) =>
    z
      .object({
        filter: z.enum(["missing", "linked", "all"]),
        q: z.string().trim().max(120).nullable(),
        from: z.string().date().nullable(),
        to: z.string().date().nullable(),
        ...pageInput,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: false });
    return listHistory(context.supabase, ctx, { ...data, q: data.q || null });
  });

export const previewDeliveryHistory = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.delivery", "manage")])
  .inputValidator((input: unknown) =>
    z.object({ pairs: z.array(pair).min(1).max(100) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: false });
    return previewHistory(context.supabase, ctx, data.pairs);
  });

export const applyDeliveryHistory = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.delivery", "manage")])
  .inputValidator((input: unknown) =>
    z
      .object({
        pairs: z
          .array(
            pair.extend({ snapshot: z.string().min(8).max(64), criterion: z.string().max(40) }),
          )
          .min(1)
          .max(100),
        note: note.min(5, "Informe a justificativa."),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: true });
    return applyHistory(context.supabase, ctx, data);
  });

export const applyExactDeliveryHistory = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.delivery", "manage")])
  .handler(async ({ context }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: true });
    return applyExactHistory(context.supabase, ctx);
  });

export const createMissingDeliveryProjects = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.delivery", "manage")])
  .inputValidator((input: unknown) =>
    z
      .object({
        dealIds: z.array(uuid).min(1).max(25),
        note: note.min(5, "Informe a justificativa."),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: true });
    return createMissingHistory(context.supabase, ctx, data);
  });

export const revertDeliveryHistory = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.delivery", "manage")])
  .inputValidator((input: unknown) =>
    z
      .object({ eventIds: z.array(uuid).min(1).max(100), note: note.min(5, "Informe o motivo.") })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await requireReconAdmin(context.supabase, context.userId, { write: true });
    return revertHistory(context.supabase, ctx, data);
  });
