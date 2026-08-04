// Opções de lembrete para tarefas/atividades (minutos antes do vencimento).
export const REMINDER_OPTIONS = [
  { value: "0", label: "Na hora do vencimento" },
  { value: "5", label: "5 minutos antes" },
  { value: "15", label: "15 minutos antes" },
  { value: "30", label: "30 minutos antes" },
  { value: "60", label: "1 hora antes" },
  { value: "120", label: "2 horas antes" },
  { value: "1440", label: "1 dia antes" },
] as const;

export function reminderLabel(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "Sem lembrete";
  return REMINDER_OPTIONS.find((o) => o.value === String(minutes))?.label ?? `${minutes} min antes`;
}
