// Chaves granulares de permissão da Suíte de Prospecção.
// Módulo puro (sem React/Supabase) — usado tanto no gate server-side
// (assertAnyPermission) quanto na UI (usePermissions).

const P = "techsales.prospecting";

/** Fila de prospecção */
export const QUEUE_VIEW = [
  `${P}.queue.view`,
  `${P}.queue.view.team`,
  `${P}.queue.view.own`,
] as const;
export const QUEUE_CREATE = [`${P}.queue.create.workspace`, `${P}.queue.create.own`] as const;
export const QUEUE_UPDATE = [`${P}.queue.update.workspace`, `${P}.queue.update.own`] as const;
export const QUEUE_DELETE = [`${P}.queue.delete.workspace`, `${P}.queue.delete.own`] as const;
export const QUEUE_UPDATE_WORKSPACE = `${P}.queue.update.workspace`;
export const QUEUE_DELETE_WORKSPACE = `${P}.queue.delete.workspace`;

/** Cadências */
export const CADENCES_VIEW = [
  `${P}.cadences.view`,
  `${P}.cadences.view.team`,
  `${P}.cadences.view.own`,
] as const;
export const CADENCES_CREATE = [
  `${P}.cadences.create.workspace`,
  `${P}.cadences.create.own`,
] as const;
export const CADENCES_UPDATE = [
  `${P}.cadences.update.workspace`,
  `${P}.cadences.update.own`,
] as const;
export const CADENCES_DELETE = [
  `${P}.cadences.delete.workspace`,
  `${P}.cadences.delete.own`,
] as const;

/** Questionários */
export const QUESTIONNAIRES_VIEW = [
  `${P}.questionnaires.view`,
  `${P}.questionnaires.view.team`,
  `${P}.questionnaires.view.own`,
] as const;
export const QUESTIONNAIRES_CREATE = [
  `${P}.questionnaires.create.workspace`,
  `${P}.questionnaires.create.own`,
] as const;
export const QUESTIONNAIRES_UPDATE = [
  `${P}.questionnaires.update.workspace`,
  `${P}.questionnaires.update.own`,
] as const;
export const QUESTIONNAIRES_DELETE = [
  `${P}.questionnaires.delete.workspace`,
  `${P}.questionnaires.delete.own`,
] as const;

export const asKeys = (keys: readonly string[]): string[] => [...keys];
