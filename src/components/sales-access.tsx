import { createContext, useContext, type ReactNode } from "react";
import { HrScreenAccess, HrAccessError } from "@/components/hr-access";
import { useSalesCapabilities } from "@/lib/access-control/use-sales-capabilities";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  SALES_TABLE_RESOURCES,
  type SalesTable,
  type SalesAction,
} from "@/lib/access-control/sales-resources";
import { readViewAs } from "@/lib/view-as-client";
import { salesRouteResources } from "@/lib/access-control/sales-route-map";
const CapabilityContext = createContext<
  Partial<Record<SalesTable, ReturnType<typeof useSalesCapabilities>["for"]>>
>({});
export function SalesCapabilityScope({
  table,
  ids,
  children,
}: {
  table: SalesTable;
  ids: string[];
  children: ReactNode;
}) {
  const inherited = useContext(CapabilityContext),
    cap = useSalesCapabilities(table, ids);
  return (
    <CapabilityContext.Provider value={{ ...inherited, [table]: cap.for }}>
      {children}
    </CapabilityContext.Provider>
  );
}
export function useSalesRecordCapability(table: SalesTable, id: string) {
  const inherited = useContext(CapabilityContext)[table],
    own = useSalesCapabilities(table, !inherited && id ? [id] : []);
  return inherited ? inherited(id) : own.for(id);
}
export function SalesRouteAccess({ path, children }: { path: string; children: ReactNode }) {
  const resources = salesRouteResources(path);
  return resources ? (
    <HrScreenAccess resources={[...resources]}>{children}</HrScreenAccess>
  ) : (
    <>{children}</>
  );
}
export function SalesRecordAccess({
  table,
  id,
  children,
}: {
  table: SalesTable;
  id: string;
  children: ReactNode;
}) {
  const cap = useSalesCapabilities(table, [id]);
  if (cap.isLoading)
    return (
      <p className="p-6" role="status">
        Verificando acesso ao registro…
      </p>
    );
  if (cap.isError) return <HrAccessError retry={() => void cap.refetch()} />;
  if (!cap.for(id).can_view)
    return (
      <p className="p-6" role="alert">
        Registro indisponível ou sem permissão de consulta.
      </p>
    );
  return <section key={id}>{children}</section>;
}
export function SalesAction({
  table,
  action,
  id,
  resource,
  children,
}: {
  table: SalesTable;
  action: Exclude<SalesAction, "view">;
  id?: string;
  resource?: string;
  children: ReactNode;
}) {
  const p = usePermissions(),
    cap = useSalesRecordCapability(table, id ?? ""),
    r = resource ?? SALES_TABLE_RESOURCES[table],
    view = readViewAs();
  const roleSandbox = !!view && view.mode === "role";
  const sandboxWritable =
    ["leads", "contacts", "companies", "deals", "activities"].includes(table) &&
    ["create", "update", "delete", "assign"].includes(action);
  const readOnly = !!view && (roleSandbox ? !sandboxWritable : view.readOnly);
  const coarse =
    p.canAny(["own", "team", "workspace"].map((s) => `${r}.${action}.${s}`)) &&
    p.canAny(["own", "team", "workspace"].map((s) => `${r}.view.${s}`));
  const special = resource && resource !== SALES_TABLE_RESOURCES[table];
  const row =
    !id ||
    (special
      ? action === "manage" &&
        (resource === "techsales.quote_share" || resource === "techsales.proposal_share"
          ? cap.can_share
          : resource === "techsales.quote_send" || resource === "techsales.proposal_send"
            ? cap.can_send
            : false)
      : action !== "create" && cap[`can_${action}`]);
  return !p.isLoading && !p.isError && !!p.workspaceId && !readOnly && coarse && row ? (
    <>{children}</>
  ) : null;
}
