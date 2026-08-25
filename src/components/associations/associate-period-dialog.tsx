import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export type AssociationPeriod = "30" | "60" | "90" | "180" | "all";

export const PERIOD_OPTIONS: { value: AssociationPeriod; label: string; days: number | null }[] = [
  { value: "30", label: "Últimos 30 dias", days: 30 },
  { value: "60", label: "Últimos 60 dias", days: 60 },
  { value: "90", label: "Últimos 90 dias", days: 90 },
  { value: "180", label: "Últimos 180 dias", days: 180 },
  { value: "all", label: "Desde sempre", days: null },
];

export const periodToDays = (p: AssociationPeriod): number | null =>
  PERIOD_OPTIONS.find((o) => o.value === p)?.days ?? null;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onConfirm: (period: AssociationPeriod) => Promise<void> | void;
  defaultValue?: AssociationPeriod;
};

export function AssociatePeriodDialog({
  open,
  onOpenChange,
  title = "Vincular registro",
  description = "Escolha quanto do histórico de atividades você deseja trazer para esta associação.",
  onConfirm,
  defaultValue = "all",
}: Props) {
  const [value, setValue] = useState<AssociationPeriod>(defaultValue);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm(value);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={value}
          onValueChange={(v) => setValue(v as AssociationPeriod)}
          className="space-y-1 py-2"
        >
          {PERIOD_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
            >
              <RadioGroupItem value={opt.value} id={`period-${opt.value}`} />
              <Label
                htmlFor={`period-${opt.value}`}
                className="text-sm font-normal cursor-pointer flex-1"
              >
                {opt.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
