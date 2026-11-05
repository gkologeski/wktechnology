export type SignatureContext = {
  hash: string;
  reason: string | null;
  deal_id: string | null;
  entity_id: string | null;
  can_manage: boolean;
  commercial_source: boolean;
  entities: { id: string; name: string; cnpj: string | null }[];
  evidence: {
    id: string;
    kind: "native" | "external";
    document_id: string | null;
    current_version: boolean;
    recorded_at: string;
    signed_on: string | null;
    reference: string | null;
    note: string;
    revoked_at: string | null;
    revocation_reason: string | null;
  }[];
};
export type RecruitmentContext = {
  ready: boolean;
  reason: string | null;
  governed: boolean;
  kind: string;
  contract_id: string | null;
  revision: number;
  contracts: { id: string; title: string; number: string | null; reason: string | null }[];
};
