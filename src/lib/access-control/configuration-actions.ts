/** UI mirrors effective action scopes; PostgREST RLS remains authoritative. */
export function canConfigurationAction(
  permissions: ReadonlySet<string>,
  workspaceId: string | null,
  ready: boolean,
  resource: string,
  action: "view" | "create" | "update" | "delete",
  actor?: string,
  owner?: string,
) {
  if (!ready || !workspaceId) return false;
  const scoped = (a: string) =>
    permissions.has(`${resource}.${a}.workspace`) ||
    (resource === "system.automation.macros" &&
      (permissions.has(`${resource}.${a}.team`) ||
        (!!actor && actor === owner && permissions.has(`${resource}.${a}.own`))));
  return scoped("view") && scoped(action);
}
