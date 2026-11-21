import { z } from "zod";
import { notificationRecipientRuleSchema } from "@/lib/notification-recipients";
import { validNotificationTimeZone } from "@/lib/notification-center-preferences";

export const NOTIFICATION_FOLLOWUP_EVENT_KEYS = [
  "contracts.contract.expiring",
  "contracts.contract.renewal_due",
  "projects.project.overdue",
  "projects.task.overdue",
  "projects.milestone.due",
  "people.document.expiring",
  "people.approval.pending",
  "finance.payable.due",
  "finance.receivable.due",
  "finance.payable.overdue",
  "finance.receivable.overdue",
  "finance.invoice.received",
] as const;

export function notificationFollowupEventAllowed(key: unknown): boolean {
  return (NOTIFICATION_FOLLOWUP_EVENT_KEYS as readonly unknown[]).includes(key);
}
export const notificationPrioritySchema = z.enum(["low", "normal", "high"]);
export const notificationEscalationRecipientSchema = notificationRecipientRuleSchema.refine(
  (recipient) => recipient.kind !== "followers",
  { message: "Seguidores não estão disponíveis para escalonamento." },
);
export const notificationFollowupSchema = z
  .object({
    reminder: z
      .object({
        interval_hours: z.number().int().min(1).max(168),
        max_occurrences: z.number().int().min(1).max(3),
      })
      .strict()
      .refine((value) => value.interval_hours * value.max_occurrences <= 168, {
        message: "Os lembretes devem terminar em até 168 horas.",
      })
      .optional(),
    escalation: z
      .object({
        after_hours: z.number().int().min(1).max(168),
        recipient: notificationEscalationRecipientSchema,
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((value) => value.reminder !== undefined || value.escalation !== undefined, {
    message: "Configure um lembrete ou um escalonamento explícito.",
  });
export type NotificationFollowup = z.infer<typeof notificationFollowupSchema>;
export type NotificationPriority = z.infer<typeof notificationPrioritySchema>;

export function notificationFollowupProblem(key: unknown, delivery: unknown): string | null {
  if (!delivery || typeof delivery !== "object") return null;
  const config = delivery as Record<string, unknown>;
  if (
    config.priority !== undefined &&
    !notificationPrioritySchema.safeParse(config.priority).success
  )
    return "Prioridade de aviso inválida.";
  if (config.followup === undefined) return null;
  if (!notificationFollowupSchema.safeParse(config.followup).success)
    return "Revise os intervalos e limites do acompanhamento; o horizonte máximo é 168 horas.";
  if (!notificationFollowupEventAllowed(key))
    return "Este evento não permite lembrete ou escalonamento automático.";
  if (!Array.isArray(config.channels) || !config.channels.includes("inapp"))
    return "O acompanhamento exige o aviso original no aplicativo.";
  if (
    key === "people.approval.pending" &&
    (config.followup as Record<string, unknown>).escalation !== undefined
  )
    return "A aprovação pendente permite somente lembrete ao aprovador vigente, sem escalonamento.";
  return null;
}

/** The complete published action tree is checked before filters or an earlier action can run. */
export function notificationSchedulingActionProblem(
  key: unknown,
  actions: readonly unknown[],
): string | null {
  for (const value of actions) {
    if (!value || typeof value !== "object") continue;
    const action = value as Record<string, unknown>;
    if (action.type === "send_notification") {
      const problem = notificationFollowupProblem(key, action.delivery);
      if (problem) return problem;
    }
    for (const name of ["then", "else", "default", "actions"]) {
      if (!Array.isArray(action[name])) continue;
      const problem = notificationSchedulingActionProblem(key, action[name] as unknown[]);
      if (problem) return problem;
    }
    for (const name of ["branches", "cases"]) {
      if (!Array.isArray(action[name])) continue;
      for (const child of action[name] as unknown[]) {
        if (
          !child ||
          typeof child !== "object" ||
          !Array.isArray((child as Record<string, unknown>).actions)
        )
          continue;
        const problem = notificationSchedulingActionProblem(
          key,
          (child as { actions: unknown[] }).actions,
        );
        if (problem) return problem;
      }
    }
  }
  return null;
}

const timezoneSchema = z
  .string()
  .min(1)
  .max(80)
  .refine(validNotificationTimeZone, "Informe um fuso horário IANA válido.");
export const notificationDigestSettingsSchema = z
  .object({
    enabled: z.boolean().default(false),
    frequency: z.enum(["daily", "weekly"]).default("daily"),
    at: z
      .string()
      .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
      .default("08:30"),
    timezone: timezoneSchema.default("America/Sao_Paulo"),
    weekday: z.number().int().min(1).max(7).default(1),
    channels: z
      .array(z.enum(["email", "whatsapp"]))
      .max(2)
      .refine((channels) => new Set(channels).size === channels.length, "Não repita um canal.")
      .default([]),
  })
  .strict()
  .refine((value) => !value.enabled || value.channels.length > 0, {
    path: ["channels"],
    message: "Escolha pelo menos um canal para habilitar o resumo.",
  });
export type NotificationDigestSettings = z.infer<typeof notificationDigestSettingsSchema>;
export const DEFAULT_NOTIFICATION_DIGEST_SETTINGS: NotificationDigestSettings =
  notificationDigestSettingsSchema.parse({});
export const notificationDigestSettingsResultSchema = z.object({
  settings: notificationDigestSettingsSchema,
  revision: z.number().int().min(0),
});
