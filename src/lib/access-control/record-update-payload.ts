/** Server-authored edit payloads preserve the record's original author and workspace. The DB independently rejects attempts to rewrite either field. */
export function recordUpdatePayload<T extends Record<string, unknown>>(payload: T) {
  const { id: _id, owner_id: _owner, workspace_id: _workspace, ...updatable } = payload;
  return updatable;
}
