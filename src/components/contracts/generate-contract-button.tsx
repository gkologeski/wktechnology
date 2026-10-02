// Botão "Gerar contrato" de Propostas e Cotações.
// Se a empresa já tem contrato ativo, pergunta: novo contrato ou termo aditivo.
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FileSignature, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCurrency } from "@/lib/crm";
import { createContractFromSales, listActiveContractsForSales } from "@/lib/sales-flow.functions";

type Source = { proposalId?: string; quoteId?: string };
type Active = Awaited<ReturnType<typeof listActiveContractsForSales>>[number];

export function GenerateContractButton({
  source,
  size = "sm",
  variant = "outline",
}: {
  source: Source;
  size?: "sm" | "default";
  variant?: "outline" | "default";
}) {
  const navigate = useNavigate();
  const listActive = useServerFn(listActiveContractsForSales);
  const create = useServerFn(createContractFromSales);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Active[]>([]);
  const [choice, setChoice] = useState<string>("new");

  async function generate(mainContractId: string | null) {
    setBusy(true);
    try {
      const r = await create({ data: { ...source, mainContractId } });
      const label = mainContractId ? "Aditivo" : "Contrato";
      toast.success(
        r.reused
          ? "Este documento já gerou um contrato — abrindo o existente."
          : `${label} gerado${"templateName" in r && r.templateName ? ` com o modelo "${r.templateName}"` : ""}.`,
      );
      setOpen(false);
      void navigate({ to: "/contracts/$id", params: { id: r.contract.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setBusy(true);
    try {
      const list = await listActive({ data: source });
      if (list.length === 0) {
        setBusy(false);
        await generate(null);
        return;
      }
      setActive(list);
      setChoice("new");
      setOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={() => void start()} disabled={busy}>
        {busy ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <FileSignature className="mr-1 h-4 w-4" aria-hidden="true" />
        )}
        Gerar contrato
      </Button>
      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Esta empresa já tem contrato ativo</DialogTitle>
            <DialogDescription>
              Gere um novo contrato independente ou um termo aditivo de um contrato ativo.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={choice} onValueChange={setChoice} className="space-y-2 py-1">
            <Label
              htmlFor="gc-new"
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/40"
            >
              <RadioGroupItem id="gc-new" value="new" className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">Novo contrato independente</span>
                <span className="block text-xs text-muted-foreground">
                  Usa o modelo vinculado ao serviço do catálogo, se houver.
                </span>
              </span>
            </Label>
            {active.map((c) => (
              <Label
                key={c.id}
                htmlFor={`gc-${c.id}`}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/40"
              >
                <RadioGroupItem id={`gc-${c.id}`} value={c.id} className="mt-0.5" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    Termo aditivo de: {c.title}
                  </span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {c.number ?? "—"} ·{" "}
                    {formatCurrency(Number(c.total_value ?? 0), c.currency ?? "BRL")}
                  </span>
                </span>
              </Label>
            ))}
          </RadioGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={() => void generate(choice === "new" ? null : choice)} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {choice === "new" ? "Gerar contrato" : "Gerar aditivo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
