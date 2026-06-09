import { formatDateTime } from "@/lib/crm";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listSchedules,
  upsertSchedule,
  deleteSchedule,
  toggleSchedule,
  runScheduleNow,
} from "@/lib/scheduled-exports.functions";
import { listReports } from "@/lib/reports.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, Play, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/exports")({
  component: ExportsPage,
});

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type FormState = {
  id?: string;
  report_id: string;
  name: string;
  recipients: string;
  frequency: "daily" | "weekly" | "monthly";
  hour_of_day: number;
  day_of_week: number;
  day_of_month: number;
  enabled: boolean;
};

function emptyForm(): FormState {
  return {
    report_id: "",
    name: "",
    recipients: "",
    frequency: "weekly",
    hour_of_day: 8,
    day_of_week: 1,
    day_of_month: 1,
    enabled: true,
  };
}

function ExportsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listSchedules);
  const save = useServerFn(upsertSchedule);
  const remove = useServerFn(deleteSchedule);
  const toggle = useServerFn(toggleSchedule);
  const runNow = useServerFn(runScheduleNow);
  const reports = useServerFn(listReports);

  const schedQ = useQuery({ queryKey: ["report-schedules"], queryFn: () => list() });
  const reportsQ = useQuery({ queryKey: ["reports"], queryFn: () => reports() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  function openCreate() {
    setForm(emptyForm());
    setOpen(true);
  }
  function openEdit(s: any) {
    setForm({
      id: s.id,
      report_id: s.report_id,
      name: s.name,
      recipients: (s.recipients ?? []).join(", "),
      frequency: s.frequency,
      hour_of_day: s.hour_of_day ?? 8,
      day_of_week: s.day_of_week ?? 1,
      day_of_month: s.day_of_month ?? 1,
      enabled: s.enabled,
    });
    setOpen(true);
  }

  const saveMut = useMutation({
    mutationFn: (data: any) => save({ data }),
    onSuccess: () => {
      toast.success("Agendamento salvo.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["report-schedules"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report-schedules"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });
  const toggleMut = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report-schedules"] }),
  });
  const runMut = useMutation({
    mutationFn: (id: string) => runNow({ data: { id } }),
    onSuccess: (r: any) => {
      if (r?.ok) toast.success(`Enviado (${r.rows} linhas).`);
      else toast.error(r?.error ?? "Erro ao executar.");
      qc.invalidateQueries({ queryKey: ["report-schedules"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });

  function handleSubmit() {
    if (!form.report_id) return toast.error("Selecione um relatório.");
    if (!form.name.trim()) return toast.error("Dê um nome ao agendamento.");
    const recipients = form.recipients
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (recipients.length === 0) return toast.error("Adicione ao menos um destinatário.");
    saveMut.mutate({
      ...(form.id ? { id: form.id } : {}),
      report_id: form.report_id,
      name: form.name.trim(),
      recipients,
      frequency: form.frequency,
      hour_of_day: form.hour_of_day,
      day_of_week: form.frequency === "weekly" ? form.day_of_week : null,
      day_of_month: form.frequency === "monthly" ? form.day_of_month : null,
      enabled: form.enabled,
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Exports agendados por email
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Envie relatórios salvos por email automaticamente (diário, semanal ou mensal). O CSV vai como anexo, usando sua conta Gmail conectada.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Novo agendamento
          </Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Relatório</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead>Destinatários</TableHead>
                  <TableHead>Próx. envio</TableHead>
                  <TableHead>Último</TableHead>
                  <TableHead className="w-24">Ativo</TableHead>
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedQ.isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Carregando…</TableCell></TableRow>
                ) : (schedQ.data ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhum agendamento.</TableCell></TableRow>
                ) : (
                  (schedQ.data as any[]).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.custom_reports?.name ?? s.report_id}</TableCell>
                      <TableCell>
                        {s.frequency === "daily" && `Diário às ${String(s.hour_of_day).padStart(2, "0")}:00 UTC`}
                        {s.frequency === "weekly" && `${WEEKDAYS[s.day_of_week ?? 1]} às ${String(s.hour_of_day).padStart(2, "0")}:00 UTC`}
                        {s.frequency === "monthly" && `Dia ${s.day_of_month} às ${String(s.hour_of_day).padStart(2, "0")}:00 UTC`}
                      </TableCell>
                      <TableCell className="text-xs">{(s.recipients ?? []).join(", ")}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.next_run_at ? formatDateTime(s.next_run_at) : "—"}
                      </TableCell>
                      <TableCell>
                        {s.last_status ? (
                          <Badge variant={s.last_status === "success" ? "default" : "destructive"}>
                            {s.last_status === "success" ? "✓" : "✕"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={s.enabled}
                          onCheckedChange={(enabled) => toggleMut.mutate({ id: s.id, enabled })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-0.5">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => runMut.mutate(s.id)} title="Executar agora">
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => delMut.mutate(s.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar agendamento" : "Novo agendamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Relatório</Label>
              <Select value={form.report_id} onValueChange={(v) => setForm({ ...form, report_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {(reportsQ.data ?? []).map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome do agendamento</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Destinatários (separados por vírgula)</Label>
              <Input
                placeholder="time@empresa.com, gestor@empresa.com"
                value={form.recipients}
                onChange={(e) => setForm({ ...form, recipients: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Frequência</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Hora (UTC)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={form.hour_of_day}
                  onChange={(e) => setForm({ ...form, hour_of_day: Number(e.target.value) })}
                />
              </div>
            </div>
            {form.frequency === "weekly" && (
              <div>
                <Label>Dia da semana</Label>
                <Select value={String(form.day_of_week)} onValueChange={(v) => setForm({ ...form, day_of_week: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((d, i) => (
                      <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.frequency === "monthly" && (
              <div>
                <Label>Dia do mês (1–28)</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={form.day_of_month}
                  onChange={(e) => setForm({ ...form, day_of_month: Number(e.target.value) })}
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={(enabled) => setForm({ ...form, enabled })} />
              <Label className="!mt-0">Ativo</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              O envio usa a conta Gmail conectada do dono do workspace (configure em Configurações → Conexão de Email).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saveMut.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
