// Diálogo para publicar/editar um checkpoint macro de projeto.
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createProjectUpdate,
  updateProjectUpdate,
  type ProjectUpdateRow,
} from "@/lib/projects/delivery.functions";
import { HEALTH_LABELS, VISIBILITY_LABELS } from "@/lib/projects/delivery-labels";

export function ProjectUpdateDialog({
  projectId,
  update,
  trigger,
  open,
  onOpenChange,
}: {
  projectId: string;
  update?: ProjectUpdateRow | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const create = useServerFn(createProjectUpdate);
  const patch = useServerFn(updateProjectUpdate);

  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [health, setHealth] = useState<string>("green");
  const [progress, setProgress] = useState<string>("");
  const [expected, setExpected] = useState<string>("");
  const [visibility, setVisibility] = useState<string>("commercial");

  useEffect(() => {
    if (!isOpen) return;
    setTitle(update?.title ?? "");
    setSummary(update?.summary ?? "");
    setHealth(update?.health ?? "green");
    setProgress(update?.progress_pct != null ? String(update.progress_pct) : "");
    setExpected(update?.expected_delivery_date ?? "");
    setVisibility(update?.visibility ?? "commercial");
  }, [isOpen, update]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim(),
        summary: summary.trim() ? summary.trim() : null,
        health: health as "green" | "yellow" | "red",
        progressPct: progress.trim() === "" ? null : Number(progress),
        expectedDeliveryDate: expected || null,
        visibility: visibility as "internal" | "commercial",
      };
      if (update) return patch({ data: { id: update.id, ...payload } });
      return create({ data: { projectId, ...payload } });
    },
    onSuccess: () => {
      toast.success(update ? "Acompanhamento atualizado." : "Acompanhamento publicado.");
      void qc.invalidateQueries({ queryKey: ["project-delivery"] });
      void qc.invalidateQueries({ queryKey: ["deal-delivery"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível salvar o acompanhamento."),
  });

  const invalid =
    title.trim().length === 0 ||
    (progress !== "" && (Number(progress) < 0 || Number(progress) > 100));

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{update ? "Editar acompanhamento" : "Publicar acompanhamento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pu-title">Título</Label>
            <Input
              id="pu-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Sprint de integração concluída"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pu-summary">Resumo macro</Label>
            <Textarea
              id="pu-summary"
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Explicação macro da evolução, sem detalhes de tarefas."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pu-health">Farol</Label>
              <Select value={health} onValueChange={setHealth}>
                <SelectTrigger id="pu-health">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(HEALTH_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pu-progress">Evolução (%)</Label>
              <Input
                id="pu-progress"
                type="number"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
                placeholder="0 a 100"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pu-expected">Previsão de entrega</Label>
              <Input
                id="pu-expected"
                type="date"
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pu-visibility">Visibilidade</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger id="pu-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={invalid || save.isPending}>
            {save.isPending ? "Salvando..." : update ? "Salvar" : "Publicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
