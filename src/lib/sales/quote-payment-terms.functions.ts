import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import type { Json } from "@/integrations/supabase/types";
import { paymentTermsSchema } from "@/lib/sales/payment-terms";
import {
  saveQuotePaymentTermsCore,
  type QuotePaymentStore,
} from "@/lib/sales/quote-payment-terms.write";

export const saveQuotePaymentTerms = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.quotes", "update")])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), terms: paymentTermsSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSalesRecord(context.supabase, "quotes", data.id, "update");
    const store: QuotePaymentStore = {
      readTotal: async (id) => {
        const { data: row, error } = await context.supabase
          .from("quotes")
          .select("total")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return row ? Number(row.total) : null;
      },
      writeTerms: async (id, terms) => {
        const { error } = await context.supabase
          .from("quotes")
          .update({ payment_terms: terms as unknown as Json })
          .eq("id", id);
        if (error) throw error;
      },
    };
    return saveQuotePaymentTermsCore(store, data.id, data.terms);
  });
