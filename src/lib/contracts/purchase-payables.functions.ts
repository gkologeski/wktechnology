import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireWorkPermission } from "@/lib/access-control/work-permission.middleware";
import { assertWorkRecord, workRpc } from "@/lib/access-control/work-core.server";

// Contas a pagar de um contrato de compra assinado: proposta + títulos já gerados (RLS do usuário).
export const getPurchasePayables = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.contracts", "view")])
  .inputValidator((d) => z.object({ contractId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertWorkRecord(context.supabase, "techcontracts.contracts", data.contractId, "view");
    const { proposePurchasePayables } = await import("./purchase-payables");
    const { data: c, error } = await context.supabase
      .from("contracts")
      .select("id,role,status,total_value,currency,payment_terms,signed_at,starts_at")
      .eq("id", data.contractId)
      .maybeSingle();
    if (error || !c) throw new Error("Contrato indisponível.");
    const signed =
      !!c.signed_at || ["active", "renewing", "ended"].includes(String(c.status ?? ""));
    const entries = await context.supabase
      .from("financial_entries")
      .select("id,description,amount,currency,due_date,status,installment_number")
      .eq("contract_id", data.contractId)
      .eq("direction", "payable")
      .or(
        `external_ref.like.purchase-payables:${data.contractId}:%,external_ref.like.payment-terms:${data.contractId}:%`,
      )
      .order("installment_number", { ascending: true });
    const today = new Date().toISOString().slice(0, 10);
    return {
      isPurchase: c.role === "client",
      signed,
      total: c.total_value === null ? null : Number(c.total_value),
      currency: c.currency ?? "BRL",
      financeVisible: !entries.error,
      entries: (entries.data ?? []).map((e) => ({ ...e, amount: Number(e.amount) })),
      proposal: proposePurchasePayables(
        {
          total_value: c.total_value === null ? null : Number(c.total_value),
          payment_terms: c.payment_terms,
          signed_at: c.signed_at,
          starts_at: c.starts_at,
        },
        today,
      ),
    };
  });

// Financeiro confirma: o banco revalida permissão, assinatura, soma e duplicidade.
export const generatePurchasePayables = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.contracts", "view")])
  .inputValidator((d) =>
    z
      .object({
        contractId: z.string().uuid(),
        installments: z
          .array(
            z.object({
              label: z.string().trim().max(120),
              amount: z.number().positive().multipleOf(0.01),
              due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            }),
          )
          .min(1)
          .max(60),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    return workRpc<{ generated: number; duplicate: boolean }>(
      context.supabase,
      "contract_purchase_payables_generate",
      { p_contract: data.contractId, p_installments: data.installments },
    );
  });
