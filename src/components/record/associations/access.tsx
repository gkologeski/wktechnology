import { createContext, useContext, type ComponentType } from "react";
import { useSalesCapabilities } from "@/lib/access-control/use-sales-capabilities";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { SALES_TABLE_RESOURCES, type SalesTable } from "@/lib/access-control/sales-resources";
import { readViewAs } from "@/lib/view-as-client";
type AssociationScope = { table: SalesTable; id?: string; linked?: boolean };
const Scope = createContext<(AssociationScope & { allowed: boolean }) | null>(null);
export function withAssociationAccess<P extends object>(
  Component: ComponentType<P>,
  scopeFor: (props: P) => AssociationScope,
) {
  return function PermissionScopedAssociation(props: P) {
    const scope = scopeFor(props),
      p = usePermissions(),
      caps = useSalesCapabilities(scope.table, scope.id ? [scope.id] : []),
      r = SALES_TABLE_RESOURCES[scope.table];
    const view = readViewAs();
    const readonly =
      !!view &&
      (view.mode === "role"
        ? !["leads", "contacts", "companies", "deals"].includes(scope.table)
        : view.readOnly);
    const allowed =
      !p.isError &&
      !p.isLoading &&
      !readonly &&
      (scope.id
        ? caps.for(scope.id).can_update
        : p.canAny(["own", "team", "workspace"].map((s) => `${r}.update.${s}`)) &&
          p.canAny(["own", "team", "workspace"].map((s) => `${r}.view.${s}`)));
    return (
      <Scope.Provider value={{ ...scope, allowed }}>
        <Component {...props} />
      </Scope.Provider>
    );
  };
}
export function useAssociationMutation(id?: string) {
  const scope = useContext(Scope),
    caps = useSalesCapabilities(scope?.table ?? "leads", scope?.linked && id ? [id] : []);
  return scope ? scope.allowed && (!scope.linked || !id || caps.for(id).can_update) : true;
}
