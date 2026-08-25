// Heurística client-safe para detectar se um documento importado é, na verdade,
// um TERMO ADITIVO gravado como contrato principal.
// Usada no diagnóstico em lote (/contracts) e nos testes unitários.

export type AmendmentSignals = {
  /** Parece aditivo? */
  isAmendment: boolean;
  /** Número do aditivo, quando identificável ("1", "2", ...). */
  number: string | null;
  /** Evidências legíveis para revisão humana. */
  reasons: string[];
};

const ORDINALS: Record<string, string> = {
  primeiro: "1",
  primeira: "1",
  segundo: "2",
  segunda: "2",
  terceiro: "3",
  terceira: "3",
  quarto: "4",
  quarta: "4",
  quinto: "5",
  quinta: "5",
  sexto: "6",
  sexta: "6",
  setimo: "7",
  setima: "7",
  oitavo: "8",
  oitava: "8",
  nono: "9",
  nona: "9",
  decimo: "10",
  decima: "10",
};

function deaccent(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function norm(value: string | null | undefined) {
  return deaccent((value ?? "").toString()).toLowerCase();
}

/** Extrai o número do aditivo a partir de textos como "2º termo aditivo" ou "primeiro aditivo". */
export function extractAmendmentNumber(text: string | null | undefined): string | null {
  const t = norm(text);
  if (!t) return null;
  const numeric = t.match(/(\d{1,2})\s*[ºoª°.-]?\s*(?:termo\s+)?aditiv/);
  if (numeric?.[1]) return String(Number(numeric[1]));
  const after = t.match(/aditiv\w*\s*(?:n[ºo°.]?\s*)?(\d{1,2})\b/);
  if (after?.[1]) return String(Number(after[1]));
  for (const [word, value] of Object.entries(ORDINALS)) {
    if (new RegExp(`\\b${word}\\b[^.]{0,20}aditiv`).test(t)) return value;
  }
  return null;
}

/**
 * Avalia título, avisos da importação e números citados para decidir se o
 * documento é um aditivo. Conservadora: só marca com evidência textual explícita.
 */
export function detectAmendmentSignals(input: {
  title?: string | null;
  warnings?: string[] | null;
  selfNumber?: string | null;
  fileName?: string | null;
}): AmendmentSignals {
  const reasons: string[] = [];
  const title = input.title ?? "";
  const fileName = input.fileName ?? "";
  const selfNumber = input.selfNumber ?? "";
  const warnings = (input.warnings ?? []).filter((w) => typeof w === "string");

  const hasAmendmentWord = (value: string) => /aditiv/.test(norm(value));
  // "ADT" isolado (prefixo antigo dos títulos importados).
  const hasAdtPrefix = (value: string) => /(^|[\s\-_[(])adt([\s\-_)\]]|$)/.test(norm(value));

  if (hasAmendmentWord(title) || hasAdtPrefix(title)) {
    reasons.push(`Título indica aditivo: "${title}".`);
  }
  if (hasAmendmentWord(fileName) || hasAdtPrefix(fileName)) {
    reasons.push(`Arquivo de origem indica aditivo: "${fileName}".`);
  }
  if (hasAmendmentWord(selfNumber)) {
    reasons.push(`Número do documento indica aditivo: "${selfNumber}".`);
  }
  for (const w of warnings) {
    if (hasAmendmentWord(w)) reasons.push(`Aviso da importação: "${w}"`);
  }

  const number =
    extractAmendmentNumber(title) ??
    extractAmendmentNumber(selfNumber) ??
    extractAmendmentNumber(fileName) ??
    extractAmendmentNumber(warnings.join(" · "));

  return { isAmendment: reasons.length > 0, number, reasons };
}
