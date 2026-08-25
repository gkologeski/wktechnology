// Diálogo para lançar/editar apontamento de horas na ficha da pessoa.
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { upsertTimeEntry } from "@/lib/people/timesheet.functions";

export type TimeEntryDraft = {
  id?: string;
  project_id?: string | null;
  project_name?: string | null;
  task_id?: string | null;
  task_title?: string | null;
  allocation_id?: string | null;
  entry_date?: string;
  hours?: number;
  billable?: boolean;
  hourly_rate?: number | null;
  description?: string | null;
};

export function TimeEntryDialog({
  open,
  onOpenChange,
  personId,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  personId: string;
  initial?: TimeEntryDraft | null;
}) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertTimeEntry);

  const [projectId, setProjectId] = useState<string | null>(initial?.project_id ?? null);
  const [projectLabel, setProjectLabel] = useState<string | null>(initial?.project_name ?? null);
  const [taskId, setTaskId] = useState<string | null>(initial?.task_id ?? null);
  const [entryDate, setEntryDate] = useState<string>(
    initial?.entry_date ?? new Date().toISOString().slice(0, 10),
  );
  const [hours, setHours] = useState<string>(String(initial?.hours ?? 1));
  const [billable, setBillable] = useState<boolean>(initial?.billable ?? true);
  const [hourlyRate, setHourlyRate] = useState<string>(
    initial?.hourly_rate != null ? String(initial.hourly_rate) : "",
  );
  const [description, setDescription] = useState<string>(initial?.description ?? "");

  useEffect(() => {
    if (open) {
      setProjectId(initial?.project_id ?? null);
      setProjectLabel(initial?.project_name ?? null);
      setTaskId(initial?.task_id ?? null);
      setEntryDate(initial?.entry_date ?? new Date().toISOString().slice(0, 10));
      setHours(String(initial?.hours ?? 1));
      setBillable(initial?.billable ?? true);
      setHourlyRate(initial?.hourly_rate != null ? String(initial.hourly_rate) : "");
      setDescription(initial?.description ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("Selecione um projeto");
      const h = Number(hours);
      if (!(h > 0)) throw new Error("Horas devem ser maior que zero");
      const rate = hourlyRate.trim() ? Number(hourlyRate) : null;
      return upsert({
        data: {
          id: initial?.id,
          person_id: personId,
          project_id: projectId,
          task_id: taskId,
          allocation_id: initial?.allocation_id ?? null,
          entry_date: entryDate,
          hours: h,
          billable,
          hourly_rate: rate,
          description: description.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success(initial?.id ? "Apontamento atualizado" : "Apontamento criado");
      qc.invalidateQueries({ queryKey: ["person-timesheet", personId] });
      qc.invalidateQueries({ queryKey: ["person-allocations-period", personId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const preview = billable && hours && hourlyRate ? Number(hours) * Number(hourlyRate) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar apontamento" : "Lançar horas"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-1.5">
            <Label>Projeto</Label>
            <EntityCombobox
              entity="projects"
              select="id, name"
              searchColumn="name"
              labelFrom={(r) => (r.name as string) ?? "—"}
              value={projectId}
              onChange={(id, item) => {
                setProjectId(id);
                setProjectLabel(item?.label ?? null);
                setTaskId(null);
              }}
              placeholder="Selecionar projeto"
            />
          </div>

          {projectId && (
            <div className="grid gap-1.5">
              <Label>Tarefa (opcional)</Label>
              <EntityCombobox
                entity="project_tasks"
                select="id, title, project_id"
                searchColumn="title"
                filters={{ project_id: projectId }}
                labelFrom={(r) => (r.title as string) ?? "—"}
                value={taskId}
                onChange={(id) => setTaskId(id)}
                placeholder="Selecionar tarefa"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="te-date">Data</Label>
              <Input
                id="te-date"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="te-hours">Horas</Label>
              <Input
                id="te-hours"
                type="number"
                min="0"
                step="0.25"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="te-billable" className="text-sm">
                Billable
              </Label>
              <p className="text-xs text-muted-foreground">
                Contabiliza receita para o contrato/projeto.
              </p>
            </div>
            <Switch id="te-billable" checked={billable} onCheckedChange={setBillable} />
          </div>

          {billable && (
            <div className="grid gap-1.5">
              <Label htmlFor="te-rate">Tarifa/h (opcional — usa a da alocação se vazio)</Label>
              <Input
                id="te-rate"
                type="number"
                min="0"
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
              />
              {preview > 0 && (
                <p className="text-xs text-muted-foreground">
                  Valor: {preview.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              )}
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="te-desc">Descrição</Label>
            <Textarea
              id="te-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="O que foi feito?"
            />
          </div>

          {projectLabel && <p className="text-xs text-muted-foreground">Projeto: {projectLabel}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : initial?.id ? "Atualizar" : "Lançar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
