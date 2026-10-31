// Formato dos filtros do público enviado à função do banco `wa_campaign_audience_ids`.
import {
  CUSTOM_FIELD_PREFIX,
  filterColumnPath,
  filterTerms,
  type AudienceBase,
  type AudienceFilterOp,
  type AudienceGroup,
} from "./campaign-audience";

/** Remove curingas e separadores que mudariam o sentido do "contém". */
export const cleanFilterTerm = (v: string) => v.replace(/[%_,()*"\\]/g, " ").trim();

/** Filtro já normalizado para `wa_campaign_audience_ids` (banco monta a consulta). */
export type CompiledAudienceFilter = {
  entity: AudienceBase;
  column: string | null;
  custom_key: string | null;
  op: AudienceFilterOp;
  value: string;
  terms: string[];
};

/**
 * Converte grupos validados no formato da função do banco, com a mesma limpeza
 * de termos usada antes na consulta REST (contém/não contém/diferente de).
 */
export function compileAudienceGroups(
  base: AudienceBase,
  groups: AudienceGroup[],
): { logic: "and" | "or"; filters: CompiledAudienceFilter[] }[] {
  return groups.map((g) => ({
    logic: g.logic === "or" ? "or" : "and",
    filters: g.filters.map((f) => {
      const path = filterColumnPath(f.column); // valida chave personalizada
      const isCustom = f.column.startsWith(CUSTOM_FIELD_PREFIX);
      const v = f.value.trim();
      const terms = filterTerms(f);
      const compiledTerms =
        f.op === "ilike"
          ? terms.length <= 1
            ? [cleanFilterTerm(terms[0] ?? v)]
            : terms.map(cleanFilterTerm)
          : f.op === "not_ilike"
            ? (terms.length ? terms : [v]).map(cleanFilterTerm)
            : [];
      return {
        entity: f.entity ?? base,
        column: isCustom ? null : path,
        custom_key: isCustom ? f.column.slice(CUSTOM_FIELD_PREFIX.length) : null,
        op: f.op,
        value: f.op === "neq" ? cleanFilterTerm(v) : v,
        terms: compiledTerms,
      };
    }),
  }));
}
