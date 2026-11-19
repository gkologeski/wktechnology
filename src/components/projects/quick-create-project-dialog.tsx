import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createProject } from "@/lib/projects.functions";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { readViewAs } from "@/lib/view-as-client";

import { IsoDatePicker } from "@/components/iso-date-picker";
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId?: string;
  serviceId?: string;
  onCreated?: (id: string) => void;
  initialName?: string;
};

export function QuickCreateProjectDialog({
  open,
  onOpenChange,
  contractId,
  serviceId,
  onCreated,
  initialName = "",
}: Props) {
  const create = useServerFn(createProject);
  const navigate = useNavigate();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [plannedHours, setPlannedHours] = useState("");
  const [saving, setSaving] = useState(false);
  const p = usePermissions();
  const allowed =
    !p.isLoading &&
    !p.isError &&
    !!p.workspaceId &&
    !readViewAs()?.readOnly &&
    p.canAny(["techprojects.projects.create.own", "techprojects.projects.create.workspace"]);

  const reset = () => {
    setName("");
    setDescription("");
    setDueAt("");
    setPlannedHours("");
  };

  const submit = async () => {
    if (!allowed) return toast.error("Sem permissão para criar projetos.");
    if (!name.trim()) {
      toast.error("Informe o nome do projeto");
      return;
    }
    setSaving(true);
    try {
      const row = await create({
        data: {
          name: name.trim(),
          description: description.trim() || null,
          contractId: contractId ?? null,
          serviceId: serviceId ?? null,
          dueAt: dueAt || null,
          plannedHours: plannedHours ? Number(plannedHours) : null,
        },
      });
      toast.success("Projeto criado");
      onOpenChange(false);
      reset();
      onCreated?.((row as any).id);
      if (!onCreated) navigate({ to: "/projects/$id", params: { id: (row as any).id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar projeto");
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo projeto</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prazo</Label>
              <IsoDatePicker ariaLabel="Prazo" value={dueAt} onChange={(v) => setDueAt(v ?? "")} />
            </div>
            <div className="space-y-1.5">
              <Label>Horas planejadas</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={plannedHours}
                onChange={(e) => setPlannedHours(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Criando…" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
