import { z } from "zod";
import { ASSIGNMENT_MODES, type AssignmentMode } from "@/lib/whatsapp/campaign-assignment";

/** Quem recebe as reuniões marcadas pela assistente de voz (mesmos modos do WhatsApp). */
export const MEETING_ASSIGNMENT_LABELS: Record<AssignmentMode, string> = {
  auto: "Responsável do Lead/Contato",
  member: "Membro específico",
  round_robin: "Dividir entre membros da equipe",
  unassigned: "Sem agendamento na ligação",
};

export const MEETING_ASSIGNMENT_HELP: Record<AssignmentMode, string> = {
  auto: "A reunião vai para a agenda do responsável pelo Lead/Contato. Sem agenda conectada, os horários seguem pelo WhatsApp.",
  member: "Todas as reuniões desta campanha vão para a agenda da pessoa escolhida.",
  round_robin: "As reuniões são divididas em rodízio, igualmente, entre os membros marcados.",
  unassigned: "A assistente não marca na ligação; combina de enviar os horários pelo WhatsApp.",
};

export const MeetingAssignmentInput = z.object({
  meeting_assignment_mode: z.enum(ASSIGNMENT_MODES).default("unassigned"),
  meeting_member_ids: z.array(z.string().uuid()).max(100).default([]),
  meeting_duration_minutes: z.number().int().min(15).max(120).default(30),
  meeting_horizon_days: z.number().int().min(1).max(30).default(7),
  meeting_template_name: z.string().max(200).nullable().default(null),
  meeting_template_language: z.string().max(20).nullable().default(null),
});
export type MeetingAssignment = z.infer<typeof MeetingAssignmentInput>;

/** Normaliza e valida; lança erro em português. */
export function normalizeMeetingAssignment(cfg: MeetingAssignment): MeetingAssignment {
  const ids = [...new Set(cfg.meeting_member_ids)];
  const mode = cfg.meeting_assignment_mode;
  if (mode === "member" && ids.length !== 1)
    throw new Error("Escolha exatamente um membro para receber as reuniões.");
  if (mode === "round_robin" && ids.length < 2)
    throw new Error("Escolha ao menos dois membros para dividir as reuniões.");
  return {
    ...cfg,
    meeting_member_ids: mode === "member" || mode === "round_robin" ? ids : [],
  };
}

/** Membros escolhidos que não têm agenda conectada (bloqueiam o Iniciar). */
export function membersWithoutCalendar(
  cfg: Pick<MeetingAssignment, "meeting_assignment_mode" | "meeting_member_ids">,
  withCalendar: Set<string>,
): string[] {
  if (cfg.meeting_assignment_mode !== "member" && cfg.meeting_assignment_mode !== "round_robin")
    return [];
  return cfg.meeting_member_ids.filter((id) => !withCalendar.has(id));
}
