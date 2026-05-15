import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConfirmCountDialog({
  open, setOpen, count, entity, onConfirm,
}: {
  open: boolean; setOpen: (b: boolean) => void; count: number; entity: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const ok = typed.trim() === String(count);
  return (
    <Dialog open={open} onOpenChange={(b) => { if (!b) setTyped(""); setOpen(b); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar exclusão</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Você está prestes a excluir <strong>{count}</strong> {entity}. Esta ação é irreversível.
        </p>
        <p className="text-sm">
          Para confirmar, digite o número <strong>{count}</strong>:
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-count">Confirmação</Label>
          <Input id="confirm-count" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="destructive" disabled={!ok} onClick={async () => { await onConfirm(); setTyped(""); setOpen(false); }}>
            Excluir {count}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
