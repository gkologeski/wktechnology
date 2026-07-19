// Server functions for Legal Entities (multi-CNPJ per workspace).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().max(24).nullable().optional(),
  name: z.string().trim().min(1).max(200),
  trade_name: z.string().trim().max(200).nullable().optional(),
  cnpj: z.string().trim().max(20).nullable().optional(),
  ie: z.string().trim().max(30).nullable().optional(),
  im: z.string().trim().max(30).nullable().optional(),
  is_default: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const listLegalEntities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data, error } = await supabase
      .from("legal_entities")
      .select("id, code, name, trade_name, cnpj, ie, im, is_default, active, created_at")
      .eq("workspace_id", workspaceId)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const upsertLegalEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    if (data.id) {
      const { error } = await supabase
        .from("legal_entities")
        .update({
          code: data.code ?? null,
          name: data.name,
          trade_name: data.trade_name ?? null,
          cnpj: data.cnpj ?? null,
          ie: data.ie ?? null,
          im: data.im ?? null,
          active: data.active ?? true,
        })
        .eq("id", data.id)
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("legal_entities")
      .insert({
        workspace_id: workspaceId,
        code: data.code ?? null,
        name: data.name,
        trade_name: data.trade_name ?? null,
        cnpj: data.cnpj ?? null,
        ie: data.ie ?? null,
        im: data.im ?? null,
        is_default: data.is_default ?? false,
        active: data.active ?? true,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    return row;
  });

export const setDefaultLegalEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    // Unset any current default first (partial unique index enforces uniqueness).
    await supabase
      .from("legal_entities")
      .update({ is_default: false })
      .eq("workspace_id", workspaceId)
      .eq("is_default", true);
    const { error } = await supabase
      .from("legal_entities")
      .update({ is_default: true })
      .eq("id", data.id)
      .eq("workspace_id", workspaceId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteLegalEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    // Refuse if there are financial entries referencing it.
    const { count } = await supabase
      .from("financial_entries")
      .select("id", { count: "exact", head: true })
      .eq("legal_entity_id", data.id);
    if ((count ?? 0) > 0) {
      throw new Error(
        `Não é possível excluir: existem ${count} lançamentos vinculados. Desative a empresa em vez de excluir.`,
      );
    }
    const { error } = await supabase
      .from("legal_entities")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", workspaceId);
    if (error) throw error;
    return { ok: true };
  });

// Aggregated summary per legal entity (for dashboard cards on the settings page).
export const listLegalEntitiesSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: entities, error } = await supabase
      .from("legal_entities")
      .select("id, name, code, cnpj, is_default, active")
      .eq("workspace_id", workspaceId)
      .order("name");
    if (error) throw error;
    if (!entities || entities.length === 0) return [];

    const ids = entities.map((e) => e.id);
    const { data: agg } = await supabase
      .from("financial_entries")
      .select("legal_entity_id, direction, amount")
      .eq("workspace_id", workspaceId)
      .in("legal_entity_id", ids);

    const bucket = new Map<string, { receivable: number; payable: number; count: number }>();
    (agg ?? []).forEach((r) => {
      const k = (r as { legal_entity_id: string }).legal_entity_id;
      const b = bucket.get(k) ?? { receivable: 0, payable: 0, count: 0 };
      b.count += 1;
      if ((r as { direction: string }).direction === "receivable") {
        b.receivable += Number((r as { amount: number }).amount) || 0;
      } else {
        b.payable += Number((r as { amount: number }).amount) || 0;
      }
      bucket.set(k, b);
    });
    return entities.map((e) => ({
      ...e,
      totals: bucket.get(e.id) ?? { receivable: 0, payable: 0, count: 0 },
    }));
  });
