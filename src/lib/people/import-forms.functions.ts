// Importação em lote de prestadores a partir da planilha pública de respostas
// de um Google Form (formulário de cadastro de prestadores de serviços).
//
// Fluxo:
//  1. Baixa CSV público (Google Sheets export?format=csv).
//  2. Normaliza cada linha (CPF, telefone, email, endereço, banco, redes).
//  3. Dedupe por CPF (fallback email) dentro do workspace ativo.
//  4. Estratégia empty-fill: só grava campo se o registro atual está NULL.
//  5. Baixa até 4 anexos do Drive (permissão herdada da pasta pública) e
//     grava em `people-documents` bucket + linha em `people_documents`.
//
// Idempotente: reexecutar com os mesmos dados não duplica pessoas nem anexos.
// Executa em batches (default 10 pessoas por chamada) para caber no worker.

import { createServerFn } from "@tanstack/react-start";
import Papa from "papaparse";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAnyPermission, getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { toE164 } from "@/lib/validators";

const DEFAULT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1J9Tqg7JOehajxk3tfWPodCSK1wI58Iijk2vFcksaiFE/edit";

type NormalizedRow = {
  timestamp: string | null;
  full_name: string;
  preferred_name: string | null;
  cpf: string; // só dígitos
  cpf_formatted: string;
  rg: string | null;
  birth_date: string | null;
  email: string | null;
  phone: string | null; // E.164
  mobile: string | null; // E.164
  emergency_contact: string | null;
  address_line1: string | null;
  address_complement: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  education: string | null;
  bank: string | null;
  agency: string | null;
  account: string | null;
  shirt: string | null;
  pix: string | null;
  instagram: string | null;
  linkedin: string | null;
  marital_status: string | null;
  spouse_name: string | null;
  cnpj: string | null;
  legal_entity_name: string | null;
  trade_name: string | null;
  simples: string | null;
  attachments: { label: string; drive_id: string }[];
  raw_email_alt: string | null;
};

// ---------- helpers de normalização ----------

function digits(v: string | undefined | null): string {
  return String(v ?? "").replace(/\D+/g, "");
}

function isValidCPF(v: string): boolean {
  const d = digits(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factor - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  const dv1 = calc(d.slice(0, 9), 10);
  const dv2 = calc(d.slice(0, 10), 11);
  return dv1 === Number(d[9]) && dv2 === Number(d[10]);
}

function formatCPF(d: string): string {
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function isValidCNPJ(v: string): boolean {
  const d = digits(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((acc, n, i) => acc + Number(n) * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dv1 = calc(d.slice(0, 12), w1);
  const dv2 = calc(d.slice(0, 12) + String(dv1), w2);
  return dv1 === Number(d[12]) && dv2 === Number(d[13]);
}

function trim(v: string | undefined | null): string | null {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
}

function parseBirth(v: string | undefined | null): string | null {
  const t = trim(v);
  if (!t) return null;
  // Aceita dd/MM/yyyy, dd-MM-yyyy, yyyy-MM-dd
  const m1 = t.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (m1) {
    const [, dd, mm, yyyy] = m1;
    const iso = `${yyyy}-${mm}-${dd}`;
    const d = new Date(iso);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100) return iso;
  }
  const m2 = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  return null;
}

function extractInstagram(v: string | undefined | null): string | null {
  const t = trim(v);
  if (!t) return null;
  const m = t.match(/(?:instagram\.com\/)?@?([A-Za-z0-9_.]{2,40})/);
  return m ? `@${m[1].replace(/^@/, "")}` : t;
}

function extractLinkedin(v: string | undefined | null): string | null {
  const t = trim(v);
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  const m = t.match(/linkedin\.com\/(?:in|pub)\/[A-Za-z0-9-_.%]+/);
  if (m) return `https://www.${m[0]}`;
  return t;
}

const DRIVE_ID_RE =
  /(?:drive\.google\.com\/(?:open\?id=|file\/d\/|uc\?id=|uc\?export=[^&]+&id=)|drive\.usercontent\.google\.com\/download\?id=)([A-Za-z0-9_-]{20,})/g;

function extractDriveIds(v: string | undefined | null): string[] {
  const t = trim(v);
  if (!t) return [];
  const ids = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(DRIVE_ID_RE.source, "g");
  while ((m = re.exec(t)) !== null) ids.add(m[1]);
  return Array.from(ids);
}

// ---------- CSV parsing ----------

const COLUMN_ALIASES = {
  timestamp: ["Carimbo de data/hora"],
  cnpj: ["CNPJ"],
  legal_entity_name: ["Razão Social"],
  trade_name: ["Nome Fantasia"],
  simples: ["Optante Simples:", "Optante Simples"],
  full_name: ["Nome Completo"],
  cpf: ["CPF"],
  rg: ["RG"],
  birth: ["Data Nascimento"],
  address: ["Endereço Residencial com Número"],
  complement: ["Complemento:", "Complemento"],
  city: ["Cidade:"],
  state: ["UF:"],
  zip: ["CEP:"],
  email: ["E-mail:"],
  email_alt: ["Endereço de e-mail"],
  emergency: ["Telefone de  Recado. Favor informar nome e parentesco"],
  mobile: ["Celular:"],
  education: ["Grau de Instrução:"],
  bank: ["Banco / Agencia:"],
  agency: ["Agência:"],
  account: ["Conta:"],
  shirt: ["Tamanho de camiseta"],
  doc_id: ["Anexar foto legível do documento de Identificação que conste o CPF frente/verso:"],
  doc_addr: ["Anexar foto legível comprovante de Endereço:"],
  doc_photo: [
    "Anexar foto legível - da cintura para cima, com fundo branco ou neutro e com a câmera traseira do seu cel.(com espaços laterais e a cima da cabeça. (para o marketing) conforme exemplo no link:https://drive.google.com/file/d/1p-ihGrwqSTAVnLhXUXly2w9oFSyVzCNR/view?usp=sharing",
  ],
  doc_bundle: ["Anexar foto legível: CPF, RG e Comprovante de Endereço"],
  pix: ["Chave Pix:"],
  instagram: ["Você possui Instagram, qual?"],
  linkedin: ["Você possui Linkedin, qual?"],
  preferred: ["Como gosta de ser chamado?"],
  marital: ["Situção Civil", "Situação Civil"],
  spouse: ["Caso seja casado (a), qual nome do cônjuge?"],
} as const;

function pick(row: Record<string, string>, aliases: readonly string[]): string | null {
  for (const k of aliases) {
    for (const key of Object.keys(row)) {
      if (key.trim().replace(/\s+/g, " ") === k.trim().replace(/\s+/g, " ")) {
        return row[key];
      }
    }
  }
  return null;
}

function normalizeRow(row: Record<string, string>): { row: NormalizedRow | null; reason?: string } {
  const cpfRaw = pick(row, COLUMN_ALIASES.cpf) ?? "";
  const cpf = digits(cpfRaw);
  if (!isValidCPF(cpf)) return { row: null, reason: `CPF inválido: ${cpfRaw || "(vazio)"}` };
  const fullName = trim(pick(row, COLUMN_ALIASES.full_name));
  if (!fullName) return { row: null, reason: "Nome vazio" };

  const cnpjRaw = pick(row, COLUMN_ALIASES.cnpj);
  const cnpjDigits = digits(cnpjRaw ?? "");
  const cnpj = isValidCNPJ(cnpjDigits) ? cnpjDigits : null;

  const attachments: { label: string; drive_id: string }[] = [];
  for (const id of extractDriveIds(pick(row, COLUMN_ALIASES.doc_id))) {
    attachments.push({ label: "Documento de identidade (CPF/RG)", drive_id: id });
  }
  for (const id of extractDriveIds(pick(row, COLUMN_ALIASES.doc_addr))) {
    attachments.push({ label: "Comprovante de endereço", drive_id: id });
  }
  for (const id of extractDriveIds(pick(row, COLUMN_ALIASES.doc_photo))) {
    attachments.push({ label: "Foto para marketing", drive_id: id });
  }
  for (const id of extractDriveIds(pick(row, COLUMN_ALIASES.doc_bundle))) {
    attachments.push({ label: "CPF/RG/Comprovante de endereço", drive_id: id });
  }

  return {
    row: {
      timestamp: trim(pick(row, COLUMN_ALIASES.timestamp)),
      full_name: fullName,
      preferred_name: trim(pick(row, COLUMN_ALIASES.preferred)),
      cpf,
      cpf_formatted: formatCPF(cpf),
      rg: trim(pick(row, COLUMN_ALIASES.rg)),
      birth_date: parseBirth(pick(row, COLUMN_ALIASES.birth)),
      email: trim(pick(row, COLUMN_ALIASES.email))?.toLowerCase() ?? null,
      raw_email_alt: trim(pick(row, COLUMN_ALIASES.email_alt))?.toLowerCase() ?? null,
      phone: toE164(pick(row, COLUMN_ALIASES.mobile) ?? "") ?? trim(pick(row, COLUMN_ALIASES.mobile)),
      mobile: toE164(pick(row, COLUMN_ALIASES.mobile) ?? "") ?? trim(pick(row, COLUMN_ALIASES.mobile)),
      emergency_contact: trim(pick(row, COLUMN_ALIASES.emergency)),
      address_line1: trim(pick(row, COLUMN_ALIASES.address)),
      address_complement: trim(pick(row, COLUMN_ALIASES.complement)),
      city: trim(pick(row, COLUMN_ALIASES.city)),
      state: trim(pick(row, COLUMN_ALIASES.state))?.toUpperCase() ?? null,
      zip: (() => {
        const z = digits(pick(row, COLUMN_ALIASES.zip));
        return z.length === 8 ? `${z.slice(0, 5)}-${z.slice(5)}` : trim(pick(row, COLUMN_ALIASES.zip));
      })(),
      education: trim(pick(row, COLUMN_ALIASES.education)),
      bank: trim(pick(row, COLUMN_ALIASES.bank)),
      agency: trim(pick(row, COLUMN_ALIASES.agency)),
      account: trim(pick(row, COLUMN_ALIASES.account)),
      shirt: trim(pick(row, COLUMN_ALIASES.shirt)),
      pix: trim(pick(row, COLUMN_ALIASES.pix)),
      instagram: extractInstagram(pick(row, COLUMN_ALIASES.instagram)),
      linkedin: extractLinkedin(pick(row, COLUMN_ALIASES.linkedin)),
      marital_status: trim(pick(row, COLUMN_ALIASES.marital)),
      spouse_name: trim(pick(row, COLUMN_ALIASES.spouse)),
      cnpj,
      legal_entity_name: trim(pick(row, COLUMN_ALIASES.legal_entity_name)),
      trade_name: trim(pick(row, COLUMN_ALIASES.trade_name)),
      simples: trim(pick(row, COLUMN_ALIASES.simples)),
      attachments,
    },
  };
}

function sheetIdFromUrl(url: string): string | null {
  const m = url.match(/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

async function fetchCsv(sheetUrl: string): Promise<NormalizedRow[]> {
  const id = sheetIdFromUrl(sheetUrl);
  if (!id) throw new Error("URL da planilha inválida");
  const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
  const res = await fetch(csvUrl, { redirect: "follow" });
  if (!res.ok) throw new Error(`Falha ao baixar planilha (${res.status}): torne pública como "Qualquer pessoa com o link".`);
  const csv = await res.text();
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  const out: NormalizedRow[] = [];
  const errors: string[] = [];
  for (const row of parsed.data) {
    const { row: n, reason } = normalizeRow(row);
    if (n) out.push(n);
    else if (reason) errors.push(reason);
  }
  // Dedupe por CPF dentro do CSV (mantém primeira ocorrência mais completa).
  const byCpf = new Map<string, NormalizedRow>();
  for (const n of out) {
    if (!byCpf.has(n.cpf)) byCpf.set(n.cpf, n);
  }
  void errors;
  return Array.from(byCpf.values());
}

// ---------- Download de anexos do Drive ----------

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/tiff": "tiff",
  "image/bmp": "bmp",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
  "application/zip": "zip",
};

// Sniff pelos primeiros bytes quando o content-type é opaco.
function sniffExt(bytes: Uint8Array): { ext: string; mime: string } | null {
  if (bytes.length < 4) return null;
  const b = bytes;
  // %PDF
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46)
    return { ext: "pdf", mime: "application/pdf" };
  // JPEG
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return { ext: "jpg", mime: "image/jpeg" };
  // PNG
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return { ext: "png", mime: "image/png" };
  // GIF
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46)
    return { ext: "gif", mime: "image/gif" };
  // ZIP / DOCX / XLSX
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04)
    return { ext: "zip", mime: "application/zip" };
  // RIFF (webp)
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46)
    return { ext: "webp", mime: "image/webp" };
  return null;
}

function parseFilenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  // filename*=UTF-8''encoded
  const mStar = header.match(/filename\*\s*=\s*(?:UTF-8''|utf-8'')?([^;]+)/i);
  if (mStar) {
    try {
      return decodeURIComponent(mStar[1].trim().replace(/^"|"$/g, ""));
    } catch {
      return mStar[1].trim().replace(/^"|"$/g, "");
    }
  }
  const m = header.match(/filename\s*=\s*"?([^";]+)"?/i);
  if (m) return m[1].trim();
  return null;
}

function extFromName(name: string | null): string | null {
  if (!name) return null;
  const i = name.lastIndexOf(".");
  if (i < 0 || i >= name.length - 1) return null;
  const e = name.slice(i + 1).toLowerCase().replace(/[^a-z0-9]/g, "");
  return e.length > 0 && e.length <= 5 ? e : null;
}

// Extrai do HTML de confirmação do Drive o formulário de download com uuid/at/id.
function extractDriveConfirmUrl(html: string): string | null {
  // Formato atual: <form action="https://drive.usercontent.google.com/download" ...>
  // com <input name="id"|"export"|"confirm"|"uuid"|"at" value="...">.
  const formMatch = html.match(/<form[^>]*action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/i);
  if (!formMatch) {
    // Fallback antigo: link direto com ?confirm=t
    const link = html.match(/href="(\/uc\?export=download[^"]*confirm=[^"]+)"/i);
    if (link) return `https://drive.google.com${link[1].replace(/&amp;/g, "&")}`;
    return null;
  }
  const action = formMatch[1];
  const body = formMatch[2];
  const inputs = [...body.matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"[^>]*>/gi)];
  const params = new URLSearchParams();
  for (const [, name, value] of inputs) params.set(name, value);
  return `${action}?${params.toString()}`;
}

async function downloadDriveFile(
  fileId: string,
): Promise<{ bytes: Uint8Array; mime: string; ext: string; original_name: string | null } | null> {
  const initialUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
  let res = await fetch(initialUrl, { redirect: "follow" });
  if (!res.ok) return null;
  let contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();

  // Se veio HTML de confirmação (arquivo grande), extrai o form e refaz o GET.
  if (contentType.startsWith("text/html")) {
    const html = await res.text();
    const confirmUrl = extractDriveConfirmUrl(html);
    if (!confirmUrl) return null;
    res = await fetch(confirmUrl, { redirect: "follow" });
    if (!res.ok) return null;
    contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (contentType.startsWith("text/html")) return null;
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length === 0) return null;

  const original_name = parseFilenameFromDisposition(res.headers.get("content-disposition"));
  const extFromDisposition = extFromName(original_name);

  let mime = contentType || "application/octet-stream";
  let ext = extFromDisposition ?? EXT_BY_MIME[mime] ?? null;

  // Se ainda opaco, sniff pelos primeiros bytes.
  if (!ext || ext === "bin") {
    const sniff = sniffExt(bytes);
    if (sniff) {
      ext = sniff.ext;
      if (mime === "application/octet-stream") mime = sniff.mime;
    }
  }

  return { bytes, mime, ext: ext ?? "bin", original_name };
}

// ---------- Server function ----------

const inputSchema = z.object({
  sheet_url: z.string().url().default(DEFAULT_SHEET_URL),
  dry_run: z.boolean().default(false),
  offset: z.number().int().min(0).default(0),
  batch_size: z.number().int().min(1).max(30).default(10),
});

export type ImportBatchResult = {
  total_unique: number;
  processed: number;
  next_offset: number;
  done: boolean;
  batch: {
    created: number;
    updated_fields: number;
    unchanged: number;
    attachments_ok: number;
    attachments_failed: number;
    failures: { cpf: string; name: string; reason: string }[];
  };
  people?: Array<{
    full_name: string;
    phone: string | null;
    cpf_formatted: string;
    id_doc_drive_id: string | null;
  }>;
};

const ID_DOC_LABEL = "Documento de identidade (CPF/RG)";

export const importPeopleFromPublicSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => inputSchema.parse(i ?? {}))
  .handler(async ({ data, context }): Promise<ImportBatchResult> => {
    const { supabase, userId } = context;
    const workspaceId = await getActiveWorkspaceId(supabase, userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techpeople.people.create.own",
      "techpeople.people.update.workspace",
    ]);

    const rows = await fetchCsv(data.sheet_url);

    if (data.dry_run) {
      const attachmentsCount = rows.reduce((s, r) => s + r.attachments.length, 0);
      const people = rows.map((r) => ({
        full_name: r.full_name,
        phone: r.phone ?? r.mobile ?? null,
        cpf_formatted: r.cpf_formatted,
        id_doc_drive_id:
          r.attachments.find((a) => a.label === ID_DOC_LABEL)?.drive_id ?? null,
      }));
      return {
        total_unique: rows.length,
        processed: rows.length,
        next_offset: rows.length,
        done: true,
        batch: {
          created: 0,
          updated_fields: 0,
          unchanged: 0,
          attachments_ok: 0,
          attachments_failed: attachmentsCount,
          failures: [],
        },
        people,
      };
    }


    // owner_id = workspace ativo do usuário.
    const { data: prof } = await supabase
      .from("profiles")
      .select("active_workspace_id")
      .eq("id", userId)
      .maybeSingle();
    const ownerId = (prof as { active_workspace_id: string | null } | null)?.active_workspace_id;
    if (!ownerId) throw new Error("Workspace ativo não encontrado");

    const slice = rows.slice(data.offset, data.offset + data.batch_size);
    const cpfList = slice.map((r) => r.cpf);
    const cpfFormattedList = slice.map((r) => r.cpf_formatted);

    // Busca existentes (procura tanto por dígitos quanto por formato "###.###.###-##")
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existingRows } = await supabaseAdmin
      .from("people")
      .select("id, owner_id, full_name, email, phone, cnpj, legal_entity_name, personal_doc, notes, preferred_name, location")
      .eq("owner_id", ownerId)
      .in("cnpj", [...cpfList, ...cpfFormattedList, ...cpfList.map(formatCPF)]);
    const byCpf = new Map<string, {
      id: string;
      owner_id: string;
      full_name: string;
      email: string | null;
      phone: string | null;
      cnpj: string | null;
      legal_entity_name: string | null;
      personal_doc: Record<string, unknown> | null;
      notes: string | null;
      preferred_name: string | null;
      location: string | null;
    }>();
    for (const r of (existingRows ?? []) as never[]) {
      const rr = r as {
        id: string; owner_id: string; full_name: string; email: string | null;
        phone: string | null; cnpj: string | null; legal_entity_name: string | null;
        personal_doc: Record<string, unknown> | null; notes: string | null;
        preferred_name: string | null; location: string | null;
      };
      const key = digits(rr.cnpj ?? "");
      if (key.length === 11) byCpf.set(key, rr);
    }

    let created = 0;
    let updatedFields = 0;
    let unchanged = 0;
    let attachmentsOk = 0;
    let attachmentsFailed = 0;
    const failures: { cpf: string; name: string; reason: string }[] = [];

    for (const row of slice) {
      try {
        const personalDoc = {
          cpf: row.cpf_formatted,
          rg: row.rg,
          birth_date: row.birth_date,
          address: {
            line1: row.address_line1,
            complement: row.address_complement,
            city: row.city,
            state: row.state,
            zip: row.zip,
          },
          bank: { name: row.bank, agency: row.agency, account: row.account, pix: row.pix },
          shirt_size: row.shirt,
          education: row.education,
          emergency_contact: row.emergency_contact,
          social: { instagram: row.instagram, linkedin: row.linkedin },
          marital_status: row.marital_status,
          spouse_name: row.spouse_name,
          simples_optante: row.simples,
          trade_name: row.trade_name,
          import_source: "google_forms",
          imported_at: new Date().toISOString(),
        };

        const notesLines = [
          row.legal_entity_name ? `Razão Social: ${row.legal_entity_name}` : null,
          row.trade_name ? `Nome Fantasia: ${row.trade_name}` : null,
          row.simples ? `Optante Simples: ${row.simples}` : null,
          row.education ? `Escolaridade: ${row.education}` : null,
          row.shirt ? `Camiseta: ${row.shirt}` : null,
          row.emergency_contact ? `Recado: ${row.emergency_contact}` : null,
          row.bank ? `Banco: ${row.bank} — Ag ${row.agency ?? "-"} / Conta ${row.account ?? "-"}` : null,
          row.pix ? `PIX: ${row.pix}` : null,
          row.address_line1
            ? `Endereço: ${row.address_line1}${row.address_complement ? " - " + row.address_complement : ""}, ${row.city ?? ""}/${row.state ?? ""} ${row.zip ?? ""}`
            : null,
          row.marital_status ? `Estado civil: ${row.marital_status}` : null,
          row.spouse_name ? `Cônjuge: ${row.spouse_name}` : null,
        ].filter(Boolean);
        const importedNotes = `[Importado do Google Forms em ${new Date().toLocaleDateString("pt-BR")}]\n${notesLines.join("\n")}`;

        const emailPick = row.email || row.raw_email_alt || null;
        const location = [row.city, row.state].filter(Boolean).join("/") || null;

        const existing = byCpf.get(row.cpf);
        let personId: string;

        if (existing) {
          // empty-fill: só sobrescreve o que está null.
          const patch: Record<string, unknown> = {};
          if (!existing.email && emailPick) patch.email = emailPick;
          if (!existing.phone && row.phone) patch.phone = row.phone;
          if (!existing.legal_entity_name && row.legal_entity_name)
            patch.legal_entity_name = row.legal_entity_name;
          if (!existing.preferred_name && row.preferred_name)
            patch.preferred_name = row.preferred_name;
          if (!existing.location && location) patch.location = location;
          if (!existing.notes) patch.notes = importedNotes;
          // personal_doc: merge apenas chaves ausentes
          const currentDoc = (existing.personal_doc ?? {}) as Record<string, unknown>;
          const mergedDoc: Record<string, unknown> = { ...currentDoc };
          let docChanged = false;
          for (const [k, v] of Object.entries(personalDoc)) {
            if (mergedDoc[k] === undefined || mergedDoc[k] === null || mergedDoc[k] === "") {
              mergedDoc[k] = v;
              docChanged = true;
            }
          }
          if (docChanged) patch.personal_doc = mergedDoc;

          if (Object.keys(patch).length > 0) {
            const { error } = await supabaseAdmin
              .from("people")
              .update(patch as never)
              .eq("id", existing.id);
            if (error) throw new Error(error.message);
            updatedFields++;
          } else {
            unchanged++;
          }
          personId = existing.id;
        } else {
          const insertPayload = {
            workspace_id: ownerId,
            owner_id: ownerId,
            created_by: userId,
            full_name: row.full_name,
            preferred_name: row.preferred_name,
            email: emailPick,
            phone: row.phone,
            employment_type: "pj" as const,
            status: "active" as const,
            location,
            cnpj: row.cpf_formatted, // guardamos o CPF no campo cnpj como identificador único do prestador PJ; personal_doc.cpf também.
            legal_entity_name: row.legal_entity_name,
            currency: "BRL",
            tags: ["form-import"],
            notes: importedNotes,
            personal_doc: personalDoc as never,
          };
          const { data: inserted, error } = await supabaseAdmin
            .from("people")
            .insert(insertPayload as never)
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          personId = (inserted as { id: string }).id;
          created++;
        }

        // ---- Anexos ----
        if (row.attachments.length > 0) {
          // Evita reupload: busca file_url já cadastrados para essa pessoa.
          const { data: existingDocs } = await supabaseAdmin
            .from("people_documents")
            .select("file_url")
            .eq("person_id", personId);
          const existingPaths = new Set(
            ((existingDocs ?? []) as { file_url: string | null }[])
              .map((d) => d.file_url ?? "")
              .filter(Boolean),
          );

          for (const att of row.attachments) {
            try {
              const key = `${ownerId}/${personId}/forms-import/${att.drive_id}`;
              // Se já existe algum documento com esse fileId no path, pula.
              const already = Array.from(existingPaths).some((p) => p.includes(att.drive_id));
              if (already) {
                attachmentsOk++;
                continue;
              }
              const dl = await downloadDriveFile(att.drive_id);
              if (!dl) {
                attachmentsFailed++;
                continue;
              }
              const path = `${key}.${dl.ext}`;
              const { error: upErr } = await supabaseAdmin.storage
                .from("people-documents")
                .upload(path, dl.bytes, {
                  contentType: dl.mime,
                  upsert: true,
                });
              if (upErr) {
                attachmentsFailed++;
                continue;
              }
              const displayName = dl.original_name && dl.original_name.trim().length > 0
                ? dl.original_name
                : `${att.label}.${dl.ext}`;
              const { error: docErr } = await supabaseAdmin
                .from("people_documents")
                .insert({
                  owner_id: ownerId,
                  created_by: userId,
                  person_id: personId,
                  doc_type: att.label,
                  file_url: path,
                  file_name: displayName,
                  is_sensitive: true,
                  status: "valid",
                  notes: `Importado do Google Forms (Drive ID ${att.drive_id})`,
                } as never);
              if (docErr) {
                attachmentsFailed++;
                continue;
              }
              attachmentsOk++;
            } catch {
              attachmentsFailed++;
            }
          }
        }
      } catch (e) {
        failures.push({
          cpf: row.cpf_formatted,
          name: row.full_name,
          reason: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const nextOffset = data.offset + slice.length;
    return {
      total_unique: rows.length,
      processed: nextOffset,
      next_offset: nextOffset,
      done: nextOffset >= rows.length,
      batch: {
        created,
        updated_fields: updatedFields,
        unchanged,
        attachments_ok: attachmentsOk,
        attachments_failed: attachmentsFailed,
        failures,
      },
    };
  });

// ---------- Reimport de anexos quebrados (.bin) ----------

const REIMPORT_DRIVE_ID_RE = /Drive ID ([A-Za-z0-9_-]{15,})/;

export type ReimportResult = {
  scanned: number;
  fixed: number;
  still_failed: number;
  processed: number;
  next_offset: number;
  done: boolean;
  failures: { id: string; person_id: string; reason: string }[];
};

const reimportInputSchema = z.object({
  offset: z.number().int().min(0).default(0),
  batch_size: z.number().int().min(1).max(30).default(10),
});

export const reimportBrokenAttachments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => reimportInputSchema.parse(i ?? {}))
  .handler(async ({ data, context }): Promise<ReimportResult> => {
    const { supabase, userId } = context;
    const workspaceId = await getActiveWorkspaceId(supabase, userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techpeople.people.update.workspace",
    ]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Encontra documentos com extensão .bin ou nome terminando em .bin.
    const { data: all, error } = await supabaseAdmin
      .from("people_documents")
      .select("id, owner_id, person_id, doc_type, file_url, file_name, notes")
      .or("file_url.ilike.%.bin,file_name.ilike.%.bin")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = (all ?? []) as Array<{
      id: string;
      owner_id: string;
      person_id: string;
      doc_type: string;
      file_url: string | null;
      file_name: string | null;
      notes: string | null;
    }>;

    const scanned = rows.length;
    const slice = rows.slice(data.offset, data.offset + data.batch_size);

    let fixed = 0;
    let stillFailed = 0;
    const failures: { id: string; person_id: string; reason: string }[] = [];

    for (const row of slice) {
      try {
        // Extrai Drive ID de notes.
        const m = row.notes?.match(REIMPORT_DRIVE_ID_RE);
        if (!m) {
          stillFailed++;
          failures.push({ id: row.id, person_id: row.person_id, reason: "Drive ID não encontrado nas notas" });
          continue;
        }
        const driveId = m[1];
        const dl = await downloadDriveFile(driveId);
        if (!dl || dl.ext === "bin") {
          stillFailed++;
          failures.push({
            id: row.id,
            person_id: row.person_id,
            reason: dl ? `Não foi possível identificar o tipo (${dl.mime})` : "Falha no download do Drive",
          });
          continue;
        }
        const newPath = `${row.owner_id}/${row.person_id}/forms-import/${driveId}.${dl.ext}`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("people-documents")
          .upload(newPath, dl.bytes, { contentType: dl.mime, upsert: true });
        if (upErr) {
          stillFailed++;
          failures.push({ id: row.id, person_id: row.person_id, reason: upErr.message });
          continue;
        }
        // Remove o arquivo antigo .bin se path era diferente.
        if (row.file_url && row.file_url !== newPath) {
          await supabaseAdmin.storage.from("people-documents").remove([row.file_url]);
        }
        const displayName = dl.original_name && dl.original_name.trim().length > 0
          ? dl.original_name
          : `${row.doc_type}.${dl.ext}`;
        const { error: updErr } = await supabaseAdmin
          .from("people_documents")
          .update({ file_url: newPath, file_name: displayName } as never)
          .eq("id", row.id);
        if (updErr) {
          stillFailed++;
          failures.push({ id: row.id, person_id: row.person_id, reason: updErr.message });
          continue;
        }
        fixed++;
      } catch (e) {
        stillFailed++;
        failures.push({
          id: row.id,
          person_id: row.person_id,
          reason: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const nextOffset = data.offset + slice.length;
    return {
      scanned,
      fixed,
      still_failed: stillFailed,
      processed: nextOffset,
      next_offset: nextOffset,
      done: nextOffset >= scanned,
      failures,
    };
  });
