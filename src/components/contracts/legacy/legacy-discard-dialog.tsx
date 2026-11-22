import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArchiveX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { discardContractLegacy } from "@/lib/contracts/legacy.functions";

/** Confirmation is explicit; retries retain the operation id and the submitted reason. */
export function LegacyDiscardDialog({
  contractId,
  revision,
  allowed,
}: {
  contractId: string;
  revision: number;
  allowed: boolean;
}) {
  const permissions = usePermissions();
  const permitted =
    allowed &&
    !permissions.isLoading &&
    !permissions.isError &&
    permissions.can("techcontracts.legacy_contracts.view.workspace");
  const discard = useServerFn(discardContractLegacy);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  async function submit() {
    if (!permitted || busy || !confirmed || reason.trim().length < 5 || !operationId) return;
    setBusy(true);
    setError(null);
    try {
      await discard({
        data: { contractId, expectedRevision: revision, reason, confirmed: true, operationId },
      });
      setOpen(false);
      toast.success("Legado descartado. Original e histórico preservados.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["contract-legacy", contractId] }),
        qc.invalidateQueries({ queryKey: ["contract", contractId] }),
        qc.invalidateQueries({ queryKey: ["contracts"] }),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível descartar o legado.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="outline"
        className="w-full text-destructive"
        disabled={!permitted}
        title={
          permitted
            ? undefined
            : "Exige acesso de consulta, alteração e exclusão deste contrato e consulta de legados."
        }
        onClick={() => {
          setReason("");
          setConfirmed(false);
          setError(null);
          setOperationId(crypto.randomUUID());
          setOpen(true);
        }}
      >
        <ArchiveX className="mr-2 h-4 w-4" aria-hidden="true" /> Descartar legado pendente
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar legado pendente?</AlertDialogTitle>
            <AlertDialogDescription>
              O contrato ficará somente para consulta, com o original e o histórico preservados.
              Esta ação não pode ser desfeita e não rescinde uma operação existente nem altera
              cobranças.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <Label htmlFor="legacy-discard-reason">Motivo do descarte</Label>
            <Textarea
              id="legacy-discard-reason"
              value={reason}
              maxLength={2000}
              disabled={busy}
              onChange={(e) => {
                setReason(e.target.value);
                setOperationId(crypto.randomUUID());
              }}
              aria-describedby="legacy-discard-limit"
            />
            <p id="legacy-discard-limit" className="text-xs text-muted-foreground">
              De 5 a 2000 caracteres.
            </p>
            <div className="flex items-start gap-2">
              <Checkbox
                id="legacy-discard-confirm"
                checked={confirmed}
                disabled={busy}
                onCheckedChange={(value) => setConfirmed(value === true)}
              />
              <Label htmlFor="legacy-discard-confirm" className="text-sm leading-5">
                Confirmo o descarte deste legado pendente, preservando o documento e a trilha.
              </Label>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!permitted || busy || !confirmed || reason.trim().length < 5}
              onClick={() => void submit()}
            >
              {busy ? "Descartando…" : "Confirmar descarte"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
