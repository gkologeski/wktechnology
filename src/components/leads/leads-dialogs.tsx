import { BulkEditFieldsDialog } from "@/components/grid/bulk-edit-fields-dialog";
import { BulkEnrichDialog } from "@/components/enrichment/bulk-enrich-dialog";
import { AddToProspectingDialog } from "@/components/prospecting/add-to-prospecting-dialog";
import { CreateLeadDialog } from "@/components/leads/create-lead-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type PendingAction = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  run: () => Promise<void>;
} | null;

/** Diálogos globais da página de leads: edição em massa, enriquecimento,
 * adicionar à prospecção, criação de lead e confirmação de ação pendente. */
export function LeadsDialogs({
  bulkEditOpen,
  setBulkEditOpen,
  selectedIds,
  onBulkEditDone,
  enrichIds,
  setEnrichIds,
  onEnrichDone,
  prospectingIds,
  setProspectingIds,
  createOpen,
  setCreateOpen,
  onLeadCreated,
  pendingAction,
  actionBusy,
  onOpenChangePendingAction,
  onRunPendingAction,
}: {
  bulkEditOpen: boolean;
  setBulkEditOpen: (v: boolean) => void;
  selectedIds: Set<string>;
  onBulkEditDone: () => void;
  enrichIds: string[] | null;
  setEnrichIds: (v: string[] | null) => void;
  onEnrichDone: () => void;
  prospectingIds: string[] | null;
  setProspectingIds: (v: string[] | null) => void;
  createOpen: boolean;
  setCreateOpen: (v: boolean) => void;
  onLeadCreated: (id: string) => void;
  pendingAction: PendingAction;
  actionBusy: boolean;
  onOpenChangePendingAction: (v: boolean) => void;
  onRunPendingAction: () => void;
}) {
  return (
    <>
      <BulkEditFieldsDialog
        open={bulkEditOpen}
        setOpen={setBulkEditOpen}
        entity="leads"
        ids={Array.from(selectedIds)}
        entityLabel="lead(s)"
        onDone={onBulkEditDone}
      />

      <BulkEnrichDialog
        open={!!enrichIds}
        onOpenChange={(o) => !o && setEnrichIds(null)}
        ids={enrichIds ?? []}
        entity="lead"
        onDone={onEnrichDone}
      />

      <AddToProspectingDialog
        open={!!prospectingIds}
        onOpenChange={(o) => !o && setProspectingIds(null)}
        ids={prospectingIds ?? []}
      />

      <CreateLeadDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={onLeadCreated} />

      <AlertDialog open={!!pendingAction} onOpenChange={onOpenChangePendingAction}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pendingAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onRunPendingAction}
              disabled={actionBusy}
              className={
                pendingAction?.destructive
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {actionBusy ? "Processando…" : (pendingAction?.confirmLabel ?? "Confirmar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
