import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gauge, Heart, ListChecks, Target } from "lucide-react";

export type SurveyKindTab = "csat" | "nps" | "vendas" | "livre";

const OPTIONS: Array<{
  value: SurveyKindTab;
  label: string;
  description: string;
  icon: typeof Heart;
}> = [
  {
    value: "csat",
    label: "CSAT",
    description: "Satisfação de 0 a 5, com disparo automático em tickets.",
    icon: Heart,
  },
  {
    value: "nps",
    label: "NPS",
    description: "Recomendação de 0 a 10, com faixas de detrator a promotor.",
    icon: Gauge,
  },
  {
    value: "vendas",
    label: "Vendas",
    description: "Questionários de qualificação (BANT, MEDDIC, CHAMP, GPCT) com pontuação.",
    icon: Target,
  },
  {
    value: "livre",
    label: "Livre",
    description: "Formulário aberto com os campos de pesquisa padrão.",
    icon: ListChecks,
  },
];

/** Escolha do tipo de pesquisa antes de criar. */
export function SurveyTypePickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (kind: SurveyKindTab) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova pesquisa</DialogTitle>
          <DialogDescription>Escolha o tipo de pesquisa que deseja criar.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          {OPTIONS.map((o) => (
            <Button
              key={o.value}
              variant="outline"
              className="h-auto flex-col items-start gap-1 p-3 text-left whitespace-normal"
              onClick={() => {
                onSelect(o.value);
                onOpenChange(false);
              }}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <o.icon className="h-4 w-4 text-primary" aria-hidden />
                {o.label}
              </span>
              <span className="text-xs font-normal text-muted-foreground">{o.description}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
