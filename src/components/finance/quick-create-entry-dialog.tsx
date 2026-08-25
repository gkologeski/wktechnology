import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createFinancialEntry, createInstallments, listCategories } from "@/lib/finance.functions";
import { useLegalEntities } from "@/components/finance/legal-entity-select";

type Direction = "receivable" | "payable";

const today = () => new Date().toISOString().slice(0, 10);

function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function QuickCreateEntryDialog({
  open,
  onOpenChange,
  defaultDirection = "receivable",
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultDirection?: Direction;
  onCreated?: () => void;
}) {
  const create = useServerFn(createFinancialEntry);
  const createParcels = useServerFn(createInstallments);
  const listCats = useServerFn(listCategories);

  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState<Direction>(defaultDirection);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(today());
  const [competenceDate, setCompetenceDate] = useState(today());
  const [categoryId, setCategoryId] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [counterpartyLegalEntityId, setCounterpartyLegalEntityId] = useState<string>("none");
  const { data: legalEntities = [] } = useLegalEntities();
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof listCategories>>>([]);

  // Installment state
  const [installments, setInstallments] = useState(false);
  const [count, setCount] = useState(2);
  const [cadence, setCadence] = useState<"monthly" | "weekly" | "custom_days">("monthly");
  const [customDays, setCustomDays] = useState(30);
  const [splitMode, setSplitMode] = useState<"equal" | "first_bigger">("equal");

  useEffect(() => {
    if (!open) return;
    setDirection(defaultDirection);
    setDescription("");
    setAmount("");
    setDueDate(today());
    setCompetenceDate(today());
    setCategoryId("none");
    setCounterpartyLegalEntityId("none");
    setNotes("");
    setInstallments(false);
    setCount(2);
    setCadence("monthly");
    setCustomDays(30);
    setSplitMode("equal");
    listCats()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [open, defaultDirection, listCats]);

  const filteredCats = categories.filter((c) =>
    direction === "receivable" ? c.kind === "revenue" : c.kind === "expense",
  );

  const amt = Number(String(amount).replace(",", ".")) || 0;
  const preview = useMemo(() => {
    if (!installments || count < 2 || amt <= 0) return [];
    const each = Math.round((amt / count) * 100) / 100;
    const arr = Array(count).fill(each);
    const diff = Math.round((amt - each * count) * 100) / 100;
    if (Math.abs(diff) > 0.001) {
      if (splitMode === "first_bigger") arr[0] = Math.round((arr[0] + diff) * 100) / 100;
      else arr[arr.length - 1] = Math.round((arr[arr.length - 1] + diff) * 100) / 100;
    }
    return arr.map((v, i) => ({
      n: i + 1,
      amount: v,
      due:
        cadence === "monthly"
          ? addMonths(dueDate, i)
          : cadence === "weekly"
            ? addDays(dueDate, i * 7)
            : addDays(dueDate, i * customDays),
    }));
  }, [installments, count, amt, cadence, customDays, dueDate, splitMode]);

  async function submit() {
    if (!description.trim() || !amt || amt <= 0) {
      toast.error("Preencha descrição e valor.");
      return;
    }
    setSaving(true);
    try {
      const base = {
        direction,
        origin_type: "manual" as const,
        description: description.trim(),
        amount: amt,
        currency: "BRL",
        competence_date: competenceDate,
        due_date: dueDate,
        category_id: categoryId === "none" ? null : categoryId,
        counterparty_legal_entity_id:
          counterpartyLegalEntityId === "none" ? null : counterpartyLegalEntityId,
        notes: notes.trim() || null,
      };
      if (installments && count >= 2) {
        await createParcels({
          data: {
            base,
            count,
            cadence,
            custom_interval_days: cadence === "custom_days" ? customDays : undefined,
            split_mode: splitMode,
          },
        });
        toast.success(`Parcelamento criado (${count}×)`);
      } else {
        await create({ data: base });
        toast.success("Lançamento criado");
      }
      onCreated?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as Direction)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="receivable">A receber</SelectItem>
                <SelectItem value="payable">A pagar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Mensalidade — Cliente X"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor total (R$)</Label>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {filteredCats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Competência</Label>
              <Input
                type="date"
                value={competenceDate}
                onChange={(e) => setCompetenceDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Vencimento{installments ? " (1ª parcela)" : ""}</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Parcelar</Label>
                <p className="text-xs text-muted-foreground">
                  Divide o valor total em várias parcelas com vencimentos automáticos.
                </p>
              </div>
              <Switch checked={installments} onCheckedChange={setInstallments} />
            </div>
            {installments && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nº parcelas</Label>
                    <Input
                      type="number"
                      min={2}
                      max={120}
                      value={count}
                      onChange={(e) =>
                        setCount(Math.max(2, Math.min(120, Number(e.target.value) || 2)))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cadência</Label>
                    <Select value={cadence} onValueChange={(v) => setCadence(v as typeof cadence)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="custom_days">Dias fixos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {cadence === "custom_days" ? "Dias entre parcelas" : "Ajuste centavos"}
                    </Label>
                    {cadence === "custom_days" ? (
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={customDays}
                        onChange={(e) => setCustomDays(Math.max(1, Number(e.target.value) || 30))}
                      />
                    ) : (
                      <Select
                        value={splitMode}
                        onValueChange={(v) => setSplitMode(v as typeof splitMode)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="equal">Na última</SelectItem>
                          <SelectItem value="first_bigger">Na primeira</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
                {preview.length > 0 && (
                  <div className="rounded-md bg-muted/50 p-2 max-h-40 overflow-y-auto text-xs">
                    {preview.map((p) => (
                      <div key={p.n} className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">
                          {p.n}/{count} — {p.due}
                        </span>
                        <span className="font-medium">{money(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {legalEntities.length > 1 && (
            <div className="space-y-2">
              <Label>Empresa contra-parte (intercompany)</Label>
              <Select
                value={counterpartyLegalEntityId}
                onValueChange={setCounterpartyLegalEntityId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {(legalEntities as Array<{ id: string; code: string | null; name: string }>).map(
                    (le) => (
                      <SelectItem key={le.id} value={le.id}>
                        {le.code ? `${le.code} · ${le.name}` : le.name}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Marque quando a contra-parte for outro CNPJ do grupo. Esses lançamentos são
                eliminados no DRE e Fluxo de Caixa consolidados.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {installments && count >= 2 ? `Criar ${count} parcelas` : "Criar lançamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
