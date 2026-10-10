import * as React from "react";

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

// A interface do diálogo (Radix AlertDialog + bloqueio de rolagem, ~90 KB) é carregada
// sob demanda: pré-carregada no ocioso após montar e, no pior caso, no primeiro pedido.
// Assim ela não entra no arquivo inicial de todas as páginas.
type ViewModule = typeof import("./confirm-dialog-view");
let viewPromise: Promise<ViewModule> | null = null;
function loadView() {
  viewPromise ??= import("./confirm-dialog-view").catch((err) => {
    viewPromise = null; // permite nova tentativa no próximo pedido
    throw err;
  });
  return viewPromise;
}

export function ConfirmDialogHost() {
  const [pending, setPending] = React.useState<Pending | null>(current);
  const [View, setView] = React.useState<ViewModule["ConfirmDialogView"] | null>(null);

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

  // Pré-carrega no ocioso.
  React.useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const run = () =>
      void loadView()
        .then((m) => setView(() => m.ConfirmDialogView))
        .catch(() => {});
    const id = w.requestIdleCallback ? w.requestIdleCallback(run) : window.setTimeout(run, 2000);
    return () => {
      if (!w.requestIdleCallback) window.clearTimeout(id);
    };
  }, []);

  // Pedido antes do pré-carregamento: carrega agora; se falhar, cancela (nunca confirma sozinho).
  React.useEffect(() => {
    if (!pending || View) return;
    let alive = true;
    loadView()
      .then((m) => alive && setView(() => m.ConfirmDialogView))
      .catch(() => alive && settle(false));
    return () => {
      alive = false;
    };
  }, [pending, View, settle]);

  if (!View) return null;
  return <View options={pending?.options ?? null} open={!!pending} onSettle={settle} />;
}

/** Hook opcional, para quem preferir a API de hook. */
export function useConfirm() {
  return confirmDialog;
}
