// Tratar alerta: reconhecer, adiar, resolver ou reabrir, sempre com justificativa. Não altera a origem.
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { ALERT_RULE_LABEL, ALERT_STATUS_LABEL } from "@/lib/projects/dashboard-views.shared";
import { alertEvidenceText } from "./drill-columns";

import { IsoDatePicker } from "@/components/iso-date-picker";
export type AlertAction = "ack" | "snooze" | "resolve" | "reopen";

const ACTION_LABEL: Record<AlertAction, string> = {
  ack: "Reconhecer (ciente, sem corrigir a causa)",
  snooze: "Adiar até uma data",
  resolve: "Resolver manualmente",
  reopen: "Reabrir",
};

function actionsFor(status: string): AlertAction[] {
  if (status === "resolved") return ["reopen"];
  if (status === "acknowledged") return ["snooze", "resolve", "reopen"];
  if (status === "snoozed") return ["ack", "resolve", "reopen"];
  return ["ack", "snooze", "resolve"];
}

export function AlertActDialog({
  alert,
  onClose,
  onSubmit,
  pending,
  today,
}: {
  alert: Record<string, unknown> | null;
  onClose: () => void;
  onSubmit: (v: { action: AlertAction; note: string; until: string | null }) => void;
  pending: boolean;
  today: string;
}) {
  const status = String(alert?.status ?? "open");
  const options = actionsFor(status);
  const [action, setAction] = useState<AlertAction>(options[0]);
  const [note, setNote] = useState("");
  const [until, setUntil] = useState("");
  const noteOk = note.trim().length >= 5;
  const untilOk = action !== "snooze" || (until > today && until.length === 10);
  return (
    <Dialog open={!!alert} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Tratar alerta:{" "}
            {ALERT_RULE_LABEL[String(alert?.rule_key)] ?? String(alert?.rule_key ?? "")}
          </DialogTitle>
          <DialogDescription>
            {alert ? alertEvidenceText(alert) : null} Situação atual:{" "}
            {ALERT_STATUS_LABEL[status] ?? status}. Tratar o alerta não altera apontamentos,
            projetos nem negócios; se a causa continuar, ele volta na próxima avaliação.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (noteOk && untilOk)
              onSubmit({ action, note: note.trim(), until: action === "snooze" ? until : null });
          }}
        >
          <RadioGroup
            value={action}
            onValueChange={(v) => setAction(v as AlertAction)}
            aria-label="Ação"
          >
            {options.map((o) => (
              <div key={o} className="flex items-center gap-2">
                <RadioGroupItem value={o} id={`alert-act-${o}`} />
                <Label htmlFor={`alert-act-${o}`}>{ACTION_LABEL[o]}</Label>
              </div>
            ))}
          </RadioGroup>
          {action === "snooze" ? (
            <div className="space-y-1.5">
              <Label htmlFor="alert-until">Adiar até</Label>
              <IsoDatePicker
                id="alert-until"
                min={today}
                value={until}
                onChange={(v) => setUntil(v ?? "")}
                required
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="alert-note">Justificativa</Label>
            <Textarea
              id="alert-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Explique a decisão (mínimo 5 caracteres)."
              maxLength={1000}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !noteOk || !untilOk}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
