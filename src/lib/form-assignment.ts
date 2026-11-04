import type { AssignmentMode } from "@/lib/whatsapp/campaign-assignment";

/** Formulários sempre geram Lead/Contato com responsável; não há modo "desatribuído". */
export const FORM_ASSIGNMENT_MODES = [
  "auto",
  "member",
  "round_robin",
] as const satisfies readonly AssignmentMode[];
export type FormAssignmentMode = (typeof FORM_ASSIGNMENT_MODES)[number];

export const FORM_ASSIGNMENT_LABELS: Record<FormAssignmentMode, string> = {
  auto: "Dono do formulário (padrão)",
  member: "Membro específico",
  round_robin: "Dividir entre membros da equipe",
};

export const FORM_ASSIGNMENT_HELP: Record<FormAssignmentMode, string> = {
  auto: "Novas inscrições ficam com quem criou o formulário.",
  member: "Todas as novas inscrições vão para a pessoa escolhida.",
  round_robin: "As novas inscrições são divididas em rodízio entre os membros marcados.",
};

/** Responsável de uma inscrição nova: o sorteado pela regra ou, sem ninguém ativo, o dono. */
export function pickFormAssignee(ruleAssignee: string | null, ownerId: string): string {
  return ruleAssignee ?? ownerId;
}
