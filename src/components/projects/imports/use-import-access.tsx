import { usePermissions } from "@/lib/access-control/use-permissions";
import { useAuth } from "@/lib/auth";
import { readViewAs } from "@/lib/view-as-client";
import type { ImportProvider } from "@/lib/projects/imports/import-journey";
import type { ImportQueryScope } from "./import-format";
import {
  canManageImportContext,
  canReadImportContext,
  type ImportAccessContext,
} from "./import-access";

/** A leaf never relies on a parent having hidden it; reads/writes recheck the live context. */
export function useImportAccess(scope: ImportQueryScope) {
  const p = usePermissions();
  const { user, loading } = useAuth();
  const context: ImportAccessContext = {
    actorId: user?.id ?? null,
    workspaceId: p.workspaceId,
    scope,
    permissions: p.permissions,
    ready: !loading && !p.isLoading && !p.isError,
    readOnly: !!readViewAs()?.readOnly,
  };
  return {
    canRead: (provider?: ImportProvider) => canReadImportContext(context, provider),
    canManage: (provider: ImportProvider) => canManageImportContext(context, provider),
  };
}
