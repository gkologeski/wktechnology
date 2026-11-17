/** Read-only grouping: imported/orphaned tasks remain visible without changing stored status. */
export function taskStatusGroups<T extends { custom_status_id: string | null }>(
  statuses: ReadonlyArray<{ id: string }>,
  tasks: readonly T[],
) {
  const byStatus = new Map(statuses.map((s) => [s.id, [] as T[]]));
  const unclassified: T[] = [];
  for (const task of tasks) {
    const group = task.custom_status_id ? byStatus.get(task.custom_status_id) : undefined;
    (group ?? unclassified).push(task);
  }
  return { byStatus, unclassified };
}
