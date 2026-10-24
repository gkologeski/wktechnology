import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { updateOffer, type OfferListRow } from "@/lib/ats/offers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IsoDatePicker } from "@/components/iso-date-picker";
export function OfferTermsEditor({ offer, onSaved }: { offer: OfferListRow; onSaved: () => void }) {
  const update = useServerFn(updateOffer);
  const [title, setTitle] = useState(offer.title),
    [body, setBody] = useState(offer.body ?? ""),
    [amount, setAmount] = useState(offer.salary_amount?.toString() ?? ""),
    [currency, setCurrency] = useState(offer.salary_currency ?? "BRL"),
    [date, setDate] = useState(offer.start_date),
    [busy, setBusy] = useState(false);
  if (!offer.can_edit_terms) return null;
  return (
    <div className="space-y-3 rounded border p-4">
      <p className="text-sm text-muted-foreground">
        Alterar as condições cria outra versão e exige nova aprovação.
      </p>
      <Label>
        Título
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} />
      </Label>
      <div className="grid grid-cols-2 gap-3">
        <Label>
          Salário
          <Input
            aria-label="Salário da oferta"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Label>
        <Label>
          Moeda
          <Input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={8} />
        </Label>
      </div>
      <Label>
        Início
        <IsoDatePicker ariaLabel="Data de início da oferta" value={date} onChange={setDate} />
      </Label>
      <Label>
        Texto da proposta
        <Textarea
          aria-label="Texto da proposta"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={50000}
        />
      </Label>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await update({
              data: {
                id: offer.id,
                revision: offer.revision,
                patch: {
                  title,
                  body,
                  salary_amount: amount === "" ? null : Number(amount),
                  salary_currency: currency,
                  start_date: date,
                },
              },
            });
            toast.success("Condições atualizadas; solicite aprovação da nova versão.");
            onSaved();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao atualizar");
          } finally {
            setBusy(false);
          }
        }}
      >
        Salvar nova versão
      </Button>
    </div>
  );
}
