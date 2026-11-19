import { lazy, Suspense } from "react";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useAuth } from "@/lib/auth";
import { readViewAs } from "@/lib/view-as-client";
import { QuickCreateCompanyDialog } from "./quick-create-dialogs";
import { CreateContactDialog } from "@/components/contacts/create-contact-dialog";
import { QuickCreateProjectDialog } from "@/components/projects/quick-create-project-dialog";

const ContractWizard = lazy(() =>
  import("@/components/contracts/contract-wizard").then((m) => ({ default: m.ContractWizard })),
);
import { searchCreateResources, type SearchCreateEntity } from "@/lib/search-create-entities";
export function SearchCreateRecordDialog({
  entity,
  name,
  companyId,
  commercialContractId,
  workspaceId,
  actorId,
  onClose,
  onCreated,
}: {
  entity: SearchCreateEntity;
  name: string;
  companyId: string | null;
  commercialContractId?: string | null;
  workspaceId: string;
  actorId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const p = usePermissions(),
    { user } = useAuth(),
    resource = searchCreateResources[entity];
  const allowed =
    !p.isLoading &&
    !p.isError &&
    p.workspaceId === workspaceId &&
    user?.id === actorId &&
    !readViewAs()?.readOnly &&
    p.canAny(["own", "team", "workspace"].map((scope) => `${resource}.create.${scope}`)) &&
    p.canAny(["own", "team", "workspace"].map((scope) => `${resource}.view.${scope}`));
  if (!allowed) return null;
  const close = (open: boolean) => {
    if (!open) onClose();
  };
  if (entity === "company")
    return (
      <QuickCreateCompanyDialog
        open
        onOpenChange={close}
        initialName={name}
        onCreated={onCreated}
      />
    );
  if (entity === "contact")
    return (
      <CreateContactDialog
        open
        onOpenChange={close}
        initialName={name}
        fixedCompanyId={companyId}
        onCreated={onCreated}
      />
    );
  if (entity === "project")
    return (
      <QuickCreateProjectDialog
        open
        onOpenChange={close}
        initialName={name}
        contractId={commercialContractId ?? undefined}
        onCreated={onCreated}
      />
    );
  // Always use the complete official wizard; never create a contract from a title alone.
  // A commercial contract's customer must not default to the supplier being contracted.
  return (
    <Suspense fallback={<p role="status">Abrindo criação de contrato…</p>}>
      <ContractWizard
        source={{
          companyId: entity === "contract" ? companyId : null,
          initialKind: entity === "contract" ? "client" : "provider",
        }}
        onOpenChange={close}
        onCreated={onCreated}
      />
    </Suspense>
  );
}
