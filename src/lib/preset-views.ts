import type { PresetView } from "@/lib/saved-views";

export const PRESET_VIEWS: Record<string, PresetView[]> = {
  leads: [
    { id: "preset:all", name: "Todos", filters: { type: "group", op: "and", conditions: [] } },
    { id: "preset:open", name: "Em aberto", filters: { type: "group", op: "and", conditions: [
      { type: "condition", field: "status", op: "neq", value: "disqualified" },
    ] } },
    { id: "preset:my", name: "Meus leads", filters: { type: "group", op: "and", conditions: [] } },
    { id: "preset:hot", name: "Quentes (score > 50)", filters: { type: "group", op: "and", conditions: [
      { type: "condition", field: "score", op: "gt", value: 50 },
    ] } },
  ],
  deals: [
    { id: "preset:all", name: "Todos", filters: { type: "group", op: "and", conditions: [] } },
    { id: "preset:open", name: "Em aberto", filters: { type: "group", op: "and", conditions: [
      { type: "condition", field: "stage", op: "neq", value: "won" },
      { type: "condition", field: "stage", op: "neq", value: "lost" },
    ] } },
    { id: "preset:won", name: "Ganhos", filters: { type: "group", op: "and", conditions: [
      { type: "condition", field: "stage", op: "eq", value: "won" },
    ] } },
    { id: "preset:lost", name: "Perdidos", filters: { type: "group", op: "and", conditions: [
      { type: "condition", field: "stage", op: "eq", value: "lost" },
    ] } },
  ],
  contacts: [
    { id: "preset:all", name: "Todos", filters: { type: "group", op: "and", conditions: [] } },
    { id: "preset:marketing", name: "Marketing OK", filters: { type: "group", op: "and", conditions: [
      { type: "condition", field: "marketing_status", op: "eq", value: "marketing" },
    ] } },
    { id: "preset:hot", name: "Quentes (score > 50)", filters: { type: "group", op: "and", conditions: [
      { type: "condition", field: "score", op: "gt", value: 50 },
    ] } },
  ],
  companies: [
    { id: "preset:all", name: "Todas", filters: { type: "group", op: "and", conditions: [] } },
    { id: "preset:targets", name: "Target Accounts", filters: { type: "group", op: "and", conditions: [
      { type: "condition", field: "is_target_account", op: "eq", value: true },
    ] } },
  ],
};
