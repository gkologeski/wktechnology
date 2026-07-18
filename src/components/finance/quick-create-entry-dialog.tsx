import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createFinancialEntry, listCategories } from "@/lib/finance.functions";

type Direction = "receivable" | "payable";

const today = () => new Date().toISOString().slice(0, 10);

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
  const listCats = useServerFn(listCategories);

  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState<Direction>(defaultDirection);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(today());
  const [competenceDate, setCompetenceDate] = useState(today());
  const [categoryId, setCategoryId] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [categories, setCategories] = useState<
    Awaited<ReturnType<typeof listCategories>>
  >([]);

  useEffect(() => {
    if (!open) return;
    setDirection(defaultDirection);
    setDescription("");
    setAmount("");
    setDueDate(today());
    setCompetenceDate(today());
    setCategoryId("none");
    setNotes("");
    listCats().then(setCategories).catch(() => setCategories([]));
  }, [open, defaultDirection, listCats]);

  const filteredCats = categories.filter((c) =>
    direction === "receivable" ? c.kind === "revenue" : c.kind === "expense",
  );

  async function submit() {
    const amt = Number(String(amount).replace(",", "."));
    if (!description.trim() || !amt || amt <= 0) {
      toast.error("Preencha descrição e valor.");
      return;
    }
    setSaving(true);
    try {
      await create({
        data: {
          direction,
          origin_type: "manual",
          description: description.trim(),
          amount: amt,
          currency: "BRL",
          competence_date: competenceDate,
          due_date: dueDate,
          category_id: categoryId === "none" ? null : categoryId,
          notes: notes.trim() || null,
        },
      });
      toast.success("Lançamento criado");
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
      <DialogContent className="sm:max-w-lg">
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
              <Label>Valor (R$)</Label>
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
              <Label>Vencimento</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
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
            Criar lançamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
