import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const HR_RECORD_RESOURCES = [
  "people",
  "candidates",
  "onboarding_plans",
  "onboarding_tasks",
  "onboarding_templates",
] as const;
export type HrRecordResource = (typeof HR_RECORD_RESOURCES)[number];
export type HrCapability = {
  id: string;
  can_view: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_create_child: boolean;
  can_edit_settings: boolean;
};
export const hrCapabilityRequest = z.object({
  resource: z.enum(HR_RECORD_RESOURCES),
  ids: z.array(z.string().uuid()).max(200),
});

// Authenticated metadata only. Identity, selected workspace, scope and deny are
// resolved by the same database predicates that protect the underlying rows.
export const getHrCapabilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => hrCapabilityRequest.parse(input))
  .handler(async ({ data, context }): Promise<HrCapability[]> => {
    const rpc = context.supabase.rpc as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: HrCapability[] | null; error: { message: string } | null }>;
    const result = await rpc.call(context.supabase, "hr_record_capabilities", {
      _resource: data.resource,
      _ids: data.ids,
    });
    if (result.error) throw new Error("Não foi possível verificar as ações permitidas.");
    return result.data ?? [];
  });
