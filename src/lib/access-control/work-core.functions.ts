import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
const resource = z.enum([
  "techcontracts.contracts",
  "techprojects.projects",
  "techprojects.tasks",
  "techcontracts.esign",
  "techservice.services",
  "techcontracts.contract_templates",
  "techprojects.spaces",
  "techprojects.folders",
  "techprojects.lists",
  "techprojects.milestones",
  "techprojects.members",
  "techprojects.project_updates",
  "techprojects.list_templates",
  "techprojects.custom_fields",
  "techprojects.statuses",
]);
export type WorkResource = z.infer<typeof resource>;
export type WorkCapability = {
  id: string;
  can_view: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_assign: boolean;
  can_send: boolean;
  can_cancel: boolean;
  can_share: boolean;
  can_manage: boolean;
};
export const getWorkCapabilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ resource, ids: z.array(z.string().uuid()).max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    const { workRpc } = await import("./work-core.server");
    return workRpc<WorkCapability[]>(context.supabase, "work_area_capabilities", {
      r: data.resource,
      ids: data.ids,
    });
  });
