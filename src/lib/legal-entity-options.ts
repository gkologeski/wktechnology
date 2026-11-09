/** Historical filters retain every entity; assignment pickers only offer active entities. */
export function legalEntityAssignmentOptions<T extends { id: string; active: boolean }>(
  entities: T[],
  savedId?: string | null,
): T[] {
  return entities.filter((entity) => entity.active || entity.id === savedId);
}
