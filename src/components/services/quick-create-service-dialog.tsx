import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { createService } from "@/lib/services.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractId: string;
  defaultCurrency?: string;
  onCreated?: (id: string) => void;
};

export function QuickCreateServiceDialog({
  open,
  onOpenChange,
  contractId,
  defaultCurrency = "BRL",
  onCreated,
}: Props) {
  const create = useServerFn(createService);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"one_time" | "recurring" | "usage_based" | "milestone">(
    "recurring",
  );
  const [cadence, setCadence] = useState<"monthly" | "quarterly" | "yearly" | "on_delivery">(
    "monthly",
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number | "">("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setType("recurring");
      setCadence("monthly");
      setQuantity(1);
      setUnitPrice("");
      setStartsAt("");
      setEndsAt("");
    }
  }, [open]);

  async function submit() {
    if (!name.trim()) {
      toast.error("Informe um nome.");
      return;
    }
    setSaving(true);
    try {
      const row = await create({
        data: {
          contractId,
          name: name.trim(),
          description: description.trim() || null,
          type,
          cadence: type === "recurring" ? cadence : null,
          quantity: Number(quantity) || 1,
          unitPrice: typeof unitPrice === "number" ? unitPrice : 0,
          currency: defaultCurrency,
          startsAt: startsAt || null,
          endsAt: endsAt || null,
        },
      });
      toast.success("Serviço criado.");
      onOpenChange(false);
      onCreated?.(row.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo serviço</DialogTitle>
          <DialogDescription>
            Serviço vinculado ao contrato. Ao ativar, gera lançamentos financeiros conforme a
            cadência.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Consultoria mensal"
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recurring">Recorrente</SelectItem>
                  <SelectItem value="one_time">Único</SelectItem>
                  <SelectItem value="milestone">Por marco</SelectItem>
                  <SelectItem value="usage_based">Por uso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {type === "recurring" ? (
              <div className="space-y-2">
                <Label>Cadência</Label>
                <Select value={cadence} onValueChange={(v) => setCadence(v as typeof cadence)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Preço unitário</Label>
              <CurrencyInput
                value={typeof unitPrice === "number" ? unitPrice : undefined}
                onValueChange={(v) => setUnitPrice(typeof v === "number" ? v : "")}
                currency={defaultCurrency}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Início</Label>
              <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fim</Label>
              <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Criando…" : "Criar serviço"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
