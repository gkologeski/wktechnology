// Dialog para criar uma nova oferta (carta-proposta) a partir do scorecard.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createOffer, sendOffer } from "@/lib/ats/offers.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidateId: string;
  candidateName: string;
  jobId?: string;
  applicationId?: string;
  defaultPromoteStage?: string;
  onCreated?: () => void;
};

export function CreateOfferDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  jobId,
  applicationId,
  defaultPromoteStage = "hired",
  onCreated,
}: Props) {
  const create = useServerFn(createOffer);
  const send = useServerFn(sendOffer);
  const [title, setTitle] = useState("Carta-proposta");
  const [salary, setSalary] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [startDate, setStartDate] = useState("");
  const [body, setBody] = useState(
    `Prezado(a) ${candidateName},\n\nTemos a satisfação de oferecer-lhe a posição em nossa empresa.\nAo aceitar esta proposta, confirma sua intenção de iniciar nas condições acima.\n\nAtenciosamente,\nEquipe de Recrutamento`,
  );
  const [busy, setBusy] = useState(false);

  const handleSave = async (sendNow: boolean) => {
    setBusy(true);
    try {
      const offer = await create({
        data: {
          candidate_id: candidateId,
          application_id: applicationId ?? null,
          job_id: jobId ?? null,
          title,
          body,
          salary_amount: salary ? Number(salary) : null,
          salary_currency: currency,
          start_date: startDate || null,
          promote_to_stage: defaultPromoteStage,
        },
      });
      if (sendNow && offer?.id) {
        await send({ data: { id: offer.id } });
        toast.success("Oferta enviada para assinatura");
      } else {
        toast.success("Oferta salva como rascunho");
      }
      onCreated?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova oferta — {candidateName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Moeda</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
            <div>
              <Label>Salário</Label>
              <Input
                type="number"
                step="0.01"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
              />
            </div>
            <div>
              <Label>Data de início</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Texto da proposta</Label>
            <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={() => handleSave(false)} disabled={busy}>
            Salvar rascunho
          </Button>
          <Button onClick={() => handleSave(true)} disabled={busy}>
            Salvar e enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
