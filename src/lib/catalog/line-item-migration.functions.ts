// Migração assistida de itens de linha legados de Negócios: itens criados como
// texto livre (herança do HubSpot / catálogo de produtos extinto) passam a
// apontar para a linha de serviço do catálogo, o cargo e a senioridade.
// Só classifica — nunca altera quantidade, preço, desconto ou imposto.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";

const DEALS_VIEW = [
  "techsales.deals.view.workspace",
  "techsales.deals.view.team",
  "techsales.deals.view.own",
];
const DEALS_UPDATE = [
  "techsales.deals.update.workspace",
  "techsales.deals.update.team",
  "techsales.deals.update.own",
];
const CATALOG_UPDATE = [
  "techsales.catalog.services.update.workspace",
  "techsales.catalog.services.update.team",
  "techsales.catalog.services.update.own",
];

const sel = (s: string): string => s;

type RawLineItem = {
  id: string;
  deal_id: string | null;
  name: string | null;
  quantity: number | null;
  unit_price: number | null;
};

export type UnmappedGroup = {
  name: string;
  /** Variantes cruas do nome no banco (com espaços/caixa originais). */
  rawNames: string[];
  itemCount: number;
  dealCount: number;
  totalValue: number;
};

/**
 * Agrupa por nome os itens de linha ainda sem serviço do catálogo, com
 * contagem de itens, de negócios e valor bruto envolvido.
 */
export const listUnmappedLineItemNames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, DEALS_VIEW);

    const { data, error } = await supabase
      .from("deal_line_items")
      .select(sel("id, deal_id, name, quantity, unit_price"))
      .is("service_catalog_id", null)
      .limit(5000)
      .returns<RawLineItem[]>();
    if (error) throw error;

    const map = new Map<
      string,
      { itemCount: number; deals: Set<string>; totalValue: number; rawNames: Set<string> }
    >();
    for (const row of data ?? []) {
      const raw = row.name ?? "";
      const name = raw.trim();
      if (!name) continue;
      const entry = map.get(name) ?? {
        itemCount: 0,
        deals: new Set<string>(),
        totalValue: 0,
        rawNames: new Set<string>(),
      };
      entry.itemCount += 1;
      entry.rawNames.add(raw);
      if (row.deal_id) entry.deals.add(row.deal_id);
      entry.totalValue += Number(row.quantity ?? 0) * Number(row.unit_price ?? 0);
      map.set(name, entry);
    }

    const groups: UnmappedGroup[] = [...map.entries()]
      .map(([name, v]) => ({
        name,
        rawNames: [...v.rawNames],
        itemCount: v.itemCount,
        dealCount: v.deals.size,
        totalValue: v.totalValue,
      }))
      .sort((a, b) => b.itemCount - a.itemCount || a.name.localeCompare(b.name));

    return { groups, totalItems: (data ?? []).length };
  });

const mappingEntry = z.object({
  name: z.string().min(1),
  // Nomes exatamente como estão no banco; quando ausente, cai no nome aparado.
  rawNames: z.array(z.string().min(1)).min(1).max(50).optional(),
  serviceCatalogId: z.string().uuid(),
  jobProfileId: z.string().uuid().nullable().optional(),
  seniority: z.string().min(1).nullable().optional(),
  unit: z.string().min(1).nullable().optional(),
});

/**
 * Aplica o mapeamento aprovado. Idempotente: só toca itens cujo
 * `service_catalog_id` ainda é nulo, e só grava colunas de classificação.
 */
export const applyLineItemMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ entries: z.array(mappingEntry).min(1).max(300) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, DEALS_UPDATE);

    let updated = 0;
    const failures: Array<{ name: string; message: string }> = [];
    const results: Array<{ name: string; updated: number }> = [];

    for (const entry of data.entries) {
      const patch: {
        service_catalog_id: string;
        job_profile_id?: string | null;
        seniority?: string | null;
        unit?: string;
      } = { service_catalog_id: entry.serviceCatalogId };
      if (entry.jobProfileId !== undefined) patch.job_profile_id = entry.jobProfileId ?? null;
      if (entry.seniority !== undefined) patch.seniority = entry.seniority ?? null;
      if (entry.unit) patch.unit = entry.unit;

      const names = entry.rawNames && entry.rawNames.length > 0 ? entry.rawNames : [entry.name];
      const { data: rows, error } = await supabase
        .from("deal_line_items")
        .update(patch)
        .in("name", names)
        .is("service_catalog_id", null)
        .select("id");
      if (error) {
        failures.push({ name: entry.name, message: error.message });
        continue;
      }
      const count = rows?.length ?? 0;
      updated += count;
      results.push({ name: entry.name, updated: count });
    }

    return { updated, failures, results };
  });

const jobProfileEntry = z.object({
  id: z.string().uuid(),
  serviceCatalogId: z.string().uuid().nullable().optional(),
  seniority: z.string().min(1).nullable().optional(),
});

/**
 * Enriquece o cadastro de cargos com a linha de serviço (e senioridade quando o
 * nome do cargo já a contém), para novos negócios já sugerirem o serviço.
 */
export const applyJobProfileMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ entries: z.array(jobProfileEntry).min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, CATALOG_UPDATE);

    let updated = 0;
    const failures: Array<{ id: string; message: string }> = [];

    for (const entry of data.entries) {
      const patch: { service_catalog_id?: string | null; seniority?: string | null } = {};
      if (entry.serviceCatalogId !== undefined) {
        patch.service_catalog_id = entry.serviceCatalogId ?? null;
      }
      if (entry.seniority !== undefined) patch.seniority = entry.seniority ?? null;
      if (Object.keys(patch).length === 0) continue;

      const { data: rows, error } = await supabase
        .from("job_profiles")
        .update(patch)
        .eq("id", entry.id)
        .select("id");
      if (error) {
        failures.push({ id: entry.id, message: error.message });
        continue;
      }
      updated += rows?.length ?? 0;
    }

    return { updated, failures };
  });
