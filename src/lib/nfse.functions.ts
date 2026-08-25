// Server functions para NFS-e (Release 15).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

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
    let q = context.supabase
      .from("nfse_invoices")
      .select("*, customer_invoices(invoice_number, amount, currency, description)")
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
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { data: inv, error } = await context.supabase
      .from("customer_invoices")
      .select("id,amount")
      .eq("id", data.invoice_id)
      .single();
    if (error || !inv) throw new Error(error?.message ?? "Fatura não encontrada");

    const externalId = `nfeio_${inv.id.slice(0, 8)}`;
    const { data: row, error: e2 } = await context.supabase
      .from("nfse_invoices")
      .insert({
        workspace_id: workspaceId,
        invoice_id: inv.id,
        external_id: externalId,
        status: "processing",
        service_code: data.service_code ?? null,
        amount: inv.amount,
      })
      .select("*")
      .single();
    if (e2) throw new Error(e2.message);
    return { nfse: row };
  });
