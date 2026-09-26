"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { notifyDialogClosed } from "@/lib/dialog-refresh";
import { beginAuditSession, endAuditSession, touchAuditSession } from "@/lib/audit-session";
import {
  useWindowChrome,
  WindowChromeContext,
  type WindowChrome,
} from "@/components/activity/activity-window-context";
import { WindowControls } from "@/components/activity/activity-window-frame";

const DockContext = React.createContext<WindowChrome | null>(null);

// Wrapper do Root que notifica o QueryClient sempre que o dialog fecha, para
// revalidar dados alterados dentro dele sem exigir F5 do usuário.
const Dialog = ({
  onOpenChange,
  docked = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root> & { docked?: boolean }) => {
  const chrome = useWindowChrome();
  const dock = docked ? chrome : null;
  const sessionRef = React.useRef<string | null>(null);
  const isOpen = props.open ?? props.defaultOpen ?? false;

  React.useEffect(() => {
    if (isOpen && !sessionRef.current) sessionRef.current = beginAuditSession();
    if (!isOpen && sessionRef.current) {
      endAuditSession(sessionRef.current);
      sessionRef.current = null;
    }
  }, [isOpen]);

  React.useEffect(() => () => endAuditSession(sessionRef.current), []);

  React.useEffect(() => {
    if (dock?.position === 0 && !dock.minimized) touchAuditSession(sessionRef.current);
  }, [dock?.position, dock?.minimized]);

  return (
    <DockContext.Provider value={dock}>
      <DialogPrimitive.Root
        {...props}
        modal={!dock}
        onOpenChange={(open) => {
          if (dock && !open) {
            dock.onClose();
            return;
          }
          if (open && !sessionRef.current) sessionRef.current = beginAuditSession();
          onOpenChange?.(open);
          if (!open) {
            endAuditSession(sessionRef.current);
            sessionRef.current = null;
            notifyDialogClosed();
          }
        }}
      />
    </DockContext.Provider>
  );
};
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-foreground/25 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DockedDialogContent className={className} forwardedRef={ref} {...props}>
    {children}
  </DockedDialogContent>
));

function DockedDialogContent({
  className,
  children,
  forwardedRef,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  forwardedRef: React.ForwardedRef<React.ElementRef<typeof DialogPrimitive.Content>>;
}) {
  const dock = React.useContext(DockContext);
  const position = dock?.position ?? 0;
  return (
    <WindowChromeContext.Provider value={null}>
      <DialogPortal>
        {!dock && <DialogOverlay />}
        <DialogPrimitive.Content
          ref={forwardedRef}
          data-dialog-content=""
          className={cn(
            // `w-[calc(100vw-2rem)]` limita a largura real à janela (o `max-w-*` de cada
            // modal continua valendo, pois width e max-width são propriedades distintas);
            // `grid-cols-[minmax(0,1fr)]` permite que filhos largos encolham/quebrem em vez
            // de estourar lateralmente e cortar o conteúdo.
            "fixed left-[50%] top-[50%] z-50 grid grid-cols-[minmax(0,1fr)] w-[calc(100vw-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] translate-x-[-50%] translate-y-[-50%] gap-5 overflow-y-auto overflow-x-hidden overscroll-contain border border-border/60 bg-card text-card-foreground p-7 rounded-[24px] shadow-[0_32px_64px_-16px_rgb(0_0_0/0.18)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            dock &&
              "!fixed !top-auto !bottom-3 !left-auto !right-3 !z-[120] !w-[min(480px,calc(100vw-1.5rem))] !max-w-none !max-h-[min(680px,calc(100dvh-1.5rem))] !translate-x-0 !translate-y-0 !rounded-md !border-product-divider !bg-product-panel !p-4 !pt-12 !shadow-xl !gap-3 max-sm:!inset-0 max-sm:!h-dvh max-sm:!w-screen max-sm:!max-h-dvh max-sm:!rounded-none",
            dock && position === 1 && "lg:!right-[500px]",
            dock?.expanded && "lg:!right-3 lg:!w-[min(860px,calc(100vw-1.5rem))]",
            dock && (dock.minimized || position > 1) && "!hidden",
            dock && position > 0 && "max-sm:!hidden",
            className,
          )}
          {...props}
          onPointerDown={(event) => {
            dock?.onFocus();
            props.onPointerDown?.(event);
          }}
          onEscapeKeyDown={(event) => {
            if (dock) {
              event.preventDefault();
              dock.onMinimize();
            } else props.onEscapeKeyDown?.(event);
          }}
        >
          {children}
          {dock && (
            <div className="absolute inset-x-0 top-0 flex h-10 items-center justify-between gap-2 border-b border-product-divider bg-product-header px-3">
              <span className="truncate text-sm font-semibold">{dock.title}</span>
              <WindowControls chrome={dock} />
            </div>
          )}
          {!dock && (
            <DialogPrimitive.Close className="absolute right-5 top-5 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none cursor-pointer">
              <X className="h-4 w-4" />
              <span className="sr-only">Fechar</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </WindowChromeContext.Provider>
  );
}
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // negative margins pull the header to the edge so it sits flush with the modal frame
      "flex min-w-0 flex-col space-y-1.5 -mx-7 -mt-7 px-7 pt-7 pb-5 pr-14 border-b border-border/60 text-left",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("min-w-0 space-y-5", className)} {...props} />
);
DialogBody.displayName = "DialogBody";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 -mx-7 -mb-7 px-7 py-5 mt-2 border-t border-border/60 bg-muted/40 sm:flex-row sm:justify-end sm:gap-3",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-xl font-bold leading-tight tracking-tight text-foreground break-words",
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm leading-relaxed text-muted-foreground break-words", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
