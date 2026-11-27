import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IsoDatePicker } from "@/components/iso-date-picker";
import { completeServiceExecution } from "@/lib/services.functions";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { readViewAs } from "@/lib/view-as-client";
import { formatIsoDate } from "@/lib/iso-date";

/** Conclusão operacional auditada; nunca gera cobrança ou presume assinatura. */
export function ServiceExecutionButton({
  serviceId,
  status,
  canUpdate,
  contractId,
}: {
  serviceId: string;
  status: string;
  canUpdate: boolean;
  contractId?: string | null;
}) {
  const permissions = usePermissions();
  const complete = useServerFn(completeServiceExecution);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [completedAt, setCompletedAt] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const allowed =
    canUpdate &&
    !permissions.isLoading &&
    !permissions.isError &&
    !readViewAs()?.readOnly &&
    readViewAs()?.mode !== "role" &&
    permissions.can("techservice.service_execution.manage.workspace") &&
    ["active", "paused"].includes(status);
  if (!allowed) return null;

  async function submit() {
    setBusy(true);
    try {
      await complete({ data: { id: serviceId, completedAt, reason: reason.trim() } });
      toast.success(
        "Execução concluída. A assinatura e o faturamento seguem seus próprios registros.",
      );
      setOpen(false);
      setCompletedAt("");
      setReason("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["service", serviceId] }),
        qc.invalidateQueries({ queryKey: ["services"] }),
        qc.invalidateQueries({ queryKey: ["contract-services", contractId] }),
        qc.invalidateQueries({ queryKey: ["journey-services"] }),
        qc.invalidateQueries({ queryKey: ["deal-contracting-journey"] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir a execução.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Check className="mr-1 h-3.5 w-3.5" aria-hidden /> Concluir execução
      </Button>
      <Dialog open={open} onOpenChange={(value) => !busy && setOpen(value)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Concluir execução do serviço</DialogTitle>
            <DialogDescription>
              Registre quando o trabalho foi entregue. A conclusão não registra assinatura nem gera
              lançamento financeiro. Sem aceite do contrato ou assinatura, a cobrança permanece
              retida.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="service-completed-at">Data da conclusão</Label>
            <IsoDatePicker
              id="service-completed-at"
              ariaLabel="Data da conclusão"
              value={completedAt}
              onChange={(value) => setCompletedAt(value ?? "")}
              max={formatIsoDate(new Date())}
              required
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="service-completion-reason">Motivo e comprovação</Label>
            <Textarea
              id="service-completion-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={2000}
              placeholder="Informe a entrega realizada e como a conclusão foi confirmada."
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">
              Mínimo de 10 caracteres. Seu usuário, a data informada e o registro ficam no
              histórico.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={busy || !completedAt || reason.trim().length < 10} onClick={submit}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              Confirmar conclusão da execução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
