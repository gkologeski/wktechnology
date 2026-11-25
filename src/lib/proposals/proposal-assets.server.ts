import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { describePaymentTerms, parsePaymentTerms } from "@/lib/sales/payment-terms";
import { collectVisualStoragePaths, type VisualDesign } from "./visual-design";
import type { VisualRenderContext, VisualRenderItem } from "./visual-renderer";

export const PROPOSAL_ASSETS_BUCKET = "proposal-assets";
export const PROPOSAL_ASSETS_MAX_BYTES = 5 * 1024 * 1024;
export const PROPOSAL_ASSETS_ALLOWED_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
] as const;
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hora

export function slugifyProposalAssetName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name) || "imagem";
  const ext =
    dot > 0
      ? name
          .slice(dot)
          .toLowerCase()
          .replace(/[^a-z0-9.]/g, "")
      : ".png";
  const safeBase =
    base
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 48) || "imagem";
  return `${safeBase}${ext || ".png"}`;
}

export function isValidWorkspaceAssetPath(path: string, workspaceId: string): boolean {
  if (!path || path.includes("..") || path.startsWith("/")) return false;
  return path.startsWith(`${workspaceId}/`);
}

/** Assina apenas caminhos pertencentes ao workspace especificado no bucket privado proposal-assets. */
export async function signProposalAssetPaths(
  paths: string[],
  workspaceId: string,
): Promise<Record<string, string>> {
  const safe = [...new Set(paths)].filter((p) => isValidWorkspaceAssetPath(p, workspaceId));
  if (!safe.length) return {};
  const { data, error } = await supabaseAdmin.storage
    .from(PROPOSAL_ASSETS_BUCKET)
    .createSignedUrls(safe, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const row of data) {
    if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
  }
  return map;
}

export async function signDesignAssets(
  design: VisualDesign,
  workspaceId: string,
): Promise<Record<string, string>> {
  const paths = collectVisualStoragePaths(design);
  if (!paths.length) return {};
  return signProposalAssetPaths(paths, workspaceId);
}

export type ProposalVisualSourceInput = {
  workspaceId: string;
  title: string;
  currency: string;
  totalAmount: number | null;
  createdAt: string;
  expiresAt: string | null;
  validityDays?: number | null;
  paymentMethod?: string | null;
  installmentsCount?: number | null;
  paymentTerms?: unknown;
  companyName: string | null;
  companyLegalName?: string | null;
  companyCnpj?: string | null;
  contactName: string | null;
  contactEmail: string | null;
  dealName?: string | null;
  agentName: string | null;
  legalEntityId?: string | null;
  items: VisualRenderItem[];
};

const PAYMENT_METHOD_PT: Record<string, string> = {
  pix: "PIX",
  boleto: "Boleto bancário",
  transfer: "Transferência bancária",
  card: "Cartão de crédito",
};

export async function buildProposalVisualContext(
  sb: SupabaseClient,
  input: ProposalVisualSourceInput,
  design?: VisualDesign | null,
): Promise<VisualRenderContext> {
  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: input.currency || "BRL" }).format(
      v,
    );
  const formatDate = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString("pt-BR") : "";

  const [entityRes, brandingRes, signedUrls] = await Promise.all([
    input.legalEntityId
      ? sb
          .from("legal_entities")
          .select("name, trade_name, cnpj, logo_url")
          .eq("id", input.legalEntityId)
          .eq("workspace_id", input.workspaceId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    sb
      .from("workspace_branding")
      .select("logo_url")
      .eq("workspace_id", input.workspaceId)
      .maybeSingle(),
    design ? signDesignAssets(design, input.workspaceId) : Promise.resolve({}),
  ]);

  const entity = entityRes.data as {
    name: string;
    trade_name: string | null;
    cnpj: string | null;
    logo_url: string | null;
  } | null;
  const branding = brandingRes.data as { logo_url: string | null } | null;

  const parsedTerms = parsePaymentTerms(input.paymentTerms);
  const termsSummary = parsedTerms ? describePaymentTerms(parsedTerms) : "";
  const instCount = input.installmentsCount ?? null;
  const instVal =
    instCount && instCount > 0 && input.totalAmount != null
      ? fmt(input.totalAmount / instCount)
      : "";
  const pmLabel = input.paymentMethod
    ? (PAYMENT_METHOD_PT[input.paymentMethod] ?? input.paymentMethod)
    : "";
  const installmentsSummary =
    termsSummary ||
    (instCount && instVal
      ? `${instCount}x de ${instVal}${pmLabel ? ` via ${pmLabel}` : ""}`
      : pmLabel || "Condições conforme proposta");

  return {
    proposalTitle: input.title,
    companyName: input.companyName,
    companyLegalName: input.companyLegalName ?? input.companyName,
    companyCnpj: input.companyCnpj ?? "",
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    dealName: input.dealName ?? input.title,
    total: input.totalAmount != null ? fmt(input.totalAmount) : "",
    validUntil: formatDate(input.expiresAt),
    validityDays: input.validityDays ?? "",
    date: formatDate(input.createdAt),
    contractingName: entity?.trade_name || entity?.name || "",
    contractingCnpj: entity?.cnpj ?? "",
    contractingLogoUrl: entity?.logo_url ?? null,
    workspaceLogoUrl: branding?.logo_url ?? null,
    agentName: input.agentName,
    paymentMethod: pmLabel,
    installmentsCount: instCount ?? "",
    installmentValue: instVal,
    installmentsSummary,
    paymentTermsSummary: termsSummary || installmentsSummary,
    items: input.items,
    signedUrls,
  };
}
