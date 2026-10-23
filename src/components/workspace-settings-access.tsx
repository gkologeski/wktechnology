import type { ReactNode } from "react";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { Button } from "@/components/ui/button";

type SettingsResource =
  | "techfinance.payments_settings"
  | "techfinance.nfse_settings"
  | "techsales.meeting_settings";

/** Mounts the data loader only after authorization; workspace changes discard form state. */
export function WorkspaceSettingsAccess({
  resource,
  children,
}: {
  resource: SettingsResource;
  children: (canManage: boolean) => ReactNode;
}) {
  const permissions = usePermissions();
  if (permissions.isLoading)
    return (
      <p className="p-6" role="status">
        Verificando acesso…
      </p>
    );
  if (permissions.isError)
    return (
      <div className="space-y-3 p-6" role="alert">
        <p>Não foi possível verificar seu acesso.</p>
        <Button variant="outline" onClick={() => void permissions.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  if (!permissions.workspaceId || !permissions.can(`${resource}.view.workspace`)) {
    return (
      <p className="p-6" role="alert">
        Você não tem permissão para consultar estas configurações.
      </p>
    );
  }
  const canManage = permissions.can(`${resource}.manage.workspace`);
  return (
    <section key={permissions.workspaceId}>
      {!canManage && (
        <p className="px-6 pt-6 text-sm text-muted-foreground">Acesso somente para consulta.</p>
      )}
      {children(canManage)}
    </section>
  );
}
