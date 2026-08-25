// Server functions for Legal Entities (multi-CNPJ per workspace).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { isValidCnpj, onlyDigits } from "@/lib/cnpj";
import { normalizeEntityName } from "@/lib/contracts/link-suggest";

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

/** Empresa completa do workspace (para o formulário de edição não perder campos). */
export const getLegalEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: row, error } = await supabase
      .from("legal_entities")
      .select("id, code, name, trade_name, cnpj, ie, im, is_default, active")
      .eq("id", data.id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Empresa não encontrada");
    return row;
  });

export type LegalEntityCnpjSuggestion = {
  id: string;
  name: string;
  code: string | null;
  cnpj: string | null;
  suggested_cnpj: string | null;
  suggested_from_name: string | null;
  occurrences: number;
};

/**
 * Sugere o CNPJ de cada empresa do workspace a partir das partes extraídas dos
 * contratos importados (`*_name_extracted` / `*_cnpj_extracted`), casando o nome
 * normalizado. Não altera nada — apenas propõe.
 */
export const suggestLegalEntityCnpjs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LegalEntityCnpjSuggestion[]> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);

    const { data: entities, error } = await supabase
      .from("legal_entities")
      .select("id, code, name, trade_name, cnpj, is_default")
      .eq("workspace_id", workspaceId)
      .order("name");
    if (error) throw error;

    const { data: contracts } = await supabase
      .from("contracts")
      .select("metadata")
      .eq("workspace_id", workspaceId)
      .limit(3000);

    // Agrupa pares nome normalizado → CNPJ, contando ocorrências.
    const parties = new Map<string, Map<string, { count: number; rawName: string }>>();
    for (const row of (contracts ?? []) as Array<{ metadata: Record<string, unknown> | null }>) {
      const meta = row.metadata ?? {};
      const pairs: Array<[unknown, unknown]> = [
        [meta["contracting_name_extracted"], meta["contracting_cnpj_extracted"]],
        [meta["counterparty_name_extracted"], meta["counterparty_cnpj_extracted"]],
      ];
      for (const [rawName, rawCnpj] of pairs) {
        const name = typeof rawName === "string" ? rawName : "";
        const cnpj = onlyDigits(typeof rawCnpj === "string" ? rawCnpj : "");
        const key = normalizeEntityName(name);
        if (key.length < 4 || cnpj.length !== 14) continue;
        const bucket = parties.get(key) ?? new Map();
        const current = bucket.get(cnpj) ?? { count: 0, rawName: name };
        bucket.set(cnpj, { count: current.count + 1, rawName: current.rawName || name });
        parties.set(key, bucket);
      }
    }

    return (
      (entities ?? []) as Array<{
        id: string;
        code: string | null;
        name: string;
        trade_name: string | null;
        cnpj: string | null;
      }>
    ).map((e) => {
      const candidates = new Map<string, { count: number; rawName: string }>();
      const keys = [normalizeEntityName(e.name), normalizeEntityName(e.trade_name)].filter(
        (k) => k.length >= 4,
      );
      for (const [partyKey, byCnpj] of parties) {
        const matches = keys.some(
          (k) => partyKey === k || partyKey.includes(k) || k.includes(partyKey),
        );
        if (!matches) continue;
        for (const [cnpj, info] of byCnpj) {
          const current = candidates.get(cnpj) ?? { count: 0, rawName: info.rawName };
          candidates.set(cnpj, { count: current.count + info.count, rawName: current.rawName });
        }
      }
      const best = Array.from(candidates.entries()).sort((a, b) => b[1].count - a[1].count)[0];
      return {
        id: e.id,
        name: e.name,
        code: e.code,
        cnpj: e.cnpj,
        suggested_cnpj: best ? best[0] : null,
        suggested_from_name: best ? best[1].rawName : null,
        occurrences: best ? best[1].count : 0,
      };
    });
  });

export type FillCnpjsResult = {
  entities_updated: number;
  contracts_updated: number;
  contracts_retitled: number;
};

/**
 * Grava os CNPJs informados nas empresas do workspace e, em seguida, reprocessa
 * automaticamente os contratos cujo papel gravado divergir do papel inferido.
 */
export const fillLegalEntityCnpjsAndRecalc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        entities: z
          .array(
            z.object({
              id: z.string().uuid(),
              cnpj: z
                .string()
                .trim()
                .max(20)
                .transform((v) => onlyDigits(v))
                .refine((v) => v.length === 0 || isValidCnpj(v), "CNPJ inválido"),
            }),
          )
          .min(1)
          .max(100),
        retitle: z.boolean().optional(),
        recalc: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<FillCnpjsResult> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);

    // Recusa o mesmo CNPJ em duas empresas do mesmo workspace.
    const filled = data.entities.filter((e) => e.cnpj.length === 14);
    const unique = new Set(filled.map((e) => e.cnpj));
    if (unique.size !== filled.length) {
      throw new Error("O mesmo CNPJ foi informado para mais de uma empresa.");
    }

    let entitiesUpdated = 0;
    for (const entity of data.entities) {
      const { error } = await supabase
        .from("legal_entities")
        .update({ cnpj: entity.cnpj.length === 14 ? entity.cnpj : null })
        .eq("id", entity.id)
        .eq("workspace_id", workspaceId);
      if (error) throw new Error(error.message);
      entitiesUpdated += 1;
    }

    if (data.recalc === false) {
      return { entities_updated: entitiesUpdated, contracts_updated: 0, contracts_retitled: 0 };
    }

    const { recalcRoles } = await import("@/lib/contracts/role-recalc.server");
    const result = await recalcRoles(supabase, workspaceId, userId, {
      ids: null,
      retitle: data.retitle ?? true,
    });
    return {
      entities_updated: entitiesUpdated,
      contracts_updated: result.updated,
      contracts_retitled: result.retitled,
    };
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
    // CNPJ é gravado sempre em dígitos e validado quando informado.
    const cnpjDigits = onlyDigits(data.cnpj);
    if (cnpjDigits.length > 0 && !isValidCnpj(cnpjDigits)) {
      throw new Error("CNPJ inválido");
    }
    const cnpj = cnpjDigits.length === 14 ? cnpjDigits : null;
    if (data.id) {
      const { error } = await supabase
        .from("legal_entities")
        .update({
          code: data.code ?? null,
          name: data.name,
          trade_name: data.trade_name ?? null,
          cnpj,
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
        cnpj,
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
