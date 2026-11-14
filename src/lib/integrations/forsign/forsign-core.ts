// Regras puras da integração ForSign (sem rede, sem banco): situação, webhook e texto do PDF.
export type ForsignOpStatus =
  | "creating"
  | "sent"
  | "partially_signed"
  | "completed"
  | "evidence_recorded"
  | "canceled"
  | "expired"
  | "failed"
  | "stale";

/** Rótulo do participante: na ordem sequencial do ForSign, quem ainda não recebeu o convite aparece "Na fila". */
export function memberStatusLabel(m: { status?: string | null; stage?: string | null }) {
  if (m.status === "Create" && m.stage === "WaitingToSend")
    return "Na fila — recebe o convite após o anterior assinar";
  if (m.status === "Create" && m.stage === "Sent") return "Convite enviado — aguardando assinatura";
  return MEMBER_STATUS_PT[m.status ?? ""] ?? m.status ?? "";
}

/** Converte a situação da operação no ForSign para a situação local. */
export function mapOperationStatus(
  remote: string | null | undefined,
  progress: { current: number; total: number },
): ForsignOpStatus {
  switch (remote) {
    case "Completed":
      return "completed";
    case "Canceled":
      return "canceled";
    case "Expired":
      return "expired";
    default:
      return progress.current > 0 && progress.current < progress.total
        ? "partially_signed"
        : "sent";
  }
}

export const MEMBER_STATUS_PT: Record<string, string> = {
  Create: "Aguardando assinatura",
  InProgress: "Pendente",
  Completed: "Assinou",
  Canceled: "Cancelado",
};

export const OP_STATUS_PT: Record<ForsignOpStatus, string> = {
  creating: "Enviando",
  sent: "Enviado",
  partially_signed: "Assinado parcialmente",
  completed: "Assinado — recebendo PDF",
  evidence_recorded: "Assinado — evidência registrada",
  canceled: "Cancelado",
  expired: "Expirado",
  failed: "Falhou",
  stale: "Versão não vigente",
};

/** Envios que ainda dependem do ForSign (sincronização periódica). */
export const PENDING_STATUSES: ForsignOpStatus[] = ["sent", "partially_signed", "completed"];

function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** HMAC-SHA256 do corpo cru, comparado em tempo constante (header `sha256=<hex>`). */
export async function verifyForsignSignature(
  rawBody: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header || !secret) return false;
  const received = header
    .replace(/^sha256=/, "")
    .trim()
    .toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(received)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  return diff === 0;
}

/** Recusa avisos com horário de envio muito distante (repetição maliciosa). */
export function timestampFresh(header: string | null, nowMs = Date.now(), maxAgeS = 3600) {
  const t = Number(header);
  if (!Number.isFinite(t) || t <= 0) return false;
  return Math.abs(nowMs / 1000 - t) <= maxAgeS;
}

export type PdfBlock = { kind: "h1" | "h2" | "p" | "li"; text: string; bold?: boolean };

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};
function decode(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

/** Converte o HTML do contrato em blocos de texto para o PDF (títulos, parágrafos e itens). */
export function htmlToBlocks(html: string): PdfBlock[] {
  const src = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n");
  const out: PdfBlock[] = [];
  const re = /<(h1|h2|h3|h4|p|li|div|td)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  let matched = false;
  while ((m = re.exec(src))) {
    matched = true;
    const tag = m[1].toLowerCase();
    const inner = m[2];
    if (/<(p|li|div|h[1-4])\b/i.test(inner)) {
      out.push(...htmlToBlocks(inner));
      continue;
    }
    const text = decode(inner.replace(/<[^>]+>/g, ""))
      .replace(/[ \t]+/g, " ")
      .trim();
    if (!text) continue;
    const kind = tag === "h1" ? "h1" : tag.startsWith("h") ? "h2" : tag === "li" ? "li" : "p";
    const bold = kind === "p" && /^\s*<(strong|b)>[\s\S]*<\/(strong|b)>\s*$/i.test(inner);
    out.push({ kind, text, ...(bold ? { bold } : {}) });
  }
  if (!matched) {
    for (const part of decode(src.replace(/<[^>]+>/g, "")).split(/\n{2,}/)) {
      const t = part.trim();
      if (t) out.push({ kind: "p", text: t });
    }
  }
  return out;
}

/** Fonte padrão do PDF só tem WinAnsi: troca o que não existe nela sem perder acentos. */
export function toWinAnsi(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[^\n\x20-\x7e\u00a1-\u00ff]/g, "");
}

export type SignerInput = { name: string; email: string; cpf?: string | null; role: string };

/** Monta os assinantes da operação no ForSign (paralelo, notificação por e-mail). */
export function buildMembers(signers: SignerInput[]) {
  const seen = new Set<string>();
  return signers.map((s, i) => {
    const email = s.email.trim().toLowerCase();
    if (seen.has(email)) throw new Error("Os assinantes precisam ter e-mails diferentes.");
    seen.add(email);
    const cpf = (s.cpf ?? "").replace(/\D/g, "");
    return {
      name: s.name.trim(),
      email,
      role: s.role,
      orderPosition: i,
      observer: false,
      notificationChannel: "Email",
      ...(cpf.length === 11 ? { cpf } : {}),
    };
  });
}

/** Provider completion must cover the exact roster originally requested, including witnesses. */
export function allRequestedSignersCompleted(expected: unknown, remote: unknown): boolean {
  if (
    !Array.isArray(expected) ||
    expected.length < 2 ||
    !Array.isArray(remote) ||
    remote.length !== expected.length
  )
    return false;
  const emails = (rows: unknown[]) =>
    rows.map((v) =>
      typeof v === "object" && v !== null && "email" in v && typeof v.email === "string"
        ? v.email.trim().toLowerCase()
        : "",
    );
  const wanted = emails(expected),
    received = emails(remote);
  if (
    wanted.some((e) => !e) ||
    new Set(wanted).size !== wanted.length ||
    new Set(received).size !== received.length
  )
    return false;
  return wanted.every((email) =>
    remote.some((r: any) => r.email?.trim().toLowerCase() === email && r.status === "Completed"),
  );
}
