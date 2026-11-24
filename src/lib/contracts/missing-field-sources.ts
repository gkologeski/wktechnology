export type MissingDraftField = {
  key: string;
  label: string;
  group: string;
};

export type DraftMissingSources = {
  legalEntityId: string | null;
  companyId: string | null;
  proposalId: string | null;
  dealId: string | null;
  isPurchase: boolean;
};

export type MissingFieldDestination =
  | { kind: "legal_entity"; id: string }
  | { kind: "company"; id: string }
  | { kind: "proposal"; id: string }
  | { kind: "deal"; id: string }
  | { kind: "none" };

export type MissingFieldGroup = {
  id: "legal_entity" | "counterparty" | "proposal" | "deal" | "other";
  sourceLabel: string;
  actionLabel: string;
  labels: string[];
  destination: MissingFieldDestination;
  requiredPermissions: string[];
  deniedReason: string;
};

const LEGAL_ENTITY_VIEW_PERMS = [
  "techfinance.legal_entities.view.workspace",
  "techfinance.legal_entities.view.team",
  "techfinance.legal_entities.view.own",
];
const COMPANY_VIEW_PERMS = [
  "techsales.companies.view.workspace",
  "techsales.companies.view.team",
  "techsales.companies.view.own",
];
const PROPOSAL_VIEW_PERMS = [
  "techsales.proposals.view.workspace",
  "techsales.proposals.view.team",
  "techsales.proposals.view.own",
];
const DEAL_VIEW_PERMS = [
  "techsales.deals.view.workspace",
  "techsales.deals.view.team",
  "techsales.deals.view.own",
];

const GROUP_ORDER: MissingFieldGroup["id"][] = [
  "legal_entity",
  "counterparty",
  "proposal",
  "deal",
  "other",
];

function bucketForField(
  field: MissingDraftField,
  sources: DraftMissingSources,
): Omit<MissingFieldGroup, "labels"> {
  if (field.group === "Contratante") {
    return {
      id: "legal_entity",
      sourceLabel: sources.isPurchase ? "Empresa contratante (WK)" : "Empresa prestadora",
      actionLabel: "Abrir cadastro",
      destination: sources.legalEntityId
        ? { kind: "legal_entity", id: sources.legalEntityId }
        : { kind: "none" },
      requiredPermissions: LEGAL_ENTITY_VIEW_PERMS,
      deniedReason: "Sem permissão para abrir Empresas e CNPJs do workspace.",
    };
  }
  if (field.group === "Contraparte" || field.group === "Signatário" || field.group === "Contato") {
    return {
      id: "counterparty",
      sourceLabel: sources.isPurchase ? "Fornecedor/signatário" : "Cliente/signatário",
      actionLabel: "Abrir cadastro",
      destination: sources.companyId
        ? { kind: "company", id: sources.companyId }
        : { kind: "none" },
      requiredPermissions: COMPANY_VIEW_PERMS,
      deniedReason: sources.isPurchase
        ? "Sem permissão para abrir o cadastro do fornecedor."
        : "Sem permissão para abrir o cadastro da empresa cliente.",
    };
  }
  if (field.group === "Proposta Comercial" || field.group === "Contrato") {
    if (sources.proposalId) {
      return {
        id: "proposal",
        sourceLabel: "Proposta comercial",
        actionLabel: "Abrir proposta",
        destination: { kind: "proposal", id: sources.proposalId },
        requiredPermissions: PROPOSAL_VIEW_PERMS,
        deniedReason: "Sem permissão para abrir a proposta comercial.",
      };
    }
    if (sources.dealId) {
      return {
        id: "deal",
        sourceLabel: "Negócio",
        actionLabel: "Abrir negócio",
        destination: { kind: "deal", id: sources.dealId },
        requiredPermissions: DEAL_VIEW_PERMS,
        deniedReason: "Sem permissão para abrir o negócio.",
      };
    }
  }
  if (field.group === "Negócio" && sources.dealId) {
    return {
      id: "deal",
      sourceLabel: "Negócio",
      actionLabel: "Abrir negócio",
      destination: { kind: "deal", id: sources.dealId },
      requiredPermissions: DEAL_VIEW_PERMS,
      deniedReason: "Sem permissão para abrir o negócio.",
    };
  }
  return {
    id: "other",
    sourceLabel: "Outros dados",
    actionLabel: "",
    destination: { kind: "none" },
    requiredPermissions: [],
    deniedReason: "",
  };
}

/** Agrupa campos pendentes da minuta por cadastro de origem, preservando a ordem dos rótulos. */
export function groupMissingDraftFields(
  fields: MissingDraftField[],
  sources: DraftMissingSources,
): MissingFieldGroup[] {
  if (fields.length === 0) return [];
  const buckets = new Map<MissingFieldGroup["id"], MissingFieldGroup>();
  for (const field of fields) {
    const meta = bucketForField(field, sources);
    const existing = buckets.get(meta.id);
    if (existing) {
      if (!existing.labels.includes(field.label)) existing.labels.push(field.label);
    } else {
      buckets.set(meta.id, { ...meta, labels: [field.label] });
    }
  }
  return GROUP_ORDER.flatMap((id) => {
    const item = buckets.get(id);
    return item ? [item] : [];
  });
}
