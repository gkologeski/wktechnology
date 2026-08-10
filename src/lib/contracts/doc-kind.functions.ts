// Server functions do diagnóstico/correção do tipo de documento (Principal x Aditivo).
// A regra fica em doc-kind.server.ts; aqui só validação de entrada e workspace.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";

export type {
  DocKindDiagnosis,
  DocKindSuspect,
  DocKindCandidateParent,
  ApplyDocKindResult,
} from "@/lib/contracts/doc-kind.server";

export const diagnoseContractDocKinds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { diagnoseDocKinds, CONTRACT_UPDATE_PERMISSIONS } =
      await import("@/lib/contracts/doc-kind.server");
    await assertAnyPermission(supabase, userId, workspaceId, CONTRACT_UPDATE_PERMISSIONS);
    return diagnoseDocKinds(supabase, workspaceId);
  });

export const applyContractDocKinds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        items: z
          .array(
            z.object({
              id: z.string().uuid(),
              mainContractId: z.string().uuid(),
              amendmentNumber: z.string().max(40).nullable().optional(),
            }),
          )
          .min(1)
          .max(300),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { applyDocKindCorrections } = await import("@/lib/contracts/doc-kind.server");
    return applyDocKindCorrections(supabase, workspaceId, userId, data.items);
  });
