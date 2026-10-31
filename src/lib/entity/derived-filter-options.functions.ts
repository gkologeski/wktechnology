import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";

const Input = z.object({ column: z.string().max(60) });

export const listContactDerivedOptions = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.contacts", "view")])
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    const { loadDerivedFilterOptions } = await import("./derived-filter-options.server");
    const ws = await resolveActiveWorkspace(context.userId);
    return loadDerivedFilterOptions(context.supabase, ws, "contacts", data.column);
  });

export const listLeadDerivedOptions = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.leads", "view")])
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    const { loadDerivedFilterOptions } = await import("./derived-filter-options.server");
    const ws = await resolveActiveWorkspace(context.userId);
    return loadDerivedFilterOptions(context.supabase, ws, "leads", data.column);
  });

export const listCompanyDerivedOptions = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.companies", "view")])
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    const { loadDerivedFilterOptions } = await import("./derived-filter-options.server");
    const ws = await resolveActiveWorkspace(context.userId);
    return loadDerivedFilterOptions(context.supabase, ws, "companies", data.column);
  });
