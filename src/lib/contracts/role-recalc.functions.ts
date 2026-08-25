// Diagnóstico e reprocessamento em lote do papel (Prestação/Compra) dos contratos.
// O papel é derivado das empresas do workspace (CNPJ, com fallback por nome),
// e não do campo `role` gravado pela IA na importação.
// A regra fica em role-recalc.server.ts para ser reutilizada por outras server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";

export type {
  ContractRoleConflict,
  ContractRolesDiagnosis,
  RecalcContractRolesResult,
} from "@/lib/contracts/role-recalc.server";

export const diagnoseContractRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { diagnoseRoles, CONTRACT_UPDATE_PERMISSIONS } =
      await import("@/lib/contracts/role-recalc.server");
    await assertAnyPermission(supabase, userId, workspaceId, CONTRACT_UPDATE_PERMISSIONS);
    return diagnoseRoles(supabase, workspaceId);
  });

export const recalcContractRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(500),
        retitle: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { recalcRoles } = await import("@/lib/contracts/role-recalc.server");
    return recalcRoles(supabase, workspaceId, userId, {
      ids: data.ids,
      retitle: data.retitle ?? false,
    });
  });
