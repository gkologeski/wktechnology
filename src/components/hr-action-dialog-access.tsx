import type { ReactNode } from "react";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useHrCapabilities } from "@/lib/access-control/use-hr-capabilities";
import type { HrRecordResource } from "@/lib/access-control/hr-capabilities.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HrAccessError } from "./hr-access";

/** Mount action loaders/forms only after the actual parent action is allowed. */
export function HrActionDialogAccess({
  open,
  onOpenChange,
  resource,
  id,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: HrRecordResource;
  id: string;
  title: string;
  children: ReactNode;
}) {
  const p = usePermissions();
  const access = useHrCapabilities(resource, open && id ? [id] : []);
  if (!open) return null;
  const loading = p.isLoading || access.isLoading;
  if (!loading && !p.isError && !access.isError && access.for(id).can_create_child) return children;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p role="status">Verificando acesso…</p>
        ) : p.isError || access.isError ? (
          <HrAccessError
            retry={() => {
              void p.refetch();
              void access.refetch();
            }}
          />
        ) : (
          <p role="alert">Você não tem permissão para executar esta ação nesta candidatura.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
