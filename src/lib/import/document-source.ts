/**
 * Leitura segura de documentos para importações com IA (pesquisas, perfis de vaga…).
 * Utilitários puros: detecção por assinatura, SSRF, HTML/DOCX → texto, hash.
 * O conteúdo extraído é sempre DADO, nunca instrução.
 */
import { unzipSync } from "fflate";

export const IMPORT_LIMITS = {
  fileBytes: 10 * 1024 * 1024,
  htmlBytes: 2 * 1024 * 1024,
  docxXmlBytes: 8 * 1024 * 1024,
  docxEntries: 2000,
  textChars: 120_000,
  fetchTimeoutMs: 15_000,
  maxRedirects: 3,
} as const;

export type SourceKind = "pdf" | "docx" | "image";

/** Detecta o tipo pelos bytes iniciais (não confia na extensão/MIME declarado). */
export function sniff(bytes: Uint8Array): { kind: SourceKind; mime: string } | null {
  const h = (n: number) => bytes[n];
  if (h(0) === 0x25 && h(1) === 0x50 && h(2) === 0x44 && h(3) === 0x46)
    return { kind: "pdf", mime: "application/pdf" };
  if (h(0) === 0x50 && h(1) === 0x4b && h(2) === 0x03 && h(3) === 0x04)
    return {
      kind: "docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  if (h(0) === 0x89 && h(1) === 0x50 && h(2) === 0x4e && h(3) === 0x47)
    return { kind: "image", mime: "image/png" };
  if (h(0) === 0xff && h(1) === 0xd8 && h(2) === 0xff) return { kind: "image", mime: "image/jpeg" };
  if (
    h(0) === 0x52 &&
    h(1) === 0x49 &&
    h(2) === 0x46 &&
    h(3) === 0x46 &&
    h(8) === 0x57 &&
    h(9) === 0x45 &&
    h(10) === 0x42 &&
    h(11) === 0x50
  )
    return { kind: "image", mime: "image/webp" };
  return null;
}

/** PDF protegido por senha (dicionário /Encrypt no trailer). */
export function pdfIsEncrypted(bytes: Uint8Array): boolean {
  const tail = new TextDecoder("latin1").decode(bytes.slice(Math.max(0, bytes.length - 4096)));
  const head = new TextDecoder("latin1").decode(bytes.slice(0, Math.min(bytes.length, 4096)));
  return /\/Encrypt\s/.test(tail) || /\/Encrypt\s/.test(head);
}

const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^0\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];
/** Bloqueia SSRF: só http(s), sem credenciais, sem host interno/IP privado/porta não padrão. */
export function checkImportUrl(
  raw: string,
): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "URL inválida." };
  }
  if (!["http:", "https:"].includes(url.protocol))
    return { ok: false, reason: "Use um endereço http ou https." };
  if (url.username || url.password)
    return { ok: false, reason: "URL com credenciais não é permitida." };
  if (url.port && !["80", "443"].includes(url.port))
    return { ok: false, reason: "Porta não permitida." };
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    !host.includes(".")
  )
    return { ok: false, reason: "Endereço interno bloqueado." };
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && PRIVATE_V4.some((r) => r.test(host)))
    return { ok: false, reason: "Endereço interno bloqueado." };
  if (host.includes(":") && (/^(::1|::|fc|fd|fe80)/.test(host) || host.startsWith("::ffff:")))
    return { ok: false, reason: "Endereço interno bloqueado." };
  if (/^\d+$/.test(host) || /^0x/i.test(host))
    return { ok: false, reason: "Endereço numérico não permitido." };
  return { ok: true, url };
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));

/** HTML estático → texto legível preservando rótulos, tipos de input e opções. */
export function htmlToText(html: string): { text: string; hasForm: boolean } {
  const hasForm = /<form[\s>]|<input[\s>]|<select[\s>]|<textarea[\s>]/i.test(html);
  const t = html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<option[^>]*>([\s\S]*?)<\/option>/gi, "\n  ( ) $1")
    .replace(
      /<input[^>]*type=["']?(radio|checkbox)["']?[^>]*>/gi,
      (m, t2: string) => `\n  [${t2 === "radio" ? "( )" : "[ ]"}] `,
    )
    .replace(
      /<input[^>]*type=["']?(email|tel|url|number|date|datetime-local|file)["']?[^>]*>/gi,
      (_, t2: string) => ` [campo ${t2}]`,
    )
    .replace(/<input[^>]*required[^>]*>/gi, " [campo obrigatório]")
    .replace(/<input[^>]*>/gi, " [campo texto]")
    .replace(/<textarea[^>]*>[\s\S]*?<\/textarea>/gi, " [campo texto longo]")
    .replace(/<\/(p|div|li|h[1-6]|label|tr|fieldset|legend|section|select)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decode(t)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, IMPORT_LIMITS.textChars);
  return { text, hasForm };
}

/** DOCX → texto (só word/document.xml; sem macros; com teto contra ZIP bomb). */
export function docxToText(bytes: Uint8Array): string {
  let entries = 0;
  let oversized = false;
  const files = unzipSync(bytes, {
    filter: (f) => {
      entries++;
      if (entries > IMPORT_LIMITS.docxEntries) throw new Error("DOCX com estrutura excessiva.");
      if (f.name !== "word/document.xml") return false;
      if (f.originalSize > IMPORT_LIMITS.docxXmlBytes) {
        oversized = true;
        return false;
      }
      return true;
    },
  });
  if (oversized) throw new Error("Documento DOCX grande demais para importar.");
  const xml = files["word/document.xml"];
  if (!xml) throw new Error("Arquivo DOCX sem conteúdo de documento.");
  const s = new TextDecoder().decode(xml);
  return decode(
    s
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br[^>]*\/>/g, "\n")
      .replace(/<w:sym[^>]*w:char="(F0A8|F06F|2610)"[^>]*\/>/gi, "( ) ")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, IMPORT_LIMITS.textChars);
}

export async function sha256(input: Uint8Array | string): Promise<string> {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const d = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

