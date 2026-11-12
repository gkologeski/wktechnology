import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";

// Cancelamento interno: mantém a proposta e o histórico, apenas encerra a
// negociação. Aceitas e já encerradas não podem ser canceladas.
export const cancelProposal = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposals", "update")])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSalesRecord(context.supabase, "proposals", data.id, "update");
    const { data: cur, error: e0 } = await context.supabase
      .from("proposals")
      .select("status")
      .eq("id", data.id)
      .single();
    if (e0) throw new Error(e0.message);
    if (["accepted", "rejected", "expired", "canceled"].includes(cur.status))
      throw new Error("Esta proposta já está encerrada e não pode ser cancelada.");
    const { data: upd, error } = await context.supabase
      .from("proposals")
      .update({ status: "canceled" })
      .eq("id", data.id)
      .eq("status", cur.status)
      .select("id");
    if (error) throw new Error(error.message);
    if (!upd?.length) throw new Error("Não foi possível cancelar: a proposta mudou ou você não tem acesso.");
    return { ok: true };
  });
