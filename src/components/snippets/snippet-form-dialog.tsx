import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RichHtmlEditor, htmlToPlain } from "@/components/rich-html-editor";
import { upsertSnippet, type SnippetRow } from "@/lib/snippets.functions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Partial<SnippetRow> | null;
  canShare: boolean;
  onSaved: () => void;
};

export function SnippetFormDialog({ open, onOpenChange, editing, canShare, onSaved }: Props) {
  const upsertFn = useServerFn(upsertSnippet);
  const [name, setName] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [folder, setFolder] = useState("");
  const [visibility, setVisibility] = useState<"personal" | "shared">("personal");
  const [bodyHtml, setBodyHtml] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setShortcut(editing?.shortcut ?? "");
    setFolder(editing?.folder ?? "");
    setVisibility((editing?.visibility as "personal" | "shared") ?? "personal");
    setBodyHtml(editing?.body_html ?? editing?.body_text ?? "");
  }, [open, editing]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const bodyText = htmlToPlain(bodyHtml);
      return upsertFn({
        data: {
          id: editing?.id,
          name: name.trim(),
          shortcut: shortcut.trim(),
          body_html: bodyHtml,
          body_text: bodyText,
          folder: folder.trim() || null,
          visibility,
        },
      });
    },
    onSuccess: () => {
      toast.success(editing?.id ? "Snippet atualizado" : "Snippet criado");
      onOpenChange(false);
      onSaved();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar"),
  });

  const canSubmit = name.trim().length > 0 && /^[a-zA-Z0-9_\-/]{1,40}$/.test(shortcut.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing?.id ? "Editar snippet" : "Novo snippet"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="snip-name">Nome</Label>
              <Input
                id="snip-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Assinatura padrão"
                maxLength={120}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="snip-shortcut">Atalho</Label>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">/</span>
                <Input
                  id="snip-shortcut"
                  value={shortcut}
                  onChange={(e) => setShortcut(e.target.value)}
                  placeholder="assinatura"
                  maxLength={40}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                letras, números, <code>_</code>, <code>-</code>, <code>/</code>
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="snip-folder">Pasta (opcional)</Label>
              <Input
                id="snip-folder"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="Vendas, Suporte…"
                maxLength={80}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Visibilidade</Label>
              <RadioGroup
                value={visibility}
                onValueChange={(v) => setVisibility(v as "personal" | "shared")}
                className="flex gap-4 pt-1"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="personal" /> Pessoal
                </label>
                <label
                  className={`flex items-center gap-2 text-sm ${canShare ? "" : "opacity-50"}`}
                  title={canShare ? undefined : "Apenas administradores"}
                >
                  <RadioGroupItem value="shared" disabled={!canShare} /> Compartilhado
                </label>
              </RadioGroup>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Conteúdo</Label>
            <RichHtmlEditor value={bodyHtml} onChange={setBodyHtml} minHeight={160} />
            <p className="text-xs text-muted-foreground">
              O texto será inserido no lugar do atalho. Em campos sem formatação (chat, WhatsApp), a
              versão em texto puro é usada automaticamente.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => saveMut.mutate()} disabled={!canSubmit || saveMut.isPending}>
            {saveMut.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
