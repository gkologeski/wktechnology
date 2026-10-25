import { usePermissions } from "./use-permissions";
import { readViewAs } from "@/lib/view-as-client";
/** Shared configuration scopes are workspace-only; record scopes come from DB capabilities. */
export function useSharedAction(resource: string, action: string) {
  const p = usePermissions();
  return (
    !p.isLoading &&
    !p.isError &&
    !!p.workspaceId &&
    (action === "view" || !readViewAs()) &&
    p.can(`${resource}.view.workspace`) &&
    p.can(`${resource}.${action}.workspace`)
  );
}
