// Auditoria da importação ContaAzul / lançamentos financeiros.
// Retorna contagens de lançamentos com dados faltantes (categoria, centro
// de custo, empresa) agrupados por CNPJ, e possíveis duplicidades.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const financeAuditReport = createServerFn({ method: "POST" })
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
    const { supabase } = context;

    const scopeIds =
      data.legalEntityIds && data.legalEntityIds.length
        ? data.legalEntityIds
        : data.legalEntityId
          ? [data.legalEntityId]
          : null;

    let base = supabase
      .from("financial_entries")
      .select(
        "id, amount, direction, description, due_date, category_id, legal_entity_id, financial_entry_allocations(id)",
      )
      .limit(50000);
    if (scopeIds) base = base.in("legal_entity_id", scopeIds);

    const { data: rows, error } = await base;
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as Array<{
      id: string;
      amount: number | string;
      direction: string;
      description: string | null;
      due_date: string | null;
      category_id: string | null;
      legal_entity_id: string | null;
      financial_entry_allocations: Array<{ id: string }> | null;
    }>;
    const byEntity = new Map<
      string,
      { total: number; no_category: number; no_cost_center: number; no_legal_entity: number }
    >();
    let noLegalEntity = 0;
    let noCategory = 0;
    let noCostCenter = 0;

    // Chave para detectar duplicidade provável.
    const dupMap = new Map<string, number>();

    for (const r of list) {
      const key = r.legal_entity_id ?? "__none";
      const b = byEntity.get(key) ?? {
        total: 0,
        no_category: 0,
        no_cost_center: 0,
        no_legal_entity: 0,
      };
      b.total++;
      if (!r.category_id) {
        b.no_category++;
        noCategory++;
      }
      if (!r.financial_entry_allocations || r.financial_entry_allocations.length === 0) {
        b.no_cost_center++;
        noCostCenter++;
      }
      if (!r.legal_entity_id) {
        b.no_legal_entity++;
        noLegalEntity++;
      }
      byEntity.set(key, b);

      const dk = [
        r.legal_entity_id ?? "-",
        r.due_date ?? "-",
        r.direction,
        Number(r.amount).toFixed(2),
        (r.description ?? "").trim().toLowerCase().slice(0, 60),
      ].join("|");
      dupMap.set(dk, (dupMap.get(dk) ?? 0) + 1);
    }

    const duplicates = Array.from(dupMap.entries())
      .filter(([, count]) => count > 1)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 100);

    // Nomes das empresas para exibição.
    const ids = Array.from(byEntity.keys()).filter((k) => k !== "__none");
    let entities: Array<{ id: string; name: string; code: string | null }> = [];
    if (ids.length) {
      const { data: ents } = await supabase
        .from("legal_entities")
        .select("id, name, code")
        .in("id", ids);
      entities = ents ?? [];
    }
    const nameById = new Map(entities.map((e) => [e.id, e]));

    const byEntityRows = Array.from(byEntity.entries()).map(([id, v]) => ({
      legal_entity_id: id === "__none" ? null : id,
      name:
        id === "__none" ? "Sem empresa vinculada" : (nameById.get(id)?.name ?? "(desconhecida)"),
      code: id === "__none" ? null : (nameById.get(id)?.code ?? null),
      ...v,
    }));

    byEntityRows.sort((a, b) => b.total - a.total);

    return {
      totals: {
        entries: list.length,
        no_category: noCategory,
        no_cost_center: noCostCenter,
        no_legal_entity: noLegalEntity,
        duplicate_groups: duplicates.length,
      },
      by_entity: byEntityRows,
      duplicates,
    };
  });
