// Dialog para criar uma nova oferta (carta-proposta) a partir do scorecard.
import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/lib/access-control/use-permissions";
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
import { createOffer, reviewOffer, canCreateOffer } from "@/lib/ats/offers.functions";

import { IsoDatePicker } from "@/components/iso-date-picker";
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
  const check = useServerFn(canCreateOffer);
  const permissions = usePermissions();
  const access = useQuery({
    queryKey: [
      "offer-create",
      permissions.workspaceId,
      [...permissions.permissions].sort(),
      candidateId,
      jobId,
      applicationId,
    ],
    queryFn: () =>
      check({ data: { candidate_id: candidateId, job_id: jobId, application_id: applicationId } }),
    enabled: open && !permissions.isLoading && !permissions.isError && !!permissions.workspaceId,
    staleTime: 0,
  });
  const send = useServerFn(reviewOffer);
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
        await send({ data: { id: offer.id, revision: offer.revision, action: "request" } });
        toast.success("Oferta salva e encaminhada para aprovação");
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
        {access.data === true && !access.isError ? (
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
                <IsoDatePicker
                  ariaLabel="Data de início"
                  value={startDate}
                  onChange={(v) => setStartDate(v ?? "")}
                />
              </div>
            </div>
            <div>
              <Label>Texto da proposta</Label>
              <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
          </div>
        ) : (
          <p role="status">
            {access.isLoading
              ? "Verificando acesso…"
              : "Sem permissão para elaborar as condições desta oferta."}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSave(false)}
            disabled={busy || access.data !== true || access.isError}
          >
            Salvar rascunho
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={busy || access.data !== true || access.isError}
          >
            Salvar e solicitar aprovação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
