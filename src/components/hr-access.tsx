import type { ReactNode } from "react";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useHrCapabilities } from "@/lib/access-control/use-hr-capabilities";
import type { HrRecordResource } from "@/lib/access-control/hr-capabilities.functions";
import { Button } from "@/components/ui/button";

export function HrAccessError({ retry }: { retry?: () => void }) {
  return (
    <div className="space-y-3 p-6" role="alert">
      <p>Não foi possível carregar este conteúdo ou verificar seu acesso.</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

/** Gate before mounting data loaders, including direct URL navigation. */
export function HrScreenAccess({
  resources,
  children,
}: {
  resources: string[];
  children: ReactNode;
}) {
  const p = usePermissions();
  if (p.isLoading)
    return (
      <p className="p-6" role="status">
        Verificando acesso…
      </p>
    );
  if (p.isError) return <HrAccessError retry={p.refetch} />;
  if (
    !p.workspaceId ||
    !p.canAny(resources.flatMap((r) => ["workspace", "team", "own"].map((s) => `${r}.view.${s}`)))
  ) {
    return (
      <p className="p-6" role="alert">
        Você não tem permissão para consultar esta tela.
      </p>
    );
  }
  return <section key={p.workspaceId}>{children}</section>;
}

export function HrRecordAccess({
  resource,
  id,
  children,
}: {
  resource: HrRecordResource;
  id: string;
  children: ReactNode;
}) {
  const access = useHrCapabilities(resource, [id]);
  if (access.isLoading)
    return (
      <p className="p-6" role="status">
        Verificando acesso ao registro…
      </p>
    );
  if (access.isError) return <HrAccessError retry={() => void access.refetch()} />;
  if (!access.for(id).can_view)
    return (
      <p className="p-6" role="alert">
        Registro indisponível ou sem permissão de consulta.
      </p>
    );
  return <section key={id}>{children}</section>;
}
