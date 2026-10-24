import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";
// Server functions para NFS-e (Release 15).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listNfse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        legalEntityId: z.string().uuid().optional(),
        legalEntityIds: z.array(z.string().uuid()).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await authorizeFinanceBusiness(context.supabase, "nfse", "view", undefined);
    let q = context.supabase
      .from("nfse_invoices")
      .select(
        "id,invoice_id,status,rps_number,nf_number,pdf_url,xml_url,service_code,amount,error_message,issued_at,created_at,legal_entity_id,customer_invoices(invoice_number, amount, currency, description)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.legalEntityId) q = q.eq("legal_entity_id", data.legalEntityId);
    if (data.legalEntityIds && data.legalEntityIds.length)
      q = q.in("legal_entity_id", data.legalEntityIds);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

/**
 * Issue a NFS-e for an invoice via NFE.io. Without real credentials this returns
 * a deterministic sandbox stub so the UI flow can be tested.
 */
export const issueNfse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        invoice_id: z.string().uuid(),
        service_code: z.string().max(50).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await authorizeFinanceBusiness(context.supabase, "invoices", "view", data.invoice_id);
    throw new Error(
      "Emissão fiscal indisponível: o adaptador NFS-e não está habilitado. Nenhuma nota foi emitida.",
    );
  });
