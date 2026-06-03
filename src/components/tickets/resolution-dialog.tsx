import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function ResolutionDialog({
  open,
  onOpenChange,
  onConfirm,
  count = 1,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (note: string) => void | Promise<void>;
  count?: number;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNote("");
      setSaving(false);
    }
  }, [open]);

  const confirm = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await onConfirm(note.trim());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resolução do chamado</DialogTitle>
          <DialogDescription>
            {count > 1
              ? `Descreva a resolução aplicada aos ${count} chamados. O texto será incluído na DM enviada ao solicitante.`
              : "Descreva a resolução aplicada. O texto será incluído na DM enviada ao solicitante."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label htmlFor="resolution-note">Texto de resolução *</Label>
          <Textarea
            id="resolution-note"
            rows={5}
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: Reiniciamos o serviço X e validamos com o usuário."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={saving || !note.trim()}>
            {saving ? "Salvando…" : "Marcar como resolvido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
