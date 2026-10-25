import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
const resource = z.enum(["techcontracts.contracts", "techprojects.projects", "techprojects.tasks"]);
export type WorkResource = z.infer<typeof resource>;
export type WorkCapability = {
  id: string;
  can_view: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_assign: boolean;
};
export const getWorkCapabilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ resource, ids: z.array(z.string().uuid()).max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    const { workRpc } = await import("./work-core.server");
    return workRpc<WorkCapability[]>(context.supabase, "work_core_capabilities", {
      r: data.resource,
      ids: data.ids,
    });
  });
