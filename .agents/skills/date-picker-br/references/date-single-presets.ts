import { addDays, startOfDay, subDays } from "date-fns";

export type SinglePresetKey = "custom" | "yesterday" | "today" | "tomorrow";

export type SinglePreset = {
  key: SinglePresetKey;
  label: string;
};

/** Ordem exibida na UI: "Personalizado" sempre no topo. */
export const SINGLE_PRESETS: SinglePreset[] = [
  { key: "custom", label: "Personalizado" },
  { key: "yesterday", label: "Ontem" },
  { key: "today", label: "Hoje" },
  { key: "tomorrow", label: "Amanhã" },
];

/**
 * Data de um preset, sempre no início do dia.
 * `custom` não tem data própria (retorna `null`): apenas habilita o calendário.
 */
export function getSinglePresetDate(key: SinglePresetKey, now: Date = new Date()): Date | null {
  switch (key) {
    case "yesterday":
      return startOfDay(subDays(now, 1));
    case "today":
      return startOfDay(now);
    case "tomorrow":
      return startOfDay(addDays(now, 1));
    case "custom":
    default:
      return null;
  }
}

/** Preset que corresponde exatamente a uma data, ou "custom". */
export function presetForDate(date: Date, now: Date = new Date()): SinglePresetKey {
  const target = startOfDay(date).getTime();
  for (const key of ["yesterday", "today", "tomorrow"] as const) {
    const d = getSinglePresetDate(key, now);
    if (d && d.getTime() === target) return key;
  }
  return "custom";
}
