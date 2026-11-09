// DADOS-CONTRATO: endereço oficial pelo CNPJ (BrasilAPI) para completar PJ sem endereço.
// Server-only. Falha de rede nunca bloqueia o contrato: retorna null.

export type CnpjAddress = {
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  source: "brasilapi";
};

function title(s: unknown): string | null {
  if (typeof s !== "string" || !s.trim()) return null;
  return s
    .toLowerCase()
    .replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase())
    .trim();
}

export async function lookupCnpjAddress(cnpj: string | null | undefined): Promise<CnpjAddress | null> {
  const digits = (cnpj ?? "").replace(/\D/g, "");
  if (digits.length !== 14) return null;
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (!r.ok) return null;
    const d = (await r.json()) as Record<string, unknown>;
    const cep = typeof d.cep === "string" ? d.cep.replace(/\D/g, "") : "";
    const street = [title(d.descricao_tipo_de_logradouro), title(d.logradouro)]
      .filter(Boolean)
      .join(" ");
    return {
      street: street || null,
      number: typeof d.numero === "string" ? d.numero : null,
      complement: title(d.complemento),
      neighborhood: title(d.bairro),
      city: title(d.municipio),
      state: typeof d.uf === "string" ? d.uf : null,
      zip_code: cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : null,
      source: "brasilapi",
    };
  } catch {
    return null;
  }
}
