import type { LucideIcon } from "lucide-react";
import {
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  Eye,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";

/**
 * Situação de assinatura em uma escala única de tons, usada pelo quadro ForSign e
 * pelo envio nativo do TechERP. O tom decide apenas ícone e cor; a regra de quem
 * pode enviar, assinar ou ver continua no servidor (RLS/permissões).
 */
export type SignatureTone =
  | "signed"
  | "partial"
  | "waiting"
  | "queued"
  | "viewed"
  | "sending"
  | "failed"
  | "neutral";

export type SignatureToneStyle = { icon: LucideIcon; ink: string; pill: string; spin?: boolean };

export const SIGNATURE_TONE: Record<SignatureTone, SignatureToneStyle> = {
  signed: {
    icon: CircleCheck,
    ink: "text-success",
    pill: "border-success/30 bg-success/10 text-success",
  },
  partial: {
    icon: CircleDashed,
    ink: "text-warning",
    pill: "border-warning/40 bg-warning/10 text-warning",
  },
  waiting: {
    icon: Clock,
    ink: "text-warning",
    pill: "border-warning/40 bg-warning/10 text-warning",
  },
  queued: {
    icon: CircleDashed,
    ink: "text-text-tertiary",
    pill: "border-border-subtle bg-surface-sunken text-text-secondary",
  },
  viewed: {
    icon: Eye,
    ink: "text-primary",
    pill: "border-primary/30 bg-primary/10 text-primary",
  },
  sending: {
    icon: LoaderCircle,
    ink: "text-text-secondary",
    pill: "border-border-subtle bg-surface-sunken text-text-secondary",
    spin: true,
  },
  failed: {
    icon: CircleX,
    ink: "text-destructive",
    pill: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  neutral: {
    icon: CircleDashed,
    ink: "text-text-tertiary",
    pill: "border-border-subtle bg-surface-sunken text-text-secondary",
  },
};

/** Cor do rótulo conforme o tom (para texto inline, sem fundo). */
export function signatureToneInk(tone: SignatureTone) {
  return SIGNATURE_TONE[tone].ink;
}
