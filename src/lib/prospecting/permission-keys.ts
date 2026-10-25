// Chaves granulares de permissão da Suíte de Prospecção.
// Módulo puro (sem React/Supabase) — usado tanto no gate server-side
// (assertAnyPermission) quanto na UI (usePermissions).

const P = "techsales";

/** Fila de prospecção */
export const QUEUE_VIEW = [
  `${P}.prospecting_queue.view.workspace`,
  `${P}.prospecting_queue.view.team`,
  `${P}.prospecting_queue.view.own`,
] as const;
export const QUEUE_CREATE = [
  `${P}.prospecting_queue.create.workspace`,
  `${P}.prospecting_queue.create.own`,
] as const;
export const QUEUE_UPDATE = [
  `${P}.prospecting_queue.update.workspace`,
  `${P}.prospecting_queue.update.own`,
] as const;
export const QUEUE_DELETE = [
  `${P}.prospecting_queue.delete.workspace`,
  `${P}.prospecting_queue.delete.own`,
] as const;
export const QUEUE_UPDATE_WORKSPACE = `${P}.prospecting_queue.update.workspace`;
export const QUEUE_DELETE_WORKSPACE = `${P}.prospecting_queue.delete.workspace`;

/** Cadências */
export const CADENCES_VIEW = [
  `${P}.prospecting_cadences.view.workspace`,
  `${P}.prospecting_cadences.view.own`,
] as const;
export const CADENCES_CREATE = [
  `${P}.prospecting_cadences.create.workspace`,
  `${P}.prospecting_cadences.create.own`,
] as const;
export const CADENCES_UPDATE = [
  `${P}.prospecting_cadences.update.workspace`,
  `${P}.prospecting_cadences.update.own`,
] as const;
export const CADENCES_DELETE = [
  `${P}.prospecting_cadences.delete.workspace`,
  `${P}.prospecting_cadences.delete.own`,
] as const;

/** Questionários */
export const QUESTIONNAIRES_VIEW = [
  `${P}.prospecting_questionnaires.view.workspace`,
  `${P}.prospecting_questionnaires.view.own`,
] as const;
export const QUESTIONNAIRES_CREATE = [
  `${P}.prospecting_questionnaires.create.workspace`,
  `${P}.prospecting_questionnaires.create.own`,
] as const;
export const QUESTIONNAIRES_UPDATE = [
  `${P}.prospecting_questionnaires.update.workspace`,
  `${P}.prospecting_questionnaires.update.own`,
] as const;
export const QUESTIONNAIRES_DELETE = [
  `${P}.prospecting_questionnaires.delete.workspace`,
  `${P}.prospecting_questionnaires.delete.own`,
] as const;

export const asKeys = (keys: readonly string[]): string[] => [...keys];
