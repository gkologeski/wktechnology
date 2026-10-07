// Lista de números autorizados no piloto do SDR (sem dependências de servidor).
// Compara números brasileiros com e sem o nono dígito.
function brKeys(raw: string): string[] {
  let d = raw.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  const keys = new Set([d]);
  if (d.startsWith("55") && d.length === 13 && d[4] === "9") keys.add(d.slice(0, 4) + d.slice(5));
  if (d.startsWith("55") && d.length === 12 && /[6-9]/.test(d[4] ?? ""))
    keys.add(`${d.slice(0, 4)}9${d.slice(4)}`);
  return [...keys];
}

/** Lista vazia = sem restrição. Lista preenchida = somente esses números. */
export function isPhoneAllowlisted(phone: string, list: string[] | null | undefined): boolean {
  if (!list || list.length === 0) return true;
  const allowed = new Set(list.flatMap(brKeys));
  return brKeys(phone).some((k) => allowed.has(k));
}
