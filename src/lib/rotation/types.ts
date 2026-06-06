// Tipos da Distribuição (rotação) de Leads e Negócios.
import type { WorkflowFilter } from "@/lib/workflows/types";

export type RotationEntity = "leads" | "deals" | "tickets";
export type RotationStrategy = "round_robin" | "weighted";

export interface RotationAssignee {
  user_id: string;
  weight: number;
}

export interface RotationRule {
  id: string;
  owner_id: string;
  name: string;
  entity: RotationEntity;
  enabled: boolean;
  strategy: RotationStrategy;
  filters: WorkflowFilter[];
  assignees: RotationAssignee[];
  last_index: number;
  last_assigned_user_id: string | null;
  last_assigned_at: string | null;
  updated_at: string;
}

export const STRATEGY_LABELS: Record<RotationStrategy, string> = {
  round_robin: "Round-robin (rodízio)",
  weighted: "Ponderada (por peso)",
};

export const ROT_ENTITY_LABELS: Record<RotationEntity, string> = {
  leads: "Leads",
  deals: "Negócios",
  tickets: "Tickets",
};
