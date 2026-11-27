import { requireWorkPermission } from "@/lib/access-control/work-permission.middleware";
// Server functions do acompanhamento macro de entrega.
// Vendedor acessa o projeto pela ponte: deals -> contracts.deal_id -> projects.contract_id.
// A visibilidade dos registros é garantida por RLS em public.project_updates.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseCheckpointInput, parseCheckpointPatchInput } from "./delivery-progress";
import {
  runCreateProjectUpdate,
  runDeleteProjectUpdate,
  runGetDealDelivery,
  runGetProjectDelivery,
  runUpdateProjectUpdate,
  type DeliveryProject,
  type ProjectUpdateRow,
} from "./delivery.server";

export type { DeliveryProject, ProjectUpdateRow };

/** Projetos + timeline macro de um negócio (via contrato). */
export const getDealDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ dealId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => runGetDealDelivery(context.supabase, data.dealId));

/** Timeline macro de um projeto específico (visão somente leitura). */
export const getProjectDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => runGetProjectDelivery(context.supabase, data.projectId));

export const createProjectUpdate = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.project_updates", "create")])
  .inputValidator((input) => parseCheckpointInput(input))
  .handler(async ({ data, context }) =>
    runCreateProjectUpdate(context.supabase, context.userId, data),
  );

export const updateProjectUpdate = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.project_updates", "update")])
  .inputValidator((input) => parseCheckpointPatchInput(input))
  .handler(async ({ data, context }) =>
    runUpdateProjectUpdate(context.supabase, context.userId, data),
  );

export const deleteProjectUpdate = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.project_updates", "delete")])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) =>
    runDeleteProjectUpdate(context.supabase, context.userId, data.id),
  );
