import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Trash2, Undo2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PhoneReviewRecordLink } from "@/components/phone/phone-review-record-link";
import type { PhoneReviewItem } from "@/lib/phone/phone-settings.functions";

export type PhoneReviewAction = "confirm" | "keep" | "clear";

export type PhoneReviewDetail = {
  original: string;
  candidate: string | null;
  candidateDisplay: string | null;
  resolved: boolean;
};

/**
 * Revisão de UM celular antigo sem o 9: quem revisa vê o valor gravado e a
 * sugestão completos e decide. Nada é gravado sem clique; apagar pede
 * confirmação. Componente de apresentação (dados e ações vêm por props).
 */
export function PhoneLegacyReviewDialog({
  open,
  onOpenChange,
  item,
  fieldLabel,
  detail,
  loading,
  error,
  pending,
  position,
  onAction,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: PhoneReviewItem | null;
  fieldLabel: string;
  detail: PhoneReviewDetail | null;
  loading: boolean;
  error: string | null;
  pending: PhoneReviewAction | null;
  position: string | null;
  onAction: (a: PhoneReviewAction) => void;
}) {
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => setConfirmClear(false), [item?.id]);
  const busy = pending !== null;
  const canAct = !!detail && !detail.resolved && !loading && !error;

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Celular antigo sem o 9</DialogTitle>
          <DialogDescription>
            Confirme só se tiver certeza de que o número com o 9 é o da pessoa ou empresa. Nada é
            enviado; a decisão fica registrada com o valor antigo para desfazer.
          </DialogDescription>
        </DialogHeader>

        {item && (
          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Registro</dt>
            <dd className="min-w-0">
              <PhoneReviewRecordLink item={item} />
            </dd>
            <dt className="text-muted-foreground">Campo</dt>
            <dd>{fieldLabel}</dd>
            <dt className="text-muted-foreground">Gravado hoje</dt>
            <dd className="font-mono" aria-busy={loading}>
              {loading ? "Carregando…" : (detail?.original ?? "—")}
            </dd>
            <dt className="text-muted-foreground">Sugestão</dt>
            <dd className="font-mono font-medium">
              {loading ? "…" : (detail?.candidateDisplay ?? "Sem sugestão")}
            </dd>
          </dl>
        )}

        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
        {detail?.resolved && (
          <p role="status" className="text-sm text-muted-foreground">
            Este item já foi resolvido.
          </p>
        )}

        {confirmClear ? (
          <div
            role="alertdialog"
            aria-label="Confirmar exclusão do número"
            className="space-y-3 rounded-md border border-destructive/40 p-3"
          >
            <p className="text-sm">
              Apagar este telefone do cadastro? O valor antigo fica guardado para desfazer.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setConfirmClear(false)}
              >
                Voltar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() => onAction("clear")}
              >
                {pending === "clear" && (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
                )}
                Apagar número
              </Button>
            </div>
          </div>
        ) : (
          <DialogFooter className="gap-2 sm:justify-between">
            <span className="self-center text-xs text-muted-foreground" aria-live="polite">
              {position}
            </span>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                disabled={!canAct || busy}
                onClick={() => setConfirmClear(true)}
              >
                <Trash2 className="mr-1 h-4 w-4" aria-hidden />
                Apagar
              </Button>
              <Button
                variant="outline"
                disabled={!canAct || busy}
                onClick={() => onAction("keep")}
              >
                {pending === "keep" ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Undo2 className="mr-1 h-4 w-4" aria-hidden />
                )}
                Manter como está
              </Button>
              <Button
                disabled={!canAct || busy || !detail?.candidate}
                onClick={() => onAction("confirm")}
              >
                {pending === "confirm" ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Check className="mr-1 h-4 w-4" aria-hidden />
                )}
                Confirmar com o 9
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
