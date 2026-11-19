import { z } from "zod";
import { requestKind, type PreparationRow } from "./types";
export const approvalInput = z
  .object({ kind: requestKind, id: z.string().uuid(), revision: z.number().int().positive() })
  .strict();
export const approvalDecisionInput = approvalInput.extend({
  approval: z.string().uuid(),
  stage: z.enum(["manager", "ceo"]),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().min(5, "Informe um motivo com ao menos 5 caracteres.").max(2000),
  operation: z.string().uuid(),
});
export type ApprovalEvent = {
  id: string;
  revision: number;
  actor_id: string;
  stage: "manager" | "ceo" | null;
  kind: "requested" | "approved" | "rejected" | "superseded";
  note: string;
  created_at: string;
};
export type ApprovalContext = {
  request: PreparationRow;
  status: "not_requested" | "pending" | "approved" | "rejected" | "superseded";
  approval_id: string | null;
  stage: "manager" | "ceo" | null;
  approver_id: string | null;
  manager_id: string | null;
  ceo_id: string | null;
  problem: string | null;
  can_request: boolean;
  can_decide: boolean;
  events: ApprovalEvent[];
};
export const approvalLabels = {
  not_requested: "Aprovação não solicitada",
  pending: "Aguardando decisão",
  approved: "Aprovada",
  rejected: "Rejeitada",
  superseded: "Aprovação invalidada",
};
export const approvalEventLabels = {
  requested: "Aprovação solicitada",
  approved: "Aprovada",
  rejected: "Rejeitada",
  superseded: "Decisões invalidadas",
};
