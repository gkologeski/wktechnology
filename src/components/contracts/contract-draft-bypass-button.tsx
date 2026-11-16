// MINUTA-BLOQUEIO: dispensa registrada do aceite do cliente (decisão final no banco).
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck } from "lucide-react";
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
import { bypassContractDraftClientAcceptance } from "@/lib/contracts/contract-drafts.functions";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  canBypassClientAcceptance,
  CONTRACT_DRAFT_APPROVE_KEY,
  CONTRACT_DRAFT_BYPASS_KEY,
} from "@/lib/contracts/contract-draft-status";

export function ContractDraftBypassButton(props: {
  draftId: string;
  status: string;
  /** A tela só mostra esta área ao aprovador listado e ativo (regra real no banco). */
  workspaceId: string;
  onDone: () => void;
}) {
  const bypass = useServerFn(bypassContractDraftClientAcceptance);
  const perms = usePermissions();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const keys = new Set(
    [CONTRACT_DRAFT_APPROVE_KEY, CONTRACT_DRAFT_BYPASS_KEY].filter((k) => perms.can(k)),
  );
  const allowed = canBypassClientAcceptance(props.status, props.workspaceId, {
    workspaceId: props.workspaceId,
    memberActive: true,
    listedApprover: true,
    keys,
  });
  if (!allowed) return null;
  const valid = reason.trim().length >= 10;
  const submit = async () => {
    setBusy(true);
    try {
      await bypass({ data: { id: props.draftId, reason: reason.trim() } });
      toast.success("Aceite dispensado. O contrato já pode ser criado.");
      setOpen(false);
      props.onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ShieldCheck className="mr-2 h-4 w-4" />
        Dispensar aceite do cliente
      </Button>
      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Dispensar aceite do cliente</DialogTitle>
            <DialogDescription>
              A minuta passa a contar como aceita e o contrato pode ser criado. Seu nome, o horário e
              o motivo ficam no histórico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="bypass-reason">Motivo da dispensa</Label>
            <Textarea
              id="bypass-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: cliente aprovou a minuta por e-mail em 16/11."
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">Mínimo de 10 caracteres.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={!valid || busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar dispensa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
