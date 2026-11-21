import { listBankReferences as listBankAccounts } from "@/lib/finance-references.functions";
import { useEffect, useState, useRef } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/crm";
import { registerPayment } from "@/lib/finance.functions";

import { IsoDatePicker } from "@/components/iso-date-picker";
import { formatIsoDate } from "@/lib/iso-date";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useFinanceCapabilities } from "@/lib/access-control/use-finance-capabilities";
import { readViewAs } from "@/lib/view-as-client";
type EntryLike = {
  id: string;
  amount: number;
  paid_amount: number | null;
  currency: string;
  description: string;
  direction: "receivable" | "payable";
};

const today = () => formatIsoDate(new Date());

type Props = {
  entry: EntryLike | null;
  onOpenChange: (o: boolean) => void;
  onDone?: () => void;
  revalidating?: boolean;
  blocked?: boolean;
};
export function RegisterPaymentDialog(props: Props) {
  const { user } = useAuth();
  const p = usePermissions();
  if (!user || !p.workspaceId || p.isLoading || p.isError) return null;
  return (
    <PaymentDialogContent
      key={`${user.id}:${p.workspaceId}:${props.entry?.id ?? "closed"}`}
      {...props}
    />
  );
}
function PaymentDialogContent({
  entry,
  onOpenChange,
  onDone,
  revalidating = false,
  blocked = false,
}: Props) {
  const access = useFinanceCapabilities(entry ? [entry.id] : []);
  const authorizing = revalidating || access.isFetching || !access.isFetchedAfterMount;
  const allowed =
    !!entry && !access.isError && access.for(entry.id).can_pay && !readViewAs()?.readOnly;
  const canWrite = allowed && !authorizing && !blocked;
  const register = useServerFn(registerPayment);
  const listBanks = useServerFn(listBankAccounts);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(today());
  const [method, setMethod] = useState<string>("pix");
  const [bankAccountId, setBankAccountId] = useState<string>("none");
  const [banks, setBanks] = useState<Awaited<ReturnType<typeof listBankAccounts>>>([]);

  const open = !!entry;
  const outstanding = entry ? Number(entry.amount) - Number(entry.paid_amount ?? 0) : 0;

  const initialized = useRef(false);
  useEffect(() => {
    if (!open) initialized.current = false;
    if (!open || !entry || !canWrite || initialized.current) return;
    initialized.current = true;
    setAmount(outstanding.toFixed(2).replace(".", ","));
    setPaidAt(today());
    setMethod("pix");
    setBankAccountId("none");
    listBanks()
      .then(setBanks)
      .catch(() => setBanks([]));
  }, [open, entry, outstanding, listBanks, canWrite]);

  async function submit() {
    if (!entry || !canWrite) return;
    const amt = Number(String(amount).replace(",", "."));
    if (!amt || amt <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (amt > outstanding + 0.001) {
      toast.error("Valor maior que o saldo em aberto.");
      return;
    }
    setSaving(true);
    try {
      await register({
        data: {
          entry_id: entry.id,
          amount: amt,
          paid_at: paidAt,
          method,
          bank_account_id: bankAccountId === "none" ? null : bankAccountId,
        },
      });
      toast.success(
        entry.direction === "receivable" ? "Recebimento registrado" : "Pagamento registrado",
      );
      onDone?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao registrar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {authorizing
              ? "Conferindo acesso à baixa…"
              : blocked
                ? "Confira o lançamento atualizado"
                : entry?.direction === "receivable"
                  ? "Registrar recebimento"
                  : "Registrar pagamento"}
          </DialogTitle>
        </DialogHeader>
        {!authorizing && (!allowed || blocked) && (
          <p role="alert">
            Saldo, situação ou permissão mudaram. Feche e confira o lançamento antes de abrir uma
            nova baixa.
          </p>
        )}
        <fieldset
          className="contents"
          disabled={!canWrite}
          hidden={!canWrite}
          inert={!canWrite || undefined}
          style={!canWrite ? { display: "none" } : undefined}
        >
          {entry && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="font-medium">{entry.description}</div>
                <div className="text-muted-foreground text-xs mt-1">
                  Em aberto:{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatCurrency(outstanding, entry.currency)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data</Label>
                  <IsoDatePicker
                    ariaLabel="Data"
                    value={paidAt}
                    onChange={(v) => setPaidAt(v ?? "")}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Método</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="credit_card">Cartão</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Conta bancária</Label>
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não vincular</SelectItem>
                    {banks.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
}
