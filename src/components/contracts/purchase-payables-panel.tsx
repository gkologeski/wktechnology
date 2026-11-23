import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IsoDatePicker } from "@/components/iso-date-picker";
import {
  generatePurchasePayables,
  getPurchasePayables,
} from "@/lib/contracts/purchase-payables.functions";
import { payablesProblem, type ProposedPayable } from "@/lib/contracts/purchase-payables";
import { usePermissions } from "@/lib/access-control/use-permissions";

const brl = (v: number, c = "BRL") => v.toLocaleString("pt-BR", { style: "currency", currency: c });
const br = (d: string) => d.slice(0, 10).split("-").reverse().join("/");

/** Contrato de compra assinado: o sistema propõe as parcelas e o Financeiro confirma. */
export function PurchasePayablesPanel({
  contract,
}: {
  contract: { id: string; role?: string | null };
}) {
  const isPurchase = contract.role === "client";
  const permissions = usePermissions();
  const canGenerate =
    !permissions.isLoading &&
    !permissions.isError &&
    ["own", "workspace"].some((s) => permissions.can(`techfinance.entries.create.${s}`));
  const get = useServerFn(getPurchasePayables);
  const generate = useServerFn(generatePurchasePayables);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["purchase-payables", contract.id],
    queryFn: () => get({ data: { contractId: contract.id } }),
    enabled: isPurchase,
  });
  const [rows, setRows] = useState<ProposedPayable[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.data) setRows(q.data.proposal);
  }, [q.data]);
  if (!isPurchase) return null;

  const body = () => {
    if (q.isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
    if (q.isError || !q.data)
      return (
        <div className="flex items-center gap-3 text-sm text-destructive">
          Não foi possível carregar as contas a pagar.
          <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
            Tentar de novo
          </Button>
        </div>
      );
    const d = q.data;
    if (d.entries.length)
      return (
        <ul className="divide-y divide-border text-sm" aria-label="Contas a pagar geradas">
          {d.entries.map((e) => (
            <li key={e.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>{e.description}</span>
              <span className="text-muted-foreground">
                {br(e.due_date)} · {brl(e.amount, e.currency)} ·{" "}
                {e.status === "paid" ? "Pago" : e.status === "open" ? "Em aberto" : e.status}
              </span>
            </li>
          ))}
        </ul>
      );
    if (!d.signed)
      return (
        <p className="text-sm text-muted-foreground">
          As contas a pagar ficam disponíveis depois que o contrato de compra for assinado.
        </p>
      );
    if (!d.total)
      return (
        <p className="text-sm text-muted-foreground">
          Informe o valor total do contrato para o sistema propor as parcelas.
        </p>
      );
    if (!canGenerate)
      return (
        <p className="text-sm text-muted-foreground">
          Contrato assinado. O Financeiro precisa revisar e gerar as contas a pagar (você não tem
          permissão para criar lançamentos financeiros).
        </p>
      );
    const problem = payablesProblem(d.total, rows);
    const sum = rows.reduce((s, r) => s + Math.round(r.amount * 100), 0) / 100;
    const set = (i: number, patch: Partial<ProposedPayable>) =>
      setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    async function run() {
      setBusy(true);
      try {
        const r = await generate({ data: { contractId: contract.id, installments: rows } });
        toast.success(
          r.duplicate
            ? "As contas a pagar já tinham sido geradas."
            : `${r.generated} conta(s) a pagar gerada(s).`,
        );
        await qc.invalidateQueries({ queryKey: ["purchase-payables", contract.id] });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível gerar as contas a pagar.");
      } finally {
        setBusy(false);
      }
    }
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Parcelas propostas a partir das condições do contrato. Revise valores e vencimentos antes
          de gerar.
        </p>
        {rows.map((r, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_10rem_11rem_auto] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor={`pp-label-${i}`}>Descrição</Label>
              <Input
                id={`pp-label-${i}`}
                value={r.label}
                maxLength={120}
                onChange={(e) => set(i, { label: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`pp-amount-${i}`}>Valor</Label>
              <Input
                id={`pp-amount-${i}`}
                inputMode="decimal"
                value={String(r.amount)}
                onChange={(e) => set(i, { amount: Number(e.target.value.replace(",", ".")) || 0 })}
              />
            </div>
            <div className="space-y-1">
              <Label>Vencimento</Label>
              <IsoDatePicker
                value={r.due_on}
                required
                aria-label={`Vencimento da parcela ${i + 1}`}
                onChange={(v) => set(i, { due_on: v ?? "" })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remover parcela ${i + 1}`}
              disabled={rows.length <= 1}
              onClick={() => setRows((x) => x.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setRows((x) => [
                ...x,
                { label: `Parcela ${x.length + 1}`, amount: 0, due_on: x.at(-1)?.due_on ?? "" },
              ])
            }
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Adicionar parcela
          </Button>
          <span className="text-sm text-muted-foreground" aria-live="polite">
            Soma {brl(sum, d.currency)} de {brl(d.total, d.currency)}
          </span>
        </div>
        {problem && <p className="text-sm text-destructive">{problem}</p>}
        <Button type="button" disabled={!!problem || busy} onClick={() => void run()}>
          <Receipt className="mr-1 h-4 w-4" aria-hidden="true" />
          {busy ? "Gerando…" : "Gerar contas a pagar"}
        </Button>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Contas a pagar</CardTitle>
      </CardHeader>
      <CardContent>{body()}</CardContent>
    </Card>
  );
}
