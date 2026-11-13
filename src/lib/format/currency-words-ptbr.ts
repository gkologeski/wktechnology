// Valor monetário (BRL) por extenso em PT-BR. Puro, client-safe.
const UNI = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
  "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CEN = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos",
  "setecentos", "oitocentos", "novecentos"];

function hundreds(n: number): string {
  if (n === 100) return "cem";
  const c = Math.floor(n / 100), r = n % 100, parts: string[] = [];
  if (c) parts.push(CEN[c]);
  if (r < 20) { if (r) parts.push(UNI[r]); }
  else { parts.push(DEZ[Math.floor(r / 10)] + (r % 10 ? ` e ${UNI[r % 10]}` : "")); }
  return parts.join(" e ");
}

const SCALES: [string, string][] = [["", ""], ["mil", "mil"], ["milhão", "milhões"], ["bilhão", "bilhões"], ["trilhão", "trilhões"]];

function integerWords(n: number): string {
  if (n === 0) return "zero";
  const groups: number[] = [];
  while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
  const chunks: { text: string; value: number }[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    let text = i === 1 && g === 1 ? "mil" : hundreds(g);
    if (i >= 1 && !(i === 1 && g === 1)) text += ` ${g === 1 ? SCALES[i][0] : SCALES[i][1]}`;
    chunks.push({ text, value: g });
  }
  return chunks.reduce((acc, ch, idx) => {
    if (idx === 0) return ch.text;
    const last = idx === chunks.length - 1;
    const sep = last && (ch.value < 100 || ch.value % 100 === 0) ? " e " : ", ";
    return acc + sep + ch.text;
  }, "");
}

/** Converte número (ou texto "R$ 18.870,00" / "18870.5") para extenso. Vazio/zero → "". */
export function currencyToWordsPtBr(input: unknown): string {
  let n: number;
  if (typeof input === "number") n = input;
  else if (typeof input === "string" && input.trim()) {
    const t = input.replace(/[^\d,.-]/g, "");
    n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  } else return "";
  if (!Number.isFinite(n) || n <= 0) return "";
  const cents = Math.round(n * 100);
  const reais = Math.floor(cents / 100), cent = cents % 100;
  const parts: string[] = [];
  if (reais) {
    const w = integerWords(reais);
    const de = reais % 1_000_000 === 0 ? " de" : "";
    parts.push(`${w}${de} ${reais === 1 ? "real" : "reais"}`);
  }
  if (cent) parts.push(`${integerWords(cent)} ${cent === 1 ? "centavo" : "centavos"}`);
  return parts.join(" e ");
}
