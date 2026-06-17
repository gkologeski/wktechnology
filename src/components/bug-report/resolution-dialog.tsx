import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RichHtmlEditor, htmlToPlain } from "@/components/rich-html-editor";

export function BugReportResolutionDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (text: string) => void | Promise<void>;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setText("");
      setSaving(false);
    }
  }, [open]);

  const confirm = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await onConfirm(text.trim());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!saving) onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resolução do chamado</DialogTitle>
          <DialogDescription>
            Descreva a resolução aplicada. O texto será exibido junto à mensagem de mudança de
            status para quem abriu o chamado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label htmlFor="br-resolution-text">Texto de resolução *</Label>
          <Textarea
            id="br-resolution-text"
            rows={5}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ex.: Corrigimos o erro X e validamos com o usuário."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={saving || !text.trim()}>
            {saving ? "Salvando…" : "Marcar como resolvido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
