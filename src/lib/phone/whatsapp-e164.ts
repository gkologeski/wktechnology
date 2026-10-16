/**
 * Telefones para WhatsApp: separa vários números de um campo, classifica
 * celular x fixo (Brasil) e normaliza em E.164. Sem dependências — usado no
 * servidor (campanhas, disparo, Inbox, Lia) e no navegador (formulários).
 */

export type PhoneKind = "mobile" | "landline" | "foreign" | "invalid";

export type ParsedPhone = { kind: PhoneKind; e164: string | null };

const JUNK = /^[\s\-–—.0]*$/;

/** Divide um campo com vários números ("(11) 9999-0000 / 11 3333-4444"). */
export function parsePhoneCandidates(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[/;,|\n]+|\s+(?:e|ou)\s+/i)
    .map((s) => s.trim())
    .filter((s) => s && !JUNK.test(s));
}

/** Classifica e normaliza um único número. */
export function classifyPhone(raw: string | null | undefined): ParsedPhone {
  const s = (raw ?? "").trim();
  if (!s || JUNK.test(s)) return { kind: "invalid", e164: null };
  // remove ramal
  const main = s.split(/\s*(?:ramal|ext\.?|r\.|x)\s*\d+\s*$/i)[0];
  let d = main.replace(/\D/g, "");
  const hadPlus = main.trim().startsWith("+");
  if (d.startsWith("00")) d = d.slice(2);
  else if (!hadPlus && d.startsWith("0")) {
    // 0 + operadora (2 dígitos) + DDD + número, ou 0 + DDD + número
    if (d.length === 13 || d.length === 14) d = d.slice(3);
    else d = d.replace(/^0+/, "");
  }
  if ((hadPlus || d.length > 13) && !d.startsWith("55")) {
    // Estrangeiro: campanhas WhatsApp só aceitam celular do Brasil.
    return { kind: d.length >= 8 && d.length <= 15 ? "foreign" : "invalid", e164: null };
  }
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!d.startsWith("55") || (d.length !== 12 && d.length !== 13)) {
    return { kind: "invalid", e164: null };
  }
  const ddd = d.slice(2, 4);
  const local = d.slice(4);
  if (!/^[1-9][1-9]$/.test(ddd)) return { kind: "invalid", e164: null };
  if (local.length === 9) {
    return local.startsWith("9")
      ? { kind: "mobile", e164: `+55${ddd}${local}` }
      : { kind: "invalid", e164: null };
  }
  // 8 dígitos: 6–9 = celular no formato antigo (ganha o 9); 2–5 = fixo
  if (/^[6-9]/.test(local)) return { kind: "mobile", e164: `+55${ddd}9${local}` };
  if (/^[2-5]/.test(local)) return { kind: "landline", e164: `+55${ddd}${local}` };
  return { kind: "invalid", e164: null };
}

/** E.164 do celular (ou número estrangeiro); null para fixo/inválido. */
export function toWhatsAppE164(raw: string | null | undefined): string | null {
  const p = classifyPhone(raw);
  return p.kind === "mobile" ? p.e164 : null;
}

export function isBrMobile(raw: string | null | undefined): boolean {
  return classifyPhone(raw).kind === "mobile";
}

export type WhatsAppPick =
  | { status: "ok"; e164: string }
  | { status: "landline" | "invalid" | "empty"; e164: null };

/**
 * Escolhe o número de WhatsApp na ordem dada (WhatsApp → Celular → Telefone),
 * olhando cada número de cada campo. Fixo nunca é escolhido.
 */
export function pickWhatsAppNumber(fields: Array<string | null | undefined>): WhatsAppPick {
  let sawLandline = false;
  let sawAny = false;
  for (const f of fields) {
    for (const c of parsePhoneCandidates(f)) {
      sawAny = true;
      const p = classifyPhone(c);
      if (p.kind === "mobile" && p.e164) {
        return { status: "ok", e164: p.e164 };
      }
      if (p.kind === "landline") sawLandline = true;
    }
  }
  return { status: sawLandline ? "landline" : sawAny ? "invalid" : "empty", e164: null };
}

/** Validação para o campo WhatsApp de formulários/API. */
export function validateWhatsAppInput(
  raw: string | null | undefined,
): { ok: true; e164: string | null } | { ok: false; message: string } {
  if (!raw || !raw.trim()) return { ok: true, e164: null };
  const p = classifyPhone(raw);
  if (p.kind === "landline")
    return { ok: false, message: "Telefone fixo não pode ser usado como WhatsApp." };
  if (p.kind !== "mobile" || !p.e164)
    return {
      ok: false,
      message: "Use celular do Brasil: DDD + 9 + 8 dígitos, ex.: (11) 91234-5678.",
    };
  return { ok: true, e164: p.e164 };
}
