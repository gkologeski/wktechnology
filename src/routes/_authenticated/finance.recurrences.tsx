import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Plus, Play, Pause, Trash2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/crm";
import {
  deleteRecurrence,
  listRecurrences,
  runMyDueRecurrences,
  toggleRecurrence,
  upsertRecurrence,
} from "@/lib/finance-recurrences.functions";
import { listCategories } from "@/lib/finance.functions";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  LegalEntitySelect,
  useLegalEntityFilter,
  useLegalEntityFilterInput,
} from "@/components/finance/legal-entity-select";

export const Route = createFileRoute("/_authenticated/finance/recurrences")({
  head: () => ({ meta: [{ title: "Recorrências financeiras" }] }),
  component: RecurrencesPage,
});

const CADENCE_LABEL: Record<string, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  yearly: "Anual",
  custom_days: "A cada N dias",
};

function RecurrencesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listRecurrences);
  const upsert = useServerFn(upsertRecurrence);
  const toggle = useServerFn(toggleRecurrence);
  const del = useServerFn(deleteRecurrence);
  const runDue = useServerFn(runMyDueRecurrences);
  const listCats = useServerFn(listCategories);

  const [tab, setTab] = useState<"all" | "receivable" | "payable">("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [legalEntityId, setLegalEntityId] = useLegalEntityFilter();
  const filterInput = useLegalEntityFilterInput(legalEntityId);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["finance-recurrences", tab, legalEntityId, JSON.stringify(filterInput)],
    queryFn: () =>
      list({
        data: { ...(tab === "all" ? {} : { direction: tab }), ...filterInput },
      }),
  });

  const { data: cats = [] } = useQuery({
    queryKey: ["finance-categories"],
    queryFn: () => listCats(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["finance-recurrences"] });
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Recorrências"
        description="Modelos que geram lançamentos financeiros automaticamente."
        actions={
          <div className="flex gap-2">
            <LegalEntitySelect value={legalEntityId} onChange={setLegalEntityId} />
            <Button
              variant="outline"
              onClick={async () => {
                const r = await runDue();
                toast.success(`Recorrências processadas. ${r.generated} lançamento(s) gerado(s).`);
                invalidate();
              }}
            >
              <RefreshCcw className="h-4 w-4 mr-1" /> Rodar agora
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova recorrência
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="receivable">A receber</TabsTrigger>
          <TabsTrigger value="payable">A pagar</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ativas e paradas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma recorrência cadastrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Direção</TableHead>
                  <TableHead>Cadência</TableHead>
                  <TableHead>Próxima geração</TableHead>
                  <TableHead>Geradas</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-40" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.template?.description ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {r.direction === "receivable" ? "A receber" : "A pagar"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {CADENCE_LABEL[r.cadence] ?? r.cadence}
                      {r.cadence === "custom_days" && r.interval_days
                        ? ` (${r.interval_days}d)`
                        : ""}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{r.next_run_date}</TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {r.occurrences_generated}
                      {r.max_occurrences ? `/${r.max_occurrences}` : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatCurrency(
                        Number(r.template?.amount ?? 0),
                        (r.template?.currency as string) ?? "BRL",
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.active ? "default" : "secondary"} className="text-xs">
                        {r.active ? "Ativa" : "Parada"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            await toggle({ data: { id: r.id, active: !r.active } });
                            invalidate();
                          }}
                          title={r.active ? "Pausar" : "Ativar"}
                        >
                          {r.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            if (
                              !(await confirmDialog(
                                "Excluir esta recorrência? Lançamentos já gerados serão mantidos.",
                              ))
                            )
                              return;
                            await del({ data: { id: r.id } });
                            toast.success("Recorrência excluída.");
                            invalidate();
                          }}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NewRecurrenceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={cats}
        onSave={async (payload) => {
          await upsert({ data: payload });
          toast.success("Recorrência criada.");
          setDialogOpen(false);
          invalidate();
        }}
      />
    </div>
  );
}

function NewRecurrenceDialog({
  open,
  onOpenChange,
  categories,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: any[];
  onSave: (data: any) => Promise<void>;
}) {
  const [direction, setDirection] = useState<"receivable" | "payable">("receivable");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cadence, setCadence] = useState<"weekly" | "monthly" | "yearly" | "custom_days">(
    "monthly",
  );
  const [intervalDays, setIntervalDays] = useState<number>(30);
  const [dayOfMonth, setDayOfMonth] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>("");
  const [maxOccurrences, setMaxOccurrences] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredCats = useMemo(
    () =>
      categories.filter((c) =>
        direction === "receivable" ? c.kind === "revenue" : c.kind === "expense",
      ),
    [categories, direction],
  );

  const submit = async () => {
    const amt = Number(amount);
    if (!description.trim() || !Number.isFinite(amt) || amt <= 0) {
      toast.error("Preencha descrição e valor.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        direction,
        template: {
          description: description.trim(),
          amount: amt,
          currency: "BRL",
          category_id: categoryId,
          notes: notes || null,
        },
        cadence,
        interval_days: cadence === "custom_days" ? intervalDays : null,
        day_of_month: dayOfMonth,
        start_date: startDate,
        end_date: endDate || null,
        max_occurrences: maxOccurrences ? Number(maxOccurrences) : null,
      });
      // reset
      setDescription("");
      setAmount("");
      setNotes("");
      setMaxOccurrences("");
      setEndDate("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova recorrência</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Direção</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receivable">A receber</SelectItem>
                  <SelectItem value="payable">A pagar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select
                value={categoryId ?? "__none"}
                onValueChange={(v) => setCategoryId(v === "__none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sem categoria</SelectItem>
                  {filteredCats.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Cadência</Label>
              <Select value={cadence} onValueChange={(v) => setCadence(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                  <SelectItem value="custom_days">A cada N dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {cadence === "custom_days" && (
            <div className="space-y-1">
              <Label>Intervalo (dias)</Label>
              <Input
                type="number"
                min={1}
                value={intervalDays}
                onChange={(e) => setIntervalDays(Number(e.target.value) || 30)}
              />
            </div>
          )}

          {(cadence === "monthly" || cadence === "yearly") && (
            <div className="space-y-1">
              <Label>Dia do mês (opcional)</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={dayOfMonth ?? ""}
                onChange={(e) => setDayOfMonth(e.target.value ? Number(e.target.value) : null)}
                placeholder="Usa o dia da data inicial"
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Início</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fim (opcional)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Máx. ocorrências</Label>
              <Input
                type="number"
                min={1}
                value={maxOccurrences}
                onChange={(e) => setMaxOccurrences(e.target.value)}
                placeholder="Sem limite"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notas</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando…" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
