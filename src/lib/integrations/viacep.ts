// ViaCEP — endpoint público sem autenticação. Chamado direto do navegador.
// GET https://viacep.com.br/ws/{cep}/json/
export type CepResult = {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
};

export async function lookupCep(rawCep: string): Promise<CepResult | null> {
  const cep = rawCep.replace(/\D/g, "");
  if (cep.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as CepResult;
    if (data.erro) return null;
    return data;
  } catch {
    return null;
  }
}
