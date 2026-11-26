import {
  IMPORT_PROVIDERS,
  type ImportProvider,
  type JourneySource,
} from "@/lib/projects/imports/import-journey";
import type { ImportQueryScope } from "./import-format";

export type ImportAccessContext = {
  actorId: string | null;
  workspaceId: string | null;
  scope: ImportQueryScope;
  permissions: ReadonlySet<string>;
  ready: boolean;
  readOnly: boolean;
};

export function importPermissionFingerprint(keys: ReadonlySet<string>): string {
  return [...keys]
    .filter((key) =>
      IMPORT_PROVIDERS.some((provider) => key.startsWith(`techprojects.${provider}_import.`)),
    )
    .sort()
    .join("|");
}

/** Effective keys already exclude inactive memberships and explicit denies. */
export function canReadImportContext(
  context: ImportAccessContext,
  provider?: ImportProvider,
): boolean {
  return (
    context.ready &&
    !!context.actorId &&
    !!context.workspaceId &&
    context.actorId === context.scope[0] &&
    context.workspaceId === context.scope[1] &&
    importPermissionFingerprint(context.permissions) === context.scope[2] &&
    (provider ? [provider] : IMPORT_PROVIDERS).some((value) =>
      context.permissions.has(`techprojects.${value}_import.view.workspace`),
    )
  );
}

export function canManageImportContext(
  context: ImportAccessContext,
  provider: ImportProvider,
): boolean {
  return (
    canReadImportContext(context, provider) &&
    !context.readOnly &&
    context.permissions.has(`techprojects.${provider}_import.manage.workspace`)
  );
}

export function canManageImportSource(source: JourneySource, readOnly: boolean): boolean {
  return canConfigureImportSource(source, readOnly) && source.ready;
}

export function canConfigureImportSource(source: JourneySource, readOnly: boolean): boolean {
  return source.canView && source.canManage && !readOnly;
}

export function assertImportUiAccess(
  access: {
    canRead: (provider?: ImportProvider) => boolean;
    canManage: (provider: ImportProvider) => boolean;
  },
  provider?: ImportProvider,
  write = false,
): void {
  if (write ? !provider || !access.canManage(provider) : !access.canRead(provider))
    throw new Error("Sem permissão para esta ação na origem e no workspace ativos.");
}
