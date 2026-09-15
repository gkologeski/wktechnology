// Server functions dos padrões de contrato do workspace e do pré-preenchimento
// a partir do negócio.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";
import { CONTRACT_KINDS } from "./contract-kinds";

export const getContractDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { loadContractDefaults } = await import("./contract-defaults.server");
    return loadContractDefaults(supabase, workspaceId);
  });

export const saveContractDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        scope: z.enum(["general", ...CONTRACT_KINDS] as [string, ...string[]]),
        defaults: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techcontracts.contracts.update.workspace",
    ]);
    const { sanitizeDefaults } = await import("./contract-defaults-shared");
    const clean = sanitizeDefaults(data.defaults);
    const documentKind = data.scope === "general" ? null : data.scope;

    // Padrão geral fica com `document_kind` nulo; por tipo, com o tipo.
    const base = supabase.from("contract_defaults").select("id").eq("workspace_id", workspaceId);
    const existing =
      documentKind === null
        ? await base.is("document_kind", null)
        : await base.eq("document_kind", documentKind);
    if (existing.error) throw new Error(existing.error.message);

    const rowId = (existing.data as { id: string }[] | null)?.[0]?.id ?? null;

    if (rowId) {
      const { error } = await supabase
        .from("contract_defaults")
        .update({ defaults: clean as never, updated_at: new Date().toISOString() })
        .eq("id", rowId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("contract_defaults").insert({
        workspace_id: workspaceId,
        owner_id: userId,
        document_kind: documentKind,
        defaults: clean as never,
      } as never);
      if (error) throw new Error(error.message);
    }
    return { ok: true, defaults: clean };
  });

/** Dados do negócio para pré-preencher o formulário de contrato. */
export const getDealContractPrefill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ dealId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { loadDealForContract, contractFieldsFromDeal } =
      await import("./contract-create.server");
    const { loadContractDefaults } = await import("./contract-defaults.server");
    const { deal, items } = await loadDealForContract(supabase, data.dealId);
    if (deal.workspace_id && deal.workspace_id !== workspaceId) {
      throw new Error("Negócio não encontrado");
    }
    return {
      deal: { id: deal.id, name: deal.name },
      fields: contractFieldsFromDeal(deal, items),
      lineItems: items,
      defaults: await loadContractDefaults(supabase, workspaceId),
    };
  });
