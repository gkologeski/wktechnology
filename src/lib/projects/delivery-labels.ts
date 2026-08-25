// Rótulos PT-BR do acompanhamento macro de entrega (checkpoints de projeto).

export type DeliveryHealth = "green" | "yellow" | "red";
export type DeliveryUpdateKind = "checkpoint" | "auto";
export type DeliveryVisibility = "internal" | "commercial";

export const HEALTH_LABELS: Record<DeliveryHealth, string> = {
  green: "Verde",
  yellow: "Atenção",
  red: "Crítico",
};

export const HEALTH_VARIANT: Record<
  DeliveryHealth,
  "default" | "secondary" | "destructive" | "outline"
> = {
  green: "default",
  yellow: "secondary",
  red: "destructive",
};

export const KIND_LABELS: Record<DeliveryUpdateKind, string> = {
  checkpoint: "Checkpoint",
  auto: "Evento automático",
};

export const VISIBILITY_LABELS: Record<DeliveryVisibility, string> = {
  internal: "Interno",
  commercial: "Visível ao comercial",
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  planning: "Planejamento",
  active: "Execução",
  on_hold: "Em espera",
  done: "Concluído",
  cancelled: "Cancelado",
};

export function healthLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return HEALTH_LABELS[value as DeliveryHealth] ?? value;
}

export function projectStatusLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return PROJECT_STATUS_LABELS[value] ?? value;
}

export function formatDeliveryDate(value: string | null | undefined): string {
  if (!value) return "Sem previsão";
  const d = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(d.getTime())) return "Sem previsão";
  return d.toLocaleDateString("pt-BR");
}
