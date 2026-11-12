// EMPRESA-PROPOSTA: criar proposta em branco com a empresa emissora e trocar a
// empresa de uma proposta. Cliente do usuário (RLS); o gatilho do banco recusa
// empresa inativa ou de outro workspace.
import { assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const createProposalWithEntity = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposals", "create")])
  .inputValidator((d) =>
    z
      .object({
        title: z.string().min(1).max(255),
        body: z.string().max(500_000).default(""),
        dealId: z.string().uuid().nullable().optional(),
        contactId: z.string().uuid().nullable().optional(),
        companyId: z.string().uuid().nullable().optional(),
        totalAmount: z.number().nullable().optional(),
        currency: z.string().min(3).max(3).default("BRL"),
        expiresAt: z.string().nullable().optional(),
        legalEntityId: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { data: row, error } = await context.supabase
      .from("proposals")
      .insert({
        owner_id: context.userId,
        workspace_id: workspaceId,
        title: data.title,
        body: data.body,
        deal_id: data.dealId ?? null,
        contact_id: data.contactId ?? null,
        company_id: data.companyId ?? null,
        total_amount: data.totalAmount ?? null,
        currency: data.currency,
        expires_at: data.expiresAt ?? null,
        variables: {},
        legal_entity_id: data.legalEntityId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const setProposalLegalEntity = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposals", "update")])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), legalEntityId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSalesRecord(context.supabase, "proposals", data.id, "update");
    const { data: cur, error: e0 } = await context.supabase
      .from("proposals")
      .select("locked")
      .eq("id", data.id)
      .single();
    if (e0) throw new Error(e0.message);
    if (cur.locked) throw new Error("Proposta bloqueada para edição (já enviada).");
    const { error } = await context.supabase
      .from("proposals")
      .update({ legal_entity_id: data.legalEntityId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
