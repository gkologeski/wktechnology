import { cn } from "@/lib/utils";
import { SIGNATURE_TONE } from "./signature-status-tone";

/** Ícone da situação. Decorativo: o texto ao lado é que carrega o significado. */
export function SignatureStatusIcon({
  tone,
  className,
}: {
  tone: keyof typeof SIGNATURE_TONE;
  className?: string;
}) {
  const { icon: Icon, ink, spin } = SIGNATURE_TONE[tone];
  return (
    <Icon
      aria-hidden
      className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", ink, spin && "animate-spin", className)}
    />
  );
}

/** Rótulo em selo com ícone, para a situação geral de um documento ou remessa. */
export function SignatureStatusBadge({
  tone,
  children,
  className,
}: {
  tone: keyof typeof SIGNATURE_TONE;
  children: React.ReactNode;
  className?: string;
}) {
  const { icon: Icon, pill, spin } = SIGNATURE_TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5",
        "text-[11px] font-medium leading-none whitespace-nowrap",
        pill,
        className,
      )}
    >
      <Icon aria-hidden className={cn("h-3 w-3 shrink-0", spin && "animate-spin")} />
      {children}
    </span>
  );
}
