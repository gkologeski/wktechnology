import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { financeRpc } from "./finance-records.server";
import { authorizeFinanceBusiness } from "./finance-business.server";
export type BusinessCapability = {
  id: string;
  can_update: boolean;
  can_delete: boolean;
  can_settle: boolean;
  can_issue: boolean;
  can_cancel: boolean;
};
export const getFinanceBusinessCapabilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        resource: z.enum([
          "invoices",
          "categories",
          "bank_accounts",
          "legal_entities",
          "legal_entity_groups",
          "dunning",
          "charging_templates",
        ]),
        ids: z.array(z.string().uuid()).max(500),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) =>
    financeRpc<BusinessCapability[]>(context.supabase, "finance_business_capabilities", {
      _resource: data.resource,
      _ids: data.ids,
    }),
  );
export const authorizeFinanceBusinessExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ resource: z.enum(["reports", "invoices", "nfse", "bank_accounts"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await authorizeFinanceBusiness(context.supabase, data.resource, "export");
    return { ok: true };
  });
