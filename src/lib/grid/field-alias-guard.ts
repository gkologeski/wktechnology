// Trava contra campos duplicados por alias no catálogo de campos.
// Sem dependência de UI: usado pelo diálogo de edição em massa e testável.
import { FIELD_ALIASES, canonicalOf, isLegacyAlias } from "@/lib/entity-fields-meta";

type Field = { name: string; label: string; system?: boolean };

/**
 * Garante que colunas legadas (alias de um campo canônico) nunca apareçam ao
 * lado do canônico na lista principal: elas são marcadas como campo de sistema.
 * Também resolve colisões de rótulo residuais, mantendo o canônico no topo.
 */
export function dedupeAliasFields<T extends Field>(fields: T[]): T[] {
  const names = new Set(fields.map((f) => f.name));
  const labelOwner = new Map<string, string>();
  for (const f of fields) {
    if (isLegacyAlias(f.name)) continue;
    if (!labelOwner.has(f.label)) labelOwner.set(f.label, f.name);
  }

  return fields.map((f) => {
    const canonical = FIELD_ALIASES[f.name];
    const isShadowedAlias = !!canonical && names.has(canonical);
    const labelCollides =
      labelOwner.get(f.label) !== undefined && labelOwner.get(f.label) !== f.name;
    if (isShadowedAlias || labelCollides) return { ...f, system: true };
    return f;
  });
}

export type AliasConflict = {
  alias: string;
  canonical: string;
  aliasLabel: string;
  canonicalLabel: string;
};

/**
 * Detecta seleção simultânea de um alias e do seu campo canônico — que
 * gravaria o mesmo dado em duas colunas com valores potencialmente divergentes.
 */
export function findAliasConflict(selected: string[], fields: Field[]): AliasConflict | null {
  const set = new Set(selected);
  const labelOf = (name: string) => fields.find((f) => f.name === name)?.label ?? name;
  for (const name of selected) {
    if (!isLegacyAlias(name)) continue;
    const canonical = canonicalOf(name);
    if (set.has(canonical)) {
      return {
        alias: name,
        canonical,
        aliasLabel: labelOf(name),
        canonicalLabel: labelOf(canonical),
      };
    }
  }
  return null;
}
