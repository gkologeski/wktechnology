// Utilitários puros de CNPJ (formatação, normalização e validação de dígitos).
export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Formata como 00.000.000/0000-00, tolerando entradas parciais. */
export function formatCnpj(value: string | null | undefined): string {
  const d = onlyDigits(value).slice(0, 14);
  if (!d) return "";
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8), d.slice(8, 12), d.slice(12, 14)];
  let out = parts[0];
  if (parts[1]) out += `.${parts[1]}`;
  if (parts[2]) out += `.${parts[2]}`;
  if (parts[3]) out += `/${parts[3]}`;
  if (parts[4]) out += `-${parts[4]}`;
  return out;
}

/** Valida um CNPJ pelos dois dígitos verificadores. */
export function isValidCnpj(value: string | null | undefined): boolean {
  const d = onlyDigits(value);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const check = (len: number) => {
    let weight = len - 7;
    let sum = 0;
    for (let i = 0; i < len; i += 1) {
      sum += Number(d[i]) * weight;
      weight -= 1;
      if (weight < 2) weight = 9;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return check(12) === Number(d[12]) && check(13) === Number(d[13]);
}
