import * as React from "react";

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

export type ConfirmOptions = {
  /** Título curto do diálogo. */
  title?: string;
  /** Texto explicativo / pergunta. */
  description?: React.ReactNode;
  /** Rótulo do botão de confirmação. */
  confirmLabel?: string;
  /** Rótulo do botão de cancelamento. */
  cancelLabel?: string;
  /** Usa estilo destrutivo no botão de confirmação. */
  variant?: "default" | "destructive";
};

type Pending = {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
};

type Listener = (pending: Pending | null) => void;

let current: Pending | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(current);
}

function isDestructiveText(text: string) {
  return /excluir|remover|apagar|deletar|descartar|cancelar|desconectar/i.test(text);
}

/**
 * Confirmação global no padrão do design system (substitui window.confirm).
 * Uso: `if (!(await confirmDialog("Excluir este registro?"))) return;`
 */
export function confirmDialog(input: string | ConfirmOptions): Promise<boolean> {
  const options: ConfirmOptions =
    typeof input === "string"
      ? {
          description: input,
          variant: isDestructiveText(input) ? "destructive" : "default",
        }
      : input;

  if (typeof window === "undefined") return Promise.resolve(false);

  // Se já existe um diálogo aberto, resolve o anterior como cancelado.
  if (current) {
    current.resolve(false);
    current = null;
  }

  return new Promise<boolean>((resolve) => {
    current = { options, resolve };
    emit();
  });
}

export function ConfirmDialogHost() {
  const [pending, setPending] = React.useState<Pending | null>(current);

  React.useEffect(() => {
    listeners.add(setPending);
    setPending(current);
    return () => {
      listeners.delete(setPending);
    };
  }, []);

  const settle = React.useCallback(
    (value: boolean) => {
      if (pending) pending.resolve(value);
      if (current === pending) {
        current = null;
        emit();
      }
      setPending(null);
    },
    [pending],
  );

  const options = pending?.options;
  const destructive = options?.variant === "destructive";

  return (
    <AlertDialog
      open={!!pending}
      onOpenChange={(open) => {
        if (!open) settle(false);
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
          <AlertDialogCancel onClick={() => settle(false)}>
            {options?.cancelLabel ?? "Cancelar"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => settle(true)}
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

/** Hook opcional, para quem preferir a API de hook. */
export function useConfirm() {
  return confirmDialog;
}
