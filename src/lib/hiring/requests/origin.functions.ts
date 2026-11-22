import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { workRpc } from "@/lib/access-control/work-core.server";
import { assertPreparation } from "./boundary.server";
import { requestKind } from "./types";
import type { PreparationOrigin } from "./origin-presentation";
export const getPreparationOrigins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: requestKind,
      projectId: z.string().uuid().nullable(),
      dealId: z.string().uuid().nullable(),
      additionalDealIds: z.array(z.string().uuid()).max(20).default([]),
      contractId: z.string().uuid().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await assertPreparation(context.supabase, context.userId, data.kind, "view");
    const refs: Array<[PreparationOrigin["source"], string | null]> = [
      ["project", data.projectId],
      ["deal", data.dealId],
      ...data.additionalDealIds.map((id): [PreparationOrigin["source"], string] => ["deal", id]),
      ["commercial_contract", data.contractId],
    ];
    return Promise.all(
      refs
        .filter((x): x is [PreparationOrigin["source"], string] => !!x[1])
        .map(([s, i]) =>
          workRpc<PreparationOrigin>(context.supabase, "hiring_preparation_origin_context", {
            w,
            k: data.kind,
            s,
            i,
          }),
        ),
    );
  });
