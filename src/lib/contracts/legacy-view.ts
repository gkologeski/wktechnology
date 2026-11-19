// LEGADO-REGULARIZA: regras puras de exibição do painel de contrato legado (sem dados nem ações).
import type { LegacySituation } from "./legacy-types";

export type LegacyEvent = {
  kind: "recognized" | "rebased" | "evidence_reserved" | "evidence_attested" | "regularized";
  revision: number;
  actor_id: string;
  created_at: string;
  /** Somente o motivo textual chega à tela; demais detalhes ficam na trilha do banco. */
  reason: string | null;
};
export type LegacyEvidence = {
  id: string;
  file_name: string;
  sha256: string;
  size: number;
  status: "pending_upload" | "attested" | "used" | "superseded";
  revision: number;
};
export type LegacyState = {
  contract_id: string;
  eligible_problem: string | null;
  record: null | {
    id: string;
    status: "pending" | "regularized";
    revision: number;
    situation: LegacySituation | null;
    stale: boolean;
    recognized_at: string;
    regularized_at: string | null;
  };
  events: LegacyEvent[];
  evidence: LegacyEvidence[];
};
/** Resultado do servidor: `denied` só quando a RPC negou a chave/acesso; falhas viram erro, nunca "não legado". */
export type LegacyLoad =
  | { access: "denied"; classification: "pending" | "regularized" | null }
  | { access: "granted"; state: LegacyState };

export type LegacyMode =
  | "loading"
  | "error"
  | "denied"
  | "restricted_pending"
  | "restricted_regularized"
  | "ineligible"
  | "eligible"
  | "pending"
  | "stale"
  | "regularized";

export function legacyMode(q: {
  isLoading: boolean;
  isError: boolean;
  data?: LegacyLoad;
}): LegacyMode {
  if (q.isLoading) return "loading";
  if (q.isError || !q.data) return "error";
  if (q.data.access === "denied")
    return q.data.classification === "pending"
      ? "restricted_pending"
      : q.data.classification === "regularized"
        ? "restricted_regularized"
        : "denied";
  const { record, eligible_problem } = q.data.state;
  if (!record) return eligible_problem ? "ineligible" : "eligible";
  if (record.status === "regularized") return "regularized";
  return record.stale ? "stale" : "pending";
}

/** Fluxos comerciais/assinatura novos ficam ocultos enquanto a situação não é conhecidamente "não legado". */
export type LegacyGate = "none" | "pending" | "regularized" | "unknown";
export function legacyGate(mode: LegacyMode): LegacyGate {
  if (mode === "pending" || mode === "stale" || mode === "restricted_pending") return "pending";
  if (mode === "regularized" || mode === "restricted_regularized") return "regularized";
  if (mode === "loading" || mode === "error") return "unknown";
  return "none";
}

export function missingBeforeRegularize(c: {
  counterparty_company_id?: string | null;
  contracting_legal_entity_id?: string | null;
  body_html?: string | null;
  source_file_path?: string | null;
}): string[] {
  const out: string[] = [];
  if (!c.counterparty_company_id) out.push("Contraparte (empresa)");
  if (!c.contracting_legal_entity_id) out.push("Entidade legal WK");
  if (!c.source_file_path) out.push("Arquivo importado de origem");
  return out;
}

export function todayIso(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
export function isFutureStart(startsOn: string | null, today: string): boolean {
  return !!startsOn && startsOn > today;
}

export type RegularizeDraft = {
  situation: LegacySituation | "";
  signedOn: string | null;
  signatureConfirmed: boolean;
  startsOn: string | null;
  endsOn: string | null;
  terminatedOn: string | null;
  autoRenew: boolean;
  autoRenewConfirmed: boolean;
  externalReference: string;
  reason: string;
  evidenceReady: boolean;
};
/** Espelho local das regras do banco, só para orientar o formulário; o banco continua decidindo. */
export function regularizeBlockers(d: RegularizeDraft, today: string): string[] {
  const out: string[] = [];
  if (!d.evidenceReady) out.push("Envie o PDF do original assinado e aguarde a confirmação.");
  if (!d.situation) out.push("Escolha a situação.");
  if (!d.signedOn || !d.signatureConfirmed)
    out.push("Informe e confirme a data da assinatura humana conferida no original.");
  if (d.signedOn && (d.signedOn < "1990-01-01" || d.signedOn > today))
    out.push("Data de assinatura implausível.");
  if (!d.startsOn || d.startsOn < "1990-01-01")
    out.push("Informe um início de vigência plausível.");
  if (isFutureStart(d.startsOn, today))
    out.push(
      "Vigência futura ainda não pode ser regularizada: o contrato fica pendente para não antecipar operação ou cobrança.",
    );
  if (d.startsOn && d.endsOn && d.endsOn < d.startsOn)
    out.push("Fim da vigência deve ser igual ou posterior ao início.");
  if (d.autoRenew && !d.autoRenewConfirmed)
    out.push("Confirme que conferiu a cláusula de renovação automática.");
  if (d.situation === "ended" && (!d.endsOn || d.endsOn >= today))
    out.push("Encerrado exige fim de vigência passado.");
  if (d.situation === "terminated" && (!d.terminatedOn || d.terminatedOn > today))
    out.push("Rescindido exige data de rescisão até hoje.");
  if (d.externalReference.trim().length < 3) out.push("Informe a referência do documento/origem.");
  if (d.reason.trim().length < 5) out.push("Informe a justificativa.");
  return out;
}

export const LEGACY_EVENT_LABEL: Record<LegacyEvent["kind"], string> = {
  recognized: "Reconhecido como legado",
  rebased: "Reconhecido novamente após revisão do documento",
  evidence_reserved: "PDF assinado enviado",
  evidence_attested: "PDF assinado conferido pelo servidor",
  regularized: "Regularizado",
};

/** Texto do cartão de assinatura quando o contrato é (ou pode ser) legado. */
export function legacyNotice(gate: Exclude<LegacyGate, "none">): string {
  if (gate === "regularized")
    return "Contrato legado regularizado com o original assinado. Não há nova assinatura; alterações somente por aditivo.";
  if (gate === "pending")
    return "Contrato legado em regularização: a assinatura é comprovada pelo PDF original assinado, não por um novo envio.";
  return "Verificando se o contrato é legado. Envio para assinatura fica oculto até a verificação.";
}

/** SQL returns evidence in reservation order. Never silently confirm an older upload. */
export function latestLegacyEvidence(
  evidence: LegacyEvidence[],
  revision: number,
): LegacyEvidence | null {
  return (
    [...evidence].reverse().find((e) => e.status === "attested" && e.revision === revision) ?? null
  );
}
