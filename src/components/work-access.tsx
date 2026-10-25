import type { ReactNode } from "react";
import { HrScreenAccess, HrAccessError } from "@/components/hr-access";
import { useWorkCapabilities } from "@/lib/access-control/use-work-capabilities";
import type { WorkResource } from "@/lib/access-control/work-core.functions";
export function WorkScreenAccess({
  resources,
  children,
}: {
  resources: WorkResource[];
  children: ReactNode;
}) {
  return <HrScreenAccess resources={resources}>{children}</HrScreenAccess>;
}
export function WorkRecordAccess({
  resource,
  id,
  children,
}: {
  resource: WorkResource;
  id: string;
  children: ReactNode;
}) {
  const q = useWorkCapabilities(resource, [id]);
  if (q.isLoading)
    return (
      <p className="p-6" role="status">
        Verificando acesso ao registro…
      </p>
    );
  if (q.isError) return <HrAccessError retry={() => void q.refetch()} />;
  if (!q.for(id).can_view)
    return (
      <p className="p-6" role="alert">
        Registro indisponível ou sem permissão de consulta.
      </p>
    );
  return <section key={id}>{children}</section>;
}
