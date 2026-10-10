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
import { cn } from "@/lib/utils";
import type { ConfirmOptions } from "./confirm-dialog";

/** Interface do confirmDialog global; carregada sob demanda por ConfirmDialogHost. */
export function ConfirmDialogView({
  options,
  open,
  onSettle,
}: {
  options: ConfirmOptions | null;
  open: boolean;
  onSettle: (value: boolean) => void;
}) {
  const destructive = options?.variant === "destructive";
  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onSettle(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options?.title ?? "Confirmar ação"}</AlertDialogTitle>
          {options?.description ? (
            <AlertDialogDescription className="whitespace-pre-line">
              {options.description}
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onSettle(false)}>
            {options?.cancelLabel ?? "Cancelar"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onSettle(true)}
            className={cn(
              destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            )}
          >
            {options?.confirmLabel ?? "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
