import { createContext, useContext, type ReactNode } from "react";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useWorkCapabilities } from "@/lib/access-control/use-work-capabilities";
import type { WorkResource, WorkCapability } from "@/lib/access-control/work-core.functions";
import { readViewAs } from "@/lib/view-as-client";
const Scope = createContext<Partial<Record<WorkResource, (id: string) => WorkCapability>>>({});
/** One batched check per resource, instead of one HTTP request per visible button. */
export function WorkCapabilityScope({
  resource,
  ids,
  children,
}: {
  resource: WorkResource;
  ids: string[];
  children: ReactNode;
}) {
  const inherited = useContext(Scope);
  const caps = useWorkCapabilities(resource, ids);
  return <Scope.Provider value={{ ...inherited, [resource]: caps.for }}>{children}</Scope.Provider>;
}
export function useWorkRecordCapability(resource: WorkResource, id: string) {
  const inherited = useContext(Scope)[resource];
  const own = useWorkCapabilities(resource, !inherited && id ? [id] : []);
  return inherited ? inherited(id) : own.for(id);
}
/** UI affordance only; every mutation is independently checked in the server/DB. */
export function WorkAction({
  resource,
  action,
  id,
  children,
}: {
  resource: WorkResource;
  action: "create" | "update" | "delete" | "manage" | "assign";
  id?: string;
  children: ReactNode;
}) {
  const p = usePermissions();
  const cap = useWorkRecordCapability(resource, id ?? "");
  const view = readViewAs();
  const readOnly = !!view && (view.readOnly || view.mode === "role");
  const coarse =
    p.canAny(["own", "team", "workspace"].map((s) => `${resource}.${action}.${s}`)) &&
    p.canAny(["own", "team", "workspace"].map((s) => `${resource}.view.${s}`));
  const row = !id || (action !== "create" && cap[`can_${action}`]);
  return !p.isLoading && !p.isError && !!p.workspaceId && !readOnly && coarse && row ? (
    <>{children}</>
  ) : null;
}
