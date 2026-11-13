// Dados cadastrais da contratante: o cadastro atual vence a cópia da proposta aceita
// quando preenchido (endereço enriquecido depois do aceite). Valores comerciais não passam aqui.
type Party = {
  id?: string;
  name?: string | null;
  cnpj?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
  [k: string]: unknown;
};

const filled = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

function withCep(address: string | null, cep: string | null | undefined): string | null {
  if (!address) return address;
  const digits = (cep ?? "").replace(/\D/g, "");
  if (digits.length !== 8 || address.replace(/\D/g, "").includes(digits)) return address;
  return `${address}, CEP ${digits.slice(0, 2)}.${digits.slice(2, 5)}-${digits.slice(5)}`;
}

export function mergeCompanyParty<T extends Party>(
  snapshot: T | null,
  current: Party | null,
): T | null {
  if (!snapshot && !current) return null;
  const base = { ...(current ?? {}), ...(snapshot ?? {}) } as T;
  if (current) {
    for (const k of ["cnpj", "address", "city", "state", "cep"] as const) {
      if (filled(current[k])) (base as Party)[k] = current[k];
    }
  }
  (base as Party).address = withCep(
    (base.address as string | null) ?? null,
    base.cep as string | null,
  );
  return base;
}
