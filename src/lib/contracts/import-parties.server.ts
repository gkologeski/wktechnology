import type { OwnEntity } from "./import-link.server";
import type { ExtractedContract } from "./import-schemas";

/** Resolve document sides only. The caller still reads canonical entities under user RLS. */
export function resolveImportParties(
  fields: ExtractedContract,
  entities: OwnEntity[],
  manualRole: "provider" | "client" | null = null,
) {
  const contracting = matchImportedOwnEntity(
    entities,
    fields.contracting_cnpj,
    fields.contracting_name,
  );
  const contracted = matchImportedOwnEntity(
    entities,
    fields.counterparty_cnpj,
    fields.counterparty_name,
  );
  const inferred =
    Boolean(contracting) === Boolean(contracted)
      ? null
      : contracted
        ? ("provider" as const)
        : ("client" as const);
  const role = manualRole ?? inferred ?? fields.role ?? "provider";
  const own = role === "provider" ? contracted : contracting;
  return {
    role,
    roleSource: manualRole ? "manual" : inferred ? "inferred" : "extracted",
    inferredRole: inferred,
    conflict: Boolean(manualRole && inferred && manualRole !== inferred),
    ownEntityId: own?.id ?? null,
    ownName: own?.name ?? null,
    counterpartyCnpj: role === "provider" ? fields.contracting_cnpj : fields.counterparty_cnpj,
    counterpartyName: role === "provider" ? fields.contracting_name : fields.counterparty_name,
    contractingIsOwn: Boolean(contracting),
  };
}

/** A known CNPJ is authoritative; absent identity or ambiguous names stay unresolved for review. */
export function matchImportedOwnEntity(
  entities: OwnEntity[],
  cnpj: string | null | undefined,
  name: string | null | undefined,
): OwnEntity | null {
  const digits = (cnpj ?? "").replace(/\D/g, "");
  if (digits.length) {
    if (digits.length !== 14) return null;
    const matches = entities.filter((e) => e.cnpjDigits === digits);
    return matches.length === 1 ? matches[0] : null;
  }
  const norm = (v: string | null | undefined) =>
    (v ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  const needle = norm(name);
  if (needle.length < 4) return null;
  const matches = entities.filter((e) => [e.name, e.tradeName].some((v) => norm(v) === needle));
  return matches.length === 1 ? matches[0] : null;
}
