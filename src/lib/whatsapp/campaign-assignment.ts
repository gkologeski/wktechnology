import { z } from "zod";

/** Como as conversas geradas por uma campanha WhatsApp recebem responsável. */
export const ASSIGNMENT_MODES = ["auto", "member", "round_robin", "unassigned"] as const;
export type AssignmentMode = (typeof ASSIGNMENT_MODES)[number];

export const ASSIGNMENT_MODE_LABELS: Record<AssignmentMode, string> = {
  auto: "Central de Distribuição (padrão)",
  member: "Membro específico",
  round_robin: "Dividir entre membros da equipe",
  unassigned: "Desatribuídas",
};

export const AssignmentInput = z.object({
  assignment_mode: z.enum(ASSIGNMENT_MODES),
  assignment_member_ids: z.array(z.string().uuid()).max(100).default([]),
});
export type AssignmentConfig = z.infer<typeof AssignmentInput>;

/** Normaliza e valida a regra (sem consultar o banco). */
export function normalizeAssignment(cfg: AssignmentConfig): AssignmentConfig {
  const ids = [...new Set(cfg.assignment_member_ids)];
  if (cfg.assignment_mode === "member") {
    if (ids.length !== 1)
      throw new Error("Escolha exatamente um membro para receber as conversas.");
    return { assignment_mode: "member", assignment_member_ids: ids };
  }
  if (cfg.assignment_mode === "round_robin") {
    if (ids.length < 2) throw new Error("Escolha ao menos dois membros para dividir as conversas.");
    return { assignment_mode: "round_robin", assignment_member_ids: ids };
  }
  return { assignment_mode: cfg.assignment_mode, assignment_member_ids: [] };
}

/** Escolha do rodízio: mesma regra da função do banco (membros ativos, em ordem). */
export function pickRoundRobin(activeIds: string[], cursor: number): string | null {
  if (activeIds.length === 0) return null;
  return activeIds[cursor % activeIds.length] ?? null;
}
