import { z } from "zod";
import type { RequestKind } from "./types";

/** Read model returned by `hiring_execution_ops_context` (0382). Fiscal is null without the fiscal view key. */
export type OpsHistoryItem = {
  type: "version" | "submission" | "accepted" | "rejected";
  version: number;
  at: string;
  by: string | null;
  text: string;
  title?: string;
};
export type OpsDelivery = {
  id: string;
  version: number;
  status: "open" | "submitted" | "accepted" | "rejected";
  current: {
    title: string;
    criteria: string;
    period_start: string;
    period_end: string;
    responsible_id: string;
    responsible_name: string | null;
    project_id: string | null;
    milestone_id: string | null;
    project_name: string | null;
    content_hash: string;
  };
  can_decide: boolean;
  history: OpsHistoryItem[];
};
export type OpsFiscal = {
  id: string;
  status: "registered" | "verified" | "rejected";
  doc_type: FiscalDocType;
  modality: FreelanceModality | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  issuer_tax_id: string;
  taker_tax_id: string | null;
  amount: number;
  currency: string;
  document_number: string;
  issued_on: string;
  delivery_id: string | null;
  uploaded_by_name: string | null;
  registered_at: string;
  review: { decision: string; reason: string; at: string; by: string | null } | null;
  can_review: boolean;
};
export type OpsContext = {
  started: boolean;
  proof_problem: string | null;
  kind: RequestKind;
  regime: "clt" | "pj" | "freelance" | null;
  period: { starts_at: string; ends_at: string | null } | null;
  can_manage_deliveries: boolean;
  can_register_fiscal: boolean;
  can_view_fiscal: boolean;
  deliveries: OpsDelivery[];
  fiscal: OpsFiscal[] | null;
  eligible_responsibles: Array<{ id: string; name: string | null }>;
};
export type FiscalDocType = "payroll_evidence" | "nfse" | "nfe" | "freelance_document";
export type FreelanceModality = "nfse" | "rpa" | "recibo";

export const deliveryStatusLabel: Record<OpsDelivery["status"], string> = {
  open: "Aberta",
  submitted: "Aguardando aceite",
  accepted: "Aceita",
  rejected: "Rejeitada",
};
export const fiscalStatusLabel: Record<OpsFiscal["status"], string> = {
  registered: "Aguardando conferência do Financeiro",
  verified: "Conferido pelo Financeiro",
  rejected: "Rejeitado pelo Financeiro",
};
export const fiscalTypeLabel: Record<FiscalDocType, string> = {
  payroll_evidence: "Evidência de folha (CLT)",
  nfse: "NFS-e",
  nfe: "NF-e",
  freelance_document: "Documento do freelance",
};
export const modalityLabel: Record<FreelanceModality, string> = {
  nfse: "NFS-e",
  rpa: "RPA",
  recibo: "Recibo",
};

/** Document types the database accepts for each origin; mirrors 0382 (the server is the authority). */
export function allowedFiscalTypes(
  kind: RequestKind,
  regime: OpsContext["regime"],
): FiscalDocType[] {
  if (kind === "supplier" || regime === "pj") return ["nfse", "nfe"];
  if (regime === "clt") return ["payroll_evidence"];
  if (regime === "freelance") return ["freelance_document"];
  return [];
}

/** Accepted upload types; content is also checked by magic bytes on the server. */
export const FISCAL_MIME = [
  "application/pdf",
  "application/xml",
  "text/xml",
  "image/png",
  "image/jpeg",
] as const;
export const FISCAL_MAX_BYTES = 10 * 1024 * 1024;

/** Detects the real file type from its first bytes; returns null when not an accepted type. */
export function sniffFiscalMime(bytes: Uint8Array): (typeof FISCAL_MIME)[number] | null {
  const head = (n: number) => [...bytes.slice(0, n)];
  const eq = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (eq([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  if (eq([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (eq([0xff, 0xd8, 0xff])) return "image/jpeg";
  const text = String.fromCharCode(
    ...head(64).filter((b) => b !== 0xef && b !== 0xbb && b !== 0xbf),
  ).trimStart();
  if (text.startsWith("<?xml") || text.startsWith("<")) return "application/xml";
  return null;
}

export const formatTaxId = (d: string | null) =>
  !d
    ? "—"
    : d.length === 14
      ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
      : d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");

export const opsDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const opsId = z.string().uuid();
