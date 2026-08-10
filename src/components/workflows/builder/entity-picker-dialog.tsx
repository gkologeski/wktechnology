import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ENTITY_LABELS, ENTITY_GROUPS, type WorkflowEntity } from "@/lib/workflows/types";

// ============================================================================
// Entity picker
// ============================================================================
export function EntityPickerDialog({
  open,
  currentEntity,
  onClose,
  onPick,
}: {
  open: boolean;
  currentEntity: WorkflowEntity;
  onClose: () => void;
  onPick: (e: WorkflowEntity) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>Escolha o tipo de workflow</DialogTitle>
        <DialogDescription>
          O tipo define qual objeto dispara este workflow (leads, negócios, vagas, etc.).
        </DialogDescription>
        <div className="space-y-4 mt-2">
          {ENTITY_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                {group.label}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {group.entities.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => onPick(e)}
                    className={cn(
                      "text-left rounded-md border bg-card px-3 py-3 hover:border-primary hover:bg-accent/30 transition",
                      currentEntity === e && "border-primary ring-1 ring-primary/30",
                    )}
                  >
                    <p className="text-sm font-medium">{ENTITY_LABELS[e]}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
