import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SALES_TABLE_RESOURCES, type SalesTable } from "./sales-resources";
export type SalesCapability = {
  id: string;
  can_view: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_assign: boolean;
  can_approve: boolean;
  can_export: boolean;
  can_manage: boolean;
  can_share: boolean;
  can_send: boolean;
};
export const getSalesCapabilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        table: z.string().refine((t): t is SalesTable => Object.hasOwn(SALES_TABLE_RESOURCES, t)),
        ids: z.array(z.string().uuid()).max(500),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { workRpc } = await import("./work-core.server");
    const rows = await workRpc<Omit<SalesCapability, "can_share" | "can_send">[]>(
      context.supabase,
      "sales_capabilities",
      {
        t: data.table,
        ids: data.ids,
      },
    );
    const extra = await workRpc<Pick<SalesCapability, "id" | "can_share" | "can_send">[]>(
      context.supabase,
      "sales_special_capabilities",
      { t: data.table, ids: data.ids },
    );
    const byId = new Map(extra.map((x) => [x.id, x]));
    return rows.map((row) => ({
      ...row,
      can_share: byId.get(row.id)?.can_share ?? false,
      can_send: byId.get(row.id)?.can_send ?? false,
    }));
  });
