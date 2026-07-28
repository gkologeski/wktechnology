import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { QuickCreateCompanyDialog } from "@/components/record/quick-create-dialogs";
import { createContract } from "@/lib/contracts.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
  initialCompanyId?: string | null;
  initialDealId?: string | null;
  initialRole?: "provider" | "client";
};

export function QuickCreateContractDialog({
  open,
  onOpenChange,
  onCreated,
  initialCompanyId,
  initialDealId,
  initialRole = "provider",
}: Props) {
  const create = useServerFn(createContract);
  const [title, setTitle] = useState("");
  const [role, setRole] = useState<"provider" | "client">(initialRole);
  const [companyId, setCompanyId] = useState<string | null>(initialCompanyId ?? null);
  const [dealId, setDealId] = useState<string | null>(initialDealId ?? null);
  const [totalValue, setTotalValue] = useState<number | "">("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setRole(initialRole);
      setCompanyId(initialCompanyId ?? null);
      setDealId(initialDealId ?? null);
      setTotalValue("");
      setStartsAt("");
      setEndsAt("");
    }
  }, [open, initialCompanyId, initialDealId, initialRole]);

  async function submit() {
    if (!title.trim()) {
      toast.error("Informe um título.");
      return;
    }
    setSaving(true);
    try {
      const row = await create({
        data: {
          title: title.trim(),
          role,
          counterpartyCompanyId: companyId,
          dealId,
          totalValue: typeof totalValue === "number" ? totalValue : 0,
          currency: "BRL",
          startsAt: startsAt || null,
          endsAt: endsAt || null,
        },
      });
      toast.success("Contrato criado.");
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
          <DialogTitle>Novo contrato</DialogTitle>
          <DialogDescription>
            Crie um contrato em rascunho. Os detalhes podem ser editados depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "provider" | "client")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="provider">Prestação (nós fornecemos)</SelectItem>
                <SelectItem value="client">Compra (nós contratamos)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Título *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Contrato de prestação de serviços — ACME"
            />
          </div>

          <div className="space-y-2">
            <Label>Contraparte (empresa)</Label>
            <EntityCombobox
              entity="companies"
              select="id, name, domain"
              labelFrom={(r) => (r.name as string) ?? ""}
              hintFrom={(r) => (r.domain as string | null) ?? null}
              value={companyId}
              onChange={(id) => setCompanyId(id)}
              placeholder="Selecione a empresa"
            />
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

          <div className="space-y-2">
            <Label>Valor total</Label>
            <CurrencyInput
              value={typeof totalValue === "number" ? totalValue : undefined}
              onValueChange={(v) => setTotalValue(typeof v === "number" ? v : "")}
              currency="BRL"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Criando…" : "Criar contrato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
