import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { financeRpc } from "@/lib/access-control/finance-records.server";
type Entity = {
  id: string;
  code: string | null;
  name: string;
  active: boolean;
  is_default: boolean;
};
type Group = {
  id: string;
  code: string | null;
  name: string;
  active: boolean;
  is_system: boolean;
  member_ids: string[];
};
type Category = {
  id: string;
  name: string;
  kind: string;
  parent_id: string | null;
  legal_entity_id: string | null;
};
type Bank = {
  id: string;
  name: string;
  currency: string;
  active: boolean;
  legal_entity_id: string | null;
};
export const listEntityReferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    financeRpc<Entity[]>(context.supabase, "finance_reference_list", {
      _resource: "legal_entities",
    }),
  );
export const listGroupReferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    financeRpc<Group[]>(context.supabase, "finance_reference_list", {
      _resource: "legal_entity_groups",
    }),
  );
export const listCategoryReferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => i)
  .handler(async ({ context }) =>
    financeRpc<Category[]>(context.supabase, "finance_reference_list", { _resource: "categories" }),
  );
export const listBankReferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => i)
  .handler(async ({ context }) =>
    financeRpc<Bank[]>(context.supabase, "finance_reference_list", { _resource: "bank_accounts" }),
  );
