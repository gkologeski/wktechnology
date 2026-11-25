import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  runEnrichCompaniesByCNPJ,
  runEnrichCompanyByCNPJ,
} from "@/lib/integrations/brasilapi-cnpj.server";

// Enrich a single company by its CNPJ via BrasilAPI/ReceitaWS (normalizes 13-digit leading-zero CNPJs,
// classifies lookup failures, fills legal_name/trade_name separately, and never overwrites name).
export const enrichCompanyByCNPJ = createServerFn({ method: "POST" })
  .middleware([
    requireSalesPermission(
      ["techsales.prospecting_enrichment", "techsales.companies"],
      ["manage", "update"],
    ),
  ])
  .inputValidator((i: unknown) =>
    z
      .object({
        company_id: z.string().uuid(),
        overwrite: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    return runEnrichCompanyByCNPJ(context.supabase, context.userId, data);
  });

// Bulk enrichment. Enriches by explicit IDs or all companies with CNPJ and no enrichment yet.
export const enrichCompaniesByCNPJ = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.prospecting_enrichment", "manage")])
  .inputValidator((i: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).max(1000).optional(),
        all_missing: z.boolean().optional(),
        overwrite: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    return runEnrichCompaniesByCNPJ(context.supabase, context.userId, data);
  });
