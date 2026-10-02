// "+ Adicionar Aditivo a partir de uma Proposta ou Cotação" (painel de aditivos).
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { createContractFromSales, listAmendmentSources } from "@/lib/sales-flow.functions";

const PROPOSAL_STATUS: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovada",
  sent: "Enviada",
  accepted: "Aceita",
};
const QUOTE_STATUS: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicada",
  sent: "Enviada",
  accepted: "Aceita",
};

export function AmendmentFromSalesButton({ contractId }: { contractId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
        Adicionar Aditivo a partir de uma Proposta ou Cotação
      </Button>
      {open ? <SourcesDialog contractId={contractId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function SourcesDialog({ contractId, onClose }: { contractId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const list = useServerFn(listAmendmentSources);
  const create = useServerFn(createContractFromSales);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["amendment-sources", contractId],
    queryFn: () => list({ data: { contractId } }),
  });

  async function submit() {
    const [kind, id] = choice.split(":");
    if (!id) return;
    setBusy(true);
    try {
      const r = await create({
        data: {
          ...(kind === "p" ? { proposalId: id } : { quoteId: id }),
          mainContractId: contractId,
        },
      });
      toast.success(r.reused ? "Este documento já gerou um contrato." : "Aditivo gerado.");
      onClose();
      void navigate({ to: "/contracts/$id", params: { id: r.contract.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const data = q.data;
  const empty = data && data.proposals.length === 0 && data.quotes.length === 0;

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo aditivo a partir de proposta ou cotação</DialogTitle>
          <DialogDescription>
            Mostra as propostas e cotações da mesma empresa que ainda não geraram contrato.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {q.isLoading ? (
            <div className="flex justify-center py-8" role="status" aria-label="Carregando">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : q.isError ? (
            <div className="space-y-2 py-6 text-center text-sm">
              <p className="text-destructive">{(q.error as Error).message}</p>
              <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : data && !data.hasCompany ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Defina a empresa contratante deste contrato para buscar propostas e cotações.
            </p>
          ) : empty ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma proposta ou cotação disponível para esta empresa.
            </p>
          ) : (
            <RadioGroup value={choice} onValueChange={setChoice} className="space-y-2">
              {data?.proposals.map((p) => (
                <Option
                  key={p.id}
                  value={`p:${p.id}`}
                  kind="Proposta"
                  title={p.title}
                  status={PROPOSAL_STATUS[p.status] ?? p.status}
                  amount={formatCurrency(Number(p.total_amount ?? 0), p.currency ?? "BRL")}
                />
              ))}
              {data?.quotes.map((x) => (
                <Option
                  key={x.id}
                  value={`q:${x.id}`}
                  kind="Cotação"
                  title={x.title || x.number || "Cotação"}
                  status={QUOTE_STATUS[x.status] ?? x.status}
                  amount={formatCurrency(Number(x.total ?? 0), x.currency ?? "BRL")}
                />
              ))}
            </RadioGroup>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={!choice || busy}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Gerar aditivo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Option(props: { value: string; kind: string; title: string; status: string; amount: string }) {
  const id = `src-${props.value}`;
  return (
    <Label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/40"
    >
      <RadioGroupItem id={id} value={props.value} className="mt-0.5" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <Badge variant="outline">{props.kind}</Badge>
          <span className="text-xs text-muted-foreground">{props.status}</span>
        </span>
        <span className="mt-1 block truncate text-sm font-medium">{props.title}</span>
      </span>
      <span className="whitespace-nowrap text-sm tabular-nums">{props.amount}</span>
    </Label>
  );
}
