/** LEGADO-REGULARIZA: modelos puros (sem banco) da regularização de contratos legados importados. */
export const LEGACY_EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;
export type LegacySituation = "in_force" | "ended" | "terminated";
export type LegacyRecordStatus = "pending" | "regularized";
export const LEGACY_SITUATION_LABEL: Record<LegacySituation, string> = {
  in_force: "Em vigor",
  ended: "Encerrado",
  terminated: "Rescindido",
};
export interface LegacyRegularizeInput {
  contractId: string;
  expectedRevision: number;
  situation: LegacySituation;
  signedOn: string;
  signatureConfirmed: boolean;
  startsOn: string;
  endsOn: string | null;
  terminatedOn: string | null;
  autoRenew: boolean;
  autoRenewConfirmed: boolean;
  evidenceId: string;
  evidenceSha256: string;
  externalReference: string;
  reason: string;
  operationId: string;
}
/** Original assinado precisa ser PDF real (assinatura %PDF-); DOCX de minuta nunca é evidência. */
export function isPdfBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}
