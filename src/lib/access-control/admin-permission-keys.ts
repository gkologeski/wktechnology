// Chaves granulares (client-safe) dos recursos administrativos do módulo `system`.
// Substituem o gate legado de "tool matrix" (`manage_*` / `access_logs`).
// Use com <Can any={...}> ou usePermissions().canAny(...).

const S = "system";

const crud = (resource: string) => ({
  view: [
    `${S}.${resource}.view.workspace`,
    `${S}.${resource}.view.team`,
    `${S}.${resource}.view.own`,
  ],
  create: [`${S}.${resource}.create.workspace`, `${S}.${resource}.create.own`],
  update: [`${S}.${resource}.update.workspace`, `${S}.${resource}.update.own`],
  delete: [`${S}.${resource}.delete.workspace`, `${S}.${resource}.delete.own`],
  export: [`${S}.${resource}.export.workspace`],
  manage: [`${S}.${resource}.manage.workspace`],
});

export const WORKFLOWS_PERMS = crud("workflows");
export const PIPELINES_PERMS = crud("pipelines");
export const PROPERTIES_PERMS = crud("custom_properties");
export const INTEGRATIONS_PERMS = crud("integrations");
export const BILLING_PERMS = crud("billing");
export const AUDIT_PERMS = crud("audit");
export const MEMBERS_PERMS = crud("members");

/** "Gerenciar X": manage OU update OU create (o mais amplo disponível). */
export function manageKeys(perms: ReturnType<typeof crud>): string[] {
  return [...perms.manage, ...perms.update, ...perms.create];
}

export const WORKFLOWS_MANAGE = manageKeys(WORKFLOWS_PERMS);
export const PIPELINES_MANAGE = manageKeys(PIPELINES_PERMS);
export const PROPERTIES_MANAGE = manageKeys(PROPERTIES_PERMS);
export const INTEGRATIONS_MANAGE = manageKeys(INTEGRATIONS_PERMS);
export const BILLING_MANAGE = manageKeys(BILLING_PERMS);
export const MEMBERS_MANAGE = manageKeys(MEMBERS_PERMS);
export const AUDIT_VIEW = AUDIT_PERMS.view;
export const AUDIT_EXPORT = [...AUDIT_PERMS.export, ...AUDIT_PERMS.create];
